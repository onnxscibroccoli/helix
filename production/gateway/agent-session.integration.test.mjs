import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function json(res, status, value) {
  const data = JSON.stringify(value);
  res.writeHead(status, {"content-type": "application/json"});
  res.end(data);
}

const hypervisorPort = await freePort();
const gatewayPort = await freePort();
const workspaces = new Map();

const hypervisor = createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  const match = u.pathname.match(/^\/domains\/([^/]+)$/);
  if (req.method === "GET" && match) {
    const workspace = workspaces.get(match[1]);
    return workspace ? json(res, 200, workspace) : json(res, 404, {error: "not found"});
  }
  if (req.method === "POST" && u.pathname === "/domains") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    const existing = workspaces.get(body.id);
    const workspace = {
      id: body.id,
      owner: body.owner ?? existing?.owner ?? null,
      kind: body.kind ?? existing?.kind ?? "persistent",
      status: "running",
      display: 9,
    };
    workspaces.set(body.id, workspace);
    return json(res, 200, workspace);
  }
  return json(res, 404, {error: "not found"});
});

workspaces.set("integration-stopped", {id:"integration-stopped", owner:"owner-a", kind:"persistent", status:"stopped", display:9});

await new Promise(resolve => hypervisor.listen(hypervisorPort, "127.0.0.1", resolve));

const gateway = spawn(process.execPath, ["production/gateway/helix-gateway.mjs"], {
  env: {
    ...process.env,
    GATEWAY_HOST: "127.0.0.1",
    GATEWAY_PORT: String(gatewayPort),
    HELIX_HYPERVISOR_URL: `http://127.0.0.1:${hypervisorPort}`,
    HELIX_PUBLIC_ORIGIN: `http://127.0.0.1:${gatewayPort}`,
    SESSION_SIGNING_SECRET: "integration-session-secret",
    HELIX_AGENT_API_SECRET: "integration-agent-secret",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("gateway startup timeout")), 10000);
    gateway.stdout.on("data", chunk => {
      if (chunk.toString().includes("oidc=false")) {
        clearTimeout(timer);
        resolve();
      }
    });
    gateway.once("exit", code => reject(new Error(`gateway exited during startup: ${code}`)));
  });

  const base = `http://127.0.0.1:${gatewayPort}`;
  const auth = {
    "content-type": "application/json",
    authorization: "Bearer integration-agent-secret",
  };

  let response = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({workspaceId: "unauthorized", owner: "owner-a", tier: "persistent"}),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({workspaceId: "integration-persist", owner: "owner-a", tier: "persistent"}),
  });
  assert.equal(response.status, 200);
  const launch = await response.json();
  assert.equal(launch.status, "running");
  assert.match(launch.session_url, /\/desktop\/capability\//);

  response = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({workspaceId: "integration-persist", owner: "owner-b", tier: "persistent"}),
  });
  assert.equal(response.status, 409);

  const capability = new URL(launch.session_url).pathname.split("/").pop();
  response = await fetch(`${base}/desktop/capability/${capability}`, {redirect: "manual"});
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("set-cookie"));

  response = await fetch(`${base}/desktop/capability/${capability}`, {redirect: "manual"});
  assert.equal(response.status, 401);

  response = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({workspaceId: "integration-persist", owner: "owner-a", tier: "persistent"}),
  });
  assert.equal(response.status, 200);

  console.log("agent-session integration: PASS");
} finally {
  gateway.kill("SIGTERM");
  hypervisor.close();
}
