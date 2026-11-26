import { Router, type Request } from 'express';
import {
  acceptQuotationSchema,
  createQuotationSchema,
  quotationInputSchema,
  quotationListSchema,
  rejectQuotationSchema,
  z,
  type CreateQuotationDto,
  type QuotationInputDto,
} from '@solaris/validation';
import { memberHasPermission, requireAuth, requireOrgPermission } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { getSetting } from '../settings/settings.service';
import { effectiveQuoteStatus, fromKobo, postThreadMessage, priceQuotation, quotationCardText, reference, toKobo } from './commerce.service';

export const quotationsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (req: Request, name: string) => {
  const v = req.params[name];
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw AppError.notFound('Quotation not found');
  return v;
};
const orgId = (req: Request) => (typeof req.params.orgId === 'string' && UUID_RE.test(req.params.orgId) ? req.params.orgId : undefined);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const revisionOut = (r: { subtotal: unknown; discount: unknown; vatRate: unknown; tax: unknown; total: unknown } & Record<string, unknown>) => ({
  ...r,
  subtotal: num(r.subtotal),
  discount: num(r.discount),
  vatRate: num(r.vatRate),
  tax: num(r.tax),
  total: num(r.total),
});

function validUntil(validDays: number | undefined, fallback: number) {
  return new Date(Date.now() + (validDays ?? fallback) * 86_400_000);
}

/* ═══════════════════════════ business side */

quotationsRouter.post('/organizations/:orgId/quotations', requireAuth, requireOrgPermission(orgId, 'MANAGE_QUOTATIONS'), validateBody(createQuotationSchema), async (req, res) => {
  const dto = req.body as CreateQuotationDto;
  const organizationId = orgId(req)!;
  const conv = await prisma.conversation.findFirst({ where: { id: dto.conversationId, organizationId } });
  if (!conv) throw AppError.badRequest('Quotations are sent within a conversation with the customer');

  const priced = await priceQuotation(organizationId, dto);
  const { defaultQuoteValidityDays } = await getSetting('commerce');
  const expiresAt = validUntil(dto.validDays, defaultQuoteValidityDays);
  const userId = req.auth!.userId;

  const q = await prisma.$transaction(async (tx) => {
    const quote = await tx.quotation.create({
      data: {
        reference: reference('Q'),
        customerId: conv.customerId,
        organizationId,
        conversationId: conv.id,
        designId: conv.contextType === 'DESIGN' ? conv.contextId : null,
        title: dto.title,
        status: dto.send ? 'SENT' : 'DRAFT',
        currentRevision: 1,
        expiresAt,
        sentAt: dto.send ? new Date() : null,
        revisions: {
          create: {
            revision: 1,
            lineItems: priced.lines as object,
            subtotal: priced.subtotal,
            discount: priced.discount,
            vatRate: priced.vatRate,
            tax: priced.tax,
            total: priced.total,
            notes: dto.notes,
            validUntil: expiresAt,
            createdById: userId,
          },
        },
      },
    });
    if (dto.send) {
      await postThreadMessage(tx, { conversationId: conv.id, senderId: userId, fromBusiness: true, kind: 'QUOTATION', refId: quote.id, body: quotationCardText(quote.reference, 1, priced.totalKobo, expiresAt) });
    }
    await tx.auditLog.create({ data: { actorId: userId, action: dto.send ? 'quotation.sent' : 'quotation.drafted', entityType: 'Quotation', entityId: quote.id, metadata: { totalKobo: priced.totalKobo } } });
    return quote;
  });
  ok(res, { id: q.id, reference: q.reference, status: q.status, total: priced.total }, 201);
});

quotationsRouter.get('/organizations/:orgId/quotations', requireAuth, requireOrgPermission(orgId, 'MANAGE_QUOTATIONS'), async (req, res) => {
  const { status, page, pageSize } = parseQuery(quotationListSchema, req);
  const rows = await prisma.quotation.findMany({
    where: { organizationId: orgId(req)!, ...(status && status !== 'EXPIRED' ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      revisions: { orderBy: { revision: 'desc' }, take: 1, select: { total: true, revision: true } },
      order: { select: { id: true, reference: true, status: true } },
    },
  });
  const items = rows
    .map((q) => ({ ...q, status: effectiveQuoteStatus(q), total: num(q.revisions[0]?.total), revisions: undefined }))
    .filter((q) => !status || q.status === status);
  ok(res, items, 200, { page, pageSize });
});

/** New revision (the old one is kept, immutable). Also used to re-quote after rejection/expiry. */
quotationsRouter.post('/organizations/:orgId/quotations/:id/revisions', requireAuth, requireOrgPermission(orgId, 'MANAGE_QUOTATIONS'), validateBody(quotationInputSchema.extend({ send: z.boolean().default(true) })), async (req, res) => {
  const dto = req.body as QuotationInputDto & { send: boolean };
  const id = uuidParam(req, 'id');
  const organizationId = orgId(req)!;
  const existing = await prisma.quotation.findFirst({ where: { id, organizationId } });
  if (!existing) throw AppError.notFound('Quotation not found');
  if (existing.status === 'ACCEPTED' || existing.status === 'WITHDRAWN') throw AppError.conflict(`An ${existing.status.toLowerCase()} quotation can't be revised. Create a new one.`);

  const priced = await priceQuotation(organizationId, dto);
  const { defaultQuoteValidityDays } = await getSetting('commerce');
  const expiresAt = validUntil(dto.validDays, defaultQuoteValidityDays);
  const userId = req.auth!.userId;
  const nextRev = existing.currentRevision + 1;
  const send = dto.send || existing.status !== 'DRAFT';

  await prisma.$transaction(async (tx) => {
    await tx.quotationRevision.create({
      data: { quotationId: id, revision: nextRev, lineItems: priced.lines as object, subtotal: priced.subtotal, discount: priced.discount, vatRate: priced.vatRate, tax: priced.tax, total: priced.total, notes: dto.notes, validUntil: expiresAt, createdById: userId },
    });
    await tx.quotation.update({
      where: { id },
      data: { currentRevision: nextRev, title: dto.title ?? existing.title, status: send ? 'SENT' : 'DRAFT', expiresAt, sentAt: send ? new Date() : existing.sentAt, rejectedAt: null, rejectionReason: null },
    });
    if (send) {
      await postThreadMessage(tx, { conversationId: existing.conversationId, senderId: userId, fromBusiness: true, kind: 'QUOTATION', refId: id, body: quotationCardText(existing.reference, nextRev, priced.totalKobo, expiresAt) });
    }
    await tx.auditLog.create({ data: { actorId: userId, action: 'quotation.revised', entityType: 'Quotation', entityId: id, metadata: { revision: nextRev, totalKobo: priced.totalKobo } } });
  });
  ok(res, { id, revision: nextRev, status: send ? 'SENT' : 'DRAFT', total: priced.total });
});

quotationsRouter.post('/organizations/:orgId/quotations/:id/withdraw', requireAuth, requireOrgPermission(orgId, 'MANAGE_QUOTATIONS'), async (req, res) => {
  const id = uuidParam(req, 'id');
  const q = await prisma.quotation.findFirst({ where: { id, organizationId: orgId(req)! } });
  if (!q) throw AppError.notFound('Quotation not found');
  if (q.status === 'ACCEPTED') throw AppError.conflict('This quotation was accepted — cancel the order instead.');
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    if (q.status !== 'DRAFT') {
      await postThreadMessage(tx, { conversationId: q.conversationId, senderId: req.auth!.userId, fromBusiness: true, kind: 'SYSTEM', refId: id, body: `Quotation ${q.reference} was withdrawn.` });
    }
  });
  ok(res, { id, status: 'WITHDRAWN' });
});

/* ═══════════════════════════ shared view + customer actions */

/** Who is looking: the customer, or business staff allowed to handle quotes/messages. */
async function quoteParticipant(id: string, userId: string) {
  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) throw AppError.notFound('Quotation not found');
  if (q.customerId === userId) {
    if (q.status === 'DRAFT') throw AppError.notFound('Quotation not found');
    return { q, side: 'customer' as const };
  }
  const m = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: q.organizationId } }, select: { role: true, permissions: true } });
  if (m && (memberHasPermission(m, 'MANAGE_QUOTATIONS') || memberHasPermission(m, 'MESSAGE_CUSTOMERS'))) {
    return { q, side: 'business' as const, canManage: memberHasPermission(m, 'MANAGE_QUOTATIONS') };
  }
  throw AppError.notFound('Quotation not found');
}

quotationsRouter.get('/quotations', requireAuth, async (req, res) => {
  const { page, pageSize } = parseQuery(quotationListSchema, req);
  const rows = await prisma.quotation.findMany({
    where: { customerId: req.auth!.userId, status: { not: 'DRAFT' } },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
      revisions: { orderBy: { revision: 'desc' }, take: 1, select: { total: true } },
      order: { select: { id: true, reference: true, status: true } },
    },
  });
  ok(res, rows.map((q) => ({ ...q, status: effectiveQuoteStatus(q), total: num(q.revisions[0]?.total), revisions: undefined })), 200, { page, pageSize });
});

quotationsRouter.get('/quotations/:id', requireAuth, async (req, res) => {
  const p = await quoteParticipant(uuidParam(req, 'id'), req.auth!.userId);
  const [revisions, organization, customer, order] = await Promise.all([
    prisma.quotationRevision.findMany({ where: { quotationId: p.q.id }, orderBy: { revision: 'desc' } }),
    prisma.organization.findUnique({
      where: { id: p.q.organizationId },
      select: { id: true, name: true, slug: true, logoUrl: true, phone: true, email: true, state: true, city: true, verification: true, isPlatformOwned: true, cacNumber: true, paystackSubaccountCode: true },
    }),
    prisma.user.findUnique({ where: { id: p.q.customerId }, select: { firstName: true, lastName: true } }),
    prisma.order.findUnique({ where: { quotationId: p.q.id }, select: { id: true, reference: true, status: true } }),
  ]);
  const { paystackSubaccountCode, ...org } = organization!;
  ok(res, {
    ...p.q,
    status: effectiveQuoteStatus(p.q),
    side: p.side,
    canManage: p.side === 'business' && p.canManage,
    organization: { ...org, acceptsOnlinePayment: Boolean(paystackSubaccountCode) },
    customer,
    order,
    revisions: revisions.map(revisionOut),
  });
});

/** Accept the CURRENT revision → creates the order (awaiting payment). */
quotationsRouter.post('/quotations/:id/accept', requireAuth, validateBody(acceptQuotationSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const userId = req.auth!.userId;
  const p = await quoteParticipant(id, userId);
  if (p.side !== 'customer') throw AppError.forbidden('Only the customer can accept a quotation');
  const status = effectiveQuoteStatus(p.q);
  if (status !== 'SENT') throw AppError.conflict(status === 'EXPIRED' ? 'This quotation has expired — ask the business for an updated quote.' : `This quotation is ${status.toLowerCase()}.`);
  if (req.body.revision !== p.q.currentRevision) throw AppError.conflict('This quotation was updated. Review the latest revision before accepting.');

  const rev = await prisma.quotationRevision.findUniqueOrThrow({ where: { quotationId_revision: { quotationId: id, revision: p.q.currentRevision } } });
  const { commissionRate } = await getSetting('commerce');
  const preVatKobo = toKobo(rev.subtotal) - toKobo(rev.discount);
  const commissionKobo = Math.round(preVatKobo * commissionRate);
  const lines = rev.lineItems as unknown as Array<{ productId: string | null; serviceId: string | null; description: string; quantity: number; unitPrice: number; lineTotal: number; snapshot: object | null }>;

  const order = await prisma.$transaction(async (tx) => {
    // Conditional update: two simultaneous accepts can't both create orders.
    const { count } = await tx.quotation.updateMany({ where: { id, status: 'SENT', currentRevision: rev.revision }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    if (count === 0) throw AppError.conflict('This quotation changed while you were accepting it. Please reload.');
    const o = await tx.order.create({
      data: {
        reference: reference('SO'),
        customerId: userId,
        organizationId: p.q.organizationId,
        quotationId: id,
        status: 'PENDING_PAYMENT',
        subtotal: rev.subtotal,
        discount: rev.discount,
        tax: rev.tax,
        deliveryFee: 0,
        total: rev.total,
        commissionRate,
        commissionAmount: fromKobo(commissionKobo),
        deliveryAddress: req.body.deliveryAddress,
        notes: rev.notes,
        items: {
          create: lines.map((l) => ({ productId: l.productId, serviceId: l.serviceId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, snapshot: (l.snapshot ?? {}) as object })),
        },
        events: { create: { status: 'PENDING_PAYMENT', note: `Created from quotation ${p.q.reference} (revision ${rev.revision})`, actorId: userId } },
      },
    });
    await postThreadMessage(tx, { conversationId: p.q.conversationId, senderId: userId, fromBusiness: false, kind: 'ORDER', refId: o.id, body: `Accepted quotation ${p.q.reference} — order ${o.reference} created` });
    await tx.auditLog.create({ data: { actorId: userId, action: 'quotation.accepted', entityType: 'Quotation', entityId: id, metadata: { orderId: o.id, revision: rev.revision } } });
    return o;
  });
  ok(res, { orderId: order.id, reference: order.reference }, 201);
});

quotationsRouter.post('/quotations/:id/reject', requireAuth, validateBody(rejectQuotationSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const p = await quoteParticipant(id, req.auth!.userId);
  if (p.side !== 'customer') throw AppError.forbidden('Only the customer can decline a quotation');
  if (p.q.status !== 'SENT') throw AppError.conflict(`This quotation is ${effectiveQuoteStatus(p.q).toLowerCase()}.`);
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: req.body.reason } });
    await postThreadMessage(tx, { conversationId: p.q.conversationId, senderId: req.auth!.userId, fromBusiness: false, kind: 'SYSTEM', refId: id, body: `Declined quotation ${p.q.reference}${req.body.reason ? `: ${req.body.reason}` : ''}` });
  });
  ok(res, { id, status: 'REJECTED' });
});
