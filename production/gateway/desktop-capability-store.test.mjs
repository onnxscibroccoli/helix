import assert from "node:assert/strict";
import test from "node:test";

process.env.HELIX_DESKTOP_CAPABILITY_STORE = "memory";
process.env.WS_TICKET_TTL_SECONDS = "60";

const {putDesktopCapability, consumeDesktopCapability} = await import("./desktop-capability-store.mjs");

test("desktop capability is one-use", async () => {
  await putDesktopCapability("cap-a", {owner:"owner-a", workspace:"ws-a"});
  assert.deepEqual(await consumeDesktopCapability("cap-a"), {owner:"owner-a", workspace:"ws-a"});
  assert.equal(await consumeDesktopCapability("cap-a"), null);
});

test("desktop capability binds owner and workspace in the store", async () => {
  await putDesktopCapability("cap-b", {owner:"owner-b", workspace:"ws-b"});
  assert.deepEqual(await consumeDesktopCapability("cap-b"), {owner:"owner-b", workspace:"ws-b"});
});

test("concurrent memory redemption consumes once", async () => {
  await putDesktopCapability("cap-c", {owner:"owner-c", workspace:"ws-c"});
  const results = await Promise.all([
    consumeDesktopCapability("cap-c"),
    consumeDesktopCapability("cap-c"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});

console.log("desktop-capability-store: contract tests passed");
