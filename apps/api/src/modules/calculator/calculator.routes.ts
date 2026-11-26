import { Router } from 'express';
import { analyseEnergy, calculateSystem, DEFAULT_ASSUMPTIONS, normaliseLoads } from '@solaris/solar-engine';
import { energyEstimateSchema, sizingInputSchema } from '@solaris/validation';
import { calculatorLimiter } from '../../middleware/rate-limit';
import { validateBody } from '../../middleware/validate';
import { ok } from '../../shared/http';
import { getSetting } from '../settings/settings.service';
import { requireFeature } from '../settings/site.routes';

/**
 * Anonymous calculator — no account required. Results are returned, not stored;
 * signing in lets the user save them via POST /solar/designs.
 */
export const calculatorRouter = Router();

calculatorRouter.post('/energy/audits/estimate', requireFeature('calculator'), calculatorLimiter, validateBody(energyEstimateSchema), (req, res) => {
  const { appliances, backupHours } = req.body;
  const energy = analyseEnergy(normaliseLoads(appliances, DEFAULT_ASSUMPTIONS.defaultNightFraction), backupHours);
  ok(res, { energy, status: 'ESTIMATED' });
});

calculatorRouter.post('/solar/designs/estimate', requireFeature('calculator'), calculatorLimiter, validateBody(sizingInputSchema), async (req, res) => {
  const referencePrices = await getSetting('pricing');
  ok(res, { ...calculateSystem({ ...req.body, referencePrices }), calculatedAt: new Date().toISOString() });
});
