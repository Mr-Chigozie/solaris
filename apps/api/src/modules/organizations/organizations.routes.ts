import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { createOrganizationSchema, type CreateOrganizationDto } from '@solaris/validation';
import type { UserRole } from '../../generated/prisma/enums';
import { requireAuth, requireOrgRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';

export const organizationsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orgIdParam = (req: { params: Record<string, string | string[] | undefined> }) => {
  const id = req.params.orgId;
  return typeof id === 'string' && UUID_RE.test(id) ? id : undefined;
};

export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'business';
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/**
 * Open a business. A person stays a customer and becomes OWNER of the new
 * organisation — the same account can buy, sell and install.
 */
organizationsRouter.post('/organizations', requireAuth, validateBody(createOrganizationSchema), async (req, res) => {
  const dto = req.body as CreateOrganizationDto;
  const userId = req.auth!.userId;

  const owned = await prisma.organizationMember.count({ where: { userId, role: 'OWNER' } });
  if (owned >= 5) throw AppError.conflict('You can own at most 5 businesses. Contact support to raise this limit.');

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        ...dto,
        serviceStates: dto.serviceStates ?? (dto.state ? [dto.state] : []),
        slug: slugify(dto.name),
        verification: 'PENDING',
        memberships: { create: { userId, role: 'OWNER' } },
        subscription: { create: { plan: 'FREE' } },
      },
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true } });
    const addRoles = dto.types.filter((t) => !user.roles.includes(t as UserRole)) as UserRole[];
    if (addRoles.length) await tx.user.update({ where: { id: userId }, data: { roles: { push: addRoles } } });
    await tx.auditLog.create({ data: { actorId: userId, action: 'org.create', entityType: 'Organization', entityId: created.id, ip: req.ip } });
    return created;
  });

  ok(res, org, 201);
});

/** Businesses the caller belongs to, with their role and permissions in each. */
organizationsRouter.get('/organizations/mine', requireAuth, async (req, res) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.auth!.userId },
    select: { role: true, permissions: true, title: true, organization: true },
  });
  ok(res, memberships);
});

/** Organisation workspace detail — members of *this* organisation only. */
organizationsRouter.get('/organizations/:orgId', requireAuth, requireOrgRole(orgIdParam), async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgIdParam(req)! },
    include: {
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      memberships: { select: { role: true, permissions: true, title: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
    },
  });
  if (!org) throw AppError.notFound();
  ok(res, org);
});
