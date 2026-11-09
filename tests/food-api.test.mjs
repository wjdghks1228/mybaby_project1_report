import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/db.mjs';
import {handle} from '../cloud/worker.js';
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'),site='https://test-family.example';
test('이유식은 기기 간 전송·수정·삭제되며 구버전에 새 형식을 보내지 않는다',async()=>{
 const env=database(schema);
 async function call(path,body,access){const r=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
 try{
  const child={id:crypto.randomUUID(),name:'가상 이유식 검증',date:'2026-01-01',unborn:false},pin=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
  const a=(await call('/api/families',{child,pin,label:'검증 A',consent:true})).data;
  const inv=(await call('/api/invites',{},a.accessToken)).data;
  const b=(await call('/api/join',{invite:inv.invite,pin,label:'검증 B'})).data;
  const r={id:crypto.randomUUID(),child_id:child.id,type:'food',kind:'이유식',foodName:'쌀미음',amount:60.5,unit:'g',at:1,memo:null},op={id:crypto.randomUUID(),key:r.id,entity:'record',action:'put',baseRevision:0,record:r};
  assert.equal((await call('/api/push',{operations:[op],recordEpoch:0},a.accessToken)).status,200);
  const legacy=await call('/api/pull?protocol=2',null,b.accessToken);assert.equal(legacy.status,426);assert.equal(legacy.data.code,'UPDATE_REQUIRED');
  const fresh=await call('/api/pull?protocol=3',null,b.accessToken);assert.equal(fresh.status,200);assert.equal(fresh.data.changes.find(e=>e.id===r.id).record.amount,60.5);
  assert.equal((await call('/api/push',{operations:[{...op,id:crypto.randomUUID(),baseRevision:1,record:{...r,amount:80}}],recordEpoch:0},b.accessToken)).status,200);
  const changed=await call('/api/pull?protocol=3&cursor='+fresh.data.cursor,null,a.accessToken);assert.equal(changed.data.changes[0].record.amount,80);
  assert.equal((await call('/api/push',{operations:[{...op,id:crypto.randomUUID(),baseRevision:2,action:'delete',record:null}],recordEpoch:0},a.accessToken)).status,200);
  const deleted=await call('/api/pull?protocol=3&cursor='+changed.data.cursor,null,b.accessToken);assert.equal(deleted.data.changes[0].deleted,true);
  const bad={...r,id:crypto.randomUUID(),unit:'mL'};assert.equal((await call('/api/push',{operations:[{...op,id:crypto.randomUUID(),key:bad.id,record:bad}],recordEpoch:0},a.accessToken)).status,400);
 }finally{env.close();}
});
