const crypto=require('node:crypto');
function fail(status,message){return Object.assign(new Error(message),{status})}
function validateInventory(op,p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw fail(400,'Ungültige Eingabe.');
 if(!['createArea','renameArea','createItem','setQuantity','bump'].includes(op))throw fail(400,'Unbekannte Aktion.');
 if(!/^[a-f0-9-]{36}$/i.test(p.requestId||''))throw fail(400,'Anfrage-ID fehlt.');
 const text=(key,max)=>{if(typeof p[key]!=='string'||!p[key].trim()||p[key].trim().length>max)throw fail(400,'Name / Einheit fehlt oder ist zu lang.');return p[key].trim()};
 const number=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9;
 let out={requestId:p.requestId};
 if(op==='createArea'){out.name=text('name',100);if(p.business!=='Lager')throw fail(400,'Betrieb fehlt.');out.business=p.business;}
 if(op==='renameArea'){out.id=text('id',200);out.name=text('name',100);out.previousName=text('previousName',100);}
 if(op==='createItem'){out.name=text('name',200);out.unit=text('unit',100);out.areaId=text('areaId',200);if(p.quantity!==null&&!number(p.quantity))throw fail(400,'Bestand muss eine positive Zahl oder leer sein.');out.quantity=p.quantity;}
 if(op==='setQuantity'||op==='bump')out.id=text('id',200);
 if(op==='setQuantity'){if(!number(p.quantity)||!Number.isInteger(p.revision)||p.revision<0)throw fail(400,'Ungültiger Bestand.');out.quantity=p.quantity;out.revision=p.revision;}
 if(op==='bump'){if(![-1,1].includes(p.delta))throw fail(400,'Ungültige Änderung.');out.delta=p.delta;}
 return out;
}
async function inventoryRpc(op,payload,config=process.env){
 const {INVENTORY_SUPABASE_URL:url,INVENTORY_PUBLISHABLE_KEY:key,INVENTORY_API_KEY:secret}=config;
 if(!url||!key||!secret)throw fail(503,'Gemeinsamer Bestand ist noch nicht eingerichtet.');
 let r;try{r=await fetch(url+'/rest/v1/rpc/bh_inventory_api',{method:'POST',headers:{apikey:key,'Content-Type':'application/json','x-bh-inventory-key':secret},body:JSON.stringify({op,payload}),signal:AbortSignal.timeout(15000)})}catch{throw fail(503,'Bestand ist gerade nicht erreichbar. Bitte erneut versuchen.');}
 const data=await r.json();if(!r.ok){const errors={'P0409':[409,'Der Bestand wurde inzwischen geändert. Bitte aktualisieren und erneut eingeben.'],'P0002':[404,'Artikel nicht gefunden.'],'22023':[400,'Bitte zuerst den gezählten Bestand eintragen.'],'23505':[409,'Dieser Lagerbereich existiert bereits.'],'23503':[400,'Lagerbereich nicht gefunden.'],'23514':[400,'Ungültige Menge oder Einheit.']};const [status,message]=errors[data.code]||[503,'Bestand konnte nicht gespeichert werden. Bitte erneut versuchen.'];throw fail(status,message);}return data;
}
async function readJson(req){let parts=[],size=0;for await(const part of req){size+=part.length;if(size>16000)throw fail(413,'Eingabe ist zu groß.');parts.push(part)}try{return JSON.parse(Buffer.concat(parts).toString())}catch{throw fail(400,'Ungültige Eingabe.')}}
async function handleInventory(req,res,role){
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
 if(!role){send(401,{error:'Bitte erneut anmelden.'});return;}
 try{
 if(req.method==='GET'){send(200,await inventoryRpc('list',{}));return;}
 if(req.method!=='POST'){send(405,{error:'Methode nicht erlaubt.'});return;}
 const origin=req.headers.origin;const host=req.headers.host;
 if(!origin||new URL(origin).host!==host||req.headers['sec-fetch-site']==='cross-site'){send(403,{error:'Ungültiger Anfrage-Ursprung.'});return;}
 if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'JSON erwartet.');
 const {op,payload}=await readJson(req);const data=validateInventory(op,payload);data.actor=role;
 send(200,await inventoryRpc(op,data));
 }catch(e){send(e.status||500,{error:e.status?e.message:'Bestandsfehler. Bitte erneut versuchen.'})}
}
module.exports={handleInventory,validateInventory,inventoryRpc};
