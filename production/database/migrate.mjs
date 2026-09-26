import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const migrationDir = path.join(root, 'migrations');
const pool = new Pool({ connectionString: databaseUrl, max: 2 });

try {
  await pool.query(`create table if not exists _helix_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`);
  await pool.query('select pg_advisory_lock(hashtext($1))', ['helix:migrations']);
  try {
    const files = (await fs.readdir(migrationDir)).filter((name) => /^\\d{4}_.+\\.sql$/.test(name)).sort();
    const applied = new Set((await pool.query('select filename from _helix_migrations')).rows.map((r) => r.filename));
    for (const filename of files) {
      if (applied.has(filename)) continue;
      const sql = await fs.readFile(path.join(migrationDir, filename), 'utf8');
      await pool.query('begin');
      try {
        await pool.query(sql);
        await pool.query('insert into _helix_migrations(filename) values ($1)', [filename]);
        await pool.query('commit');
        console.log(`[migrate] applied ${filename}`);
      } catch (error) {
        await pool.query('rollback');
        throw new Error(`migration ${filename} failed: ${error.message}`);
      }
    }
    console.log('[migrate] database schema is current');
  } finally {
    await pool.query('select pg_advisory_unlock(hashtext($1))', ['helix:migrations']);
  }
} finally {
  await pool.end();
}
