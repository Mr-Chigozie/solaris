import { Router } from 'express';
import {
  APPLIANCE_CATALOG,
  BATTERY_CHEMISTRY_PROFILES,
  DEFAULT_ASSUMPTIONS,
  ENGINE_VERSION,
  NIGERIA_STATES,
  SOLAR_DATA_SOURCE,
  SOLAR_DATA_VERSION,
} from '@solaris/solar-engine';
import { prisma } from '../../lib/prisma';
import { ok } from '../../shared/http';

/**
 * Public reference data. States come from the versioned engine package; the
 * appliance catalogue is admin-managed in the DB with the built-in list as
 * fallback, so the open calculator keeps working if the database is down.
 */
export const catalogRouter = Router();

const cacheFor = (seconds: number) => `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`;

/** Admin-managed catalogue from the DB; falls back to the engine's built-in list. */
catalogRouter.get('/catalog/appliances', async (_req, res) => {
  res.set('Cache-Control', cacheFor(60));
  try {
    const rows = await prisma.appliance.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    if (rows.length > 0) {
      const items = rows.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        defaultWatts: Number(a.defaultWatts),
        surgeFactor: Number(a.surgeFactor),
        typicalHoursPerDay: Number(a.typicalHoursPerDay),
        typicalNightFraction: Number(a.typicalNightFraction),
        ...(a.note ? { note: a.note } : {}),
      }));
      return ok(res, items, 200, { count: items.length, source: 'database' });
    }
  } catch {
    /* database unavailable — serve the built-in catalogue */
  }
  ok(res, APPLIANCE_CATALOG, 200, { count: APPLIANCE_CATALOG.length, source: 'built-in' });
});

catalogRouter.get('/locations/states', (_req, res) => {
  res.set('Cache-Control', cacheFor(3600));
  const states = [...NIGERIA_STATES].sort((a, b) => a.state.localeCompare(b.state));
  ok(res, states, 200, { count: states.length, dataVersion: SOLAR_DATA_VERSION, source: SOLAR_DATA_SOURCE });
});

catalogRouter.get('/solar/methodology', (_req, res) => {
  res.set('Cache-Control', cacheFor(3600));
  ok(res, {
    engineVersion: ENGINE_VERSION,
    dataVersion: SOLAR_DATA_VERSION,
    dataSource: SOLAR_DATA_SOURCE,
    defaults: DEFAULT_ASSUMPTIONS,
    batteryChemistries: BATTERY_CHEMISTRY_PROFILES,
  });
});
