import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentExecutor } from './agent-executor.mjs';

test('agent executor sends only the task payload execution fields', async () => {
  let request;
  const execute = createAgentExecutor({ token: 'test-token', baseUrl: 'http://agent.test/', fetchImpl: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 'run-1', exitCode: 0, stdout: 'ok', stderr: '' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  const result = await execute({ task_id: "task-1", idempotency_key: "idem-1", payload: { command: 'printf ok', cwd: '/tmp', timeout: 12, ignored: 'x' } });
  assert.equal(result.stdout, 'ok');
  assert.equal(request.url, 'http://agent.test/execute');
  assert.equal(request.options.headers.authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), { operation_key: "idem-1", command: "printf ok", cwd: "/tmp", timeout: 12 });
});

test('agent HTTP errors become fenced executor errors', async () => {
  const execute = createAgentExecutor({ token: 'test-token', fetchImpl: async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) });
  await assert.rejects(() => execute({ payload: { command: 'true' } }), error => error.code === 'AGENT_HTTP_401');
});

test('agent executor exposes durable operation cancellation', async () => {
  const requests = [];
  const execute = createAgentExecutor({ token: 'test-token', baseUrl: 'http://agent.test/', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ acknowledged: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }});
  const result = await execute.cancelOperation('idem-2');
  assert.equal(result.acknowledged, true);
  assert.equal(requests[0].url, 'http://agent.test/cancel');
  assert.deepEqual(JSON.parse(requests[0].options.body), { operation_key: 'idem-2' });
});
