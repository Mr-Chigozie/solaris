import { randomBytes } from 'node:crypto';
import { ORDER_STATUS_LABEL, type QuotationInputDto } from '@solaris/validation';
import type { Prisma } from '../../generated/prisma/client';
import type { MessageKind, OrderStatus } from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { getSetting } from '../settings/settings.service';
import type { VerifiedCharge } from '../payments/provider';

type Tx = Prisma.TransactionClient;

/* ───────────────────────────── money: integer kobo, never floats */

export const toKobo = (naira: number | string | { toString(): string }) => Math.round(Number(naira) * 100);
export const fromKobo = (kobo: number) => kobo / 100;
const fmt = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/** Human-friendly, unguessable reference, e.g. Q-261126-7KX2M. */
export function reference(prefix: 'Q' | 'SO' | 'PAY') {
  const d = new Date();
  const date = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from(randomBytes(prefix === 'PAY' ? 8 : 5), (b) => alphabet[b % alphabet.length]).join('');
  return `${prefix}-${date}-${rand}`;
}

/* ───────────────────────────── quotation pricing */

export interface QuoteLine {
  kind: 'PRODUCT' | 'SERVICE' | 'CUSTOM';
  productId: string | null;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  snapshot: Record<string, unknown> | null;
}

/**
 * Resolve catalogue references (must belong to this business), snapshot them,
 * and compute totals on the server — client-supplied totals are never trusted.
 */
export async function priceQuotation(organizationId: string, dto: QuotationInputDto) {
  const { vatRate } = await getSetting('commerce');
  const productIds = dto.lineItems.flatMap((l) => (l.kind === 'PRODUCT' && l.productId ? [l.productId] : []));
  const serviceIds = dto.lineItems.flatMap((l) => (l.kind === 'SERVICE' && l.serviceId ? [l.serviceId] : []));
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, organizationId, deletedAt: null } }),
    prisma.service.findMany({ where: { id: { in: serviceIds }, organizationId, deletedAt: null } }),
  ]);

  let subtotalKobo = 0;
  const lines: QuoteLine[] = dto.lineItems.map((l) => {
    let snapshot: QuoteLine['snapshot'] = null;
    if (l.kind === 'PRODUCT') {
      const p = products.find((x) => x.id === l.productId);
      if (!p) throw AppError.badRequest(`Product on line "${l.description}" is not in your catalogue`);
      snapshot = { name: p.name, brand: p.brand, model: p.model, category: p.category, listPrice: p.price === null ? null : Number(p.price), specifications: p.specifications, image: p.images[0] ?? null, slug: p.slug };
    } else if (l.kind === 'SERVICE') {
      const s = services.find((x) => x.id === l.serviceId);
      if (!s) throw AppError.badRequest(`Service on line "${l.description}" is not in your catalogue`);
      snapshot = { title: s.title, category: s.category, priceType: s.priceType, listPrice: s.price === null ? null : Number(s.price) };
    }
    const unitKobo = toKobo(l.unitPrice);
    const lineKobo = unitKobo * l.quantity;
    subtotalKobo += lineKobo;
    return {
      kind: l.kind,
      productId: l.kind === 'PRODUCT' ? l.productId! : null,
      serviceId: l.kind === 'SERVICE' ? l.serviceId! : null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: fromKobo(unitKobo),
      lineTotal: fromKobo(lineKobo),
      snapshot,
    };
  });

  const discountKobo = toKobo(dto.discount ?? 0);
  if (discountKobo > subtotalKobo) throw AppError.badRequest('Discount cannot exceed the subtotal');
  const rate = dto.applyVat ? vatRate : 0;
  const taxKobo = Math.round((subtotalKobo - discountKobo) * rate);
  const totalKobo = subtotalKobo - discountKobo + taxKobo;

  return {
    lines,
    subtotal: fromKobo(subtotalKobo),
    discount: fromKobo(discountKobo),
    vatRate: rate,
    tax: fromKobo(taxKobo),
    total: fromKobo(totalKobo),
    totalKobo,
  };
}

/* ───────────────────────────── chat cards */

export async function postThreadMessage(
  tx: Tx,
  args: { conversationId: string | null; senderId: string; fromBusiness: boolean; kind: MessageKind; refId?: string; body: string },
) {
  if (!args.conversationId) return;
  const now = new Date();
  await tx.message.create({
    data: { conversationId: args.conversationId, senderId: args.senderId, fromBusiness: args.fromBusiness, kind: args.kind, refId: args.refId, body: args.body },
  });
  await tx.conversation.update({
    where: { id: args.conversationId },
    data: { lastMessageAt: now, ...(args.fromBusiness ? { businessReadAt: now } : { customerReadAt: now }) },
  });
}

export const quotationCardText = (ref: string, revision: number, totalKobo: number, validUntil: Date | null) =>
  `Quotation ${ref}${revision > 1 ? ` (revision ${revision})` : ''} · ${fmt(totalKobo)}${validUntil ? ` · valid until ${validUntil.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`;

/* ───────────────────────────── effective status */

/** A sent quotation past its validity is EXPIRED, even before any job runs. */
export function effectiveQuoteStatus(q: { status: string; expiresAt: Date | null }) {
  return q.status === 'SENT' && q.expiresAt && q.expiresAt < new Date() ? 'EXPIRED' : q.status;
}

/** Unpaid orders lapse after the configured window so stale orders don't linger. */
export async function expireIfStale(order: { id: string; status: OrderStatus; createdAt: Date }) {
  if (order.status !== 'PENDING_PAYMENT') return order.status;
  const { unpaidOrderExpiryHours } = await getSetting('commerce');
  if (Date.now() - order.createdAt.getTime() < unpaidOrderExpiryHours * 3_600_000) return order.status;
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, status: 'PENDING_PAYMENT' },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Payment window expired' },
  });
  if (count) await prisma.orderEvent.create({ data: { orderId: order.id, status: 'CANCELLED', note: 'Payment window expired' } });
  return 'CANCELLED' as OrderStatus;
}

/* ───────────────────────────── payment confirmation (idempotent) */

/**
 * Apply a verified successful charge. Safe to call many times (webhook retries,
 * the browser's verify call and the webhook racing each other): the first call
 * wins and the rest are no-ops.
 */
export async function applySuccessfulCharge(charge: VerifiedCharge) {
  if (charge.status !== 'success') return { applied: false, reason: `status ${charge.status}` };

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerRef: charge.reference }, include: { order: { include: { items: true, quotation: { select: { conversationId: true } } } } } });
    if (!payment) {
      logger.warn({ reference: charge.reference }, 'Charge for unknown payment reference');
      return { applied: false, reason: 'unknown reference' };
    }
    if (payment.status === 'SUCCEEDED') return { applied: false, reason: 'already applied', orderId: payment.orderId };

    const order = payment.order;
    const expectedKobo = toKobo(order.total);
    if (charge.amountKobo !== expectedKobo || charge.currency !== 'NGN') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', webhookData: charge.raw as object } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'DISPUTED' } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: 'DISPUTED', note: `Amount mismatch: expected ${expectedKobo} kobo, received ${charge.amountKobo} ${charge.currency}` } });
      logger.error({ reference: charge.reference, expectedKobo, got: charge.amountKobo }, 'Payment amount mismatch');
      return { applied: false, reason: 'amount mismatch', orderId: order.id };
    }

    const paidAt = charge.paidAt ? new Date(charge.paidAt) : new Date();
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', paidAt, channel: charge.channel, webhookData: charge.raw as object } });

    const { count } = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID', paidAt } });
    if (count === 0) {
      // Paid after the order was cancelled/expired: money arrived, goods weren't reserved → needs a refund.
      await tx.order.update({ where: { id: order.id }, data: { status: 'DISPUTED' } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: 'DISPUTED', note: 'Payment received after the order was cancelled — refund required' } });
      return { applied: true, reason: 'paid after cancellation', orderId: order.id };
    }

    await tx.orderEvent.create({ data: { orderId: order.id, status: 'PAID', note: `Payment received (${charge.channel ?? 'online'})` } });

    // Decrement stock for tracked products; never below zero.
    for (const item of order.items) {
      if (!item.productId) continue;
      await tx.$executeRaw`UPDATE products SET "stockQuantity" = GREATEST(0, "stockQuantity" - ${item.quantity}) WHERE id = ${item.productId}::uuid AND "trackInventory" = true`;
    }

    await postThreadMessage(tx, {
      conversationId: order.quotation?.conversationId ?? null,
      senderId: order.customerId,
      fromBusiness: false,
      kind: 'ORDER',
      refId: order.id,
      body: `Payment received for order ${order.reference} · ${fmt(expectedKobo)}`,
    });
    await tx.auditLog.create({ data: { actorId: order.customerId, action: 'order.paid', entityType: 'Order', entityId: order.id, metadata: { reference: charge.reference, amountKobo: charge.amountKobo } } });
    return { applied: true, orderId: order.id };
  });
}

export const statusLine = (ref: string, status: OrderStatus, note?: string) =>
  `Order ${ref}: ${ORDER_STATUS_LABEL[status]}${note ? ` — ${note}` : ''}`;
