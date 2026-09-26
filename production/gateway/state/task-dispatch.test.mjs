import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskDispatch } from './task-dispatch.mjs';

test('dispatch validates contract and persists idempotent task request', async () => {
  let received;
  const store = { createTask: async x => (received = x, { task_id: x.taskId, state: 'PENDING' }) };
  const dispatch = createTaskDispatch({ store, runner: {} });
  const result = await dispatch({ taskId: 't1', target: 'kali', payload: { command: 'true' }, idempotencyKey: 'idem-1', workspaceId: 'omnikali' });
  assert.equal(result.state, 'PENDING');
  assert.deepEqual(received, { taskId: 't1', target: 'kali', payload: { command: 'true' }, idempotencyKey: 'idem-1', workspaceId: 'omnikali' });
});

test('dispatch rejects missing idempotency key', async () => {
  const dispatch = createTaskDispatch({ store: { createTask: async () => {} }, runner: {} });
  await assert.rejects(() => dispatch({ target: 'kali' }), e => e.statusCode === 400 && e.message === 'idempotency_key is required');
});
