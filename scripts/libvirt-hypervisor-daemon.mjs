#!/usr/bin/env node
/**
 * Helix libvirt-backed workspace reconciler.
 *
 * Control plane: localhost:8090
 * VM lifecycle: libvirt/qemu:///system
 * Guest network: libvirt default NAT (never public)
 * Guest display: libvirt VNC bound to localhost
 * Browser stream: authenticated upstream gateway -> /kasm/ws/:id -> this daemon
 */
import { createServer } from "node:http";
import { createConnection, execFile } from "node:net";
import { execFile as exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

const pexec = promisify(exec);
const HOST = "127.0.0.1";
const PORT = Number(process.env.HYPERVISOR_PORT ?? 8090);
const ROOT = process.env.HELIX_HYPERVISOR_ROOT ?? "/var/lib/helix-hypervisor";
const DISKS = join(ROOT, "disks");
const STATE = join(ROOT, "state");
const ISO = join(ROOT, "images", "TinyCorePure64.iso");
const KERNEL = join(ROOT, "boot", "vmlinuz64");
const INITRD = join(ROOT, "boot", "corepure64.gz");
const TINYCORE_URL =
  process.env.HELIX_ISO_URL ??
  "https://distro.ibiblio.org/tinycorelinux/15.x/x86_64/release/TinyCorePure64-15.0.iso";
const LIBVIRT = "qemu:///system";
const GUEST_NET = "default";
const GUEST_IP = "10.0.2.15";
const MAX_VCPUS = Number(process.env.HELIX_MAX_VCPUS ?? 1);
const MAX_MEMORY_MB = Number(process.env.HELIX_MAX_MEMORY_MB ?? 768);

mkdirSync(DISKS, { recursive: true });
mkdirSync(STATE, { recursive: true });
mkdirSync(join(ROOT, "images"), { recursive: true });
mkdirSync(join(ROOT, "boot"), { recursive: true });

const domains = new Map();

function shell(cmd, args = []) {
  return pexec(cmd, args, { maxBuffer: 8 * 1024 * 1024 });
}

async function virsh(args, allowFailure = false) {
  try {
    const { stdout } = await shell("virsh", ["-c", LIBVIRT, ...args]);
    return stdout.trim();
  } catch (e) {
    if (allowFailure) return "";
    throw new Error(e.stderr?.trim() || e.message);
  }
}

async function qemuImg(args) {
  return shell("qemu-img", args);
}

async function ensureNetwork() {
  await virsh(["net-start", GUEST_NET], true);
  await virsh(["net-autostart", GUEST_NET], true);
}

function safeId(id) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) throw new Error("invalid workspace id");
  return id;
}

function statePath(id) {
  return join(STATE, id + ".json");
}

function saveState(d) {
  writeFileSync(statePath(d.id), JSON.stringify({
    id: d.id, kind: d.kind, ticket: d.ticket, createdAt: d.createdAt,
  }, null, 2));
}

function loadState(id) {
  try { return JSON.parse(readFileSync(statePath(id), "utf8")); } catch { return null; }
}

function removeState(id) {
  try { unlinkSync(statePath(id)); } catch {}
}

async function ensureTinyCore() {
  if (!existsSync(ISO) || statSync(ISO).size < 1_000_000) {
    const res = await fetch(TINYCORE_URL);
    if (!res.ok || !res.body) throw new Error("TinyCore ISO download failed");
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(ISO, bytes);
  }
  if (existsSync(KERNEL) && existsSync(INITRD)) return;
  // TinyCore's boot files are at the ISO root on the official release image.
  await shell("mount", ["-o", "loop,ro", ISO, "/mnt"]);
  try {
    const candidates = [
      ["/mnt/boot/vmlinuz64", "/mnt/boot/corepure64.gz"],
      ["/mnt/vmlinuz64", "/mnt/corepure64.gz"],
    ];
    const found = candidates.find(([k, i]) => existsSync(k) && existsSync(i));
    if (!found) throw new Error("TinyCore kernel/initrd not found in ISO");
    const { stdout: k } = await shell("cp", [found[0], KERNEL]);
    void k;
    await shell("cp", [found[1], INITRD]);
  } finally {
    await shell("umount", ["/mnt"], true);
  }
}

async function domainExists(id) {
  const out = await virsh(["dominfo", id], true);
  return Boolean(out);
}

async function domainState(id) {
  const out = await virsh(["domstate", id], true);
  return out || "absent";
}

async function vncPort(id) {
  const xml = await virsh(["dumpxml", id]);
  const m = xml.match(/<graphics[^>]*type='vnc'[^>]*port='(\d+)'/);
  if (!m) throw new Error("domain has no VNC graphics");
  return Number(m[1]);
}

async function domainXml(id, kind, disk) {
  const memory = kind === "ephemeral" ? 384 : 768;
  const diskSize = kind === "ephemeral" ? 2 : 8;
  if (memory > MAX_MEMORY_MB) throw new Error("memory policy exceeded");
  const diskXml = `<disk type='file' device='disk'><driver name='qemu' type='qcow2'/><source file='${disk}'/><target dev='vda' bus='virtio'/></disk>`;
  return `<domain type='kvm'>
  <name>${id}</name>
  <memory unit='MiB'>${memory}</memory>
  <currentMemory unit='MiB'>${memory}</currentMemory>
  <vcpu placement='static'>${Math.min(MAX_VCPUS, 1)}</vcpu>
  <os>
    <type arch='x86_64' machine='pc'>hvm</type>
    <kernel>${KERNEL}</kernel>
    <initrd>${INITRD}</initrd>
    <cmdline>loglevel=3 cde vga=791</cmdline>
    <boot dev='hd'/>
  </os>
  ${diskXml}
  <interface type='network'>
    <source network='${GUEST_NET}'/>
    <model type='virtio'/>
  </interface>
  <graphics type='vnc' listen='127.0.0.1' autoport='yes'/>
  <video><model type='virtio'/></video>
  <channel type='unix'><target type='virtio' name='org.qemu.guest_agent.0'/></channel>
  <features><acpi/><apic/></features>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
</domain>`;
}

async function reconcileOne(id) {
  const state = loadState(id);
  if (!state || !(await domainExists(id))) return null;
  const status = await domainState(id);
  const port = status === "running" ? await vncPort(id) : null;
  const d = {
    id, kind: state.kind, status: status === "running" ? "running" : "stopped",
    vncPort: port, ticket: state.ticket, logs: [
      `libvirt domain=${id}`,
      `state=${status}`,
      port ? `RFB 127.0.0.1:${port}` : "RFB unavailable",
    ],
    startedAt: state.createdAt, memoryMb: state.kind === "ephemeral" ? 384 : 768,
    vcpus: 1, diskGb: state.kind === "ephemeral" ? 2 : 8,
    guestIp: GUEST_IP, streamPath: `/kasm/ws/${id}`,
  };
  domains.set(id, d);
  return d;
}

async function startDomain({ id, kind }) {
  id = safeId(id);
  kind = kind === "ephemeral" ? "ephemeral" : "persistent";
  await ensureNetwork();
  await ensureTinyCore();

  const existing = await reconcileOne(id);
  if (existing?.status === "running") return existing;
  if (await domainExists(id)) await virsh(["destroy", id], true);

  const disk = join(DISKS, id + ".qcow2");
  const size = kind === "ephemeral" ? "2G" : "8G";
  if (!existsSync(disk)) await qemuImg(["create", "-f", "qcow2", disk, size]);

  const xml = await domainXml(id, kind, disk);
  const xmlPath = join(STATE, id + ".xml");
  writeFileSync(xmlPath, xml);
  await virsh(["define", xmlPath]);
  await virsh(["start", id]);

  const d = {
    id, kind, status: "running", vncPort: await vncPort(id),
    ticket: randomBytes(24).toString("base64url"), logs: [
      "libvirt define succeeded",
      "libvirt start succeeded",
      `KVM domain active · VNC 127.0.0.1:${await vncPort(id)}`,
    ],
    startedAt: new Date().toISOString(),
    memoryMb: kind === "ephemeral" ? 384 : 768, vcpus: 1,
    diskGb: kind === "ephemeral" ? 2 : 8, guestIp: GUEST_IP,
    streamPath: `/kasm/ws/${id}`,
  };
  domains.set(id, d);
  saveState(d);
  return d;
}

async function stopDomain(id) {
  id = safeId(id);
  const d = domains.get(id) ?? await reconcileOne(id);
  await virsh(["destroy", id], true);
  await virsh(["undefine", id], true);
  if (d?.kind === "ephemeral") {
    try { unlinkSync(join(DISKS, id + ".qcow2")); } catch {}
  }
  domains.delete(id);
  removeState(id);
  return { ok: true, kind: d?.kind ?? "unknown" };
}

function publicDomain(d) {
  return {
    id: d.id, kind: d.kind, status: d.status, vncPort: d.vncPort,
    ticket: d.ticket, logs: d.logs.slice(-40), startedAt: d.startedAt,
    memoryMb: d.memoryMb, vcpus: d.vcpus, diskGb: d.diskGb,
    guestIp: d.guestIp, streamPath: d.streamPath,
  };
}

async function reconcileAll() {
  await ensureNetwork();
  let ids = [];
  try {
    const raw = await virsh(["list", "--all", "--name"]);
    ids = raw.split("\n").map(s => s.trim()).filter(Boolean);
  } catch {}
  for (const id of ids) await reconcileOne(id);
}

async function capabilities() {
  let qemuVersion = null;
  try { qemuVersion = (await shell("qemu-system-x86_64", ["--version"])).stdout.split("\n")[0]; } catch {}
  return {
    hostname: hostname(), kvm: existsSync("/dev/kvm"),
    nested: (() => {
      for (const p of ["/sys/module/kvm_intel/parameters/nested","/sys/module/kvm_amd/parameters/nested"]) {
        try { return readFileSync(p, "utf8").trim(); } catch {}
      }
      return "unknown";
    })(),
    qemu: Boolean(qemuVersion), qemuVersion,
    iso: existsSync(ISO), kernel: existsSync(KERNEL) && existsSync(INITRD),
    guests: [...domains.values()].filter(d => d.status === "running").length,
    node: "libvirt-nested-kvm", region: process.env.HELIX_REGION ?? "us-east-1",
    guestNet: "10.0.2.0/24", guestIp: GUEST_IP, nic: "virtio libvirt NAT",
    guestOs: "TinyCorePure64-15.0",
  };
}

function body(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", c => parts.push(c));
    req.on("end", () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts)) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function send(res, code, value) {
  const data = JSON.stringify(value);
  res.writeHead(code, {"content-type":"application/json","content-length":Buffer.byteLength(data)});
  res.end(data);
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && u.pathname === "/health") return send(res, 200, {ok:true});
    if (req.method === "GET" && u.pathname === "/capabilities") return send(res, 200, await capabilities());
    if (req.method === "GET" && u.pathname === "/domains") return send(res, 200, [...domains.values()].map(publicDomain));
    const m = u.pathname.match(/^\/domains\/([^/]+)$/);
    if (m && req.method === "GET") {
      const d = domains.get(m[1]) ?? await reconcileOne(m[1]);
      return d ? send(res, 200, publicDomain(d)) : send(res, 404, {error:"not found"});
    }
    if (m && req.method === "DELETE") return send(res, 200, await stopDomain(m[1]));
    if (req.method === "POST" && u.pathname === "/domains") {
      const b = await body(req);
      return send(res, 200, publicDomain(await startDomain({id:String(b.id),kind:b.kind})));
    }
    return send(res, 404, {error:"not found"});
  } catch (e) {
    return send(res, 500, {error:e instanceof Error ? e.message : "hypervisor error"});
  }
});

const wss = new WebSocketServer({noServer:true});
server.on("upgrade", (req, socket, head) => {
  const u = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const m = u.pathname.match(/^\/kasm\/ws\/([^/]+)$/);
  const d = m ? domains.get(m[1]) : null;
  if (!d || d.status !== "running" || u.searchParams.get("ticket") !== d.ticket) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    const tcp = createConnection({host:"127.0.0.1",port:d.vncPort});
    tcp.on("error", () => ws.close());
    tcp.on("data", data => { if (ws.readyState === ws.OPEN) ws.send(data); });
    ws.on("message", data => { if (!tcp.destroyed) tcp.write(data); });
    const close = () => { try { tcp.destroy(); } catch {} };
    ws.on("close", close); tcp.on("close", () => { try { ws.close(); } catch {} });
  });
});

await reconcileAll();
server.listen(PORT, HOST, () => console.log(`[helix-libvirt] KVM=${existsSync("/dev/kvm")} port=${PORT}`));
