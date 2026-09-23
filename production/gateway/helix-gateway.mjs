#!/usr/bin/env node
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { URL } from "node:url";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { WebSocketServer } from "ws";
import { createConnection } from "node:net";

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
async function login(req,res){if(!configured())return html(res,503,"<h1>Helix gateway</h1><p>OIDC is not configured yet.</p>");const c=await discovery(),state=b64url(randomBytes(32)),nonce=b64url(randomBytes(32));res.writeHead(302,{location:c.authorization_endpoint+"?"+new URLSearchParams({client_id:CLIENT_ID,response_type:"code",redirect_uri:REDIRECT_URI,scope:"openid email profile",state,nonce}),"set-cookie":[cookie(STATE_COOKIE,state,600),cookie(NONCE_COOKIE,nonce,600)]});res.end()}
async function callback(req,res,u){const ck=parseCookies(req),state=u.searchParams.get("state"),code=u.searchParams.get("code");if(!state||!ck[STATE_COOKIE]||state.length!==ck[STATE_COOKIE].length||!timingSafeEqual(Buffer.from(state),Buffer.from(ck[STATE_COOKIE])))return json(res,400,{error:"invalid oauth state"});if(!code)return json(res,400,{error:"missing authorization code"});const c=await discovery(),tr=await fetch(c.token_endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,client_id:CLIENT_ID,client_secret:CLIENT_SECRET})});if(!tr.ok)return json(res,502,{error:"oidc token exchange failed"});const t=await tr.json();if(!t.id_token)return json(res,502,{error:"no id_token"});jwks ||= createRemoteJWKSet(new URL(c.jwks_uri));const {payload}=await jwtVerify(t.id_token,jwks,{issuer:ISSUER,audience:CLIENT_ID});const s=await sign({sub:String(payload.sub),email:payload.email||null,name:payload.name||null},SESSION_TTL);res.writeHead(302,{location:"/","set-cookie":[cookie(COOKIE,s,SESSION_TTL),clearCookie(STATE_COOKIE),clearCookie(NONCE_COOKIE)]});res.end()}
async function hv(path,opts){const r=await fetch(HYPERVISOR+path,opts);const t=await r.text();let b;try{b=JSON.parse(t)}catch{b={raw:t}}return{status:r.status,body:b}}
async function desktop(req,res,id){const s=await verify(parseCookies(req)[COOKIE]);if(!s){res.writeHead(302,{location:"/auth/login"});return res.end()}if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))return json(res,400,{error:"invalid workspace id"});const page='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Helix Desktop</title><style>html,body,#screen{width:100%;height:100%;margin:0;background:#111}#status{position:fixed;z-index:2;top:8px;left:8px;color:#fff;font:14px system-ui;background:#222b;padding:6px 10px;border-radius:8px}</style><div id="status">Authorizing desktop…</div><div id="screen"></div><script type="module">import RFB from "/novnc/core/rfb.js";const id=ID_PLACEHOLDER;const status=document.getElementById("status");const r=await fetch("/api/v1/workspaces/"+encodeURIComponent(id));if(!r.ok){status.textContent="Workspace unavailable";throw new Error("workspace authorization failed")}const x=await r.json();if(x.status!=="running"){status.textContent="Workspace is not running";throw new Error("workspace is not running")}const scheme=location.protocol==="https:"?"wss":"ws";const rfb=new RFB(document.getElementById("screen"),scheme+"://"+location.host+x.streamPath+"?ticket="+encodeURIComponent(x.ticket));rfb.scaleViewport=true;rfb.resizeSession=false;rfb.addEventListener("connect",()=>status.textContent="Connected");rfb.addEventListener("disconnect",()=>status.textContent="Disconnected");</script>';return html(res,200,page.replace("ID_PLACEHOLDER",JSON.stringify(id)))}
async function workspace(req,res,id){const s=await verify(parseCookies(req)[COOKIE]);if(!s){res.writeHead(401);return res.end("unauthorized")}if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))return json(res,400,{error:"invalid workspace id"});const d=await hv("/domains/"+encodeURIComponent(id));if(d.status!==200)return json(res,d.status,{error:"workspace not found"});if(!d.body.owner || d.body.owner!==s.sub)return json(res,403,{error:"workspace not authorized"});const ticket=await sign({sub:s.sub,workspace:id,kind:"desktop"},WS_TTL);return json(res,200,{workspace:id,status:d.body.status,display:d.body.display,streamPath:"/kasm/ws/"+id,ticket})}
async function upgrade(req,socket,head){const u=new URL(req.url||"/","http://"+HOST+":"+PORT),m=u.pathname.match(/^\/kasm\/ws\/([^/]+)$/);if(!m){socket.destroy();return}const p=await verify(u.searchParams.get("ticket"));if(!p||p.kind!=="desktop"||p.workspace!==m[1]){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return}const d=await hv("/domains/"+encodeURIComponent(m[1]));if(d.status!==200||d.body.status!=="running"||d.body.display==null){socket.destroy();return}const tcp=createConnection({host:"127.0.0.1",port:5900+Number(d.body.display)}),wss=new WebSocketServer({noServer:true});tcp.once("connect",()=>wss.handleUpgrade(req,socket,head,ws=>{const close=()=>{try{tcp.destroy()}catch{};try{if(ws.readyState===ws.OPEN)ws.close()}catch{}};tcp.on("data",b=>{if(ws.readyState===ws.OPEN)ws.send(b)});ws.on("message",b=>{if(!tcp.destroyed)tcp.write(b)});tcp.on("close",close);tcp.on("error",close);ws.on("close",close);ws.on("error",close)}));tcp.on("error",()=>socket.destroy())}
const server=createServer(async (req,res)=>{
  try {
    const u=new URL(req.url||"/","http://"+HOST+":"+PORT);
    if(req.method==="GET" && u.pathname==="/health") {
      return json(res,200,{ok:true,oidcConfigured:configured(),publicOrigin:PUBLIC_ORIGIN||null});
    }
    if(req.method==="GET" && u.pathname==="/auth/login") return login(req,res);
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
      const s=await verify(parseCookies(req)[COOKIE]);
      if(!s) return html(res,200,"<h1>Helix Cloud Desktop</h1><p>Authenticated desktop gateway.</p><a href=\"/auth/login\">Sign in</a>");
      const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Helix Cloud Desktop</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:0 20px}li{margin:12px 0}button,input,select{padding:8px;margin:4px}</style><h1>Helix Cloud Desktop</h1><p>Signed in.</p><form id="create"><input id="id" placeholder="workspace id" required><select id="kind"><option value="persistent">persistent</option><option value="ephemeral">ephemeral</option></select><button>Create desktop</button></form><ul id="list"></ul><p><a href="/auth/logout">Sign out</a></p><script>const list=document.getElementById("list");async function refresh(){const r=await fetch("/api/v1/workspaces");const x=await r.json();list.innerHTML=x.workspaces.map(w=>"<li><a href="/desktop/"+encodeURIComponent(w.id)+"">"+w.id+"</a> — "+w.kind+" — "+w.status+"</li>").join("")||"<li>No workspaces yet.</li>"}document.getElementById("create").onsubmit=async e=>{e.preventDefault();const r=await fetch("/api/v1/workspaces",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:document.getElementById("id").value,kind:document.getElementById("kind").value})});if(!r.ok){alert(await r.text());return}document.getElementById("id").value="";refresh()};refresh();</script>`;
      return html(res,200,page);
    }
    return json(res,404,{error:"not found"});
  } catch(e) {
    console.error(e);
    return json(res,500,{error:"gateway error"});
  }
});
server.on("upgrade",(req,socket,head)=>void upgrade(req,socket,head));
server.listen(PORT,HOST,()=>console.log("[helix-gateway] "+HOST+":"+PORT+" oidc="+configured()));
