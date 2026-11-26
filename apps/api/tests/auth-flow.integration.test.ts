/**
 * End-to-end flows against a real PostgreSQL database.
 * Skipped automatically when the database is unreachable
 * (start one with `npm run db:local`, then `npm run db:migrate`).
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
const app = createApp();
const run = randomUUID().slice(0, 8);
const emails: string[] = [];

const newUser = (overrides: Record<string, unknown> = {}) => {
  const email = `test-${run}-${emails.length}@example.com`;
  emails.push(email);
  return { email, password: 'SolarPower2026', firstName: 'Ada', lastName: 'Okafor', acceptTerms: true, ...overrides };
};

const design = {
  title: 'Lekki duplex',
  location: { state: 'Lagos', city: 'Lekki' },
  gridAvailable: true,
  backupHours: 8,
  autonomyDays: 1,
  appliances: [{ catalogId: 'fridge', name: 'Refrigerator', quantity: 1, watts: 150, hoursPerDay: 12 }],
};

const refreshCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('solaris_rt='))?.split(';')[0];

afterAll(async () => {
  if (dbAvailable) {
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, memberships: { select: { organizationId: true } } } });
    const orgIds = users.flatMap((u) => u.memberships.map((m) => m.organizationId));
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!dbAvailable)('auth & designs (database)', () => {
  it('registers a consumer, returns an access token and an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(newUser({ phone: '0803 123 4567' })).expect(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.roles).toEqual(['CONSUMER']);
    expect(res.body.data.user.phone).toBe('+2348031234567');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(raw).toMatch(/HttpOnly/i);
  });

  it('rejects duplicate emails and cannot self-assign ADMIN', async () => {
    await request(app).post('/api/v1/auth/register').send({ ...newUser(), email: emails[0] }).expect(409);
    await request(app).post('/api/v1/auth/register').send(newUser({ accountType: 'ADMIN' })).expect(400);
  });

  it('login → me → save design → list → owner-only access', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: emails[0], password: 'SolarPower2026' }).expect(200);
    const token = login.body.data.accessToken as string;

    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    const saved = await request(app).post('/api/v1/solar/designs').set('Authorization', `Bearer ${token}`).send(design).expect(201);
    const id = saved.body.data.id as string;

    const list = await request(app).get('/api/v1/solar/designs').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data.map((d: { id: string }) => d.id)).toContain(id);

    const got = await request(app).get(`/api/v1/solar/designs/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(got.body.data.engineVersion).toBeTruthy();
    expect(got.body.data.result.energy.dailyKwh).toBe(1.8);

    await request(app).post(`/api/v1/solar/designs/${id}/request-review`).set('Authorization', `Bearer ${token}`).expect(200);

    // Another user must not see it — 404, not 403, so existence is not leaked.
    const other = await request(app).post('/api/v1/auth/register').send(newUser()).expect(201);
    await request(app).get(`/api/v1/solar/designs/${id}`).set('Authorization', `Bearer ${other.body.data.accessToken}`).expect(404);
    await request(app).get('/api/v1/solar/designs/not-a-uuid').set('Authorization', `Bearer ${token}`).expect(404);
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: emails[0], password: 'WrongPassword1' }).expect(401);
    expect(res.body.error.message).toBe('Incorrect email or password');
    await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'WrongPassword1' }).expect(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: emails[0], password: 'SolarPower2026' }).expect(200);
    const first = refreshCookie(login)!;

    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first).expect(200);
    const second = refreshCookie(r1)!;
    expect(second).not.toBe(first);

    // Immediate replay looks like a two-tab race: rejected, but the family survives.
    const race = await request(app).post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
    expect(race.body.error.code).toBe('REFRESH_RACE');

    // Replay after the grace window = theft signal → whole family revoked.
    await prisma.refreshToken.updateMany({
      where: { replacedBy: { not: null }, revokedAt: { not: null }, user: { email: emails[0] } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSED');
    await request(app).post('/api/v1/auth/refresh').set('Cookie', second).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: emails[0], password: 'SolarPower2026' }).expect(200);
    const cookie = refreshCookie(login)!;
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('a customer can open a business that both sells and installs, keeping one account', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(newUser()).expect(201);
    const token = reg.body.data.accessToken as string;

    await request(app).post('/api/v1/organizations').set('Authorization', `Bearer ${token}`).send({ name: 'Kano Solar Hub', types: [] }).expect(400);

    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kano Solar Hub', types: ['VENDOR', 'INSTALLER'], state: 'Kano' })
      .expect(201);
    expect(created.body.data.types).toEqual(['VENDOR', 'INSTALLER']);
    expect(created.body.data.verification).toBe('PENDING');
    expect(created.body.data.isPlatformOwned).toBe(false);
    expect(created.body.data.serviceStates).toEqual(['Kano']);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.roles).toEqual(expect.arrayContaining(['CONSUMER', 'VENDOR', 'INSTALLER']));
    expect(me.body.data.memberships[0].role).toBe('OWNER');

    const ws = await request(app).get(`/api/v1/organizations/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(ws.body.data.subscription.plan).toBe('FREE');
  });

  it('installer registration creates a PENDING organisation scoped to its members; admin verifies it', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser({ accountType: 'INSTALLER', businessName: 'Sunrise Solar Ltd', state: 'Kano' }))
      .expect(201);
    const installerToken = reg.body.data.accessToken as string;
    const membership = reg.body.data.user.memberships[0];
    expect(membership.role).toBe('OWNER');
    expect(membership.organization.verification).toBe('PENDING');
    const orgId = membership.organization.id as string;

    await request(app).get(`/api/v1/organizations/${orgId}`).set('Authorization', `Bearer ${installerToken}`).expect(200);

    // An installer from a different organisation gets nothing here.
    const otherInstaller = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser({ accountType: 'INSTALLER', businessName: 'Other Solar' }))
      .expect(201);
    await request(app).get(`/api/v1/organizations/${orgId}`).set('Authorization', `Bearer ${otherInstaller.body.data.accessToken}`).expect(403);

    // Non-admins cannot verify.
    await request(app).patch(`/api/v1/admin/organizations/${orgId}/verification`).set('Authorization', `Bearer ${installerToken}`).send({ status: 'VERIFIED' }).expect(403);

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) return;
    const admin = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword }).expect(200);
    const adminToken = admin.body.data.accessToken as string;

    const pending = await request(app).get('/api/v1/admin/organizations?verification=PENDING').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(pending.body.data.map((o: { id: string }) => o.id)).toContain(orgId);

    const verified = await request(app)
      .patch(`/api/v1/admin/organizations/${orgId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED', note: 'CAC certificate and 3 completed projects reviewed' })
      .expect(200);
    expect(verified.body.data.verification).toBe('VERIFIED');

    const log = await prisma.auditLog.findFirst({ where: { entityId: orgId, action: 'org.verification_changed' } });
    expect(log).not.toBeNull();
    await prisma.auditLog.deleteMany({ where: { entityId: orgId } });
  });
});
