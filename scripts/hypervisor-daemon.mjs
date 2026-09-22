#!/usr/bin/env node
/**
 * Nested KVM control plane.
 * Listens on 127.0.0.1:8090 — QEMU/KVM domains + RFB-over-WebSocket.
 *
 * Guest stack (verified on this node):
 *   TinyCorePure64 15 kernel+initrd (skips isolinux TIMEOUT)
 *   CDE GUI from the signed ISO (flwm / wbar / aterm)
 *   e1000 + QEMU user NAT 10.0.2.0/24 — outbound internet, no tunnel
 */
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { createConnection } from "node:net";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname as osHostname } from "node:os";
import { randomBytes as rb } from "node:crypto";
import { WebSocketServer } from "ws";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.HYPERVISOR_PORT || 8090);
const QEMU_BIN = process.env.QEMU_BIN || join(ROOT, "hypervisor/bin/qemu-system-x86_64");
const QEMU_IMG = process.env.QEMU_IMG || join(ROOT, "hypervisor/bin/qemu-img");
const ISO = process.env.HELIX_ISO || join(ROOT, "hypervisor/images/TinyCorePure64.iso");
const ISO_URL =
  process.env.HELIX_ISO_URL ||
  "http://distro.ibiblio.org/tinycorelinux/15.x/x86_64/release/TinyCorePure64-15.0.iso";
const DISKS = join(ROOT, "hypervisor/disks");
const BOOT_DIR = join(ROOT, "hypervisor/boot");
const KERNEL = join(BOOT_DIR, "vmlinuz64");
const INITRD = join(BOOT_DIR, "corepure64.gz");
const KVM_DEV = "/dev/kvm";
const GUEST_IP = "10.0.2.15";
const GUEST_NET = "10.0.2.0/24";
const KERNEL_APPEND = "loglevel=3 cde vga=791";

mkdirSync(DISKS, { recursive: true });
mkdirSync(join(ROOT, "hypervisor/images"), { recursive: true });
mkdirSync(BOOT_DIR, { recursive: true });

/** @typedef {{ id: string, kind: string, status: string, pid: number | null, vncPort: number, display: number, ticket: string, logs: string[], startedAt: string | null, memoryMb: number, vcpus: number, diskGb: number, guestIp: string, streamPath: string }} Domain */

/** @type {Map<string, Domain>} */
const domains = new Map();
/** @type {Map<number, import('node:child_process').ChildProcess>} */
const children = new Map();

function logLine(domain, line) {
  const stamp = new Date().toISOString().slice(11, 19);
  const entry = `[${stamp}] ${line}`;
  domain.logs.push(entry);
  if (domain.logs.length > 200) domain.logs.splice(0, domain.logs.length - 200);
  console.log(`[helix ${domain.id.slice(0, 8)}] ${line}`);
}

function qemuAvailable() {
  return existsSync(QEMU_BIN) || existsSync("/opt/qemu/usr/bin/qemu-system-x86_64");
}

function kvmPresent() {
  return existsSync(KVM_DEV);
}

function nestedFlag() {
  const paths = [
    "/sys/module/kvm_intel/parameters/nested",
    "/sys/module/kvm_amd/parameters/nested",
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      return readFileSync(p, "utf8").trim();
    } catch {
      /* ignore */
    }
  }
  return "unknown";
}

function nextDisplay() {
  const used = new Set([...domains.values()].map((d) => d.display));
  for (let n = 1; n <= 32; n++) if (!used.has(n)) return n;
  throw new Error("no free VNC display");
}

function qemuBin() {
  if (existsSync(QEMU_BIN)) return QEMU_BIN;
  return "/opt/qemu/usr/bin/qemu-system-x86_64";
}

function qemuImg() {
  if (existsSync(QEMU_IMG)) return QEMU_IMG;
  return "/opt/qemu/usr/bin/qemu-img";
}

function qemuEnv() {
  return {
    ...process.env,
    LD_LIBRARY_PATH: `/opt/qemu/usr/lib/x86_64-linux-gnu:/opt/qemu/lib/x86_64-linux-gnu${
      process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""
    }`,
  };
}

async function ensureIso() {
  try {
    if (existsSync(ISO) && statSync(ISO).size > 1_000_000) return;
  } catch {
    /* download */
  }
  const { createWriteStream } = await import("node:fs");
  const { pipeline } = await import("node:stream/promises");
  const res = await fetch(ISO_URL);
  if (!res.ok || !res.body) throw new Error(`ISO download failed ${res.status}`);
  await pipeline(res.body, createWriteStream(ISO));
}

function bootFilesReady() {
  try {
    return (
      existsSync(KERNEL) &&
      statSync(KERNEL).size > 1_000_000 &&
      existsSync(INITRD) &&
      statSync(INITRD).size > 1_000_000
    );
  } catch {
    return false;
  }
}

/** Pull vmlinuz64 + corepure64.gz out of the ISO so we never sit on isolinux TIMEOUT 600. */
function extractBootFromIso() {
  if (bootFilesReady()) return;
  if (!existsSync(ISO) || statSync(ISO).size < 1_000_000) {
    throw new Error("TinyCore ISO is missing; cannot extract kernel");
  }
  const buf = readFileSync(ISO);
  const SECTOR = 2048;
  const pvd = 16 * SECTOR;
  if (buf.subarray(pvd + 1, pvd + 6).toString("ascii") !== "CD001") {
    throw new Error("TinyCore image is not ISO9660");
  }
  const rootLen = buf[pvd + 156];
  const root = buf.subarray(pvd + 156, pvd + 156 + rootLen);
  const extent = root.readUInt32LE(2);
  const size = root.readUInt32LE(10);
  const wanted = { VMLINUZ64: KERNEL, "COREPURE64.GZ": INITRD };

  function walk(ext, sz) {
    let off = ext * SECTOR;
    const end = off + sz;
    while (off < end && off < buf.length) {
      const recLen = buf[off];
      if (!recLen) {
        off = (Math.floor(off / SECTOR) + 1) * SECTOR;
        continue;
      }
      const rec = buf.subarray(off, off + recLen);
      const nameLen = rec[32];
      const raw = rec
        .subarray(33, 33 + nameLen)
        .toString("ascii")
        .split(";")[0]
        .replace(/\.+$/, "");
      const loc = rec.readUInt32LE(2);
      const dlen = rec.readUInt32LE(10);
      const flags = rec[25];
      if (raw === "\u0000" || raw === "\u0001") {
        off += recLen;
        continue;
      }
      if (flags & 2) walk(loc, dlen);
      else {
        const dest = wanted[raw.toUpperCase()];
        if (dest) writeFileSync(dest, buf.subarray(loc * SECTOR, loc * SECTOR + dlen));
      }
      off += recLen;
    }
  }

  walk(extent, size);
  if (!bootFilesReady()) throw new Error("Failed to extract TinyCore kernel/initrd from ISO");
}

function probeVnc(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port });
    const t = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 800);
    sock.on("connect", () => {
      sock.once("data", (buf) => {
        clearTimeout(t);
        sock.destroy();
        resolve(buf.toString("ascii").startsWith("RFB"));
      });
    });
    sock.on("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });
}

async function waitVnc(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    if (await probeVnc(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { env: qemuEnv() }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function startDomain({ id, kind }) {
  if (!kvmPresent()) throw new Error("/dev/kvm is not present on this node");
  if (!qemuAvailable()) throw new Error("qemu-system-x86_64 is not installed on this node");
  const existing = domains.get(id);
  if (existing && existing.status === "running" && existing.pid && children.has(existing.pid)) {
    return existing;
  }
  if (existing) await stopDomain(id);

  await ensureIso();
  extractBootFromIso();

  const persistent = kind !== "ephemeral";
  const diskGb = persistent ? 8 : 2;
  const memoryMb = persistent ? 512 : 384;
  const disk = join(DISKS, `${id}.qcow2`);
  if (!existsSync(disk)) {
    await run(qemuImg(), ["create", "-f", "qcow2", disk, `${diskGb}G`]);
  }
  const display = nextDisplay();
  const vncPort = 5900 + display;
  const ticket = rb(16).toString("hex");
  /** @type {Domain} */
  const domain = {
    id,
    kind: persistent ? "persistent" : "ephemeral",
    status: "booting",
    pid: null,
    vncPort,
    display,
    ticket,
    logs: [],
    startedAt: new Date().toISOString(),
    memoryMb,
    vcpus: 1,
    diskGb,
    guestIp: GUEST_IP,
    streamPath: `/kasm/ws/${id}`,
  };
  domains.set(id, domain);
  logLine(domain, `nested=${nestedFlag()} kvm=${KVM_DEV}`);
  logLine(domain, `volume ${disk} (${diskGb}G qcow2, ide)`);
  logLine(domain, `kernel ${KERNEL} append="${KERNEL_APPEND}"`);
  logLine(domain, `nic e1000 user-nat ${GUEST_NET} dhcp ${GUEST_IP} (outbound, no tunnel)`);
  logLine(domain, `qemu ${qemuBin()} -enable-kvm -vnc 127.0.0.1:${display}`);

  const args = [
    "-enable-kvm",
    "-cpu",
    "host",
    "-machine",
    "pc,accel=kvm",
    "-m",
    String(memoryMb),
    "-smp",
    "1",
    "-kernel",
    KERNEL,
    "-initrd",
    INITRD,
    "-append",
    KERNEL_APPEND,
    "-cdrom",
    ISO,
    "-drive",
    `file=${disk},if=ide,format=qcow2`,
    "-vga",
    "std",
    "-display",
    "none",
    "-usb",
    "-device",
    "usb-tablet",
    "-vnc",
    `127.0.0.1:${display}`,
    "-netdev",
    `user,id=n0,net=${GUEST_NET},dhcpstart=${GUEST_IP},hostname=helix`,
    "-device",
    "e1000,netdev=n0",
    "-name",
    `helix-${id.slice(0, 8)}`,
    "-no-reboot",
  ];

  const child = spawn(qemuBin(), args, {
    env: qemuEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  domain.pid = child.pid ?? null;
  if (domain.pid) children.set(domain.pid, child);
  child.stdout.on("data", (b) => {
    for (const line of b.toString().split("\n").filter(Boolean)) logLine(domain, line);
  });
  child.stderr.on("data", (b) => {
    for (const line of b.toString().split("\n").filter(Boolean)) logLine(domain, line);
  });
  child.on("exit", (code, signal) => {
    logLine(domain, `qemu exited code=${code} signal=${signal ?? ""}`);
    domain.status = "stopped";
    domain.pid = null;
    if (kind === "ephemeral") {
      try {
        unlinkSync(disk);
        logLine(domain, `ephemeral volume unlinked`);
      } catch {
        /* already gone */
      }
    }
  });

  const ready = await waitVnc(vncPort);
  if (!ready) {
    child.kill("SIGKILL");
    domain.status = "stopped";
    throw new Error("VNC did not come up — guest failed to bind RFB. Check hypervisor logs.");
  }
  domain.status = "running";
  logLine(domain, `RFB 003.008 on 127.0.0.1:${vncPort} · WebSocket ${domain.streamPath}`);
  return domain;
}

async function stopDomain(id) {
  const domain = domains.get(id);
  if (!domain) return { ok: true, missing: true };
  if (domain.pid && children.has(domain.pid)) {
    const child = children.get(domain.pid);
    child?.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 400));
    try {
      if (domain.pid) process.kill(domain.pid, 0);
      child?.kill("SIGKILL");
    } catch {
      /* gone */
    }
    children.delete(domain.pid);
  }
  domain.status = "stopped";
  domain.pid = null;
  if (domain.kind === "ephemeral") {
    const disk = join(DISKS, `${id}.qcow2`);
    try {
      unlinkSync(disk);
    } catch {
      /* ignore */
    }
  }
  return { ok: true, kind: domain.kind };
}

function publicDomain(d) {
  return {
    id: d.id,
    kind: d.kind,
    status: d.status,
    vncPort: d.vncPort,
    ticket: d.ticket,
    logs: d.logs.slice(-40),
    startedAt: d.startedAt,
    memoryMb: d.memoryMb,
    vcpus: d.vcpus,
    diskGb: d.diskGb,
    guestIp: d.guestIp,
    streamPath: d.streamPath,
  };
}

async function capabilities() {
  let qemuVersion = null;
  if (qemuAvailable()) {
    try {
      qemuVersion = String(await run(qemuBin(), ["--version"])).split("\n")[0];
    } catch {
      qemuVersion = "installed";
    }
  }
  return {
    hostname: osHostname(),
    kvm: kvmPresent(),
    nested: nestedFlag(),
    qemu: qemuAvailable(),
    qemuVersion,
    iso: existsSync(ISO),
    kernel: bootFilesReady(),
    guests: [...domains.values()].filter((d) => d.status === "running").length,
    node: "hypervisor-node-local",
    region: process.env.HELIX_REGION || "local-nested-kvm",
    guestNet: GUEST_NET,
    guestIp: GUEST_IP,
    nic: "e1000 user-nat",
    guestOs: "TinyCorePure64-15.0",
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && url.pathname === "/capabilities") {
      send(res, 200, await capabilities());
      return;
    }
    if (req.method === "GET" && url.pathname === "/domains") {
      send(res, 200, [...domains.values()].map(publicDomain));
      return;
    }
    const one = url.pathname.match(/^\/domains\/([^/]+)$/);
    if (req.method === "GET" && one) {
      const d = domains.get(one[1]);
      if (!d) return send(res, 404, { error: "not found" });
      return send(res, 200, publicDomain(d));
    }
    if (req.method === "DELETE" && one) {
      await stopDomain(one[1]);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/domains") {
      const body = await readJson(req);
      if (!body?.id) return send(res, 400, { error: "id required" });
      const d = await startDomain({
        id: String(body.id),
        kind: body.kind === "ephemeral" ? "ephemeral" : "persistent",
      });
      return send(res, 200, publicDomain(d));
    }
    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : "hypervisor error" });
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const m = url.pathname.match(/^\/kasm\/ws\/([^/]+)$/);
  if (!m) {
    socket.destroy();
    return;
  }
  const domain = domains.get(m[1]);
  const ticket = url.searchParams.get("ticket");
  if (!domain || domain.status !== "running" || !ticket || ticket !== domain.ticket) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const tcp = createConnection({ host: "127.0.0.1", port: domain.vncPort });
    tcp.on("error", () => ws.close());
    ws.on("error", () => tcp.destroy());
    tcp.on("data", (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
    ws.on("message", (data) => {
      if (!tcp.destroyed) tcp.write(data);
    });
    const close = () => {
      try {
        tcp.destroy();
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
    ws.on("close", close);
    tcp.on("close", close);
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[helix-hypervisor] nested=${nestedFlag()} kvm=${kvmPresent()} qemu=${qemuAvailable()} kernel=${bootFilesReady()} :${PORT}`,
  );
});

function shutdown() {
  for (const id of [...domains.keys()]) {
    void stopDomain(id);
  }
  setTimeout(() => process.exit(0), 800);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
