[Reading 198 lines from start (total: 198 lines, 0 remaining)]

import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import Redis from 'ioredis';

const TASK_STATES = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

export class TaskStateStore {
  constructor({ databaseUrl = process.env.DATABASE_URL, redisUrl = process.env.REDIS_URL,
    leaseSeconds = Number(process.env.TASK_LEASE_SECONDS || 45), pool = null, redis = null } = {}) {
    if (!databaseUrl && !pool) throw new Error('DATABASE_URL is required');
    this.pool = pool || new Pool({ connectionString: databaseUrl, max: 10 });
    this.redis = redis || (redisUrl ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 }) : null);
    this.leaseMs = Math.max(5000, leaseSeconds * 1000);
  }

  async init() {
    await this.pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    return this;
  }

  async close() {
    if (this.redis) await this.redis.quit().catch(() => {});
    await this.pool.end();
  }

  async createTask({ taskId, target, payload = {}, idempotencyKey, workspaceId = null }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO omnikali_tasks (task_id,target,payload,idempotency_key,state,workspace_id)
         VALUES ($1,$2,$3::jsonb,$4,'PENDING',$5)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
        [taskId, target, JSON.stringify(payload), idempotencyKey, workspaceId]
      );      if (inserted.rowCount) {
        await client.query(
          `INSERT INTO omnikali_task_events (task_id,to_state,detail)
           VALUES ($1,'PENDING',$2::jsonb)`,
          [taskId, JSON.stringify({ reason: 'created' })]
        );
        await client.query('COMMIT');
        return inserted.rows[0];
      }
      const existing = await client.query(
        'SELECT * FROM omnikali_tasks WHERE idempotency_key = $1 FOR UPDATE', [idempotencyKey]
      );
      const row = existing.rows[0];
      if (!row) throw new Error('idempotency lookup failed');
      if (row.target !== target || row.workspace_id !== workspaceId || JSON.stringify(row.payload) !== JSON.stringify(payload)) {
        throw new Error('idempotency_key already exists with different task payload');
      }
      await client.query('COMMIT');
      return row;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  }

  async claimNext(ownerId, { target = null } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const picked = await client.query(
        `WITH candidate AS (
           SELECT task_id,state FROM omnikali_tasks
           WHERE (state='PENDING' OR (state='RUNNING' AND lease_expires_at < now()))
             AND ($1::text IS NULL OR target=$1)
           ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE omnikali_tasks t
         SET state='RUNNING', owner_id=$2, attempts=t.attempts+1,
             started_at=COALESCE(t.started_at,now()), heartbeat_at=now(),
             lease_expires_at=now()+($3::bigint*interval '1 millisecond'), updated_at=now()
         FROM candidate c WHERE t.task_id=c.task_id RETURNING t.*, c.state AS previous_state`,
        [target, ownerId, this.leaseMs]
      );
      if (!picked.rowCount) {
        await client.query('COMMIT');
        return null;
      }
      const row = picked.rows[0];
      await client.query(
        `INSERT INTO omnikali_task_events
         (task_id,from_state,to_state,owner_id,detail)
         VALUES ($1,$2,'RUNNING',$3,$4::jsonb)`,
        [row.task_id, row.previous_state, ownerId, JSON.stringify({ attempts: row.attempts })]
      );
      await client.query('COMMIT');
      return row;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  }

  async heartbeat(taskId, ownerId) {
    const result = await this.pool.query(
      `UPDATE omnikali_tasks
       SET heartbeat_at=now(),
           lease_expires_at=now()+($3::bigint*interval '1 millisecond'),
           updated_at=now()
       WHERE task_id=$1 AND owner_id=$2 AND state='RUNNING'
       RETURNING task_id,state,lease_expires_at`,
      [taskId, ownerId, this.leaseMs]
    );
    if (!result.rowCount) throw new Error('task heartbeat rejected: task is not owned or not running');
    return result.rows[0];
  }

  async complete(taskId, ownerId, result = {}) {
    return this.#finish(taskId, ownerId, 'COMPLETED', { result });
  }

  async fail(taskId, ownerId, error = {}) {
    return this.#finish(taskId, ownerId, 'FAILED', { error });
  }

  async #finish(taskId, ownerId, state, data) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT state FROM omnikali_tasks WHERE task_id=$1 FOR UPDATE', [taskId]
      );
      if (!current.rowCount) throw new Error('task not found');
      if (current.rows[0].state !== 'RUNNING') throw new Error('task is not RUNNING');
      const updated = await client.query(
        `UPDATE omnikali_tasks
         SET state=$3,
             result=CASE WHEN $3='COMPLETED' THEN $4::jsonb ELSE result END,
             error=CASE WHEN $3='FAILED' THEN $5::jsonb ELSE error END,
             completed_at=now(), updated_at=now(), lease_expires_at=NULL
         WHERE task_id=$1 AND owner_id=$2 RETURNING *`,
        [taskId, ownerId, state, JSON.stringify(data.result || null), JSON.stringify(data.error || null)]
      );
      if (!updated.rowCount) throw new Error('task completion rejected: owner mismatch');
      await client.query(
        `INSERT INTO omnikali_task_events
         (task_id,from_state,to_state,owner_id,detail)
         VALUES ($1,'RUNNING',$2,$3,$4::jsonb)`,
        [taskId, state, ownerId, JSON.stringify(data)]
      );
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  }

  async reconcileExpired() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE omnikali_tasks
         SET state='PENDING',owner_id=NULL,lease_expires_at=NULL,
             heartbeat_at=NULL,updated_at=now()
         WHERE state='RUNNING' AND lease_expires_at < now()
         RETURNING task_id,attempts`
      );
      for (const row of result.rows) {
        await client.query(
          `INSERT INTO omnikali_task_events
           (task_id,from_state,to_state,detail)
           VALUES ($1,'RUNNING','PENDING',$2::jsonb)`,
          [row.task_id, JSON.stringify({ reason: 'lease_expired', attempts: row.attempts })]
        );
      }
      await client.query('COMMIT');
      return result.rows;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  }

  async acquireLock(name, ownerId, ttlMs = this.leaseMs) {
    if (!this.redis) throw new Error('REDIS_URL is required for distributed locks');
    if (this.redis.status === 'wait') await this.redis.connect();
    return (await this.redis.set('omnikali:lock:' + name, ownerId, 'NX', 'PX', ttlMs)) === 'OK';
  }

  async releaseLock(name, ownerId) {
    if (!this.redis) throw new Error('REDIS_URL is required for distributed locks');
    const key = 'omnikali:lock:' + name;
    const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    return Number(await this.redis.eval(script, 1, key, ownerId)) === 1;
  }
}

export { TASK_STATES };

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]