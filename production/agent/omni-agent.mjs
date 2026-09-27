import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { loadAgentBridgeToken } from "./agent-secret.mjs";

const execFileAsync = promisify(execFile);
const HOST = process.env.AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.AGENT_PORT || 8093);
const VM = process.env.AGENT_VM || "helix-omnikali";
const MAX_BODY = 1024 * 1024;
let tokenPromise = loadAgentBridgeToken();
const activeOperations = new Map();

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("request too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}async function authorized(req) {
  const h = req.headers.authorization || "";
  const token = await tokenPromise;
  return h === `Bearer ${token}`;
}

async function guestExec(operationKey, command, cwd = "/root", timeout = 300) {
  if (!operationKey || activeOperations.has(operationKey)) throw Object.assign(new Error("operation is already active"), { code: "OPERATION_IN_FLIGHT" });
  const payload = JSON.stringify({
    execute: "guest-exec",
    arguments: {
      path: "/bin/sh",
      arg: ["-lc", `cd -- ${JSON.stringify(cwd)} && ${command}`],
      "capture-output": true
    }
  });
  const { stdout } = await execFileAsync(
    "/usr/bin/virsh",
    ["-c", "qemu:///system", "qemu-agent-command", VM, payload],
    { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
  );
  const pid = JSON.parse(stdout).return.pid;
  activeOperations.set(operationKey, { pid, startedAt: Date.now() });
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    const statusPayload = JSON.stringify({
      execute: "guest-exec-status",
      arguments: { pid }
    });
    const { stdout: statusOut } = await execFileAsync(
      "/usr/bin/virsh",
      ["-c", "qemu:///system", "qemu-agent-command", VM, statusPayload],
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
    );    const status = JSON.parse(statusOut).return;
    if (status.exited) {
      activeOperations.delete(operationKey);
      return {
        exitCode: status.exitcode ?? null,
        signal: status.signal ?? null,
        stdout: Buffer.from(status["out-data"] || "", "base64").toString(),
        stderr: Buffer.from(status["err-data"] || "", "base64").toString()
      };
    }
    await new Promise(r => setTimeout(r, 250));
  }
  activeOperations.delete(operationKey);
  throw new Error("guest command timeout");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health")
      return json(res, 200, { ok: true, service: "omni-agent", vm: VM });
    if (req.method !== "POST" || !["/execute", "/cancel"].includes(url.pathname))
      return json(res, 404, { error: "not found" });
    if (!(await authorized(req))) return json(res, 401, { error: "unauthorized" });
    const body = await readBody(req);
    const operationKey = String(body.operation_key || "");
    if (!operationKey || operationKey.length > 512) return json(res, 400, { error: "operation_key is required" });
    if (url.pathname === "/cancel") {
      const active = activeOperations.get(operationKey);
      if (!active) return json(res, 200, { acknowledged: false, operation_key: operationKey, reason: "not_active" });
      try {
        const killPayload = JSON.stringify({ execute: "guest-exec", arguments: { path: "/bin/kill", arg: ["-TERM", String(active.pid)], "capture-output": true } });
        await execFileAsync("/usr/bin/virsh", ["-c", "qemu:///system", "qemu-agent-command", VM, killPayload], { timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
        return json(res, 200, { acknowledged: true, operation_key: operationKey, requestedAt: new Date().toISOString() });
      } catch {
        return json(res, 502, { error: "cancellation signal could not be delivered" });
      }
    }
    const command = String(body.command || "");
    const cwd = String(body.cwd || "/root");
    const timeout = Math.min(Math.max(Number(body.timeout || 300), 1), 900);
    if (!command.trim()) return json(res, 400, { error: "command is required" });
    if (!cwd.startsWith("/") || cwd.includes("\0"))
      return json(res, 400, { error: "invalid cwd" });
    const id = randomUUID();
    console.log(JSON.stringify({ event: "execute", id, command, cwd, timeout }));
    const result = await guestExec(operationKey, command, cwd, timeout);
    console.log(JSON.stringify({ event: "complete", id, exitCode: result.exitCode }));
    return json(res, 200, { id, operation_key: operationKey, vm: VM, canceled: result.signal === "SIGTERM", ...result });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e?.message || "agent error" });
  }
});

tokenPromise.catch(error => { console.error("agent bridge secret unavailable:", error?.message || error); process.exitCode = 1; });
server.listen(PORT, HOST, () => console.log(`[omni-agent] ${HOST}:${PORT} vm=${VM}`));
