import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskWorker } from './task-worker.mjs';

test('worker serializes ticks', async () => {
  let active = 0, max = 0, calls = 0;
  let release;
  const gate = new Promise(r => { release = r; });
  const worker = new TaskWorker({ runner: { runOnce: async () => { active++; max = Math.max(max, active); calls++; await gate; active--; return 'ok'; } } });
  const a = worker.tick(); const b = worker.tick();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(calls, 1); assert.equal(max, 1);
  release(); await a; assert.equal(await b, null);
});
