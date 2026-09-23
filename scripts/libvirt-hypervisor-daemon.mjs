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
import { createConnection } from "node:net";
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
  <features><acpi/><apic/></features>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    ${diskXml}
    <interface type='network'>
      <source network='${GUEST_NET}'/>
      <model type='virtio'/>
    </interface>
    <graphics type='vnc' listen='127.0.0.1' autoport='yes'/>
    <video><model type='virtio'/></video>
    <channel type='unix'><target type='virtio' name='org.qemu.guest_agent.0'/></channel>
  </devices>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
</domain>`;
}
