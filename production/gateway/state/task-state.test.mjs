[Reading 83 lines from start (total: 83 lines, 0 remaining)]

import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskStateStore, TASK_STATES } from './task-state.mjs';

function fakePool(clientResponses, queryResponse = { rowCount: 0, rows: [] }) {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rowCount: 1, rows: [] };
      return clientResponses.length ? clientResponses.shift() : { rowCount: 0, rows: [] };
    },
    release() {}
  };
  return {
    calls,
    connect: async () => client,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return queryResponse;
    },
    end: async () => {}
  };
}

test('state constants are closed', () => {
  assert.deepEqual(TASK_STATES, {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
  });
});

test('createTask records PENDING and commits', async () => {
  const row = { task_id: '11111111-1111-1111-1111-111111111111', target: 'kali', payload: { x: 1 }, state: 'PENDING' };
  const pool = fakePool([{ rowCount: 1, rows: [row] }, { rowCount: 1, rows: [] }]);
  const store = new TaskStateStore({ pool });
  const got = await store.createTask({ taskId: row.task_id, target: 'kali', payload: { x: 1 }, idempotencyKey: 'idem-1' });
  assert.equal(got.task_id, row.task_id);
  assert.equal(pool.calls.filter(x => x.sql === 'COMMIT').length, 1);
});

test('claimNext and heartbeat bind the worker owner', async () => {
  const task = { task_id: '22222222-2222-2222-2222-222222222222', state: 'RUNNING', attempts: 1 };
  const pool = fakePool(
    [{ rowCount: 1, rows: [task] }, { rowCount: 1, rows: [] }],
    { rowCount: 1, rows: [{ task_id: task.task_id, state: 'RUNNING' }] }
  );
  const store = new TaskStateStore({ pool, leaseSeconds: 45 });
  const claimed = await store.claimNext('worker-a', { target: 'kali' });
  assert.equal(claimed.task_id, task.task_id);
  assert.ok(pool.calls.some(x => String(x.sql).includes('SELECT task_id,state FROM omnikali_tasks')));
  const beat = await store.heartbeat(task.task_id, 'worker-a');
  assert.equal(beat.task_id, task.task_id);
  assert.ok(pool.calls.some(x => String(x.sql).includes('heartbeat_at')));
});

test('stale worker completion is fenced after ownership changes', async () => {
  const taskId = '33333333-3333-3333-3333-333333333333';
  const pool = fakePool([
    { rowCount: 1, rows: [{ state: 'RUNNING' }] },
    { rowCount: 0, rows: [] }
  ]);
  const store = new TaskStateStore({ pool });
  await assert.rejects(
    () => store.complete(taskId, 'stale-worker', { ok: true }),
    /owner mismatch/
  );
  assert.equal(pool.calls.filter(x => x.sql === 'ROLLBACK').length, 1);
});

test('expired reconciliation commits state and audit atomically', async () => {
  const pool = fakePool([
    { rowCount: 1, rows: [{ task_id: '44444444-4444-4444-4444-444444444444', attempts: 2 }] },
    { rowCount: 1, rows: [] }
  ]);
  const store = new TaskStateStore({ pool });
  const rows = await store.reconcileExpired();
  assert.equal(rows.length, 1);
  assert.equal(pool.calls.filter(x => x.sql === 'BEGIN').length, 1);
  assert.equal(pool.calls.filter(x => x.sql === 'COMMIT').length, 1);
});

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]