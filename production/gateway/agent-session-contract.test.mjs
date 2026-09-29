import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const required = [
  ["POST /api/v1/sessions", "server-to-server launch"],
  ["HELIX_AGENT_API_SECRET", "agent authentication"],
  ["workspaceId", "idempotency key"],
  ["persistent", "persistent tier"],
  ["ephemeral", "ephemeral tier"],
  ["session_url", "desktop capability"],
  ["/kasm/ws/", "authenticated desktop stream"],
];

const source = await readFile(new URL("./helix-gateway.mjs", import.meta.url), "utf8");
for (const [needle, meaning] of required) assert.ok(source.includes(needle), `missing ${meaning}: ${needle}`);
assert.ok(source.includes('return json(res,401,{error:"unauthorized"})'));
assert.ok(source.includes('return json(res,409,{error:"workspace belongs to another owner"})'));
assert.ok(source.includes('return json(res,202,{workspaceId:id,status:d.body.status,operationId:id})'));
assert.ok(source.includes('return json(res,200,{session_url:PUBLIC_ORIGIN'));
console.log("agent-session-contract: source contract checks passed");