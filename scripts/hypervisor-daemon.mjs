#!/usr/bin/env node
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";
import { attachPersistentWorkspace, detachPersistentWorkspace, describePersistentWorkspace } from "./persistent-ebs-storage.mjs";

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
mkdirSync(DISKS,{recursive:true}); mkdirSync(ROOT,{recursive:true});
function loadState(){try{return JSON.parse(readFileSync(STATE,"utf8"));}catch{return {tickets:{},kinds:{},disks:{},volumes:{}}}}
let state=loadState();
function saveState(){writeFileSync(STATE,JSON.stringify(state,null,2));}
async function sh(args){const {stdout}=await exec(VIRSH,["-c",URI,...args],{timeout:15000});return stdout.trim();}
async function qemuImg(args){const {stdout}=await exec(QEMU_IMG,args,{timeout:30*60*1000});return stdout.trim();}
function validId(id){return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id);}
function domainName(id){return `helix-${id}`;}
async function existsDomain(name){try{await sh(["dominfo",name]);return true;}catch{return false;}}
async function domainState(name){try{return await sh(["domstate",name]);}catch{return "absent";}}
async function createEphemeralDisk(id){const disk=`${DISKS}/${id}.qcow2`;if(existsSync(disk))return disk;if(!existsSync(BASE))throw new Error("base image missing; install the Helix host bootstrap/base image first");await qemuImg(["create","-f","qcow2","-F","qcow2","-b",BASE,disk,"8G"]);return disk;}

async function defineDomain(id,kind){
  const name=domainName(id);
  let diskXml, diskPath;
  if(kind==="persistent"){
    const v=await attachPersistentWorkspace(id,BASE,QEMU_IMG);
    diskPath=v.device; state.volumes[id]=v.volumeId; state.disks[id]=diskPath;
    diskXml=`<disk type='block' device='disk'><driver name='qemu' type='raw' cache='none'/><source dev='${diskPath}'/><target dev='vda' bus='virtio'/></disk>`;
  } else {
    diskPath=await createEphemeralDisk(id); state.disks[id]=diskPath;
    diskXml=`<disk type='file' device='disk'><driver name='qemu' type='qcow2' cache='none'/><source file='${diskPath}'/><target dev='vda' bus='virtio'/></disk>`;
  }
  const xml=`<domain type='kvm'>
  <name>${name}</name><memory unit='MiB'>${MEMORY_MB}</memory><currentMemory unit='MiB'>${MEMORY_MB}</currentMemory>
  <vcpu placement='static'>${VCPUS}</vcpu><os><type arch='x86_64' machine='pc'>hvm</type><boot dev='hd'/></os>
  <features><acpi/><apic/></features><cpu mode='host-passthrough' check='none'/><clock offset='utc'/>
  <on_poweroff>destroy</on_poweroff><on_reboot>restart</on_reboot><on_crash>destroy</on_crash>
  <devices>${diskXml}<interface type='network'><source network='${BRIDGE}'/><model type='virtio'/></interface>
  <graphics type='vnc' listen='127.0.0.1' autoport='yes'/><video><model type='virtio' heads='1'/></video>
  <input type='tablet' bus='usb'/><channel type='unix'><target type='virtio' name='org.qemu.guest_agent.0'/></channel></devices>
</domain>`;
  const file=`${ROOT}/${name}.xml`; writeFileSync(file,xml);
  try{await sh(["define",file]);}finally{try{unlinkSync(file);}catch{}}
  state.kinds[id]=kind;if(!state.tickets[id])state.tickets[id]=randomBytes(24).toString("base64url");saveState();return name;
}
async function startDomain(id,kind){
  if(!validId(id))throw new Error("invalid workspace id");
  const name=domainName(id);if(!(await existsDomain(name)))await defineDomain(id,kind);
  const s=await domainState(name);if(s!=="running")await sh(["start",name]);return describe(id);
}
async function stopDomain(id){
  const name=domainName(id);if(!(await existsDomain(name)))return {ok:true,missing:true};
  if((await domainState(name))==="running")await sh(["shutdown",name]).catch(()=>{});
  return {ok:true,state:await domainState(name)};
}
async function destroyDomain(id){
  const name=domainName(id);
  if(await existsDomain(name)){if((await domainState(name))==="running")await sh(["destroy",name]).catch(()=>{});await sh(["undefine",name,"--nvram"]).catch(()=>sh(["undefine",name]));}
  const kind=state.kinds[id]||"persistent";
  if(kind==="persistent") await detachPersistentWorkspace(id);
  else try{unlinkSync(`${DISKS}/${id}.qcow2`);}catch{}
  delete state.tickets[id];delete state.kinds[id];delete state.disks[id];delete state.volumes[id];saveState();return {ok:true};
}
async function describe(id){
  const name=domainName(id);if(!(await existsDomain(name)))return null;
  const s=await domainState(name);let display="";try{display=await sh(["domdisplay",name]);}catch{}
  const m=display.match(/:(\d+)$/);const d=m?Number(m[1]):null;const kind=state.kinds[id]||"persistent";
  let storage=null;try{storage=kind==="persistent"?await describePersistentWorkspace(id):null;}catch{}
  return {id,kind,status:s==="running"?"running":"stopped",domain:name,display:d,vnc:display,ticket:state.tickets[id]||null,streamPath:`/kasm/ws/${id}`,memoryMb:MEMORY_MB,vcpus:VCPUS,disk:state.disks[id]||null,storage};
}
async function capabilities(){
  let kvm=existsSync("/dev/kvm"),libvirt=false;try{await sh(["version"]);libvirt=true;}catch{}
  let nested="unknown";for(const p of ["/sys/module/kvm_intel/parameters/nested","/sys/module/kvm_amd/parameters/nested"]){if(existsSync(p))try{nested=readFileSync(p,"utf8").trim();}catch{}}
  return {hostname:process.env.HOSTNAME||"helix-hypervisor",kvm,nested,libvirt,qemuSystem:existsSync("/usr/bin/qemu-system-x86_64"),uri:URI,network:BRIDGE,persistentStorage:"aws-ebs-gp3"};
}
async function domains(){let names=[];try{names=(await sh(["list","--name"])).split("\n").map(x=>x.trim()).filter(Boolean);}catch{}const out=[];for(const n of names.filter(x=>x.startsWith("helix-"))){const d=await describe(n.slice(6));if(d)out.push(d);}return out;}
function json(res,code,body){const data=JSON.stringify(body);res.writeHead(code,{"content-type":"application/json","content-length":Buffer.byteLength(data)});res.end(data);}
function body(req){return new Promise((resolve,reject)=>{const c=[];req.on("data",x=>c.push(x));req.on("end",()=>{try{resolve(c.length?JSON.parse(Buffer.concat(c)):{});}catch(e){reject(e);}});req.on("error",reject);});}
const server=createServer(async(req,res)=>{const url=new URL(req.url||"/",`http://${HOST}:${PORT}`);try{
 if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true});
 if(req.method==="GET"&&url.pathname==="/capabilities")return json(res,200,await capabilities());
 if(req.method==="GET"&&url.pathname==="/domains")return json(res,200,await domains());
 const m=url.pathname.match(/^\/domains\/([^/]+)$/);
 if(m&&req.method==="GET"){const d=await describe(m[1]);return d?json(res,200,d):json(res,404,{error:"not found"});}
 if(m&&req.method==="DELETE")return json(res,200,await destroyDomain(m[1]));
 if(req.method==="POST"&&url.pathname==="/domains"){const b=await body(req);if(!b.id)return json(res,400,{error:"id required"});return json(res,200,await startDomain(String(b.id),b.kind==="ephemeral"?"ephemeral":"persistent"));}
 if(req.method==="POST"&&url.pathname.endsWith("/stop"))return json(res,200,await stopDomain(url.pathname.split("/")[2]));
 return json(res,404,{error:"not found"});
}catch(e){return json(res,500,{error:e?.message||"hypervisor error"});}});
const wss=new WebSocketServer({noServer:true});
server.on("upgrade",(req,socket,head)=>{const url=new URL(req.url||"/",`http://${HOST}:${PORT}`);const m=url.pathname.match(/^\/kasm\/ws\/([^/]+)$/);if(!m){socket.destroy();return;}
 const id=m[1],ticket=url.searchParams.get("ticket"),expected=state.tickets[id];if(!ticket||ticket!==expected){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return;}
 void describe(id).then(d=>{if(!d||d.status!=="running"||!d.vnc){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>{const tcp=createConnection({host:"127.0.0.1",port:5900+(d.display||0)});const close=()=>{try{tcp.destroy();}catch{}try{if(ws.readyState===ws.OPEN)ws.close();}catch{}};tcp.on("data",x=>{if(ws.readyState===ws.OPEN)ws.send(x);});ws.on("message",x=>{if(!tcp.destroyed)tcp.write(x);});tcp.on("error",close);tcp.on("close",close);ws.on("close",close);ws.on("error",()=>tcp.destroy());});}).catch(()=>socket.destroy());});
server.listen(PORT,HOST,()=>console.log(`[helix-libvirt] ${HOST}:${PORT} kvm=${existsSync("/dev/kvm")}`));
