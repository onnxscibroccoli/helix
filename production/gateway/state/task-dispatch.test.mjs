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

test('dispatch rejects a framework target until its executor is explicitly enabled', async () => {
  const dispatch = createTaskDispatch({ store: { createTask: async () => {} }, runner: {}, allowedTargets: new Set(['kali']) });
  await assert.rejects(() => dispatch({ target: 'agent-zero', idempotencyKey: 'idem-agent' }), e => e.statusCode === 403 && e.code === 'TARGET_NOT_ALLOWED');
});

test('dispatch accepts a framework target only when explicitly enabled', async () => {
  let received;
  const store = { createTask: async x => (received = x, { task_id: x.taskId, state: 'PENDING' }) };
  const dispatch = createTaskDispatch({ store, runner: {}, allowedTargets: new Set(['kali', 'agent-zero']) });
  await dispatch({ taskId: 't-agent', target: 'agent-zero', payload: { profile: 'local-test' }, idempotencyKey: 'idem-agent' });
  assert.equal(received.target, 'agent-zero');
});
