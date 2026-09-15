const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const USER = process.env.ADMIN_USER || '';
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const COOKIE_NAME = 'bh_session';
const SESSION_TTL = 1000 * 60 * 60 * 12;
const sessions = new Map();

function safeEqual(a,b){
  const aa=Buffer.from(a||''); const bb=Buffer.from(b||'');
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function token(){ return crypto.randomBytes(32).toString('hex'); }
function parseCookies(req){
  const out={};
  for(const part of (req.headers.cookie||'').split(';')){ const i=part.indexOf('='); if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim()); }
  return out;
}
function loggedIn(req){
  const t=parseCookies(req)[COOKIE_NAME];
  const s=t&&sessions.get(t);
  if(!s) return false;
  if(Date.now()>s.expires){sessions.delete(t);return false;}
  return true;
}
function send(res,status,body,headers={}){ res.writeHead(status,{'Content-Type':'text/html; charset=utf-8',...headers}); res.end(body); }
function loginPage(error=''){
  return `<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><title>BestellungBH – Login</title><style>body{margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px;box-sizing:border-box}.card{width:min(420px,100%);background:white;border-radius:20px;padding:28px;box-shadow:0 10px 40px #0001}h1{margin:0 0 6px}p{color:#667085}label{display:block;margin:16px 0 6px;font-weight:600}input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #d0d5dd;border-radius:12px;font-size:17px}button{width:100%;margin-top:20px;padding:15px;border:0;border-radius:12px;background:#111827;color:white;font-size:17px;font-weight:700}.err{color:#b42318;background:#fef3f2;padding:10px;border-radius:10px}</style></head><body><main class="card"><h1>BestellungBH</h1><p>Restaurant Lager & Bestellung</p>${error?`<div class="err">${error}</div>`:''}<form method="post" action="/login"><label>Benutzername</label><input name="username" autocomplete="username" required><label>Passwort</label><input type="password" name="password" autocomplete="current-password" required><button type="submit">Anmelden</button></form></main></body></html>`;
}
function parseForm(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>1e6)req.destroy()});req.on('end',()=>{const p=new URLSearchParams(b);resolve(Object.fromEntries(p.entries()))});req.on('error',reject)});}
const publicDir=__dirname;
const index=fs.readFileSync(path.join(publicDir,'index.html'));
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health'){return send(res,200,'OK',{'Content-Type':'text/plain; charset=utf-8'})}
  if(req.url==='/login' && req.method==='GET') return send(res,200,loginPage());
  if(req.url==='/login' && req.method==='POST'){
    if(!USER||!PASSWORD) return send(res,500,loginPage('Login ist noch nicht konfiguriert. ADMIN_USER und ADMIN_PASSWORD setzen.'));
    const f=await parseForm(req);
    if(safeEqual(f.username,USER)&&safeEqual(f.password,PASSWORD)){
      const t=token(); sessions.set(t,{expires:Date.now()+SESSION_TTL});
      return send(res,302,'',{'Location':'/','Set-Cookie':`${COOKIE_NAME}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL/1000}`});
    }
    return send(res,401,loginPage('Benutzername oder Passwort ist falsch.'));
  }
  if(req.url==='/logout'){
    const t=parseCookies(req)[COOKIE_NAME]; if(t)sessions.delete(t);
    return send(res,302,'',{'Location':'/login','Set-Cookie':`${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`});
  }
  if(!loggedIn(req)) return send(res,302,'',{'Location':'/login'});
  if(req.url==='/' || req.url==='/index.html') return send(res,200,index,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  return send(res,404,'Not found',{'Content-Type':'text/plain; charset=utf-8'});
});
server.listen(PORT,()=>console.log(`BestellungBH running on port ${PORT}`));
