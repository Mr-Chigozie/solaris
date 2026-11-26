import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

const validInput = {
  location: { state: 'Lagos' },
  gridAvailable: true,
  backupHours: 6,
  autonomyDays: 1,
  appliances: [
    { catalogId: 'fridge', name: 'Refrigerator', quantity: 1, watts: 150, hoursPerDay: 12 },
    { name: 'LED bulb', quantity: 8, watts: 10, hoursPerDay: 6 },
  ],
};

describe('public reference data', () => {
  it('lists all 36 states + FCT with data version', async () => {
    const res = await request(app).get('/api/v1/locations/states').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(37);
    expect(res.body.meta.dataVersion).toBeTruthy();
  });

  it('serves the appliance catalogue with caching headers', async () => {
    const res = await request(app).get('/api/v1/catalog/appliances').expect(200);
    expect(res.body.data.length).toBeGreaterThan(20);
    expect(res.headers['cache-control']).toContain('max-age');
  });
});

describe('anonymous calculator', () => {
  it('returns a full sizing result without authentication', async () => {
    const res = await request(app).post('/api/v1/solar/designs/estimate').send(validInput).expect(200);
    const d = res.body.data;
    expect(d.status).toBe('ESTIMATED_REVIEW_REQUIRED');
    expect(d.energy.dailyKwh).toBeCloseTo(2.28, 3); // 1800 + 480 Wh
    expect(d.location.stateCode).toBe('LA');
    expect(d.inverter.recommendedKva).toBeGreaterThan(0);
    expect(d.cost.total).toBeGreaterThan(0);
    expect(d.calculatedAt).toBeTruthy();
  });

  it('returns an energy-only estimate', async () => {
    const res = await request(app)
      .post('/api/v1/energy/audits/estimate')
      .send({ appliances: validInput.appliances, backupHours: 4 })
      .expect(200);
    expect(res.body.data.energy.dailyKwh).toBeCloseTo(2.28, 3);
  });

  it('rejects invalid input with field-level issues', async () => {
    const res = await request(app)
      .post('/api/v1/solar/designs/estimate')
      .send({ ...validInput, appliances: [{ name: 'Fan', quantity: 1, watts: -5, hoursPerDay: 30 }] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.issues.map((i: { path: string }) => i.path);
    expect(paths).toContain('appliances.0.watts');
    expect(paths).toContain('appliances.0.hoursPerDay');
  });

  it('rejects unknown assumption keys', async () => {
    await request(app)
      .post('/api/v1/solar/designs/estimate')
      .send({ ...validInput, assumptions: { hackTheEngine: 1 } })
      .expect(400);
  });

  it('rejects malformed JSON cleanly', async () => {
    const res = await request(app)
      .post('/api/v1/solar/designs/estimate')
      .set('Content-Type', 'application/json')
      .send('{"oops"')
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});

describe('access control', () => {
  it('requires authentication to save designs', async () => {
    await request(app).post('/api/v1/solar/designs').send(validInput).expect(401);
    await request(app).get('/api/v1/solar/designs').expect(401);
  });

  it('rejects forged tokens', async () => {
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('protects admin routes', async () => {
    await request(app).get('/api/v1/admin/overview').expect(401);
  });

  it('refresh without a cookie is a clean 401', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').expect(401);
    expect(res.body.error.code).toBe('NO_SESSION');
  });

  it('unknown routes are 404 JSON', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
