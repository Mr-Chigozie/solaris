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
/** Login/register/refresh — brute-force protection. */
export const authLimiter = handler('auth');
/** Anonymous calculator — open to the public, so bounded separately. */
export const calculatorLimiter = handler('calculator');
