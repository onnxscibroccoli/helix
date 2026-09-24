#!/usr/bin/env node
/**
 * Helix libvirt-backed workspace reconciler.
 *
 * Control API: 127.0.0.1:8090
 * Hypervisor: qemu:///system (libvirt)
 * Display: per-domain localhost-only VNC
 *
 * The gateway is responsible for authenticating users and issuing the short-lived
 * ticket used by /kasm/ws/:id. This process never exposes libvirt or VNC publicly.
 */
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";

const exec = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number(process.env.HYPERVISOR_PORT || 8090);
const VIRSH = process.env.VIRSH_BIN || "/usr/bin/virsh";
const QEMU_IMG = process.env.QEMU_IMG || "/usr/bin/qemu-img";
const URI = "qemu:///system";
const ROOT = "/var/lib/helix";
const DISKS = process.env.HELIX_DISKS || `${ROOT}/disks`;
const STATE = process.env.HELIX_HYPERVISOR_STATE || `${ROOT}/hypervisor-state.json`;
const BASE = process.env.HELIX_BASE_IMAGE || `${DISKS}/debian-13-generic-amd64.qcow2`;
const MEMORY_MB = Number(process.env.HELIX_VM_MEMORY_MB || 1024);
const VCPUS = Number(process.env.HELIX_VM_VCPUS || 1);
const BRIDGE = process.env.HELIX_LIBVIRT_NETWORK || "default";
const STORAGE_AGENT_URL = process.env.HELIX_STORAGE_AGENT_URL || "";
const STORAGE_AGENT_TOKEN = process.env.HELIX_STORAGE_AGENT_TOKEN || "";
const PERSISTENT_DISK_GB = Number(process.env.HELIX_PERSISTENT_DISK_GB || 20);

mkdirSync(DISKS, { recursive: true });
mkdirSync(ROOT, { recursive: true });

function loadState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); }
  catch { return { tickets: {}, kinds: {}, owners: {} }; }
}
let state = loadState();
state.storage ||= {};
state.owners ||= {};
function saveState() { writeFileSync(STATE, JSON.stringify(state, null, 2)); }

async function sh(args) {
  const { stdout } = await exec(VIRSH, ["-c", URI, ...args], { timeout: 15000 });
  return stdout.trim();
}
async function qemuImg(args) {
  const { stdout } = await exec(QEMU_IMG, args, { timeout: 30000 });
  return stdout.trim();
}
async function qga(name,payload){
  const {stdout}=await exec(VIRSH,["-c",URI,"qemu-agent-command",name,JSON.stringify(payload)],{timeout:15000});
  return JSON.parse(stdout.trim());
}
async function setGuestPassword(id,username,password){
  if(username!=="kali") throw new Error("only the Kali desktop user can be changed");
  const name=domainName(id);
  if(!(await existsDomain(name))) throw new Error("workspace not found");
  if((await domainState(name))!=="running") throw new Error("workspace is not running");
  const response=await qga(name,{execute:"guest-set-user-password",arguments:{
    username,
    password:Buffer.from(password,"utf8").toString("base64"),
    crypted:false
  }});
  if(response.error) throw new Error(response.error.desc||"guest password update failed");
  return {ok:true,username};
}
function validId(id) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id);
}
function domainName(id) { return `helix-${id}`; }
function diskPath(id) { return `${DISKS}/${id}.qcow2`; }
async function storageEnsure(id) {
  if (!STORAGE_AGENT_URL) return null;
  const response = await fetch(`${STORAGE_AGENT_URL}/volumes/ensure`, {
    method: "POST",
    headers: {"content-type": "application/json", "authorization": `Bearer ${STORAGE_AGENT_TOKEN}`},
    body: JSON.stringify({workspaceId: id, sizeGb: PERSISTENT_DISK_GB}),
  });
  if (!response.ok) throw new Error(`storage agent ensure failed: ${response.status}`);
  return response.json();
}

async function existsDomain(name) {
  try { await sh(["dominfo", name]); return true; } catch { return false; }
}
async function domainState(name) {
  try { return (await sh(["domstate", name])).trim(); } catch { return "absent"; }
}
async function createDisk(id, sizeGb, persistentMount = null) {
  const disk = persistentMount ? `${persistentMount}/disk.qcow2` : diskPath(id);
  mkdirSync(persistentMount || DISKS, { recursive: true });
  if (existsSync(disk)) return disk;
  if (!existsSync(BASE)) throw new Error("base image missing; install the Helix host bootstrap/base image first");
  await qemuImg(["create", "-f", "qcow2", "-F", "qcow2", "-b", BASE, disk, `${sizeGb}G`]);
  return disk;
}
async function defineDomain(id, kind) {
  const name = domainName(id);
  const storage = kind === "persistent" ? await storageEnsure(id) : null;
  const disk = await createDisk(id, kind === "ephemeral" ? 8 : PERSISTENT_DISK_GB, storage?.mountPath || null);
  const xml = `<domain type='kvm'>
  <name>${name}</name>
  <memory unit='MiB'>${MEMORY_MB}</memory>
  <currentMemory unit='MiB'>${MEMORY_MB}</currentMemory>
  <vcpu placement='static'>${VCPUS}</vcpu>
  <os><type arch='x86_64' machine='pc'>hvm</type><boot dev='hd'/></os>
  <features><acpi/><apic/></features>
  <cpu mode='host-passthrough' check='none'/>
  <clock offset='utc'/>
  <on_poweroff>destroy</on_poweroff><on_reboot>restart</on_reboot><on_crash>destroy</on_crash>
  <devices>
    <disk type='file' device='disk'><driver name='qemu' type='qcow2' cache='none'/><source file='${disk}'/><target dev='vda' bus='virtio'/></disk>
    <interface type='network'><source network='${BRIDGE}'/><model type='virtio'/></interface>
    <graphics type='vnc' listen='127.0.0.1' autoport='yes'/>
    <video><model type='virtio' heads='1'/></video>
    <input type='tablet' bus='usb'/>
    <channel type='unix'><target type='virtio' name='org.qemu.guest_agent.0'/></channel>
  </devices>
</domain>`;
  const file = `${ROOT}/${name}.xml`;
  writeFileSync(file, xml);
  try { await sh(["define", file]); } finally { try { unlinkSync(file); } catch {} }
  state.kinds[id] = kind;
  if (storage) state.storage[id] = storage;
  if (!state.tickets[id]) state.tickets[id] = randomBytes(24).toString("base64url");
  saveState();
  return name;
}
async function startDomain(id, kind, owner) {
  if (!validId(id)) throw new Error("invalid workspace id");
  const name = domainName(id);
  const exists = await existsDomain(name);
  if (!exists) await defineDomain(id, kind);
  if (owner) { state.owners[id] = String(owner); saveState(); }
  const s = await domainState(name);
  if (s !== "running") await sh(["start", name]);
  return describe(id);
}
async function stopDomain(id) {
  const name = domainName(id);
  if (!(await existsDomain(name))) return { ok: true, missing: true };
  const s = await domainState(name);
  if (s === "running") await sh(["shutdown", name]).catch(() => {});
  return { ok: true, state: await domainState(name) };
}
async function destroyDomain(id) {
  const name = domainName(id);
  if (await existsDomain(name)) {
    const s = await domainState(name);
    if (s === "running") await sh(["destroy", name]).catch(() => {});
    await sh(["undefine", name, "--nvram"]).catch(() => sh(["undefine", name]));
  }
  if (state.kinds[id] === "ephemeral") {
    try { unlinkSync(diskPath(id)); } catch {}
  }
  // Persistent workspaces retain their provider volume. Deleting a domain must
  // never delete the user's persistent EBS volume. The tagged volume remains
  // discoverable and can be remounted if the workspace is recreated.
  delete state.tickets[id];
  delete state.owners[id];
  delete state.storage[id];
  delete state.kinds[id];
  saveState();
  delete state.storage[id];
  delete state.kinds[id];
  saveState();
  return { ok: true };
}
async function describe(id) {
  const name = domainName(id);
  if (!(await existsDomain(name))) return null;
  const stateName = await domainState(name);
  let display = "";
  try { display = await sh(["domdisplay", name]); } catch {}
  const m = display.match(/:(\d+)$/);
  const displayNumber = m ? Number(m[1]) : null;
  const disk = state.storage[id]?.mountPath ? `${state.storage[id].mountPath}/disk.qcow2` : diskPath(id);
  return {
    id, owner: state.owners[id] || null, kind: state.kinds[id] || "persistent", status: stateName === "running" ? "running" : "stopped",
    domain: name, display: displayNumber, vnc: display,
    ticket: state.tickets[id] || null, streamPath: `/kasm/ws/${id}`,
    memoryMb: MEMORY_MB, vcpus: VCPUS, disk, storage: state.storage[id] || null
  };
}
async function capabilities() {
  let kvm = false, nested = "unknown", libvirt = false;
  try { kvm = existsSync("/dev/kvm"); await sh(["version"]); libvirt = true; } catch {}
  for (const p of ["/sys/module/kvm_intel/parameters/nested","/sys/module/kvm_amd/parameters/nested"]) {
    if (existsSync(p)) { try { nested = readFileSync(p,"utf8").trim(); } catch {} }
  }
  return { hostname: requireHost(), kvm, nested, libvirt, qemuSystem: existsSync("/usr/bin/qemu-system-x86_64"), uri: URI, network: BRIDGE };
}
function requireHost() { return process.env.HOSTNAME || "helix-hypervisor"; }
async function domains() {
  let names = [];
  try { names = (await sh(["list","--name"])).split("\n").map(x=>x.trim()).filter(Boolean); } catch {}
  const out=[];
  for (const name of names.filter(n=>n.startsWith("helix-"))) {
    const id=name.slice(6); const d=await describe(id); if(d) out.push(d);
  }
  return out;
}
function json(res, code, body) {
  const data=JSON.stringify(body); res.writeHead(code, {"content-type":"application/json","content-length":Buffer.byteLength(data)}); res.end(data);
}
function body(req) {
  return new Promise((resolve,reject)=>{ const c=[]; req.on("data",x=>c.push(x)); req.on("end",()=>{try{resolve(c.length?JSON.parse(Buffer.concat(c)):{});}catch(e){reject(e);}}); req.on("error",reject); });
}

const server=createServer(async(req,res)=>{
  const url=new URL(req.url||"/",`http://${HOST}:${PORT}`);
  try {
    if(req.method==="GET" && url.pathname==="/health") return json(res,200,{ok:true});
    if(req.method==="GET" && url.pathname==="/capabilities") return json(res,200,await capabilities());
    if(req.method==="GET" && url.pathname==="/domains") return json(res,200,await domains());
    const m=url.pathname.match(/^\/domains\/([^/]+)$/);
    if(m && req.method==="POST" && url.pathname.endsWith("/password")) {
      const b=await body(req);
      const username=String(b.username||"");
      const password=String(b.password||"");
      if(!["root","kali"].includes(username) || password.length<12 || password.length>128 || /[\u0000-\u001f\u007f]/.test(password))
        return json(res,400,{error:"invalid password"});
      return json(res,200,await setGuestPassword(m[1],username,password));
    }
    if(m && req.method==="GET") { const d=await describe(m[1]); return d?json(res,200,d):json(res,404,{error:"not found"}); }
    if(m && req.method==="DELETE") return json(res,200,await destroyDomain(m[1]));
    if(req.method==="POST" && url.pathname==="/domains") {
      const b=await body(req); if(!b.id) return json(res,400,{error:"id required"});
      return json(res,200,await startDomain(String(b.id),b.kind==="ephemeral"?"ephemeral":"persistent",b.owner));
    }
    if(req.method==="POST" && url.pathname.endsWith("/stop")) {
      const id=url.pathname.split("/")[2]; return json(res,200,await stopDomain(id));
    }
    return json(res,404,{error:"not found"});
  } catch(e) { return json(res,500,{error:e?.message||"hypervisor error"}); }
});

const wss=new WebSocketServer({noServer:true});
server.on("upgrade",(req,socket,head)=>{
  const url=new URL(req.url||"/",`http://${HOST}:${PORT}`);
  const m=url.pathname.match(/^\/kasm\/ws\/([^/]+)$/);
  if(!m){socket.destroy();return;}
  const id=m[1], ticket=url.searchParams.get("ticket"), expected=state.tickets[id];
  if(!ticket || ticket!==expected){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return;}
  void describe(id).then(d=>{
    if(!d || d.status!=="running" || !d.vnc){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>{
      const port=5900+(d.display||0);
      const tcp=createConnection({host:"127.0.0.1",port});
      const close=()=>{try{tcp.destroy();}catch{} try{if(ws.readyState===ws.OPEN)ws.close();}catch{}};
      tcp.on("data",x=>{if(ws.readyState===ws.OPEN)ws.send(x);});
      ws.on("message",x=>{if(!tcp.destroyed)tcp.write(x);});
      tcp.on("error",close); tcp.on("close",close); ws.on("close",close); ws.on("error",()=>tcp.destroy());
    });
  }).catch(()=>socket.destroy());
});

server.listen(PORT,HOST,()=>console.log(`[helix-libvirt] ${HOST}:${PORT} kvm=${existsSync("/dev/kvm")}`));
