// Development-only PostgreSQL that needs no installation (official binaries via
// the `embedded-postgres` npm package). Data persists in apps/api/.pgdata.
//
//   npm run db:local     → leave running, then in another terminal: npm run db:migrate
//
// Matches the default DATABASE_URL in .env.example. Never use this in production.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const databaseDir = fileURLToPath(new URL('../.pgdata', import.meta.url));
const port = Number(process.env.LOCAL_PG_PORT ?? 5432);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'solaris',
  password: 'solaris',
  port,
  persistent: true,
  // UTF-8 regardless of the Windows locale — otherwise "₦" and emoji can't be stored.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

const fresh = !existsSync(databaseDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('solaris');

console.log(`\n  PostgreSQL ready → postgresql://solaris:solaris@localhost:${port}/solaris`);
console.log('  Press Ctrl+C to stop.\n');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
