import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../scripts/hypervisor-daemon.mjs", import.meta.url), "utf8");

for (const needle of [
  "HELIX_EPHEMERAL_TTL_SECONDS",
  "state.expiresAt ||= {}",
  "state.expiresAt[id] = Date.now() + EPHEMERAL_TTL_SECONDS * 1000",
  "async function reconcileExpired()",
  "destroyDomain(id)",
  "setInterval(() => void reconcileExpired(), RECONCILE_INTERVAL_MS).unref()",
]) assert.ok(source.includes(needle), `missing ephemeral lifecycle guard: ${needle}`);

console.log("ephemeral-ttl-contract: source checks passed");
