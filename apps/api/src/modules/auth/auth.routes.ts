import { Router, type CookieOptions, type Request, type Response } from 'express';
import { loginSchema, registerSchema } from '@solaris/validation';
import { isProduction } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { authLimiter, loginLimiter, refreshLimiter } from '../../middleware/rate-limit';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../shared/errors';
import { ok } from '../../shared/http';
import { getSetting } from '../settings/settings.service';
import * as auth from './auth.service';

export const REFRESH_COOKIE = 'solaris_rt';

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  // Web and API share a registrable domain (localhost / *.solaris-domain), so Lax works.
  sameSite: 'lax',
  path: '/api/v1/auth',
  ...(expires ? { expires } : {}),
});

const clientContext = (req: Request): auth.ClientContext => ({ ip: req.ip, userAgent: req.get('user-agent') });

function sendSession(res: Response, result: { user: auth.PublicUser; tokens: auth.SessionTokens }, status = 200) {
  res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, cookieOptions(result.tokens.refreshTokenExpiresAt));
  return ok(res, { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.accessTokenExpiresIn }, status);
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const features = await getSetting('features');
  const open = { CONSUMER: features.consumerRegistration, INSTALLER: features.installerRegistration, VENDOR: features.vendorRegistration }[req.body.accountType as 'CONSUMER' | 'INSTALLER' | 'VENDOR'];
  if (!open) throw new AppError(403, 'REGISTRATION_CLOSED', 'Registration for this account type is currently closed.');
  sendSession(res, await auth.register(req.body, clientContext(req)), 201);
});

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  sendSession(res, await auth.login(req.body, clientContext(req)));
});

authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'NO_SESSION', message: 'Not signed in' } });
  }
  try {
    sendSession(res, await auth.refresh(token, clientContext(req)));
  } catch (err) {
    // On a benign race the browser's cookie is already the newer token — keep it.
    if (!(err instanceof AppError && err.code === 'REFRESH_RACE')) res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  ok(res, { signedOut: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  ok(res, await auth.getCurrentUser(req.auth!.userId));
});
