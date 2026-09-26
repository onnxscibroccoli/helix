import process from 'node:process';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const required = ['workspaces', 'omnikali_tasks', 'omnikali_task_events'];
  const result = await pool.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`,
    [required]
  );
  const present = new Set(result.rows.map((r) => r.table_name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`missing required tables: ${missing.join(', ')}`);
  await pool.query('select 1');
  console.log(JSON.stringify({ ok: true, database: 'reachable', requiredTables: required }));
} finally { await pool.end(); }
