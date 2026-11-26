// One-off: convert a local development database created with a non-UTF8 encoding
// (e.g. WIN1252 on Windows) into UTF8, preserving all rows.
//
//   node scripts/convert-local-db-utf8.mjs
//
// Steps: create solaris_utf8 (UTF8) → run migrations → copy every table →
// verify row counts → rename solaris → solaris_backup_<enc>, solaris_utf8 → solaris.
// The original database is kept as a backup. Development use only.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);
const tmpName = `${dbName}_utf8`;
const at = (db) => Object.assign(new URL(url), { pathname: `/${db}` }).toString();

const admin = new pg.Client({ connectionString: at('postgres') });
await admin.connect();

const { rows: [enc] } = await admin.query('SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = $1', [dbName]);
if (!enc) throw new Error(`Database ${dbName} not found`);
if (enc.e === 'UTF8') {
  console.log(`${dbName} is already UTF8 — nothing to do.`);
  process.exit(0);
}
console.log(`${dbName} encoding is ${enc.e} → converting to UTF8`);

await admin.query(`DROP DATABASE IF EXISTS "${tmpName}"`);
await admin.query(`CREATE DATABASE "${tmpName}" WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);

execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: at(tmpName) } });

const src = new pg.Client({ connectionString: at(dbName) });
const dst = new pg.Client({ connectionString: at(tmpName) });
await src.connect();
await dst.connect();

// Keep enum/array/json values in their text form so they round-trip exactly.
const asText = (v) => v;
const { rows: tables } = await src.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
);

await dst.query('SET session_replication_role = replica'); // defer FK checks while copying
const report = [];
for (const { table_name: t } of tables) {
  const { rows: cols } = await src.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [t],
  );
  const names = cols.map((c) => `"${c.column_name}"`);
  // Cast every column to text on read; Postgres parses it back to the right type on insert.
  const { rows } = await src.query(`SELECT ${names.map((n) => `${n}::text AS ${n}`).join(', ')} FROM "${t}"`);
  // No TRUNCATE: the new database is freshly migrated and empty. (TRUNCATE … CASCADE
  // here would silently wipe tables copied earlier that reference this one.)
  for (const row of rows) {
    const values = cols.map((c) => asText(row[c.column_name]));
    const params = values.map((_, i) => `$${i + 1}`);
    await dst.query(`INSERT INTO "${t}" (${names.join(', ')}) VALUES (${params.join(', ')})`, values);
  }
  report.push({ table: t, source: rows.length });
}
await dst.query('SET session_replication_role = DEFAULT');

// Verify AFTER everything is copied, so any later side effect would be caught.
for (const r of report) {
  const { rows: [n] } = await dst.query(`SELECT count(*)::int AS n FROM "${r.table}"`);
  r.copied = n.n;
  if (n.n !== r.source) throw new Error(`Row count mismatch in ${r.table}: ${r.source} → ${n.n}`);
}
console.table(report);

await src.end();
await dst.end();
const backup = `${dbName}_backup_${enc.e.toLowerCase()}`;
await admin.query(`DROP DATABASE IF EXISTS "${backup}"`);
await admin.query(`ALTER DATABASE "${dbName}" RENAME TO "${backup}"`);
await admin.query(`ALTER DATABASE "${tmpName}" RENAME TO "${dbName}"`);
await admin.end();
console.log(`✔ ${dbName} is now UTF8. Original kept as ${backup} (drop it when you're happy).`);
