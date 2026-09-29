import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('taskControl retains the same Kali executor for run and cancellation paths', async () => {
  const source = await readFile(new URL('./helix-gateway.mjs', import.meta.url), 'utf8');
  assert.match(source, /const executor=createAgentExecutor\(\{\}\);/);
  assert.match(source, /executors:\{kali:executor\}/);
  assert.doesNotMatch(source, /executors:\{kali:createAgentExecutor\(\{\}\)\}[\\s\\S]{0,500}executors:\{kali:executor\}/);
});
