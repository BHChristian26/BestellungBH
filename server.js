const http=require("http"),fs=require("fs"),path=require("path");
const port=process.env.PORT||3000;
const user=process.env.ADMIN_USER||"admin", pass=process.env.ADMIN_PASSWORD||"change-me";
const html=fs.readFileSync(path.join(__dirname,"index.html"));
function unauthorized(res){res.writeHead(401,{"Content-Type":"text/html; charset=utf-8","WWW-Authenticate":"Basic realm=\"BestellungBH\""});res.end("Login required");}
const server=http.createServer((req,res)=>{
 if(req.url==="/health"){res.writeHead(200,{"Content-Type":"text/plain"});res.end("ok");return}
 if(req.url==="/"||req.url.startsWith("/index.html")){
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Basic ")){unauthorized(res);return}
  const raw=Buffer.from(auth.slice(6),"base64").toString(), i=raw.indexOf(":");
  if(raw.slice(0,i)!==user||raw.slice(i+1)!==pass){unauthorized(res);return}
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return
 }
 res.writeHead(404);res.end("Not found");
});
server.listen(port,"0.0.0.0",()=>console.log("BestellungBH listening on "+port));