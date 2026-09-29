import { createHash } from "node:crypto";

const mode = process.env.HELIX_DESKTOP_CAPABILITY_STORE || "postgres";
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const TTL_MS = Number(process.env.WS_TICKET_TTL_SECONDS || 60) * 1000;

let poolPromise;

function digest(capability) {
  return createHash("sha256").update(capability, "utf8").digest("base64url");
}

async function pool() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the postgres desktop capability store");
  poolPromise ??= import("pg").then(({Pool}) => new Pool({connectionString: databaseUrl, max: 4}));
  return poolPromise;
}

const memory = new Map();

function memorySet(capability, grant) {
  memory.set(capability, grant);
}

async function putPostgres(capability, grant) {
  const p = await pool();
  await p.query(
    "insert into desktop_capabilities (capability_hash, owner, workspace, expires_at) values ($1,$2,$3,now() + ($4::text || ' seconds')::interval)",
    [digest(capability), grant.owner, grant.workspace, TTL_MS / 1000],
  );
}

async function consumePostgres(capability) {
  const p = await pool();
  const result = await p.query(
    "delete from desktop_capabilities where capability_hash = $1 and expires_at > now() returning owner, workspace",
    [digest(capability)],
  );
  return result.rows[0] || null;
}

export async function putDesktopCapability(capability, grant) {
  if (mode === "memory") {
    memorySet(capability, {...grant, expiresAt: Date.now() + TTL_MS});
    return;
  }
  if (mode !== "postgres") throw new Error(`unsupported desktop capability store: ${mode}`);
  await putPostgres(capability, grant);
}

export async function consumeDesktopCapability(capability) {
  if (mode === "memory") {
    const grant = memory.get(capability);
    memory.delete(capability);
    if (!grant || grant.expiresAt <= Date.now()) return null;
    return grant;
  }
  if (mode !== "postgres") throw new Error(`unsupported desktop capability store: ${mode}`);
  return consumePostgres(capability);
}

export function desktopCapabilityStoreMode() {
  return mode;
}
