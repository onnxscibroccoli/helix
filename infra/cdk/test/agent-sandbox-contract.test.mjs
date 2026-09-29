import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("agent sandbox entrypoint requires explicit account separation", async () => {
  const source = await readFile(new URL("../bin/agent-sandbox.ts", import.meta.url), "utf8");
  assert.match(source, /OMNIKALI_SANDBOX_ACCOUNT_ID/);
  assert.match(source, /OMNIKALI_PRODUCTION_ACCOUNT_ID/);
  assert.match(source, /account !== sandboxAccount/);
  assert.match(source, /sandboxAccount === productionAccount/);
});

test("agent sandbox guardrail denies production role assumption and unbounded IAM", async () => {
  const source = await readFile(new URL("../lib/agent-sandbox-guardrail-stack.ts", import.meta.url), "utf8");
  assert.match(source, /DenyProductionRoles/);
  assert.match(source, /DenyCrossAccountRoleAssumption/);
  assert.match(source, /RequireSandboxBoundary/);
  assert.match(source, /ProtectBoundary/);
});
