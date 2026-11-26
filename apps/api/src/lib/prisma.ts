import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/** Single Prisma client for the process. Connects lazily on first query. */
export const prisma = new PrismaClient({ adapter });

export type { Prisma } from '../generated/prisma/client';
