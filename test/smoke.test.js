const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Application script exists');
new vm.Script(script);

function makeApp(role='admin'){
  const el=()=>({innerHTML:'',style:{},classList:{toggle(){}},querySelectorAll(){return []},addEventListener(){}});
  const byId=new Map();
  const document={
    getElementById(id){if(!byId.has(id))byId.set(id,el());return byId.get(id)},
    querySelector(){return el()},querySelectorAll(){return []},
    body:{appendChild(){}},createElement(){return {click(){},remove(){}}}
  };
  const store={};
  const context={
    window:{__BH_ROLE:role},document,localStorage:{
      getItem(k){return store[k]||null},setItem(k,v){store[k]=v}
    },Blob,URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
    alert(){},confirm(){return true},setTimeout(){},console
  };
  vm.createContext(context);
  vm.runInContext(script.replace(/\nrender\(\);\s*$/,'\n'),context);
  return context;
}

test('Beach House source retains 170 Excel supplier links',()=>{
  const app=makeApp();
  assert.equal(vm.runInContext('Object.keys(MASTER.links).length',app),170);
});

test('Lager quantity updates the corresponding supplier and is not doubled in history',()=>{
  const a=makeApp();
  vm.runInContext("setQty('stor:Tiefkühlung:28',4)",a);
  assert.equal(vm.runInContext("state.qty['sup:Pier 7:9']",a),4);
  vm.runInContext("completeOrder()",a);
  assert.equal(vm.runInContext('state.history[0].items.length',a),1);
  assert.equal(vm.runInContext("state.history[0].items[0].qty",a),4);
});

test('Other business quantities are preserved when Beach House closes',()=>{
  const a=makeApp();
  vm.runInContext("state.qty['fs:2:left']=3;state.qty['fc:2']=2;setQty('sup:Pier 7:9',4);completeOrder()",a);
  assert.equal(vm.runInContext("state.qty['fs:2:left']",a),3);
  assert.equal(vm.runInContext("state.qty['fc:2']",a),2);
  assert.equal(vm.runInContext("state.qty['sup:Pier 7:9']",a),undefined);
});

test('Manual order adjustment survives another Gastronovi automatic recalculation',()=>{
  const a=makeApp();
  vm.runInContext("setQty('sup:Pier 7:9',7);state.sales=[];applySalesToOrders()",a);
  assert.equal(vm.runInContext("state.qty['sup:Pier 7:9']",a),7);
});

test('Staff UI cannot navigate into Admin or mutate admin-only product settings',()=>{
  const a=makeApp('staff');
  vm.runInContext("go('admin');toggleExclude('sup:Pier 7:9')",a);
  assert.equal(vm.runInContext('page',a),'lager');
  assert.equal(vm.runInContext("state.excluded['sup:Pier 7:9']",a),undefined);
});

test('Admin tabs change their route without breaking storage tabs',()=>{
  const a=makeApp();
  vm.runInContext("go('admin');setAdminTab('recipes');go('lager');selectLager('GetränkeLager')",a);
  assert.equal(vm.runInContext('adminTab',a),'recipes');
  assert.equal(vm.runInContext('selectedLager',a),'GetränkeLager');
});

test('Purchasing units are whole and invalid order entries preserve previous value',()=>{
 const a=makeApp();vm.runInContext("setQty('sup:Pier 7:9',1.2);setQty('sup:Pier 7:9',-2);setQty('sup:Pier 7:9','bad')",a);
 assert.equal(vm.runInContext("qty('sup:Pier 7:9')",a),2);
});
test('Stock, target and event inputs synchronize to supplier with rounded recommendation',()=>{
 const a=makeApp();vm.runInContext("setStock('stor:Tiefkühlung:28',1.5);setTarget('stor:Tiefkühlung:28',3);setEventExtra('stor:Tiefkühlung:28',1)",a);
 assert.equal(vm.runInContext("stock('sup:Pier 7:9')",a),1.5);
 assert.equal(vm.runInContext("recommendedOrder('sup:Pier 7:9')",a),3);
});
test('Unknown partial names and incorrect explicit suppliers never resolve silently',()=>{
 const a=makeApp();assert.equal(vm.runInContext("findMasterProduct('Burger fleisch')",a),null);
 assert.equal(vm.runInContext("findProductForAuto({purchase:'Burger fleisch (150g)',supplier:'Unknown'})",a),null);
});
test('Existing beer and water mappings aggregate into complete supplier units',()=>{
 const a=makeApp();vm.runInContext("state.sales=[{name:'Spaten Helles vom Fass 0,5 l',qty:61},{name:'Kondrauer Naturell 0,75 l',qty:13}];applySalesToOrders()",a);
 assert.equal(vm.runInContext("qty(findProductForAuto(autoRuleBySale.get('Spaten Helles vom Fass 0,5 l').components[0]).id)",a),2);
 assert.equal(vm.runInContext("qty(findProductForAuto(autoRuleBySale.get('Kondrauer Naturell 0,75 l').components[0]).id)",a),2);
});
test('Workbook upload replaces sales and synchronizes calculated supplier and Lager quantities',async()=>{
 const a=makeApp();a.XLSX={read(){return {SheetNames:['Sales'],Sheets:{Sales:{}}}},utils:{sheet_to_json(){return [['Designation','Total amount for the display period'],['> Spaten Helles vom Fass 0,5 l',61]]}}};a.window.XLSX=a.XLSX;
 await vm.runInContext("importSales({name:'test.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)})",a);
 assert.equal(vm.runInContext('state.sales.length',a),1);
 assert.equal(vm.runInContext('state.salesAutoSummary.mappedRows',a),1);
 assert.equal(vm.runInContext("(()=>{const id=state.salesAutoIds[0];return [...linkGroups[id]].every(x=>qty(x)===2)})()",a),true);
});
test('Supplier rendering retains master array order and Admin uses valid delegated controls',()=>{
 const a=makeApp();assert.equal(vm.runInContext("(()=>{selectedSupplier='Pier 7';const html=renderSuppliers();const ps=MASTER.suppliers['Pier 7'];return ps.every((p,i)=>i===0||html.indexOf(esc(ps[i-1].name))<html.indexOf(esc(p.name)))})()",a),true);
 assert.equal(vm.runInContext("adminProducts().includes('onclick=\"toggleExclude(')",a),false);
});
