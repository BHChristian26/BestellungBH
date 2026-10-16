const {spawn}=require('node:child_process');const assert=require('node:assert/strict');const test=require('node:test');
test('HTTP health, admin/staff login, role injection, logout and invalid credentials',async()=>{
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3187',ADMIN_USER:'test-admin',ADMIN_PASSWORD:'temporary-test',STAFF_USER:'test-staff',STAFF_PASSWORD:'temporary-staff'},stdio:['ignore','pipe','pipe']});
try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('Server exited: '+code)))});const base='http://127.0.0.1:3187';assert.equal(await(await fetch(base+'/health')).text(),'ok');assert.match(await(await fetch(base)).text(),/Anmelden/);
for(const [username,password,role] of [['test-admin','temporary-test','admin'],['test-staff','temporary-staff','staff']]){const login=await fetch(base+'/login',{method:'POST',body:new URLSearchParams({username,password}),redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(await(await fetch(base,{headers:{cookie}})).text(),new RegExp('window.__BH_ROLE="'+role+'"'));await fetch(base+'/logout',{method:'POST',headers:{cookie}});assert.match(await(await fetch(base,{headers:{cookie}})).text(),/Anmelden/)}
assert.equal((await fetch(base+'/login',{method:'POST',body:new URLSearchParams({username:'bad',password:'bad'})})).status,401);
}finally{child.kill()}
});
