#!/usr/bin/env node
import { createOmniKaliHandoff } from "./omnikali-handoff.mjs";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { URL } from "node:url";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { WebSocketServer } from "ws";
import { createConnection } from "node:net";
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const PORT = Number(process.env.GATEWAY_PORT || 8092);
const ISSUER = process.env.OIDC_ISSUER_URL || "";
const CLIENT_ID = process.env.OIDC_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.OIDC_REDIRECT_URI || "";
const PUBLIC_ORIGIN = process.env.HELIX_PUBLIC_ORIGIN || "";
const SESSION_SECRET = process.env.SESSION_SIGNING_SECRET || "";
const HYPERVISOR = process.env.HELIX_HYPERVISOR_URL || "http://127.0.0.1:8090";
const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS || 3600);
const WS_TTL = Number(process.env.WS_TICKET_TTL_SECONDS || 60);
const COOKIE = "helix_session";
const require = createRequire(import.meta.url);
const NOVNC_ROOT = resolve(require.resolve("@novnc/novnc"), "..", "..");
const STATE_COOKIE = "helix_oidc_state";
const NONCE_COOKIE = "helix_oidc_nonce";
if (!SESSION_SECRET) throw new Error("SESSION_SIGNING_SECRET is required");
const key = new TextEncoder().encode(SESSION_SECRET);
let oidcConfigPromise, jwks;
const b64url = b => b.toString("base64url");
function parseCookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function cookie(n,v,max,secure=true){return n+"="+encodeURIComponent(v)+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+max+(secure?"; Secure":"")}
function clearCookie(n){return cookie(n,"",0)}
function json(res,status,body){const s=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json","cache-control":"no-store","content-length":Buffer.byteLength(s)});res.end(s)}
function html(res,status,body){res.writeHead(status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(body)}
function configured(){return Boolean(ISSUER&&CLIENT_ID&&CLIENT_SECRET&&REDIRECT_URI&&PUBLIC_ORIGIN&&!CLIENT_ID.startsWith("REPLACE_")&&!CLIENT_SECRET.startsWith("REPLACE_")&&!REDIRECT_URI.includes("REPLACE_WITH_")&&!PUBLIC_ORIGIN.includes("REPLACE_WITH_"))}
async function discovery(){if(!ISSUER)throw new Error("OIDC_ISSUER_URL is not configured");if(!oidcConfigPromise)oidcConfigPromise=fetch(ISSUER.replace(/\/$/,"")+"/.well-known/openid-configuration").then(async r=>{if(!r.ok)throw new Error("OIDC discovery failed");return r.json()});return oidcConfigPromise}
async function sign(payload,ttl){return new SignJWT(payload).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime(ttl+"s").sign(key)}
async function verify(token){try{return token?(await jwtVerify(token,key,{algorithms:["HS256"]})).payload:null}catch{return null}}
async function login(req,res){if(!configured())return html(res,503,"<h1>Helix gateway</h1><p>OIDC is not configured yet.</p>");const c=await discovery(),state=b64url(randomBytes(32)),nonce=b64url(randomBytes(32));res.writeHead(302,{"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","location":c.authorization_endpoint+"?"+new URLSearchParams({client_id:CLIENT_ID,response_type:"code",redirect_uri:REDIRECT_URI,scope:"openid email profile",state,nonce}),"set-cookie":[cookie(STATE_COOKIE,state,600),cookie(NONCE_COOKIE,nonce,600)]});res.end()}
async function callback(req,res,u){const ck=parseCookies(req),state=u.searchParams.get("state"),code=u.searchParams.get("code");if(!state||!ck[STATE_COOKIE]||state.length!==ck[STATE_COOKIE].length||!timingSafeEqual(Buffer.from(state),Buffer.from(ck[STATE_COOKIE]))) { res.setHeader("cache-control","no-store, no-cache, must-revalidate"); return json(res,400,{error:"invalid oauth state"}); }if(!code) { res.setHeader("cache-control","no-store, no-cache, must-revalidate"); return json(res,400,{error:"missing authorization code"}); }const c=await discovery(),tr=await fetch(c.token_endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,client_id:CLIENT_ID,client_secret:CLIENT_SECRET})});if(!tr.ok){const detail=await tr.text();console.error("[helix-gateway] OIDC token exchange failed",tr.status,detail.slice(0,1000));return json(res,502,{error:"oidc token exchange failed"});}const t=await tr.json();if(!t.id_token)return json(res,502,{error:"no id_token"});jwks ||= createRemoteJWKSet(new URL(c.jwks_uri));const {payload}=await jwtVerify(t.id_token,jwks,{issuer:ISSUER,audience:CLIENT_ID});if(!payload.nonce||!ck[NONCE_COOKIE]||payload.nonce!==ck[NONCE_COOKIE])return json(res,400,{error:"invalid oidc nonce"});const s=await sign({sub:String(payload.sub),email:payload.email||null,name:payload.name||null},SESSION_TTL);res.writeHead(302,{"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache",location:ck.helix_return_to==="omnikali"?"/omnikali/authorize":"/","set-cookie":[clearCookie("helix_return_to"),cookie(COOKIE,s,SESSION_TTL),clearCookie(STATE_COOKIE),clearCookie(NONCE_COOKIE)]});res.end()}
async function hv(path,opts){const r=await fetch(HYPERVISOR+path,opts);const t=await r.text();let b;try{b=JSON.parse(t)}catch{b={raw:t}}return{status:r.status,body:b}}
async function desktop(req,res,id){const s=await verify(parseCookies(req)[COOKIE]);if(!s){res.writeHead(302,{location:"/auth/login"});return res.end()}if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))return json(res,400,{error:"invalid workspace id"});const file=readFileSync("/opt/helix/production/gateway/desktop.html","utf8");return html(res,200,file.replace("__WORKSPACE_ID__",JSON.stringify(id)))}
async function workspace(req,res,id){const s=await verify(parseCookies(req)[COOKIE]);if(!s){res.writeHead(401);return res.end("unauthorized")}if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))return json(res,400,{error:"invalid workspace id"});let d=await hv("/domains/"+encodeURIComponent(id));if(d.status!==200)return json(res,d.status,{error:"workspace not found"});if(d.body.owner && d.body.owner!==s.sub)return json(res,403,{error:"workspace not authorized"});
  if(!d.body.owner){
    const claimed=await hv("/domains",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,kind:d.body.kind==="ephemeral"?"ephemeral":"persistent",owner:s.sub})});
    if(claimed.status>=400)return json(res,claimed.status,{error:"workspace could not be claimed"});
    d=claimed;
  }if(d.body.status!=="running"){const started=await hv("/domains",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,kind:d.body.kind==="ephemeral"?"ephemeral":"persistent",owner:s.sub})});if(started.status>=400)return json(res,started.status,{error:"workspace failed to start"});d=started;}if(d.body.status!=="running"||d.body.display==null)return json(res,409,{error:"workspace is not ready yet"});const ticket=await sign({sub:s.sub,workspace:id,kind:"desktop"},WS_TTL);return json(res,200,{workspace:id,status:d.body.status,display:d.body.display,streamPath:"/kasm/ws/"+id,ticket})}
async function session(req){return verify(parseCookies(req)[COOKIE])}
async function requestBody(req){return new Promise((resolve,reject)=>{const chunks=[];req.on("data",x=>chunks.push(x));req.on("end",()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks)):{});}catch(e){reject(e)}});req.on("error",reject)})}
async function workspaceList(req,res){
  const s=await session(req); if(!s){res.writeHead(401);return res.end("unauthorized")}
  const d=await hv("/domains"); if(d.status!==200)return json(res,d.status,{error:"workspace list unavailable"});
  return json(res,200,{workspaces:(Array.isArray(d.body)?d.body:[]).filter(w=>w.owner===s.sub)});
}
async function workspaceCreate(req,res){
  const s=await session(req); if(!s){res.writeHead(401);return res.end("unauthorized")}
  const b=await requestBody(req);
  const id=String(b.id||""); const kind=b.kind==="ephemeral"?"ephemeral":b.kind==="persistent"?"persistent":null;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))return json(res,400,{error:"invalid workspace id"});
  if(!kind)return json(res,400,{error:"kind must be persistent or ephemeral"});
  const existing=await hv("/domains/"+encodeURIComponent(id));
  if(existing.status===200){
    if(existing.body.owner && existing.body.owner!==s.sub)return json(res,403,{error:"workspace already belongs to another owner"});
    if(!existing.body.owner){
      const claimed=await hv("/domains",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,kind,owner:s.sub})});
      return json(res,claimed.status,claimed.body);
    }
    return json(res,200,existing.body);
  }
  const d=await hv("/domains",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,kind,owner:s.sub})});
  return json(res,d.status,d.body);
}
function serveNoVnc(req,res,u){const rel=decodeURIComponent(u.pathname.slice("/novnc/".length));if(!rel||rel.includes("\\0")||rel.split("/").some(p=>p===".."||p==="."))return json(res,400,{error:"invalid asset path"});const file=resolve(NOVNC_ROOT,rel);if(file!==NOVNC_ROOT&&!file.startsWith(NOVNC_ROOT+sep))return json(res,403,{error:"forbidden"});try{const st=statSync(file);if(!st.isFile())return json(res,404,{error:"not found"});const ext=file.slice(file.lastIndexOf(".")+1);const types={js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",map:"application/json",json:"application/json",svg:"image/svg+xml"};res.writeHead(200,{"content-type":types[ext]||"application/octet-stream","cache-control":"public, max-age=3600"});res.end(readFileSync(file));}catch{return json(res,404,{error:"not found"})}}
async function upgrade(req,socket,head){if(![PUBLIC_ORIGIN,"https://omnikali-workstation.iancossette73.chatgpt.site"].includes(req.headers.origin)){socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");socket.destroy();return;}const u=new URL(req.url||"/","http://"+HOST+":"+PORT),m=u.pathname.match(/^\/kasm\/ws\/([^/]+)$/);if(!m){socket.destroy();return}const p=await verify(u.searchParams.get("ticket"));if(!p||p.kind!=="desktop"||p.workspace!==m[1]){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return}const d=await hv("/domains/"+encodeURIComponent(m[1]));if(d.status!==200||d.body.status!=="running"||d.body.display==null||d.body.owner!==p.sub){socket.destroy();return}const tcp=createConnection({host:"127.0.0.1",port:Number(d.body.display)<5900?5900+Number(d.body.display):Number(d.body.display)}),wss=new WebSocketServer({noServer:true});tcp.once("connect",()=>wss.handleUpgrade(req,socket,head,ws=>{const close=()=>{try{tcp.destroy()}catch{};try{if(ws.readyState===ws.OPEN)ws.close()}catch{}};tcp.on("data",b=>{if(ws.readyState===ws.OPEN)ws.send(b)});ws.on("message",b=>{if(!tcp.destroyed)tcp.write(b)});tcp.on("close",close);tcp.on("error",close);ws.on("close",close);ws.on("error",close)}));tcp.on("error",()=>socket.destroy())}
const omniKaliHandoff=createOmniKaliHandoff({session,hv,sign,verify,json,html,cookie});
const server=createServer(async (req,res)=>{
  try {
    const u=new URL(req.url||"/","http://"+HOST+":"+PORT);
    if(await omniKaliHandoff(req,res,u)) return;
    if(req.method==="GET" && u.pathname==="/health") {
      return json(res,200,{ok:true,oidcConfigured:configured(),publicOrigin:PUBLIC_ORIGIN||null});
    }
    if(req.method==="GET" && u.pathname==="/auth/login") return login(req,res);
    if(req.method==="GET" && u.pathname.startsWith("/novnc/")) return serveNoVnc(req,res,u);
    if(req.method==="GET" && u.pathname==="/auth/callback") return callback(req,res,u);
    if(req.method==="GET" && u.pathname==="/auth/logout") {
      res.writeHead(302,{location:"/", "set-cookie":clearCookie(COOKIE)});
      return res.end();
    }
    if(req.method==="GET" && u.pathname==="/api/v1/workspaces") return workspaceList(req,res);
    if(req.method==="POST" && u.pathname==="/api/v1/workspaces") return workspaceCreate(req,res);
    if(req.method==="GET" && u.pathname.startsWith("/api/v1/workspaces/")) {
      return workspace(req,res,u.pathname.split("/").pop());
    }
    if(req.method==="GET" && u.pathname.startsWith("/desktop/")) {
      return desktop(req,res,u.pathname.split("/").pop());
    }
    if(req.method==="GET" && u.pathname==="/") {
      return html(res,200,readFileSync("/opt/helix/production/gateway/portal.html","utf8"));
    }
    return json(res,404,{error:"not found"});
  } catch(e) {
    console.error(e);
    return json(res,500,{error:"gateway error"});
  }
});
server.on("upgrade",(req,socket,head)=>void upgrade(req,socket,head));
server.listen(PORT,HOST,()=>console.log("[helix-gateway] "+HOST+":"+PORT+" oidc="+configured()+" clientSecret="+(CLIENT_SECRET?"present":"missing")+" secretLength="+CLIENT_SECRET.length));
