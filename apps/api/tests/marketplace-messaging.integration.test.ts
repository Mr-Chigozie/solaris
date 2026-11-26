/**
 * Storefronts, listings, uploads and messaging against a real database.
 * Skipped automatically without one. Cleans up everything it creates.
 */
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/storage';

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const app = createApp();
const run = randomUUID().slice(0, 8);
const emails: string[] = [];
const uploadedKeys: string[] = [];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function register(extra: Record<string, unknown> = {}) {
  const email = `mkt-${run}-${emails.length}@example.com`;
  emails.push(email);
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SolarPower2026', firstName: 'Test', lastName: `User${emails.length}`, acceptTerms: true, ...extra })
    .expect(201);
  return { token: res.body.data.accessToken as string, user: res.body.data.user };
}

let vendor: { token: string; orgId: string; slug: string };
let customer: { token: string };
let adminToken = '';
let productId = '';
let productSlug = '';

beforeAll(async () => {
  if (!dbAvailable || !adminEmail || !adminPassword) return;
  const v = await register({ accountType: 'VENDOR', businessName: `Test Power ${run}`, state: 'Lagos' });
  const org = v.user.memberships[0].organization;
  vendor = { token: v.token, orgId: org.id, slug: org.slug };
  customer = { token: (await register()).token };
  adminToken = (await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword }).expect(200)).body.data.accessToken;
});

afterAll(async () => {
  if (dbAvailable) {
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, memberships: { select: { organizationId: true } } } });
    const userIds = users.map((u) => u.id);
    const orgIds = users.flatMap((u) => u.memberships.map((m) => m.organizationId));
    await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.conversation.deleteMany({ where: { OR: [{ customerId: { in: userIds } }, { organizationId: { in: orgIds } }] } });
    await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: orgIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    for (const key of uploadedKeys) await unlink(path.join(UPLOAD_DIR, key)).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe.skipIf(!dbAvailable || !adminEmail)('storefronts, listings & messaging (database)', () => {
  it('uploads only real images, only for business accounts', async () => {
    await request(app).post('/api/v1/uploads/images').set(auth(customer.token)).attach('file', PNG, 'x.png').expect(403);
    await request(app).post('/api/v1/uploads/images').set(auth(vendor.token)).attach('file', Buffer.from('<script>alert(1)</script>'), 'evil.png').expect(400);

    const res = await request(app).post('/api/v1/uploads/images').set(auth(vendor.token)).attach('file', PNG, 'pixel.png').expect(201);
    const url = res.body.data.url as string;
    expect(url).toMatch(/\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
    uploadedKeys.push(url.split('/uploads/')[1]!);
    const img = await request(app).get(new URL(url).pathname).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['x-content-type-options']).toBe('nosniff');
  });

  it('vendors manage listings; outsiders cannot', async () => {
    const created = await request(app)
      .post(`/api/v1/organizations/${vendor.orgId}/products`)
      .set(auth(vendor.token))
      .send({ name: `Test 550W Mono Panel ${run}`, category: 'SOLAR_PANEL', brand: 'Jinko', price: 165000, specifications: { watts: 550 }, stockQuantity: 40, status: 'PUBLISHED' })
      .expect(201);
    productId = created.body.data.id;
    productSlug = created.body.data.slug;
    expect(created.body.data.price).toBe(165000);

    await request(app).post(`/api/v1/organizations/${vendor.orgId}/products`).set(auth(vendor.token)).send({ name: `Draft inverter ${run}`, category: 'INVERTER', status: 'DRAFT' }).expect(201);
    await request(app).post(`/api/v1/organizations/${vendor.orgId}/services`).set(auth(vendor.token)).send({ title: `Installation ${run}`, category: 'INSTALLATION', priceType: 'FIXED' }).expect(400);
    await request(app).post(`/api/v1/organizations/${vendor.orgId}/services`).set(auth(vendor.token)).send({ title: `Installation ${run}`, category: 'INSTALLATION', priceType: 'FROM', price: 150000, status: 'PUBLISHED' }).expect(201);

    await request(app).post(`/api/v1/organizations/${vendor.orgId}/products`).set(auth(customer.token)).send({ name: 'Hijack', category: 'ACCESSORY' }).expect(403);
    await request(app).patch(`/api/v1/organizations/${vendor.orgId}/products/${productId}`).set(auth(customer.token)).send({ price: 1 }).expect(403);

    const ws = await request(app).get(`/api/v1/organizations/${vendor.orgId}/workspace`).set(auth(vendor.token)).expect(200);
    expect(ws.body.data.counts.productsPublished).toBe(1);
    expect(ws.body.data.counts.productsDraft).toBe(1);
    expect(ws.body.data.publiclyVisible).toBe(false);
  });

  it('unverified businesses are invisible publicly; verification makes them visible', async () => {
    let list = await request(app).get(`/api/v1/marketplace/products?q=${run}`).expect(200);
    expect(list.body.data).toHaveLength(0);
    await request(app).get(`/api/v1/marketplace/businesses/${vendor.slug}`).expect(404);
    await request(app).post('/api/v1/conversations').set(auth(customer.token)).send({ organizationId: vendor.orgId, message: 'Hello?' }).expect(404);

    await request(app).patch(`/api/v1/admin/organizations/${vendor.orgId}/verification`).set(auth(adminToken)).send({ status: 'VERIFIED', note: 'test' }).expect(200);

    list = await request(app).get(`/api/v1/marketplace/products?q=${run}`).expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([productId]); // draft stays hidden
    expect(list.body.data[0].organization.slug).toBe(vendor.slug);
  });

  it('filters by category, state, price and stock; shows detail and storefront', async () => {
    const q = (s: string) => request(app).get(`/api/v1/marketplace/products?q=${run}&${s}`).expect(200);
    expect((await q('category=SOLAR_PANEL')).body.data).toHaveLength(1);
    expect((await q('category=BATTERY')).body.data).toHaveLength(0);
    expect((await q('state=Lagos')).body.data).toHaveLength(1);
    expect((await q('state=Kano')).body.data).toHaveLength(0);
    expect((await q('maxPrice=100000')).body.data).toHaveLength(0);
    expect((await q('inStock=true&minPrice=100000')).body.data).toHaveLength(1);

    const detail = await request(app).get(`/api/v1/marketplace/products/${vendor.slug}/${productSlug}`).expect(200);
    expect(detail.body.data.specifications.watts).toBe(550);
    expect(detail.body.data).not.toHaveProperty('hiddenReason');

    const store = await request(app).get(`/api/v1/marketplace/businesses/${vendor.slug}`).expect(200);
    expect(store.body.data.products).toHaveLength(1);
    expect(store.body.data.services).toHaveLength(1);
    expect(store.body.data).not.toHaveProperty('verificationNote');

    const services = await request(app).get(`/api/v1/marketplace/services?q=${run}`).expect(200);
    expect(services.body.data).toHaveLength(1);
  });

  it('hidden listings disappear from the marketplace', async () => {
    await request(app).patch(`/api/v1/admin/products/${productId}/curation`).set(auth(adminToken)).send({ hidden: true, hiddenReason: 'test' }).expect(200);
    expect((await request(app).get(`/api/v1/marketplace/products?q=${run}`).expect(200)).body.data).toHaveLength(0);
    await request(app).patch(`/api/v1/admin/products/${productId}/curation`).set(auth(adminToken)).send({ hidden: false }).expect(200);
  });

  it('customer ↔ business messaging with unread tracking and privacy', async () => {
    const start = await request(app)
      .post('/api/v1/conversations')
      .set(auth(customer.token))
      .send({ organizationId: vendor.orgId, contextType: 'PRODUCT', contextId: productId, subject: 'Panel availability', message: 'Do you deliver 10 panels to Ikeja this week?' })
      .expect(201);
    const id = start.body.data.id as string;

    // Same product again continues the same thread
    const again = await request(app).post('/api/v1/conversations').set(auth(customer.token)).send({ organizationId: vendor.orgId, contextType: 'PRODUCT', contextId: productId, message: 'Also need mounting.' }).expect(201);
    expect(again.body.data.id).toBe(id);

    // Vendor can't message their own business
    await request(app).post('/api/v1/conversations').set(auth(vendor.token)).send({ organizationId: vendor.orgId, message: 'hi me' }).expect(400);

    const vendorUnread = await request(app).get('/api/v1/conversations/unread-count').set(auth(vendor.token)).expect(200);
    expect(vendorUnread.body.data.businesses[vendor.orgId]).toBe(1);

    const inbox = await request(app).get(`/api/v1/conversations?inbox=${vendor.orgId}`).set(auth(vendor.token)).expect(200);
    expect(inbox.body.data[0].unread).toBe(true);
    expect(inbox.body.data[0].customer.firstName).toBe('Test');
    expect(inbox.body.data[0].customer).not.toHaveProperty('email');

    const thread = await request(app).get(`/api/v1/conversations/${id}`).set(auth(vendor.token)).expect(200);
    expect(thread.body.data.side).toBe('business');
    expect(thread.body.data.messages).toHaveLength(2);
    expect(thread.body.data.context.type).toBe('PRODUCT');

    await request(app).post(`/api/v1/conversations/${id}/read`).set(auth(vendor.token)).expect(200);
    // Naira sign, Yoruba diacritics and emoji must round-trip (requires a UTF-8 database).
    const reply = 'Yes — 10 in stock, delivery Thursday. ₦15,000 to Ikeja. Ẹ ṣé! ☀️';
    await request(app).post(`/api/v1/conversations/${id}/messages`).set(auth(vendor.token)).send({ body: reply }).expect(201);

    const custUnread = await request(app).get('/api/v1/conversations/unread-count').set(auth(customer.token)).expect(200);
    expect(custUnread.body.data.customer).toBe(1);
    const custThread = await request(app).get(`/api/v1/conversations/${id}`).set(auth(customer.token)).expect(200);
    const last = custThread.body.data.messages.at(-1);
    expect(last.fromBusiness).toBe(true);
    expect(last.senderName).toBe(`Test Power ${run}`); // customer sees the business, not the staff member
    expect(last.body).toBe(reply);

    const outsider = await register();
    await request(app).get(`/api/v1/conversations/${id}`).set(auth(outsider.token)).expect(404);
    await request(app).post(`/api/v1/conversations/${id}/messages`).set(auth(outsider.token)).send({ body: 'snoop' }).expect(404);
    await request(app).get(`/api/v1/conversations?inbox=${vendor.orgId}`).set(auth(outsider.token)).expect(403);
  });

  it("can't share someone else's design", async () => {
    const other = await register();
    const saved = await request(app)
      .post('/api/v1/solar/designs')
      .set(auth(other.token))
      .send({ title: 'Theirs', location: { state: 'Lagos' }, gridAvailable: true, backupHours: 4, autonomyDays: 1, appliances: [{ name: 'Fan', quantity: 1, watts: 60, hoursPerDay: 5 }] })
      .expect(201);
    await request(app)
      .post('/api/v1/conversations')
      .set(auth(customer.token))
      .send({ organizationId: vendor.orgId, contextType: 'DESIGN', contextId: saved.body.data.id, message: 'Quote this?' })
      .expect(400);
  });
});
