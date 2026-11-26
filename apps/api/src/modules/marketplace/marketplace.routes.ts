import { Router } from 'express';
import { businessSearchSchema, productSearchSchema, serviceSearchSchema } from '@solaris/validation';
import type { Prisma } from '../../generated/prisma/client';
import { parseQuery } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { requireFeature } from '../settings/site.routes';
import { orgCardOut, productOut, publicOrgSelect, serviceOut } from './serializers';

/**
 * Public marketplace. Trust rule: only VERIFIED, non-hidden businesses appear,
 * and only their PUBLISHED, non-hidden listings. SOLARIS's own store follows the
 * same rule (it is seeded as verified).
 */
export const marketplaceRouter = Router();

const visibleOrg = (state?: string): Prisma.OrganizationWhereInput => ({
  verification: 'VERIFIED',
  hiddenAt: null,
  deletedAt: null,
  ...(state ? { OR: [{ state }, { serviceStates: { has: state } }] } : {}),
});

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });

const featuredFirst = [{ isFeatured: 'desc' as const }, { promotedUntil: { sort: 'desc' as const, nulls: 'last' as const } }];

/* ─────────────────────────── products */

marketplaceRouter.get('/marketplace/products', requireFeature('marketplace'), async (req, res) => {
  const f = parseQuery(productSearchSchema, req);
  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    hiddenAt: null,
    organization: { ...visibleOrg(f.state), ...(f.seller ? { slug: f.seller } : {}) },
    ...(f.category ? { category: f.category } : {}),
    ...(f.minPrice !== undefined || f.maxPrice !== undefined ? { price: { ...(f.minPrice !== undefined ? { gte: f.minPrice } : {}), ...(f.maxPrice !== undefined ? { lte: f.maxPrice } : {}) } } : {}),
    // Independent OR-groups must be ANDed, or one would overwrite the other.
    AND: [
      ...(f.q ? [{ OR: [{ name: contains(f.q) }, { brand: contains(f.q) }, { model: contains(f.q) }, { description: contains(f.q) }] }] : []),
      ...(f.inStock === 'true' ? [{ OR: [{ trackInventory: false }, { stockQuantity: { gt: 0 } }] }] : []),
    ],
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    f.sort === 'price_asc' ? [{ price: { sort: 'asc', nulls: 'last' } }]
    : f.sort === 'price_desc' ? [{ price: { sort: 'desc', nulls: 'last' } }]
    : f.sort === 'newest' ? [{ createdAt: 'desc' }]
    : [...featuredFirst, { createdAt: 'desc' }];

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true, slug: true, name: true, category: true, brand: true, model: true, price: true, currency: true,
        images: true, stockQuantity: true, trackInventory: true, isFeatured: true, specifications: true,
        organization: { select: publicOrgSelect },
      },
    }),
    prisma.product.count({ where }),
  ]);
  ok(res, items.map((p) => ({ ...productOut(p), organization: orgCardOut(p.organization) })), 200, { page: f.page, pageSize: f.pageSize, total });
});

marketplaceRouter.get('/marketplace/products/:orgSlug/:productSlug', requireFeature('marketplace'), async (req, res) => {
  const p = await prisma.product.findFirst({
    where: {
      slug: String(req.params.productSlug),
      status: 'PUBLISHED',
      deletedAt: null,
      hiddenAt: null,
      organization: { ...visibleOrg(), slug: String(req.params.orgSlug) },
    },
    include: { organization: { select: { ...publicOrgSelect, phone: true, whatsapp: true, website: true } } },
  });
  if (!p) throw AppError.notFound('Product not found');
  const { hiddenAt: _h, hiddenReason: _r, deletedAt: _d, ...rest } = p;
  ok(res, { ...productOut(rest), organization: orgCardOut(p.organization) });
});

/* ─────────────────────────── services */

marketplaceRouter.get('/marketplace/services', requireFeature('installerDirectory'), async (req, res) => {
  const f = parseQuery(serviceSearchSchema, req);
  const where: Prisma.ServiceWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    hiddenAt: null,
    organization: visibleOrg(f.state),
    ...(f.category ? { category: f.category } : {}),
    ...(f.q ? { OR: [{ title: contains(f.q) }, { description: contains(f.q) }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.service.findMany({
      where,
      orderBy: [...featuredFirst, { createdAt: 'desc' }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: { id: true, title: true, category: true, description: true, priceType: true, price: true, currency: true, isFeatured: true, organization: { select: publicOrgSelect } },
    }),
    prisma.service.count({ where }),
  ]);
  ok(res, items.map((s) => ({ ...serviceOut(s), organization: orgCardOut(s.organization) })), 200, { page: f.page, pageSize: f.pageSize, total });
});

/* ─────────────────────────── businesses & storefronts */

marketplaceRouter.get('/marketplace/businesses', async (req, res) => {
  const f = parseQuery(businessSearchSchema, req);
  const where: Prisma.OrganizationWhereInput = {
    ...visibleOrg(f.state),
    ...(f.type ? { types: { has: f.type } } : {}),
    ...(f.q ? { AND: [{ OR: [{ name: contains(f.q) }, { tagline: contains(f.q) }, { description: contains(f.q) }] }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { ratingAverage: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        ...publicOrgSelect,
        _count: { select: { products: { where: { status: 'PUBLISHED', deletedAt: null, hiddenAt: null } }, services: { where: { status: 'PUBLISHED', deletedAt: null, hiddenAt: null } } } },
      },
    }),
    prisma.organization.count({ where }),
  ]);
  ok(res, items.map(orgCardOut), 200, { page: f.page, pageSize: f.pageSize, total });
});

/** Public storefront: profile, published products and services. */
marketplaceRouter.get('/marketplace/businesses/:slug', async (req, res) => {
  const org = await prisma.organization.findFirst({
    where: { ...visibleOrg(), slug: String(req.params.slug) },
    select: {
      ...publicOrgSelect,
      description: true, coverUrl: true, website: true, email: true, phone: true, whatsapp: true,
      address: true, yearsInBusiness: true, cacNumber: true, verifiedAt: true, createdAt: true,
      products: {
        where: { status: 'PUBLISHED', deletedAt: null, hiddenAt: null },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: 60,
        select: { id: true, slug: true, name: true, category: true, brand: true, price: true, currency: true, images: true, stockQuantity: true, trackInventory: true, isFeatured: true },
      },
      services: {
        where: { status: 'PUBLISHED', deletedAt: null, hiddenAt: null },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, category: true, description: true, priceType: true, price: true, currency: true },
      },
    },
  });
  if (!org) throw AppError.notFound('Business not found');
  ok(res, { ...orgCardOut(org), products: org.products.map(productOut), services: org.services.map(serviceOut) });
});
