/**
 * Admin control panel: settings, roles, feature toggles, curation.
 * Runs against a real database; skipped when none is reachable.
 * Existing site settings are snapshotted and restored afterwards.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SITE_SETTINGS } from '@solaris/validation';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { invalidateSettingsCache } from '../src/modules/settings/settings.service';

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const app = createApp();
const run = randomUUID().slice(0, 8);
const emails: string[] = [];
const applianceId = `test-${run}`;

let snapshot: Array<{ key: string; value: unknown; version: number; revisions: Array<{ version: number; value: unknown; note: string | null; authorId: string | null }> }> = [];
let adminToken = '';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function registerUser() {
  const email = `admin-test-${run}-${emails.length}@example.com`;
  emails.push(email);
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SolarPower2026', firstName: 'Test', lastName: 'Editor', acceptTerms: true })
    .expect(201);
  return { email, token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}

beforeAll(async () => {
  if (!dbAvailable || !adminEmail || !adminPassword) return;
  const rows = await prisma.siteSetting.findMany({ include: { revisions: true } });
  snapshot = rows.map((r) => ({ key: r.key, value: r.value, version: r.version, revisions: r.revisions.map((v) => ({ version: v.version, value: v.value, note: v.note, authorId: v.authorId })) }));
  const login = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword }).expect(200);
  adminToken = login.body.data.accessToken;
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.siteSetting.deleteMany({});
    for (const s of snapshot) {
      await prisma.siteSetting.create({
        data: { key: s.key, value: s.value as object, version: s.version, revisions: { create: s.revisions.map((v) => ({ ...v, value: v.value as object })) } },
      });
    }
    invalidateSettingsCache();
    await prisma.appliance.deleteMany({ where: { id: applianceId } });
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!dbAvailable || !adminEmail)('admin control panel (database)', () => {
  it('serves public site config with defaults', async () => {
    const res = await request(app).get('/api/v1/site/config').expect(200);
    expect(res.body.data.branding.siteName).toBeTruthy();
    expect(res.body.data).not.toHaveProperty('pricing'); // server-side only
  });

  it('exposes admin roles on /auth/me', async () => {
    const me = await request(app).get('/api/v1/auth/me').set(auth(adminToken)).expect(200);
    expect(me.body.data.adminRoles).toContain('SUPER_ADMIN');
  });

  it('validates, versions and publishes content changes; restore creates a new version', async () => {
    const value = structuredClone(DEFAULT_SITE_SETTINGS['content.home']);
    value.hero.titleLine1 = `Test headline ${run}`;

    await request(app).put('/api/v1/admin/settings/content.home').set(auth(adminToken)).send({ value: { hero: {} } }).expect(400);
    const saved = await request(app).put('/api/v1/admin/settings/content.home').set(auth(adminToken)).send({ value, note: 'test edit' }).expect(200);
    const version = saved.body.data.version as number;

    const pub = await request(app).get('/api/v1/site/config').expect(200);
    expect(pub.body.data['content.home'].hero.titleLine1).toBe(`Test headline ${run}`);

    const revs = await request(app).get('/api/v1/admin/settings/content.home/revisions').set(auth(adminToken)).expect(200);
    expect(revs.body.data[0].version).toBe(version);
    expect(revs.body.data[0].note).toBe('test edit');

    const reset = await request(app).post('/api/v1/admin/settings/content.home/reset').set(auth(adminToken)).expect(200);
    expect(reset.body.data.version).toBe(version + 1);
    const restored = await request(app)
      .post(`/api/v1/admin/settings/content.home/revisions/${revs.body.data[0].id}/restore`)
      .set(auth(adminToken))
      .expect(200);
    expect(restored.body.data.version).toBe(version + 2);
    expect(restored.body.data.value.hero.titleLine1).toBe(`Test headline ${run}`);
  });

  it('rejects unsafe links in announcements', async () => {
    await request(app)
      .put('/api/v1/admin/settings/announcement')
      .set(auth(adminToken))
      .send({ value: { ...DEFAULT_SITE_SETTINGS.announcement, linkUrl: 'javascript:alert(1)' } })
      .expect(400);
  });

  it('scopes edits by admin role', async () => {
    const editor = await registerUser();
    await request(app).get('/api/v1/admin/overview').set(auth(editor.token)).expect(403);

    await request(app).post('/api/v1/admin/team').set(auth(adminToken)).send({ email: editor.email, adminRoles: ['CONTENT_EDITOR'] }).expect(201);

    await request(app).get('/api/v1/admin/overview').set(auth(editor.token)).expect(200);
    await request(app).put('/api/v1/admin/settings/announcement').set(auth(editor.token)).send({ value: DEFAULT_SITE_SETTINGS.announcement }).expect(200);
    await request(app).put('/api/v1/admin/settings/features').set(auth(editor.token)).send({ value: DEFAULT_SITE_SETTINGS.features }).expect(403);
    await request(app).put('/api/v1/admin/settings/pricing').set(auth(editor.token)).send({ value: DEFAULT_SITE_SETTINGS.pricing }).expect(403);
    await request(app).get('/api/v1/admin/team').set(auth(editor.token)).expect(403);
    await request(app).patch('/api/v1/admin/organizations/00000000-0000-0000-0000-000000000000/verification').set(auth(editor.token)).send({ status: 'VERIFIED' }).expect(403);

    const listing = await request(app).get('/api/v1/admin/settings').set(auth(editor.token)).expect(200);
    const features = listing.body.data.find((s: { key: string }) => s.key === 'features');
    expect(features.canEdit).toBe(false);

    await request(app).delete(`/api/v1/admin/team/${editor.id}`).set(auth(adminToken)).expect(200);
    await request(app).get('/api/v1/admin/overview').set(auth(editor.token)).expect(403);
  });

  it('never removes the last super admin', async () => {
    const me = await request(app).get('/api/v1/auth/me').set(auth(adminToken)).expect(200);
    const supers = await prisma.user.count({ where: { adminRoles: { has: 'SUPER_ADMIN' }, roles: { has: 'ADMIN' } } });
    if (supers === 1) {
      await request(app).patch(`/api/v1/admin/team/${me.body.data.id}`).set(auth(adminToken)).send({ adminRoles: ['OPERATIONS'] }).expect(409);
      await request(app).delete(`/api/v1/admin/team/${me.body.data.id}`).set(auth(adminToken)).expect(409);
    }
  });

  it('feature toggles are enforced by the API: registration, calculator and maintenance mode', async () => {
    const off = { ...DEFAULT_SITE_SETTINGS.features, consumerRegistration: false, calculator: false };
    await request(app).put('/api/v1/admin/settings/features').set(auth(adminToken)).send({ value: off }).expect(200);

    const closed = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `closed-${run}@example.com`, password: 'SolarPower2026', firstName: 'A', lastName: 'B', acceptTerms: true })
      .expect(403);
    expect(closed.body.error.code).toBe('REGISTRATION_CLOSED');
    const calc = await request(app)
      .post('/api/v1/solar/designs/estimate')
      .send({ location: { state: 'Lagos' }, gridAvailable: true, backupHours: 4, autonomyDays: 1, appliances: [{ name: 'Fan', quantity: 1, watts: 60, hoursPerDay: 5 }] })
      .expect(503);
    expect(calc.body.error.code).toBe('FEATURE_DISABLED');

    await request(app).put('/api/v1/admin/settings/features').set(auth(adminToken)).send({ value: { ...DEFAULT_SITE_SETTINGS.features, maintenanceMode: true } }).expect(200);
    const blocked = await request(app).get('/api/v1/catalog/appliances').expect(503);
    expect(blocked.body.error.code).toBe('MAINTENANCE');
    await request(app).get('/api/v1/catalog/appliances').set(auth(adminToken)).expect(200); // staff bypass
    await request(app).get('/api/v1/site/config').expect(200); // site can still render the notice

    await request(app).put('/api/v1/admin/settings/features').set(auth(adminToken)).send({ value: DEFAULT_SITE_SETTINGS.features }).expect(200);
    await request(app).get('/api/v1/catalog/appliances').expect(200);
  });

  it('admin reference prices flow into calculator costs', async () => {
    const body = { location: { state: 'Lagos' }, gridAvailable: true, backupHours: 0, autonomyDays: 1, appliances: [{ name: 'Fan', quantity: 1, watts: 550, hoursPerDay: 4 }] };
    await request(app).put('/api/v1/admin/settings/pricing').set(auth(adminToken)).send({ value: { ...DEFAULT_SITE_SETTINGS.pricing, panelPricePerWatt: 1000, pricesReviewed: '2030-01' } }).expect(200);
    const r = await request(app).post('/api/v1/solar/designs/estimate').send(body).expect(200);
    const panels = r.body.data.cost.lineItems.find((i: { code: string }) => i.code === 'SOLAR_PANELS');
    expect(panels.unitPrice).toBe(550 * 1000);
    expect(r.body.data.cost.pricesReviewed).toBe('2030-01');
    await request(app).post('/api/v1/admin/settings/pricing/reset').set(auth(adminToken)).expect(200);
  });

  it('curators manage the appliance catalogue the public calculator uses', async () => {
    await request(app)
      .post('/api/v1/admin/appliances')
      .set(auth(adminToken))
      .send({ id: applianceId, name: 'Test borehole pump', category: 'WATER', defaultWatts: 1100, surgeFactor: 3.5, typicalHoursPerDay: 2, typicalNightFraction: 0 })
      .expect(201);
    let pub = await request(app).get('/api/v1/catalog/appliances').expect(200);
    expect(pub.body.data.map((a: { id: string }) => a.id)).toContain(applianceId);

    await request(app).patch(`/api/v1/admin/appliances/${applianceId}`).set(auth(adminToken)).send({ isActive: false }).expect(200);
    pub = await request(app).get('/api/v1/catalog/appliances').expect(200);
    expect(pub.body.data.map((a: { id: string }) => a.id)).not.toContain(applianceId);
  });

  it('curators can feature and hide businesses; the platform business cannot be suspended', async () => {
    const platform = await prisma.organization.findUnique({ where: { slug: 'solaris' }, select: { id: true } });
    if (!platform) return;
    const res = await request(app).patch(`/api/v1/admin/organizations/${platform.id}/curation`).set(auth(adminToken)).send({ isFeatured: true }).expect(200);
    expect(res.body.data.isFeatured).toBe(true);
    await request(app).patch(`/api/v1/admin/organizations/${platform.id}/verification`).set(auth(adminToken)).send({ status: 'SUSPENDED' }).expect(409);
    await request(app).patch(`/api/v1/admin/organizations/${platform.id}/curation`).set(auth(adminToken)).send({ isFeatured: false }).expect(200);
  });
});
