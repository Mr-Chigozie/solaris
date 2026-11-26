/**
 * Quotation → order → payment → fulfilment, end to end on a real database,
 * using the development mock payment provider. Cleans up after itself.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { applySuccessfulCharge } from '../src/modules/commerce/commerce.service';

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const app = createApp();
const run = randomUUID().slice(0, 8);
const emails: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const address = { recipientName: 'Ada Okafor', phone: '08031234567', addressLine: '12 Admiralty Way, Lekki Phase 1', city: 'Lekki', state: 'Lagos' };

async function register(extra: Record<string, unknown> = {}) {
  const email = `com-${run}-${emails.length}@example.com`;
  emails.push(email);
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'SolarPower2026', firstName: 'Test', lastName: `C${emails.length}`, acceptTerms: true, ...extra }).expect(201);
  return { token: res.body.data.accessToken as string, user: res.body.data.user };
}

let vendor: { token: string; orgId: string };
let customer: { token: string };
let outsider: { token: string };
let productId = '';
let conversationId = '';
let quoteId = '';
let orderId = '';

beforeAll(async () => {
  if (!dbAvailable || !adminEmail || !adminPassword) return;
  const v = await register({ accountType: 'VENDOR', businessName: `Commerce Co ${run}`, state: 'Lagos' });
  vendor = { token: v.token, orgId: v.user.memberships[0].organization.id };
  customer = { token: (await register()).token };
  outsider = { token: (await register()).token };
  const admin = (await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword }).expect(200)).body.data.accessToken;
  await request(app).patch(`/api/v1/admin/organizations/${vendor.orgId}/verification`).set(auth(admin)).send({ status: 'VERIFIED' }).expect(200);
  productId = (
    await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/products`)
      .set(auth(vendor.token))
      .send({ name: `5kVA Inverter ${run}`, category: 'INVERTER', price: 850000, stockQuantity: 10, status: 'PUBLISHED' })
      .expect(201)
  ).body.data.id;
  conversationId = (
    await request(app).post('/api/v1/conversations').set(auth(customer.token)).send({ organizationId: vendor.orgId, contextType: 'PRODUCT', contextId: productId, message: 'Quote for 2 please, delivered to Lekki' }).expect(201)
  ).body.data.id;
});

afterAll(async () => {
  if (dbAvailable) {
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, memberships: { select: { organizationId: true } } } });
    const userIds = users.map((u) => u.id);
    const orgIds = users.flatMap((u) => u.memberships.map((m) => m.organizationId));
    const orders = await prisma.order.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.quotation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.conversation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: orgIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!dbAvailable || !adminEmail)('quotations, orders & payments (database)', () => {
  it('business sends a quotation; totals and VAT are computed server-side', async () => {
    // Product not in this business's catalogue is rejected
    await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/quotations`)
      .set(auth(vendor.token))
      .send({ conversationId, lineItems: [{ kind: 'PRODUCT', productId: randomUUID(), description: 'x', quantity: 1, unitPrice: 1 }] })
      .expect(400);
    // Customers can't create quotes for a business
    await request(app).post(`/api/v1/organizations/${vendor.orgId}/quotations`).set(auth(customer.token)).send({ conversationId, lineItems: [] }).expect(403);

    const res = await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/quotations`)
      .set(auth(vendor.token))
      .send({
        conversationId,
        title: '5kVA backup system',
        lineItems: [
          { kind: 'PRODUCT', productId, description: '5kVA hybrid inverter', quantity: 2, unitPrice: 820000 },
          { kind: 'CUSTOM', description: 'Delivery to Lekki', quantity: 1, unitPrice: 15000.5 },
        ],
        discount: 40000,
        applyVat: true,
      })
      .expect(201);
    quoteId = res.body.data.id;
    // (1,640,000 + 15,000.50 − 40,000) × 1.075 = 1,615,000.50 + 121,125.04 VAT = 1,736,125.54
    expect(res.body.data.total).toBeCloseTo(1_736_125.54, 2);

    const view = await request(app).get(`/api/v1/quotations/${quoteId}`).set(auth(customer.token)).expect(200);
    expect(view.body.data.side).toBe('customer');
    expect(view.body.data.revisions[0].lineItems[0].snapshot.name).toContain('5kVA Inverter');
    expect(view.body.data.organization).not.toHaveProperty('paystackSubaccountCode');
    expect(view.body.data.organization.acceptsOnlinePayment).toBe(false);

    const thread = await request(app).get(`/api/v1/conversations/${conversationId}`).set(auth(customer.token)).expect(200);
    expect(thread.body.data.messages.some((m: { kind: string; refId: string }) => m.kind === 'QUOTATION' && m.refId === quoteId)).toBe(true);

    await request(app).get(`/api/v1/quotations/${quoteId}`).set(auth(outsider.token)).expect(404);
  });

  it('revisions are immutable and stale accepts are refused', async () => {
    await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/quotations/${quoteId}/revisions`)
      .set(auth(vendor.token))
      .send({ lineItems: [{ kind: 'PRODUCT', productId, description: '5kVA hybrid inverter', quantity: 2, unitPrice: 800000 }, { kind: 'CUSTOM', description: 'Delivery to Lekki', quantity: 1, unitPrice: 15000 }] })
      .expect(200);
    await request(app).post(`/api/v1/quotations/${quoteId}/accept`).set(auth(customer.token)).send({ revision: 1, deliveryAddress: address }).expect(409);
    const view = await request(app).get(`/api/v1/quotations/${quoteId}`).set(auth(customer.token)).expect(200);
    expect(view.body.data.revisions).toHaveLength(2);
    expect(view.body.data.revisions[1].total).toBeCloseTo(1_736_125.54, 2); // revision 1 untouched
    expect(view.body.data.revisions[0].total).toBe(1_615_000);
  });

  it('accepting creates exactly one order awaiting payment', async () => {
    await request(app).post(`/api/v1/quotations/${quoteId}/accept`).set(auth(vendor.token)).send({ revision: 2, deliveryAddress: address }).expect(403);
    const res = await request(app).post(`/api/v1/quotations/${quoteId}/accept`).set(auth(customer.token)).send({ revision: 2, deliveryAddress: address }).expect(201);
    orderId = res.body.data.orderId;
    await request(app).post(`/api/v1/quotations/${quoteId}/accept`).set(auth(customer.token)).send({ revision: 2, deliveryAddress: address }).expect(409);

    const o = await request(app).get(`/api/v1/orders/${orderId}`).set(auth(customer.token)).expect(200);
    expect(o.body.data.status).toBe('PENDING_PAYMENT');
    expect(o.body.data.total).toBe(1_615_000);
    expect(o.body.data.commissionAmount).toBe(80_750); // 5% of pre-VAT 1,615,000
    expect(o.body.data.items).toHaveLength(2);
    expect(o.body.data).not.toHaveProperty('sellerReceives'); // customer view

    const seller = await request(app).get(`/api/v1/orders/${orderId}`).set(auth(vendor.token)).expect(200);
    expect(seller.body.data.sellerReceives).toBe(1_534_250);
    expect(seller.body.data.deliveryAddress.city).toBe('Lekki');
    await request(app).get(`/api/v1/orders/${orderId}`).set(auth(outsider.token)).expect(404);
  });

  it('payment requires the seller to connect payouts; then mock checkout marks the order paid exactly once', async () => {
    const blocked = await request(app).post(`/api/v1/orders/${orderId}/pay`).set(auth(customer.token)).expect(409);
    expect(blocked.body.error.code).toBe('SELLER_PAYOUTS_NOT_READY');

    await request(app).put(`/api/v1/organizations/${vendor.orgId}/payouts`).set(auth(customer.token)).send({ bankCode: '058', accountNumber: '0123456789' }).expect(403);
    await request(app).put(`/api/v1/organizations/${vendor.orgId}/payouts`).set(auth(vendor.token)).send({ bankCode: '058', accountNumber: '12345' }).expect(400);
    const payout = await request(app).put(`/api/v1/organizations/${vendor.orgId}/payouts`).set(auth(vendor.token)).send({ bankCode: '058', accountNumber: '0123456789' });
    // mock refuses accounts starting 000; use a valid-looking one
    if (payout.status !== 200) await request(app).put(`/api/v1/organizations/${vendor.orgId}/payouts`).set(auth(vendor.token)).send({ bankCode: '058', accountNumber: '1234567890' }).expect(200);
    const status = await request(app).get(`/api/v1/organizations/${vendor.orgId}/payouts`).set(auth(vendor.token)).expect(200);
    expect(status.body.data.enabled).toBe(true);
    expect(status.body.data).not.toHaveProperty('accountNumber');

    await request(app).post(`/api/v1/orders/${orderId}/pay`).set(auth(vendor.token)).expect(403);
    const pay = await request(app).post(`/api/v1/orders/${orderId}/pay`).set(auth(customer.token)).expect(200);
    expect(pay.body.data.authorizationUrl).toContain('/pay/mock?');
    const ref = pay.body.data.reference as string;

    await request(app).post(`/api/v1/payments/mock/${ref}/complete`).send({ outcome: 'success' }).expect(200);
    // Webhook retry / browser verify racing: must be a no-op
    await request(app).post(`/api/v1/payments/mock/${ref}/complete`).send({ outcome: 'success' }).expect(200);
    const verify = await request(app).post(`/api/v1/orders/${orderId}/verify-payment`).set(auth(customer.token)).send({ reference: ref }).expect(200);
    expect(verify.body.data).toEqual({ orderStatus: 'PAID', paymentStatus: 'SUCCEEDED' });

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stockQuantity).toBe(8); // decremented once, not twice
    const paidEvents = await prisma.orderEvent.count({ where: { orderId, status: 'PAID' } });
    expect(paidEvents).toBe(1);
  });

  it('seller fulfils through allowed transitions; customer confirms delivery', async () => {
    const step = (status: string, code = 200) => request(app).patch(`/api/v1/organizations/${vendor.orgId}/orders/${orderId}/status`).set(auth(vendor.token)).send({ status }).expect(code);
    await step('DELIVERED', 409); // can't skip PROCESSING
    await step('PROCESSING');
    await step('SHIPPED');
    await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(auth(customer.token)).send({}).expect(409); // paid orders aren't cancelled here
    await request(app).post(`/api/v1/orders/${orderId}/confirm-delivery`).set(auth(vendor.token)).expect(403);
    await request(app).post(`/api/v1/orders/${orderId}/confirm-delivery`).set(auth(customer.token)).expect(200);

    const o = await request(app).get(`/api/v1/orders/${orderId}`).set(auth(customer.token)).expect(200);
    expect(o.body.data.status).toBe('COMPLETED');
    expect(o.body.data.events.map((e: { status: string }) => e.status)).toEqual(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED']);
    const sellerList = await request(app).get(`/api/v1/organizations/${vendor.orgId}/orders`).set(auth(vendor.token)).expect(200);
    expect(sellerList.body.data[0].id).toBe(orderId);
  });

  it('flags amount mismatches and lapses unpaid orders', async () => {
    const q = await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/quotations`)
      .set(auth(vendor.token))
      .send({ conversationId, lineItems: [{ kind: 'CUSTOM', description: 'Site survey', quantity: 1, unitPrice: 25000 }] })
      .expect(201);
    const order2 = (await request(app).post(`/api/v1/quotations/${q.body.data.id}/accept`).set(auth(customer.token)).send({ revision: 1, deliveryAddress: address }).expect(201)).body.data.orderId;
    const pay = await request(app).post(`/api/v1/orders/${order2}/pay`).set(auth(customer.token)).expect(200);
    const result = await applySuccessfulCharge({ reference: pay.body.data.reference, status: 'success', amountKobo: 100, currency: 'NGN', raw: {} });
    expect(result.reason).toBe('amount mismatch');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order2 } })).status).toBe('DISPUTED');

    const q3 = await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/quotations`)
      .set(auth(vendor.token))
      .send({ conversationId, lineItems: [{ kind: 'CUSTOM', description: 'Maintenance', quantity: 1, unitPrice: 30000 }] })
      .expect(201);
    const order3 = (await request(app).post(`/api/v1/quotations/${q3.body.data.id}/accept`).set(auth(customer.token)).send({ revision: 1, deliveryAddress: address }).expect(201)).body.data.orderId;
    await prisma.order.update({ where: { id: order3 }, data: { createdAt: new Date(Date.now() - 100 * 3_600_000) } });
    const stale = await request(app).get(`/api/v1/orders/${order3}`).set(auth(customer.token)).expect(200);
    expect(stale.body.data.status).toBe('CANCELLED');
    expect(stale.body.data.cancelReason).toBe('Payment window expired');
  });

  it('rejects forged Paystack webhooks', async () => {
    await request(app)
      .post('/api/v1/payments/paystack/webhook')
      .set('x-paystack-signature', 'forged')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'charge.success', data: { reference: 'anything' } }))
      .expect(401);
  });
});
