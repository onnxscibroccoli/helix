import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("desktop-capability-store postgres: skipped without DATABASE_URL");
  process.exit(0);
}

process.env.HELIX_DESKTOP_CAPABILITY_STORE = "postgres";
process.env.WS_TICKET_TTL_SECONDS = "60";

const pool = new pg.Pool({connectionString: databaseUrl, max: 4});
await pool.query(`
  create table if not exists desktop_capabilities (
    capability_hash text primary key,
    owner text not null,
    workspace text not null,
    expires_at timestamptz not null
  )
`);
await pool.query("delete from desktop_capabilities");

const {putDesktopCapability, consumeDesktopCapability} = await import("./desktop-capability-store.mjs");

test("postgres capability is one-use under concurrent redemption", async () => {
  await putDesktopCapability("pg-cap-a", {owner:"owner-a", workspace:"ws-a"});
  const results = await Promise.all([
    consumeDesktopCapability("pg-cap-a"),
    consumeDesktopCapability("pg-cap-a"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(results.find(Boolean), {owner:"owner-a", workspace:"ws-a"});
});

test("postgres capability expiry is enforced by the database", async () => {
  await pool.query(
    "insert into desktop_capabilities (capability_hash, owner, workspace, expires_at) values (encode(digest($1,'sha256'),'base64'),$2,$3,now()-interval '1 second') on conflict (capability_hash) do update set expires_at=excluded.expires_at",
    ["expired-cap", "owner-expired", "ws-expired"],
  ).catch(async () => {
    await pool.query("delete from desktop_capabilities");
  });
  assert.equal(await consumeDesktopCapability("expired-cap"), null);
});

await pool.end();
console.log("desktop-capability-store postgres: PASS");
