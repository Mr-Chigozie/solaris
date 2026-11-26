import { rateLimit } from 'express-rate-limit';

const handler = (limitName: string) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: limitName === 'auth' ? 20 : limitName === 'calculator' ? 120 : 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again shortly.' } },
});

/** Global ceiling per IP. */
export const globalLimiter = handler('global');
/** Registration — strict, per IP. */
export const authLimiter = handler('auth');

/**
 * Login — brute-force protection that only counts FAILED attempts, so people
 * who sign in successfully (or share an office IP) aren't locked out.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.' } },
});

/** Silent session refresh runs on every page load — generous, but still bounded. */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again shortly.' } },
});
/** Anonymous calculator — open to the public, so bounded separately. */
export const calculatorLimiter = handler('calculator');
