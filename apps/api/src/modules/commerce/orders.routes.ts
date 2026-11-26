import { Router, type Request } from 'express';
import { cancelOrderSchema, orderListSchema, orderStatusUpdateSchema, SELLER_TRANSITIONS, verifyPaymentSchema, type OrderStatusName } from '@solaris/validation';
import { env } from '../../config/env';
import { memberHasPermission, requireAuth, requireOrgPermission } from '../../middleware/auth';
import { parseQuery, validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { requireProvider } from '../payments/provider';
import { applySuccessfulCharge, expireIfStale, postThreadMessage, reference, statusLine, toKobo } from './commerce.service';

export const ordersRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (req: Request, name: string) => {
  const v = req.params[name];
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw AppError.notFound('Order not found');
  return v;
};
const orgId = (req: Request) => (typeof req.params.orgId === 'string' && UUID_RE.test(req.params.orgId) ? req.params.orgId : undefined);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const orderMoney = <T extends { subtotal: unknown; discount: unknown; tax: unknown; deliveryFee: unknown; total: unknown; commissionRate: unknown; commissionAmount: unknown }>(o: T) => ({
  ...o,
  subtotal: num(o.subtotal),
  discount: num(o.discount),
  tax: num(o.tax),
  deliveryFee: num(o.deliveryFee),
  total: num(o.total),
  commissionRate: num(o.commissionRate),
  commissionAmount: num(o.commissionAmount),
});

async function orderParticipant(id: string, userId: string) {
  let o = await prisma.order.findUnique({ where: { id } });
  if (!o) throw AppError.notFound('Order not found');
  // If the payment window lapsed just now, reload so status, reason and timestamps are consistent.
  if ((await expireIfStale(o)) !== o.status) o = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (o.customerId === userId) return { o, side: 'customer' as const, canManage: false };
  const m = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: o.organizationId } }, select: { role: true, permissions: true } });
  if (m && (memberHasPermission(m, 'MANAGE_ORDERS') || memberHasPermission(m, 'MESSAGE_CUSTOMERS'))) {
    return { o, side: 'business' as const, canManage: memberHasPermission(m, 'MANAGE_ORDERS') };
  }
  throw AppError.notFound('Order not found');
}

async function conversationIdFor(quotationId: string | null) {
  if (!quotationId) return null;
  return (await prisma.quotation.findUnique({ where: { id: quotationId }, select: { conversationId: true } }))?.conversationId ?? null;
}

/* ═══════════════════════════ customer */

ordersRouter.get('/orders', requireAuth, async (req, res) => {
  const { status, page, pageSize } = parseQuery(orderListSchema, req);
  const rows = await prisma.order.findMany({
    where: { customerId: req.auth!.userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } }, _count: { select: { items: true } } },
  });
  for (const r of rows) r.status = await expireIfStale(r);
  ok(res, rows.map(orderMoney), 200, { page, pageSize });
});

ordersRouter.get('/orders/:id', requireAuth, async (req, res) => {
  const p = await orderParticipant(uuidParam(req, 'id'), req.auth!.userId);
  const [items, events, payments, organization, customer, quotation] = await Promise.all([
    prisma.orderItem.findMany({ where: { orderId: p.o.id } }),
    prisma.orderEvent.findMany({ where: { orderId: p.o.id }, orderBy: { createdAt: 'asc' } }),
    prisma.payment.findMany({ where: { orderId: p.o.id }, orderBy: { createdAt: 'desc' }, select: { providerRef: true, status: true, amount: true, provider: true, channel: true, paidAt: true, createdAt: true } }),
    prisma.organization.findUnique({ where: { id: p.o.organizationId }, select: { id: true, name: true, slug: true, logoUrl: true, phone: true, paystackSubaccountCode: true } }),
    prisma.user.findUnique({ where: { id: p.o.customerId }, select: { firstName: true, lastName: true } }),
    p.o.quotationId ? prisma.quotation.findUnique({ where: { id: p.o.quotationId }, select: { id: true, reference: true, conversationId: true } }) : null,
  ]);
  const { paystackSubaccountCode, ...org } = organization!;
  ok(res, {
    ...orderMoney(p.o),
    side: p.side,
    canManage: p.canManage,
    allowedTransitions: p.canManage ? (SELLER_TRANSITIONS[p.o.status as OrderStatusName] ?? []) : [],
    organization: { ...org, acceptsOnlinePayment: Boolean(paystackSubaccountCode) },
    customer,
    quotation,
    items: items.map((i) => ({ ...i, unitPrice: num(i.unitPrice), lineTotal: num(i.lineTotal) })),
    events,
    payments: payments.map((x) => ({ ...x, amount: num(x.amount) })),
    // Sellers see what they will receive; customers see what they pay.
    ...(p.side === 'business' ? { sellerReceives: (toKobo(p.o.total) - toKobo(p.o.commissionAmount)) / 100 } : {}),
  });
});

/** Start a Paystack checkout. Funds settle to the seller's subaccount; SOLARIS's commission is split off. */
ordersRouter.post('/orders/:id/pay', requireAuth, async (req, res) => {
  const p = await orderParticipant(uuidParam(req, 'id'), req.auth!.userId);
  if (p.side !== 'customer') throw AppError.forbidden('Only the customer can pay for this order');
  if (p.o.status !== 'PENDING_PAYMENT') throw AppError.conflict(`This order is ${p.o.status.toLowerCase().replace('_', ' ')}.`);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: p.o.organizationId }, select: { paystackSubaccountCode: true } });
  if (!org.paystackSubaccountCode) throw new AppError(409, 'SELLER_PAYOUTS_NOT_READY', 'This seller has not set up online payments yet. Message them to arrange payment.');
  const provider = requireProvider();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: p.o.customerId }, select: { email: true } });

  const ref = reference('PAY');
  const amountKobo = toKobo(p.o.total);
  const platformFeeKobo = toKobo(p.o.commissionAmount);
  const { authorizationUrl } = await provider.initialize({
    email: user.email,
    amountKobo,
    reference: ref,
    callbackUrl: `${env.WEB_ORIGIN}/orders/${p.o.id}?reference=${ref}`,
    subaccountCode: org.paystackSubaccountCode,
    platformFeeKobo,
    metadata: { orderId: p.o.id, orderReference: p.o.reference },
  });
  await prisma.payment.create({
    data: { orderId: p.o.id, provider: provider.name, providerRef: ref, amount: p.o.total, authorizationUrl, subaccountCode: org.paystackSubaccountCode, platformFee: p.o.commissionAmount },
  });
  ok(res, { authorizationUrl, reference: ref, provider: provider.name });
});

/** Called when the customer returns from checkout. The webhook is the source of truth; this just speeds things up. */
ordersRouter.post('/orders/:id/verify-payment', requireAuth, validateBody(verifyPaymentSchema), async (req, res) => {
  const p = await orderParticipant(uuidParam(req, 'id'), req.auth!.userId);
  const payment = await prisma.payment.findFirst({ where: { orderId: p.o.id, providerRef: req.body.reference } });
  if (!payment) throw AppError.notFound('Payment not found for this order');
  if (payment.status !== 'SUCCEEDED') {
    const charge = await requireProvider().verify(payment.providerRef);
    if (charge.status === 'success') await applySuccessfulCharge(charge);
    else if (charge.status === 'failed' || charge.status === 'abandoned') await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }
  const order = await prisma.order.findUniqueOrThrow({ where: { id: p.o.id }, select: { status: true } });
  const latest = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } });
  ok(res, { orderStatus: order.status, paymentStatus: latest.status });
});

ordersRouter.post('/orders/:id/cancel', requireAuth, validateBody(cancelOrderSchema), async (req, res) => {
  const p = await orderParticipant(uuidParam(req, 'id'), req.auth!.userId);
  if (p.side === 'business' && !p.canManage) throw AppError.forbidden();
  if (p.o.status !== 'PENDING_PAYMENT') throw AppError.conflict('Only orders awaiting payment can be cancelled here. For paid orders, contact the other party — refunds are handled through support.');
  const reason = req.body.reason || (p.side === 'customer' ? 'Cancelled by customer' : 'Cancelled by seller');
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: p.o.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
    if (!count) throw AppError.conflict('This order was just updated. Please reload.');
    await tx.orderEvent.create({ data: { orderId: p.o.id, status: 'CANCELLED', note: reason, actorId: req.auth!.userId } });
    await postThreadMessage(tx, { conversationId: await conversationIdFor(p.o.quotationId), senderId: req.auth!.userId, fromBusiness: p.side === 'business', kind: 'ORDER', refId: p.o.id, body: statusLine(p.o.reference, 'CANCELLED', reason) });
  });
  ok(res, { id: p.o.id, status: 'CANCELLED' });
});

ordersRouter.post('/orders/:id/confirm-delivery', requireAuth, async (req, res) => {
  const p = await orderParticipant(uuidParam(req, 'id'), req.auth!.userId);
  if (p.side !== 'customer') throw AppError.forbidden('Only the customer can confirm delivery');
  if (!['SHIPPED', 'DELIVERED', 'READY'].includes(p.o.status)) throw AppError.conflict('This order has not been delivered yet.');
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: p.o.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.orderEvent.create({ data: { orderId: p.o.id, status: 'COMPLETED', note: 'Customer confirmed receipt', actorId: req.auth!.userId } });
    await postThreadMessage(tx, { conversationId: await conversationIdFor(p.o.quotationId), senderId: req.auth!.userId, fromBusiness: false, kind: 'ORDER', refId: p.o.id, body: statusLine(p.o.reference, 'COMPLETED', 'customer confirmed receipt') });
  });
  ok(res, { id: p.o.id, status: 'COMPLETED' });
});

/* ═══════════════════════════ seller */

ordersRouter.get('/organizations/:orgId/orders', requireAuth, requireOrgPermission(orgId, 'MANAGE_ORDERS'), async (req, res) => {
  const { status, page, pageSize } = parseQuery(orderListSchema, req);
  const rows = await prisma.order.findMany({
    where: { organizationId: orgId(req)!, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { customer: { select: { firstName: true, lastName: true } }, _count: { select: { items: true } } },
  });
  for (const r of rows) r.status = await expireIfStale(r);
  ok(res, rows.map(orderMoney), 200, { page, pageSize });
});

ordersRouter.patch('/organizations/:orgId/orders/:id/status', requireAuth, requireOrgPermission(orgId, 'MANAGE_ORDERS'), validateBody(orderStatusUpdateSchema), async (req, res) => {
  const id = uuidParam(req, 'id');
  const o = await prisma.order.findFirst({ where: { id, organizationId: orgId(req)! } });
  if (!o) throw AppError.notFound('Order not found');
  const allowed = SELLER_TRANSITIONS[o.status as OrderStatusName] ?? [];
  const next = req.body.status as OrderStatusName;
  if (!allowed.includes(next)) throw AppError.conflict(`Can't move an order from ${o.status.toLowerCase()} to ${next.toLowerCase()}.`);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id, status: o.status },
      data: { status: next, ...(next === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: req.body.note ?? 'Cancelled by seller' } : {}) },
    });
    if (!count) throw AppError.conflict('This order was just updated. Please reload.');
    await tx.orderEvent.create({ data: { orderId: id, status: next, note: req.body.note, actorId: req.auth!.userId } });
    await postThreadMessage(tx, { conversationId: await conversationIdFor(o.quotationId), senderId: req.auth!.userId, fromBusiness: true, kind: 'ORDER', refId: id, body: statusLine(o.reference, next, req.body.note) });
  });
  ok(res, { id, status: next });
});
