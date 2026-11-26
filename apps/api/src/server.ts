import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`SOLARIS API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  void checkDatabaseEncoding();
});

/** Naira signs, Nigerian names and emoji need UTF-8. Warn loudly if the database isn't. */
async function checkDatabaseEncoding() {
  try {
    const [row] = await prisma.$queryRaw<Array<{ server_encoding: string }>>`SHOW server_encoding`;
    if (row && row.server_encoding !== 'UTF8') {
      logger.error(
        `Database encoding is ${row.server_encoding}, not UTF8 — text like "₦" will be rejected. ` +
          'Recreate the database with ENCODING UTF8 (locally: node scripts/convert-local-db-utf8.mjs).',
      );
    }
  } catch {
    logger.warn('Database unreachable at startup — the calculator still works; sign-in and saving need the database.');
  }
}

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
