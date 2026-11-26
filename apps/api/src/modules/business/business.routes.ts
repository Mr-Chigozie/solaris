import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import {
  businessProfileSchema,
  productInputSchema,
  productUpdateSchema,
  serviceInputSchema,
  serviceUpdateSchema,
  stockUpdateSchema,
  type BusinessProfileDto,
  type ProductInputDto,
} from '@solaris/validation';
import { memberHasPermission, requireAuth, requireOrgPermission, requireOrgRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { productOut, serviceOut } from '../marketplace/serializers';

/**
 * Business workspace — everything a vendor/installer manages about their own
 * storefront. Every route is scoped to :orgId and checked against the caller's
 * membership and staff permissions in THAT business.
 */
export const businessRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orgId = (req: Request) => {
  const v = req.params.orgId;
  return typeof v === 'string' && UUID_RE.test(v) ? v : undefined;
};
const paramId = (req: Request, name: string) => {
  const v = req.params[name];
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw AppError.notFound();
  return v;
};
const slugify = (s: string) =>
  `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item'}-${randomUUID().slice(0, 5)}`;

const base = '/organizations/:orgId';
const member = [requireAuth, requireOrgRole(orgId)];

/* ─────────────────────────── workspace overview */

businessRouter.get(`${base}/workspace`, ...member, async (req, res) => {
  const id = orgId(req)!;
  const [org, membership, products, services, openThreads] = await Promise.all([
    prisma.organization.findUnique({ where: { id }, include: { subscription: { select: { plan: true, status: true } } } }),
    prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: req.auth!.userId, organizationId: id } }, select: { role: true, permissions: true } }),
    prisma.product.groupBy({ by: ['status'], where: { organizationId: id, deletedAt: null }, _count: true }),
    prisma.service.groupBy({ by: ['status'], where: { organizationId: id, deletedAt: null }, _count: true }),
    prisma.conversation.count({ where: { organizationId: id } }),
  ]);
  if (!org || !membership) throw AppError.notFound();
  const count = (rows: Array<{ status: string; _count: number }>, s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  const permissions = ['MANAGE_PROFILE', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'MANAGE_SERVICES', 'MESSAGE_CUSTOMERS'] as const;
  ok(res, {
    organization: org,
    role: membership.role,
    can: Object.fromEntries(permissions.map((p) => [p, memberHasPermission(membership, p)])),
    publiclyVisible: org.verification === 'VERIFIED' && !org.hiddenAt,
    counts: {
      productsPublished: count(products, 'PUBLISHED'),
      productsDraft: count(products, 'DRAFT'),
      servicesPublished: count(services, 'PUBLISHED'),
      servicesDraft: count(services, 'DRAFT'),
      conversations: openThreads,
    },
  });
});

/* ─────────────────────────── profile / storefront */

businessRouter.patch(`${base}/profile`, requireAuth, requireOrgPermission(orgId, 'MANAGE_PROFILE'), validateBody(businessProfileSchema), async (req, res) => {
  const dto = req.body as BusinessProfileDto;
  const data = {
    ...dto,
    ...(dto.website === '' ? { website: null } : {}),
    ...(dto.logoUrl === '' ? { logoUrl: null } : {}),
    ...(dto.coverUrl === '' ? { coverUrl: null } : {}),
    ...(dto.email === '' ? { email: null } : {}),
  };
  const org = await prisma.organization.update({ where: { id: orgId(req)! }, data });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'org.profile_updated', entityType: 'Organization', entityId: org.id, metadata: { fields: Object.keys(dto) } } });
  ok(res, org);
});

/* ─────────────────────────── products */

businessRouter.get(`${base}/products`, ...member, async (req, res) => {
  const items = await prisma.product.findMany({
    where: { organizationId: orgId(req)!, deletedAt: null, status: { not: 'ARCHIVED' } },
    orderBy: { updatedAt: 'desc' },
  });
  ok(res, items.map(productOut));
});

businessRouter.get(`${base}/products/:productId`, ...member, async (req, res) => {
  const p = await prisma.product.findFirst({ where: { id: paramId(req, 'productId'), organizationId: orgId(req)!, deletedAt: null } });
  if (!p) throw AppError.notFound('Product not found');
  ok(res, productOut(p));
});

businessRouter.post(`${base}/products`, requireAuth, requireOrgPermission(orgId, 'MANAGE_PRODUCTS'), validateBody(productInputSchema), async (req, res) => {
  const dto = req.body as ProductInputDto;
  const p = await prisma.product.create({
    data: { ...dto, price: dto.price ?? null, organizationId: orgId(req)!, slug: slugify(dto.name) },
  });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'product.create', entityType: 'Product', entityId: p.id, metadata: { status: p.status } } });
  ok(res, productOut(p), 201);
});

businessRouter.patch(`${base}/products/:productId`, requireAuth, requireOrgPermission(orgId, 'MANAGE_PRODUCTS'), validateBody(productUpdateSchema), async (req, res) => {
  const id = paramId(req, 'productId');
  const existing = await prisma.product.findFirst({ where: { id, organizationId: orgId(req)!, deletedAt: null }, select: { status: true } });
  if (!existing) throw AppError.notFound('Product not found');
  const p = await prisma.product.update({ where: { id }, data: req.body });
  if (req.body.status && req.body.status !== existing.status) {
    await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'product.status_changed', entityType: 'Product', entityId: id, metadata: { from: existing.status, to: p.status } } });
  }
  ok(res, productOut(p));
});

/** Stock-only update — lets warehouse staff with MANAGE_INVENTORY adjust quantities without editing listings. */
businessRouter.patch(`${base}/products/:productId/stock`, requireAuth, requireOrgPermission(orgId, 'MANAGE_INVENTORY'), validateBody(stockUpdateSchema), async (req, res) => {
  const id = paramId(req, 'productId');
  const { count } = await prisma.product.updateMany({ where: { id, organizationId: orgId(req)!, deletedAt: null }, data: { stockQuantity: req.body.stockQuantity } });
  if (count === 0) throw AppError.notFound('Product not found');
  ok(res, { id, stockQuantity: req.body.stockQuantity });
});

businessRouter.delete(`${base}/products/:productId`, requireAuth, requireOrgPermission(orgId, 'MANAGE_PRODUCTS'), async (req, res) => {
  const id = paramId(req, 'productId');
  const { count } = await prisma.product.updateMany({ where: { id, organizationId: orgId(req)!, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
  if (count === 0) throw AppError.notFound('Product not found');
  ok(res, { id, archived: true });
});

/* ─────────────────────────── services */

businessRouter.get(`${base}/services`, ...member, async (req, res) => {
  const items = await prisma.service.findMany({ where: { organizationId: orgId(req)!, deletedAt: null, status: { not: 'ARCHIVED' } }, orderBy: { updatedAt: 'desc' } });
  ok(res, items.map(serviceOut));
});

businessRouter.post(`${base}/services`, requireAuth, requireOrgPermission(orgId, 'MANAGE_SERVICES'), validateBody(serviceInputSchema), async (req, res) => {
  const s = await prisma.service.create({ data: { ...req.body, price: req.body.priceType === 'ON_QUOTE' ? null : req.body.price, organizationId: orgId(req)! } });
  await prisma.auditLog.create({ data: { actorId: req.auth!.userId, action: 'service.create', entityType: 'Service', entityId: s.id } });
  ok(res, serviceOut(s), 201);
});

businessRouter.patch(`${base}/services/:serviceId`, requireAuth, requireOrgPermission(orgId, 'MANAGE_SERVICES'), validateBody(serviceUpdateSchema), async (req, res) => {
  const id = paramId(req, 'serviceId');
  const existing = await prisma.service.findFirst({ where: { id, organizationId: orgId(req)!, deletedAt: null } });
  if (!existing) throw AppError.notFound('Service not found');
  const next = { ...req.body };
  if ((next.priceType ?? existing.priceType) === 'ON_QUOTE') next.price = null;
  else if ((next.price ?? existing.price) === null) throw AppError.badRequest('Enter a price, or choose "price on quote"');
  ok(res, serviceOut(await prisma.service.update({ where: { id }, data: next })));
});

businessRouter.delete(`${base}/services/:serviceId`, requireAuth, requireOrgPermission(orgId, 'MANAGE_SERVICES'), async (req, res) => {
  const id = paramId(req, 'serviceId');
  const { count } = await prisma.service.updateMany({ where: { id, organizationId: orgId(req)!, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
  if (count === 0) throw AppError.notFound('Service not found');
  ok(res, { id, archived: true });
});
