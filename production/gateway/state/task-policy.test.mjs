import test from "node:test";
import assert from "node:assert/strict";
import { allowedTaskTargets, assertTaskTargetAllowed } from "./task-policy.mjs";

test("defaults to kali only", () => {
  assert.deepEqual([...allowedTaskTargets("")], ["kali"]);
});

test("parses and de-duplicates explicitly enabled targets", () => {
  assert.deepEqual([...allowedTaskTargets("kali,agent-zero,kali,hexstrike")], ["kali", "agent-zero", "hexstrike"]);
});

test("rejects an unenabled framework target", () => {
  assert.throws(() => assertTaskTargetAllowed("agent-zero", { allowed: new Set(["kali"]) }), error =>
    error.code === "TARGET_NOT_ALLOWED" && error.statusCode === 403
  );
});

test("accepts an explicitly enabled framework target", () => {
  assert.equal(assertTaskTargetAllowed("agent-zero", { allowed: new Set(["kali", "agent-zero"]) }), "agent-zero");
});

test("rejects malformed target names", () => {
  assert.throws(() => assertTaskTargetAllowed("KALI", { allowed: new Set(["KALI"]) }), error =>
    error.code === "TARGET_INVALID" && error.statusCode === 400
  );
});
