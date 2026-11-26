import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { UserRole } from '../../generated/prisma/enums';

export interface AccessTokenClaims {
  sub: string;
  roles: UserRole[];
}

const ISSUER = 'solaris-api';
const AUDIENCE = 'solaris-web';

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign({ roles: claims.roles }, env.JWT_ACCESS_SECRET, {
    subject: claims.sub,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
  if (typeof payload.sub !== 'string') throw new Error('Invalid token subject');
  return { sub: payload.sub, roles: (payload.roles ?? []) as UserRole[] };
}

/** Opaque refresh token handed to the browser (httpOnly cookie). Only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
