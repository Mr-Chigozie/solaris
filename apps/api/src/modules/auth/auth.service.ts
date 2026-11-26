import { randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { LoginDto, RegisterDto } from '@solaris/validation';
import { env } from '../../config/env';
import type { OrganizationType, UserRole } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../shared/errors';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens';

/** OWASP-recommended Argon2id parameters (19 MiB, 2 iterations). Algorithm 2 = Argon2id. */
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

const REUSE_GRACE_MS = 10_000;

/** Used to keep login timing similar whether or not the email exists. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hash('solaris-timing-equaliser', ARGON2_OPTIONS));

export interface ClientContext {
  ip?: string;
  userAgent?: string;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  state: true,
  roles: true,
  adminRoles: true,
  emailVerifiedAt: true,
  createdAt: true,
  memberships: {
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true, types: true, verification: true, isPlatformOwned: true } },
    },
  },
} as const;

export type PublicUser = Awaited<ReturnType<typeof getCurrentUser>>;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'org';
  return `${base}-${randomUUID().slice(0, 6)}`;
}

async function issueSession(userId: string, roles: UserRole[], ctx: ClientContext, familyId: string = randomUUID()): Promise<SessionTokens> {
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 255),
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, roles }),
    accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export async function register(dto: RegisterDto, ctx: ClientContext) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    select: { email: true },
  });
  if (existing) {
    throw AppError.conflict(existing.email === dto.email ? 'An account with this email already exists' : 'This phone number is already registered');
  }

  const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
  // ADMIN can never be self-assigned: accountType is limited to CONSUMER | INSTALLER | VENDOR.
  const role: UserRole = dto.accountType;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        state: dto.state,
        roles: [role],
        termsAcceptedAt: new Date(),
      },
    });

    if (dto.accountType !== 'CONSUMER' && dto.businessName) {
      const org = await tx.organization.create({
        data: {
          name: dto.businessName,
          slug: slugify(dto.businessName),
          types: [dto.accountType as OrganizationType],
          email: dto.email,
          phone: dto.phone,
          state: dto.state,
          // New businesses start PENDING — never shown as verified until an admin reviews them.
          verification: 'PENDING',
          memberships: { create: { userId: created.id, role: 'OWNER' } },
          subscription: { create: { plan: 'FREE' } },
        },
      });
      await tx.auditLog.create({
        data: { actorId: created.id, action: 'org.create', entityType: 'Organization', entityId: org.id, ip: ctx.ip },
      });
    }

    await tx.auditLog.create({
      data: { actorId: created.id, action: 'auth.register', entityType: 'User', entityId: created.id, ip: ctx.ip, metadata: { accountType: dto.accountType } },
    });
    return created;
  });

  const tokens = await issueSession(user.id, user.roles, ctx);
  return { user: await getCurrentUser(user.id), tokens };
}

export async function login(dto: LoginDto, ctx: ClientContext) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !user.passwordHash) {
    await verify(await getDummyHash(), dto.password).catch(() => false);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  const valid = await verify(user.passwordHash, dto.password);
  if (!valid || !user.isActive || user.deletedAt) {
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'auth.login_failed', ip: ctx.ip } });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: user.id, action: 'auth.login', ip: ctx.ip } }),
  ]);

  const tokens = await issueSession(user.id, user.roles, ctx);
  return { user: await getCurrentUser(user.id), tokens };
}

/**
 * Rotate a refresh token. If a token that was already rotated is presented again,
 * it has probably been stolen — revoke every token in that login family.
 */
export async function refresh(presentedToken: string, ctx: ClientContext) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
    include: { user: { select: { id: true, roles: true, isActive: true, deletedAt: true } } },
  });

  if (!stored) throw new AppError(401, 'REFRESH_INVALID', 'Session expired, please sign in again');

  if (stored.revokedAt) {
    // Two tabs refreshing at the same moment: the loser presents a token rotated a
    // few seconds ago. Don't treat that as theft — the browser already holds the
    // replacement cookie, so the client simply retries.
    const rotatedRecently = stored.replacedBy && Date.now() - stored.revokedAt.getTime() < REUSE_GRACE_MS;
    if (rotatedRecently) throw new AppError(401, 'REFRESH_RACE', 'Session was just refreshed, retry');

    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { actorId: stored.userId, action: 'auth.refresh_reuse_detected', metadata: { familyId: stored.familyId }, ip: ctx.ip },
    });
    throw new AppError(401, 'REFRESH_REUSED', 'Session expired, please sign in again');
  }

  if (stored.expiresAt < new Date() || !stored.user.isActive || stored.user.deletedAt) {
    throw new AppError(401, 'REFRESH_INVALID', 'Session expired, please sign in again');
  }

  const tokens = await issueSession(stored.userId, stored.user.roles, ctx, stored.familyId);
  const next = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashToken(tokens.refreshToken) }, select: { id: true } });

  // Conditional update guards against two concurrent refreshes both succeeding.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date(), replacedBy: next.id },
  });
  if (count === 0) {
    await prisma.refreshToken.update({ where: { id: next.id }, data: { revokedAt: new Date() } });
    throw new AppError(401, 'REFRESH_INVALID', 'Session expired, please sign in again');
  }

  return { user: await getCurrentUser(stored.userId), tokens };
}

export async function logout(presentedToken: string | undefined) {
  if (!presentedToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.unauthorized();
  return user;
}
