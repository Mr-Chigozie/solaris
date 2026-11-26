import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAccessToken } from '../auth/tokens';
import { ok } from '../../shared/http';
import { getPublicConfig, getSetting } from './settings.service';

export const siteRouter = Router();

/** Public site configuration: branding, SEO, content, features, announcement. */
siteRouter.get('/site/config', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
  ok(res, await getPublicConfig());
});

const MAINTENANCE_ALLOW = ['/auth/', '/site/config', '/admin/'];

/**
 * Maintenance mode: the public API answers 503 while platform staff (ADMIN token)
 * keep full access so they can finish work and switch it off again.
 */
export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  const features = await getSetting('features');
  if (!features.maintenanceMode) return next();
  if (MAINTENANCE_ALLOW.some((p) => req.path.startsWith(p))) return next();
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      if (verifyAccessToken(header.slice(7)).roles.includes('ADMIN')) return next();
    } catch {
      /* fall through */
    }
  }
  res.status(503).json({ success: false, error: { code: 'MAINTENANCE', message: features.maintenanceMessage } });
}

/** Reject requests to a module an admin has switched off. */
export function requireFeature(flag: 'calculator' | 'marketplace' | 'installerDirectory') {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const features = await getSetting('features');
    if (features[flag]) return next();
    res.status(503).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'This feature is temporarily unavailable.' } });
  };
}
