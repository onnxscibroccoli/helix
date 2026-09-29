import test from "node:test";
import assert from "node:assert/strict";
import { checkHealth } from "./verify-public-health.mjs";

test("health probe accepts only HTTP 200 with ok=true", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ok:true}), {status:200});
  const result = await checkHealth(fetchImpl, "https://example.invalid/health");
  assert.equal(result.status, "PASS");
});

test("health probe fails on a non-healthy response", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ok:false}), {status:200});
  const result = await checkHealth(fetchImpl, "https://example.invalid/health");
  assert.equal(result.status, "FAIL");
});

test("health probe is GET-only", async () => {
  let method;
  const fetchImpl = async (_url, init) => {
    method = init.method;
    return new Response(JSON.stringify({ok:true}), {status:200});
  };
  await checkHealth(fetchImpl, "https://example.invalid/health");
  assert.equal(method, "GET");
});
