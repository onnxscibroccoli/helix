// Authenticated, owner-scoped handoff from the existing Helix login to the private Sites UI.
export function createOmniKaliHandoff({session,hv,sign,verify,json,html,cookie}) {
  const origin='https://omnikali-workstation.iancossette73.chatgpt.site';
  const workspace='omnikali';
  async function owned(subject){const d=await hv('/domains/'+workspace);return d.status===200&&d.body.owner===subject?d:null;}
  return async function handle(req,res,u){
    if(!u.pathname.startsWith('/omnikali/'))return false;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    if(u.pathname==='/omnikali/authorize'&&req.method==='GET'){
      const s=await session(req);
      if(!s){res.writeHead(302,{location:'/auth/login','set-cookie':cookie('helix_return_to','omnikali',600)});res.end();return true;}
      let d=await hv('/domains/'+workspace);
      if(d.status!==200){json(res,404,{error:'Workspace unavailable'});return true;}
      // Same ownership policy as the existing explicit workspace connect route.
      if(d.body.owner&&d.body.owner!==s.sub){json(res,403,{error:'Workspace belongs to another account'});return true;}
      if(!d.body.owner){d=await hv('/domains',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:workspace,kind:'persistent',owner:s.sub})});}
      if(d.status>=400||d.body.owner!==s.sub){json(res,403,{error:'Workspace ownership could not be verified'});return true;}
      const grant=await sign({sub:s.sub,workspace,kind:'omnikali-grant'},3600);
      const data=JSON.stringify({type:'OMNIKALI_AUTH',grant,workspace}).replace(/</g,'\\u003c');
      html(res,200,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OmniKali connected</title><style>body{background:#101318;color:#e8ece8;font:18px system-ui;padding:32px;max-width:560px;margin:auto}a{color:#b9ed7a}</style><h1>Desktop authorized</h1><p id="message">Returning to your private workstation…</p><script>if(window.opener){window.opener.postMessage(${data},${JSON.stringify(origin)});setTimeout(()=>window.close(),600)}else{document.getElementById('message').textContent='Return to your private workstation and select Connect desktop to open this sign-in window.'}</script>`);
      return true;
    }
    if(req.headers.origin!==origin){json(res,403,{error:'Origin not allowed'});return true;}
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return true;}
    const p=await verify((req.headers.authorization||'').replace(/^Bearer /,''));
    if(!p||p.kind!=='omnikali-grant'||p.workspace!==workspace){json(res,401,{error:'Sign in to the desktop again'});return true;}
    const d=await owned(p.sub);if(!d){json(res,403,{error:'Workspace not authorized'});return true;}
    if(u.pathname==='/omnikali/status'&&req.method==='GET'){
      const status=['running','booting','stopped','error'].includes(d.body.status)?d.body.status:'unknown';
      json(res,200,{workspace,status,observedAt:Date.now(),source:'libvirt',persistent:d.body.kind==='persistent'});return true;
    }
    if(u.pathname==='/omnikali/ticket'&&req.method==='POST'){
      if(d.body.status!=='running'||d.body.display==null){json(res,409,{error:'Desktop is not running; reconnect will not start it'});return true;}
      const ticket=await sign({sub:p.sub,workspace,kind:'desktop'},60);
      json(res,200,{streamPath:'/kasm/ws/'+workspace,ticket,expiresIn:60});return true;
    }
    json(res,404,{error:'Not found'});return true;
  };
}
