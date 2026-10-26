const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {validateInventory}=require('../inventory-api');
const requestId='12345678-1234-4234-8234-123456789012';
test('Storage validates counts and requires name, unit and area',()=>{
 assert.equal(validateInventory('createItem',{requestId,name:' Zucker ',unit:'kg',areaId:'test',quantity:null}).name,'Zucker');
 for(const quantity of [-1,NaN,Infinity,'2'])assert.throws(()=>validateInventory('setQuantity',{requestId,id:'i',revision:0,quantity}));
 assert.throws(()=>validateInventory('createItem',{requestId,name:'Test',unit:'',areaId:'test',quantity:0}));
 assert.throws(()=>validateInventory('bump',{requestId,id:'i',delta:2}));
 assert.equal(validateInventory('setQuantity',{requestId,id:'i',revision:1,quantity:1.25}).quantity,1.25);
});
test('Standalone Lager stays separate from Beach House and escapes item names',()=>{
 const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const el=()=>({innerHTML:'',style:{},classList:{toggle(){}},querySelectorAll(){return []},addEventListener(){}});
 const ctx={window:{__BH_ROLE:'staff',addEventListener(){}},document:{getElementById:el,querySelector:el,querySelectorAll(){return []}},localStorage:{getItem(){return null},setItem(){}},console};
 vm.createContext(ctx);vm.runInContext(script.replace(/\nrender\(\);\s*$/,''),ctx);
 vm.runInContext(fs.readFileSync('storage.js','utf8').replace(/\nloadInventory\(\);\s*$/,''),ctx);
 vm.runInContext("inventoryData={areas:[{id:'area',business:'Lager',name:'Hauptlager'},{id:'beach',business:'Beach House',name:'Beach only'}],items:[{id:'test',area_id:'area',name:'<script>bad</script>',unit:'kg',quantity:1.5,revision:1,updated_at:'2026-10-26T00:00:00Z'}]};inventoryLoaded=true;state.stock['sup:Pier 7:9']=7;setBusiness('Lager')",ctx);
 assert.equal(vm.runInContext("stock('sup:Pier 7:9')",ctx),7);
 assert.equal(vm.runInContext("qty('sup:Pier 7:9')",ctx),'');
 assert.equal(vm.runInContext('page',ctx),'storage');
 assert.match(vm.runInContext('renderInventory()',ctx),/&lt;script&gt;bad/);
 assert.doesNotMatch(vm.runInContext('renderInventory()',ctx),/Beach only/);
 assert.match(vm.runInContext('renderInventory()',ctx),/data-inventory-area/);
 vm.runInContext("setBusiness('Beach House')",ctx);assert.equal(vm.runInContext('page',ctx),'lager');
});
