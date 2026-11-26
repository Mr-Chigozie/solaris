import type { NextFunction, Request, Response } from 'express';
import type { AdminRole, OrgMemberRole, OrgPermission, UserRole } from '../generated/prisma/enums';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/tokens';
import { AppError } from '../shared/errors';

export interface AuthContext {
  userId: string;
  roles: UserRole[];
  adminRoles?: AdminRole[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function readBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

/** Attach `req.auth` when a valid access token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (token) {
    try {
      const claims = verifyAccessToken(token);
      req.auth = { userId: claims.sub, roles: claims.roles };
    } catch {
      /* treat as anonymous */
    }
  }
  next();
}

/** Reject the request unless it carries a valid access token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next(AppError.unauthorized());
  try {
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, roles: claims.roles };
    next();
  } catch {
    next(new AppError(401, 'TOKEN_INVALID', 'Session expired or invalid'));
  }
}

/**
 * Require one of the given platform roles. Roles are re-read from the database
 * (not trusted from the token) so a revoked role or deactivated account takes
 * effect immediately rather than when the access token expires.
 */
export function requireRole(...allowed: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { roles: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) return next(AppError.unauthorized('Account is not active'));
    if (!user.roles.some((r) => allowed.includes(r))) return next(AppError.forbidden());
    req.auth.roles = user.roles;
    next();
  };
}

/**
 * Organisation-scoped authorisation: the caller must be a member of *this*
 * organisation with one of the allowed member roles. Being an installer
 * elsewhere grants nothing here.
 */
export function requireOrgRole(
  getOrgId: (req: Request) => string | undefined,
  allowed: OrgMemberRole[] = ['OWNER', 'ADMIN', 'MEMBER'],
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const organizationId = getOrgId(req);
    if (!organizationId) return next(AppError.badRequest('Organisation id is required'));
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: req.auth.userId, organizationId } },
      select: { role: true },
    });
    if (!membership || !allowed.includes(membership.role)) return next(AppError.forbidden());
    next();
  };
}

export function adminHasRole(adminRoles: AdminRole[], allowed: AdminRole[]) {
  return adminRoles.includes('SUPER_ADMIN') || allowed.length === 0 || adminRoles.some((r) => allowed.includes(r));
}

/**
 * Platform staff with a scoped admin role. Pass no roles for "any admin".
 * SUPER_ADMIN passes every check. Re-read from the DB on every request.
 */
export function requireAdmin(...allowed: AdminRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { roles: true, adminRoles: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) return next(AppError.unauthorized('Account is not active'));
    if (!user.roles.includes('ADMIN') || !adminHasRole(user.adminRoles, allowed)) return next(AppError.forbidden());
    req.auth.roles = user.roles;
    req.auth.adminRoles = user.adminRoles;
    next();
  };
}

/** OWNER and ADMIN hold every permission; MEMBERs hold only those granted. */
export function memberHasPermission(member: { role: OrgMemberRole; permissions: OrgPermission[] }, permission: OrgPermission) {
  return member.role === 'OWNER' || member.role === 'ADMIN' || member.permissions.includes(permission);
}

/**
 * Staff-level authorisation inside one business, e.g. a sales member with
 * MANAGE_PRODUCTS can edit listings but not quotations or team members.
 */
export function requireOrgPermission(getOrgId: (req: Request) => string | undefined, permission: OrgPermission) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    const organizationId = getOrgId(req);
    if (!organizationId) return next(AppError.badRequest('Organisation id is required'));
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: req.auth.userId, organizationId } },
      select: { role: true, permissions: true },
    });
    if (!membership || !memberHasPermission(membership, permission)) return next(AppError.forbidden());
    next();
  };
}
