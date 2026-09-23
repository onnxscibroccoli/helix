#!/usr/bin/env node
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { WebSocketServer } from "ws";

const run = promisify(execFile);
const ROOT = process.env.HELIX_HYPERVISOR_ROOT ?? "/var/lib/helix-hypervisor";
const PORT = Number(process.env.HYPERVISOR_PORT ?? 8090);
const NET = "default";
const IP = "10.0.2.15";
const DIR = join(ROOT, "disks");
const STATE = join(ROOT, "state");
const BOOT = join(ROOT, "boot");
const ISO = join(ROOT, "images", "TinyCorePure64.iso");
const KERNEL = join(BOOT, "vmlinuz64");
const INITRD = join(BOOT, "corepure64.gz");
for (const d of [DIR, STATE, BOOT, join(ROOT, "images")]) mkdirSync(d, {recursive:true});

const domains = new Map();

async function virsh(args, ok=false) {
  try { return (await run("virsh", ["-c","qemu:///system",...args], {maxBuffer:4e6})).stdout.trim(); }
  catch (e) { if (ok) return ""; throw new Error(e.stderr?.trim() || e.message); }
}
async function exec(cmd,args) { return (await run(cmd,args,{maxBuffer:8e6})).stdout.trim(); }
function valid(id) { if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) throw Error("invalid workspace id"); return id; }
function disk(id) { return join(DIR, id+".qcow2"); }
function state(id) { return join(STATE, id+".json"); }

async function prepare() {
  await virsh(["net-start",NET],true); await virsh(["net-autostart",NET],true);
  if (!existsSync(ISO)) {
    const url=process.env.HELIX_ISO_URL ?? "https://distro.ibiblio.org/tinycorelinux/15.x/x86_64/release/TinyCorePure64-15.0.iso";
    await exec("curl",["-fL","--retry","3","-o",ISO,url]);
  }
  if (!existsSync(KERNEL) || !existsSync(INITRD)) {
    await exec("mount",["-o","loop,ro",ISO,"/mnt"]);
    try {
      const k=existsSync("/mnt/boot/vmlinuz64")?"/mnt/boot/vmlinuz64":"/mnt/vmlinuz64";
      const i=existsSync("/mnt/boot/corepure64.gz")?"/mnt/boot/corepure64.gz":"/mnt/corepure64.gz";
      if (!existsSync(k)||!existsSync(i)) throw Error("TinyCore boot files missing");
      await exec("cp",[k,KERNEL]); await exec("cp",[i,INITRD]);
    } finally { await exec("umount",["/mnt"]).catch(()=>{}); }
  }
}
async function vnc(id) {
  const x=await virsh(["dumpxml",id]);
  const m=x.match(/<graphics[^>]+type='vnc'[^>]+port='(\d+)'/);
  if (!m || m[1]==="-1") throw Error("VNC port unavailable");
  return Number(m[1]);
}
async function start(id,kind) {
  id=valid(id); kind=kind==="ephemeral"?"ephemeral":"persistent";
  await prepare();
  const existing=domains.get(id);
  if (existing?.status==="running") return existing;
  if (await virsh(["dominfo",id],true)) await virsh(["destroy",id],true);
  await virsh(["undefine",id],true);
  const d=disk(id);
  if (!existsSync(d)) await exec("qemu-img",["create","-f","qcow2",d,kind==="ephemeral"?"2G":"8G"]);
  const mem=kind==="ephemeral"?384:768;
  const xml=`<domain type='kvm'><name>${id}</name><memory unit='MiB'>${mem}</memory><currentMemory unit='MiB'>${mem}</currentMemory><vcpu>1</vcpu><os><type arch='x86_64' machine='pc'>hvm</type><kernel>${KERNEL}</kernel><initrd>${INITRD}</initrd><cmdline>loglevel=3 cde vga=791</cmdline></os><features><acpi/><apic/></features><devices><emulator>/usr/bin/qemu-system-x86_64</emulator><disk type='file' device='disk'><driver name='qemu' type='qcow2'/><source file='${d}'/><target dev='vda' bus='virtio'/></disk><interface type='network'><source network='${NET}'/><model type='virtio'/></interface><graphics type='vnc' listen='127.0.0.1' autoport='yes'/><video><model type='virtio'/></video></devices><on_poweroff>destroy</on_poweroff><on_reboot>restart</on_reboot><on_crash>destroy</on_crash></domain>`;
  const xp=join(STATE,id+".xml"); writeFileSync(xp,xml);
  await virsh(["define",xp]); await virsh(["start",id]);
  const port=await vnc(id);
  const out={id,kind,status:"running",vncPort:port,ticket:randomBytes(24).toString("base64url"),logs:["libvirt define","libvirt start",`KVM VNC 127.0.0.1:${port}`],startedAt:new Date().toISOString(),memoryMb:mem,vcpus:1,diskGb:kind==="ephemeral"?2:8,guestIp:IP,streamPath:`/kasm/ws/${id}`};
  domains.set(id,out); writeFileSync(state(id),JSON.stringify(out));
  return out;
}
async function stop(id) {
  id=valid(id); const d=domains.get(id); await virsh(["destroy",id],true); await virsh(["undefine",id],true);
  if(d?.kind==="ephemeral") try{unlinkSync(disk(id))}catch{}
  domains.delete(id); try{unlinkSync(state(id))}catch{}
  return {ok:true,kind:d?.kind};
}
function pub(d){return d;}
async function reconcile() {
  await prepare();
  const names=(await virsh(["list","--all","--name"],true)).split("\n").map(x=>x.trim()).filter(Boolean);
  for(const id of names){ try { const s=await virsh(["domstate",id]); if(s==="running" && existsSync(state(id))){const d=JSON.parse(readFileSync(state(id),"utf8")); d.vncPort=await vnc(id); domains.set(id,d);} }catch{} }
}
function send(res,n,b){const x=JSON.stringify(b);res.writeHead(n,{"content-type":"application/json"});res.end(x);}
const server=createServer(async(req,res)=>{
  const u=new URL(req.url??"/",`http://127.0.0.1:${PORT}`);
  try{
    if(req.method==="GET"&&u.pathname==="/health")return send(res,200,{ok:true});
    if(req.method==="GET"&&u.pathname==="/capabilities")return send(res,200,{hostname:hostname(),kvm:existsSync("/dev/kvm"),nested:readFileSync("/sys/module/kvm_intel/parameters/nested","utf8").trim(),qemu:true,qemuVersion:(await exec("qemu-system-x86_64",["--version"])).split("\n")[0],guests:[...domains.values()].filter(d=>d.status==="running").length,node:"libvirt-nested-kvm",region:process.env.HELIX_REGION??"us-east-1",guestNet:"10.0.2.0/24",guestIp:IP,nic:"virtio libvirt NAT",guestOs:"TinyCorePure64-15.0"});
    if(req.method==="GET"&&u.pathname==="/domains")return send(res,200,[...domains.values()].map(pub));
    const m=u.pathname.match(/^\/domains\/([^/]+)$/);
    if(m&&req.method==="DELETE")return send(res,200,await stop(m[1]));
    if(req.method==="POST"&&u.pathname==="/domains"){let b="";for await(const c of req)b+=c;const j=JSON.parse(b||"{}");return send(res,200,pub(await start(String(j.id),j.kind)));}
    if(m&&req.method==="GET"){const d=domains.get(m[1]);return d?send(res,200,pub(d)):send(res,404,{error:"not found"});}
    send(res,404,{error:"not found"});
  }catch(e){send(res,500,{error:e instanceof Error?e.message:"hypervisor error"});}
});
const wss=new WebSocketServer({noServer:true});
server.on("upgrade",(req,sock,head)=>{
  const u=new URL(req.url??"/","http://127.0.0.1"); const m=u.pathname.match(/^\/kasm\/ws\/([^/]+)$/); const d=m&&domains.get(m[1]);
  if(!d||u.searchParams.get("ticket")!==d.ticket){sock.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");return sock.destroy();}
  wss.handleUpgrade(req,sock,head,ws=>{const tcp=createConnection({host:"127.0.0.1",port:d.vncPort});tcp.on("data",x=>ws.readyState===ws.OPEN&&ws.send(x));ws.on("message",x=>!tcp.destroyed&&tcp.write(x));ws.on("close",()=>tcp.destroy());tcp.on("close",()=>ws.close());});
});
await reconcile();
server.listen(PORT,"127.0.0.1",()=>console.log(`[helix-libvirt] KVM=true port=${PORT}`));
