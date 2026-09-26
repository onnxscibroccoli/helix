import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskRunner, createCommandExecutors } from './task-runner.mjs';

function storeFor(task) {
  const calls = [];
  return {
    calls,
    async claimNext() { calls.push(['claim']); return task; },
    async heartbeat(...args) { calls.push(['heartbeat', ...args]); },
    async complete(...args) { calls.push(['complete', ...args]); return { state: 'COMPLETED', result: args[2] }; },
    async fail(...args) { calls.push(['fail', ...args]); return { state: 'FAILED' }; },
  };
}

test('runner claims, executes, heartbeats and completes a task', async () => {
  const task = { task_id: 't1', target: 'kali', payload: { command: 'true' } };
  const store = storeFor(task);
  const seen = [];
  const runner = new TaskRunner({ store, workerId: 'worker-a', heartbeatSeconds: 1,
    executors: { kali: async t => { seen.push(t); return { exitCode: 0 }; } } });
  const result = await runner.runOnce({ target: 'kali' });
  assert.equal(result.state, 'COMPLETED');
  assert.equal(seen.length, 1);
  assert.deepEqual(store.calls.at(-1).slice(0, 2), ['complete', 't1']);
});

test('unsupported target fails without executing anything', async () => {
  const task = { task_id: 't2', target: 'windows-rdp', payload: {} };
  const store = storeFor(task);
  const runner = new TaskRunner({ store, workerId: 'worker-a', executors: {} });
  const result = await runner.runOnce();
  assert.equal(result.state, 'FAILED');
  assert.equal(result.reason, 'UNSUPPORTED_TARGET');
  assert.equal(store.calls.at(-1)[0], 'fail');
});

test('executor failure is converted into FAILED task state', async () => {
  const task = { task_id: 't3', target: 'kali', payload: {} };
  const store = storeFor(task);
  const runner = new TaskRunner({ store, workerId: 'worker-a',
    executors: { kali: async () => { throw Object.assign(new Error('boom'), { code: 'EXECUTOR_ERROR' }); } } });
  const result = await runner.runOnce();
  assert.equal(result.state, 'FAILED');
  assert.equal(result.error.code, 'EXECUTOR_ERROR');
  assert.equal(store.calls.at(-1)[0], 'fail');
});

test('command executor preserves task payload boundary', async () => {
  let received;
  const executors = createCommandExecutors({ execute: async payload => { received = payload; return { ok: true }; } });
  const payload = { command: 'printf ok', cwd: '/root', timeout: 30 };
  await executors.kali({ payload });
  assert.deepEqual(received, payload);
});
