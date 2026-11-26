import { Router, type Request } from 'express';
import {
  adminTeamInviteSchema,
  adminTeamUpdateSchema,
  applianceAdminSchema,
  applianceAdminUpdateSchema,
  curationSchema,
  paginationSchema,
  SETTING_EDITOR_ROLE,
  SITE_SETTING_KEYS,
  verificationDecisionSchema,
  z,
} from '@solaris/validation';
import type { AdminRole } from '../../generated/prisma/enums';
import { adminHasRole, requireAdmin, requireAuth } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import {
  assertSettingKey,
  getAllSettings,
  listRevisions,
  resetSetting,
  restoreRevision,
  updateSetting,
} from '../settings/settings.service';

export const adminRouter = Router();
adminRouter.use('/admin', requireAuth, requireAdmin());

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidParam(req: Request, name: string) {
  const v = req.params[name];
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw AppError.notFound();
  return v;
}
const audit = (req: Request, action: string, entityType: string, entityId: string, metadata?: object) =>
  prisma.auditLog.create({ data: { actorId: req.auth!.userId, action, entityType, entityId, metadata, ip: req.ip } });

/* ═══════════════════════════════════════════════════ overview (any admin) */

adminRouter.get('/admin/overview', async (_req, res) => {
  const [users, organizations, pendingVerifications, designs, featured, hidden] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { verification: 'PENDING', deletedAt: null } }),
    prisma.solarDesign.count(),
    prisma.organization.count({ where: { isFeatured: true, deletedAt: null } }),
    prisma.organization.count({ where: { hiddenAt: { not: null }, deletedAt: null } }),
  ]);
  ok(res, { users, organizations, pendingVerifications, designs, featured, hidden });
});

/* ═══════════════════════════════════════ business verification (OPERATIONS) */

const orgListQuery = paginationSchema.extend({
  verification: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
  type: z.enum(['INSTALLER', 'VENDOR', 'ENERGY_COMPANY']).optional(),
  q: z.string().trim().max(80).optional(),
});

adminRouter.get('/admin/organizations', requireAdmin('OPERATIONS', 'MARKETPLACE_CURATOR'), async (req, res) => {
  const { page, pageSize, verification, type, q } = parseQuery(orgListQuery, req);
  const where = {
    deletedAt: null,
    ...(verification ? { verification } : {}),
    ...(type ? { types: { has: type } } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: [{ isPlatformOwned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { memberships: { where: { role: 'OWNER' }, select: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } } },
    }),
    prisma.organization.count({ where }),
  ]);
  ok(res, items, 200, { page, pageSize, total });
});

adminRouter.patch('/admin/organizations/:id/verification', requireAdmin('OPERATIONS'), validateBody(verificationDecisionSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const { status, note } = req.body as z.infer<typeof verificationDecisionSchema>;
  const existing = await prisma.organization.findUnique({ where: { id }, select: { verification: true, isPlatformOwned: true } });
  if (!existing) throw AppError.notFound('Organisation not found');
  if (existing.isPlatformOwned && status !== 'VERIFIED') throw AppError.conflict('The SOLARIS platform business cannot be suspended or rejected.');

  const updated = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id },
      data: { verification: status, verificationNote: note, verifiedAt: status === 'VERIFIED' ? new Date() : null },
    });
    await tx.auditLog.create({
      data: { actorId: req.auth!.userId, action: 'org.verification_changed', entityType: 'Organization', entityId: id, metadata: { from: existing.verification, to: status, note }, ip: req.ip },
    });
    return org;
  });
  ok(res, updated);
});

/* ═══════════════════════════════════════ marketplace curation (CURATOR) */

function curationData(body: z.infer<typeof curationSchema>) {
  return {
    ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
    ...(body.hidden !== undefined ? { hiddenAt: body.hidden ? new Date() : null, hiddenReason: body.hidden ? (body.hiddenReason ?? null) : null } : {}),
  };
}

adminRouter.patch('/admin/organizations/:id/curation', requireAdmin('MARKETPLACE_CURATOR'), validateBody(curationSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const org = await prisma.organization.update({ where: { id }, data: curationData(req.body) }).catch(() => {
    throw AppError.notFound('Organisation not found');
  });
  await audit(req, 'org.curation_changed', 'Organization', id, req.body);
  ok(res, org);
});

adminRouter.patch('/admin/products/:id/curation', requireAdmin('MARKETPLACE_CURATOR'), validateBody(curationSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const product = await prisma.product.update({ where: { id }, data: curationData(req.body) }).catch(() => {
    throw AppError.notFound('Product not found');
  });
  await audit(req, 'product.curation_changed', 'Product', id, req.body);
  ok(res, product);
});

adminRouter.patch('/admin/services/:id/curation', requireAdmin('MARKETPLACE_CURATOR'), validateBody(curationSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const service = await prisma.service.update({ where: { id }, data: curationData(req.body) }).catch(() => {
    throw AppError.notFound('Service not found');
  });
  await audit(req, 'service.curation_changed', 'Service', id, req.body);
  ok(res, service);
});

/* ═══════════════════════════════════════ appliance catalogue (CURATOR) */

const num = (v: unknown) => Number(v);
const applianceOut = (a: { defaultWatts: unknown; surgeFactor: unknown; typicalHoursPerDay: unknown; typicalNightFraction: unknown }) => ({
  ...a,
  defaultWatts: num(a.defaultWatts),
  surgeFactor: num(a.surgeFactor),
  typicalHoursPerDay: num(a.typicalHoursPerDay),
  typicalNightFraction: num(a.typicalNightFraction),
});

adminRouter.get('/admin/appliances', requireAdmin('MARKETPLACE_CURATOR'), async (_req, res) => {
  const items = await prisma.appliance.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  ok(res, items.map(applianceOut));
});

adminRouter.post('/admin/appliances', requireAdmin('MARKETPLACE_CURATOR'), validateBody(applianceAdminSchema), async (req, res) => {
  const body = req.body as z.infer<typeof applianceAdminSchema>;
  if (await prisma.appliance.findUnique({ where: { id: body.id } })) throw AppError.conflict('An appliance with this id already exists');
  const created = await prisma.appliance.create({ data: { ...body, note: body.note ?? null } });
  await audit(req, 'appliance.create', 'Appliance', created.id);
  ok(res, applianceOut(created), 201);
});

adminRouter.patch('/admin/appliances/:id', requireAdmin('MARKETPLACE_CURATOR'), validateBody(applianceAdminUpdateSchema), async (req, res) => {
  const id = String(req.params.id);
  const updated = await prisma.appliance.update({ where: { id }, data: req.body }).catch(() => {
    throw AppError.notFound('Appliance not found');
  });
  await audit(req, 'appliance.update', 'Appliance', id, req.body);
  ok(res, applianceOut(updated));
});

/* ═══════════════════════════════════════ site settings (role per key) */

/** Which settings the caller may edit — drives the admin UI. */
adminRouter.get('/admin/settings', async (req, res) => {
  const values = await getAllSettings();
  const rows = await prisma.siteSetting.findMany({ select: { key: true, version: true, updatedAt: true } });
  const adminRoles = req.auth!.adminRoles ?? [];
  ok(
    res,
    SITE_SETTING_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        value: values[key],
        version: row?.version ?? 0,
        updatedAt: row?.updatedAt ?? null,
        editorRole: SETTING_EDITOR_ROLE[key],
        canEdit: adminHasRole(adminRoles, [SETTING_EDITOR_ROLE[key] as AdminRole]),
      };
    }),
  );
});

function assertCanEdit(req: Request, key: string) {
  assertSettingKey(key);
  if (!adminHasRole(req.auth!.adminRoles ?? [], [SETTING_EDITOR_ROLE[key] as AdminRole])) {
    throw AppError.forbidden(`Editing "${key}" requires the ${SETTING_EDITOR_ROLE[key]} admin role`);
  }
  return key;
}

const settingUpdateSchema = z.object({ value: z.unknown(), note: z.string().trim().max(200).optional() });

adminRouter.put('/admin/settings/:key', validateBody(settingUpdateSchema), async (req, res) => {
  const key = assertCanEdit(req, String(req.params.key));
  ok(res, await updateSetting(key, req.body.value, req.auth!.userId, req.body.note, req.ip));
});

adminRouter.get('/admin/settings/:key/revisions', async (req, res) => {
  const key = String(req.params.key);
  assertSettingKey(key);
  ok(res, await listRevisions(key));
});

adminRouter.post('/admin/settings/:key/revisions/:revisionId/restore', async (req, res) => {
  const key = assertCanEdit(req, String(req.params.key));
  ok(res, await restoreRevision(key, uuidParam(req, 'revisionId'), req.auth!.userId, req.ip));
});

adminRouter.post('/admin/settings/:key/reset', async (req, res) => {
  const key = assertCanEdit(req, String(req.params.key));
  ok(res, await resetSetting(key, req.auth!.userId, req.ip));
});

/* ═══════════════════════════════════════ admin team (SUPER_ADMIN) */

const teamSelect = { id: true, email: true, firstName: true, lastName: true, adminRoles: true, lastLoginAt: true } as const;

adminRouter.get('/admin/team', requireAdmin('SUPER_ADMIN'), async (_req, res) => {
  ok(res, await prisma.user.findMany({ where: { roles: { has: 'ADMIN' }, deletedAt: null }, select: teamSelect, orderBy: { createdAt: 'asc' } }));
});

/** Grant admin access to an existing account (people sign up first, then are promoted). */
adminRouter.post('/admin/team', requireAdmin('SUPER_ADMIN'), validateBody(adminTeamInviteSchema), async (req, res) => {
  const { email, adminRoles } = req.body as z.infer<typeof adminTeamInviteSchema>;
  if (adminRoles.length === 0) throw AppError.badRequest('Choose at least one admin role');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, roles: true } });
  if (!user) throw AppError.notFound('No account with that email — ask them to sign up first');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { roles: user.roles.includes('ADMIN') ? undefined : { push: 'ADMIN' }, adminRoles },
    select: teamSelect,
  });
  await audit(req, 'admin.granted', 'User', user.id, { adminRoles });
  ok(res, updated, 201);
});

async function assertNotLastSuperAdmin(userId: string, nextRoles: AdminRole[] | null) {
  if (nextRoles?.includes('SUPER_ADMIN')) return;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { adminRoles: true } });
  if (!target?.adminRoles.includes('SUPER_ADMIN')) return;
  const supers = await prisma.user.count({ where: { roles: { has: 'ADMIN' }, adminRoles: { has: 'SUPER_ADMIN' }, deletedAt: null, isActive: true } });
  if (supers <= 1) throw AppError.conflict('There must always be at least one super admin.');
}

adminRouter.patch('/admin/team/:userId', requireAdmin('SUPER_ADMIN'), validateBody(adminTeamUpdateSchema), async (req, res) => {
  const userId = uuidParam(req, 'userId');
  const { adminRoles } = req.body as z.infer<typeof adminTeamUpdateSchema>;
  if (adminRoles.length === 0) throw AppError.badRequest('Use "remove" to revoke admin access');
  await assertNotLastSuperAdmin(userId, adminRoles);
  const updated = await prisma.user.update({ where: { id: userId }, data: { adminRoles }, select: teamSelect });
  await audit(req, 'admin.roles_changed', 'User', userId, { adminRoles });
  ok(res, updated);
});

adminRouter.delete('/admin/team/:userId', requireAdmin('SUPER_ADMIN'), async (req, res) => {
  const userId = uuidParam(req, 'userId');
  await assertNotLastSuperAdmin(userId, null);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roles: true } });
  if (!user) throw AppError.notFound();
  await prisma.user.update({ where: { id: userId }, data: { roles: user.roles.filter((r) => r !== 'ADMIN'), adminRoles: [] } });
  await audit(req, 'admin.revoked', 'User', userId);
  ok(res, { id: userId, revoked: true });
});

/* ═══════════════════════════════════════ audit log (SUPER_ADMIN, OPERATIONS) */

const auditQuery = paginationSchema.extend({ action: z.string().trim().max(60).optional() });

adminRouter.get('/admin/audit-logs', requireAdmin('OPERATIONS'), async (req, res) => {
  const { page, pageSize, action } = parseQuery(auditQuery, req);
  const where = action ? { action: { startsWith: action } } : {};
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true, firstName: true, lastName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  ok(res, items, 200, { page, pageSize, total });
});
