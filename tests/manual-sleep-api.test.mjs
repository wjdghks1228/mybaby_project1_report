import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/db.mjs';
import {handle} from '../cloud/worker.js';
import {manualSleepRecord} from '../app/sleep-entry.js';
import {summary} from '../app/model.js';
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'),site='https://test-family.example';
test('수동 수면은 기존 sleep API 형식으로 동기화·수정되며 진행 중 수면과 이전 앱 호환을 유지한다',async()=>{
 const env=database(schema);
 async function call(path,body,access){const r=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
 try{
  const child={id:crypto.randomUUID(),name:'가상 수면 검증',date:'2026-01-01',unborn:false},pin=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
  const a=(await call('/api/families',{child,pin,label:'검증 A',consent:true})).data,inv=(await call('/api/invites',{},a.accessToken)).data,b=(await call('/api/join',{invite:inv.invite,pin,label:'검증 B'})).data;
  const now=+new Date('2026-11-19T18:00'),base={id:crypto.randomUUID(),child_id:child.id,type:'sleep',at:now,memo:null};
  const active={...base,id:crypto.randomUUID(),at:1,end:null},manual=manualSleepRecord(base,'2026-11-18T23:30','2026-11-19T01:00','밤 수면',now);
  const op=(record,baseRevision=0)=>({id:crypto.randomUUID(),key:record.id,entity:'record',action:'put',baseRevision,record});
  assert.equal((await call('/api/push',{operations:[op(active),op(manual)],recordEpoch:0},a.accessToken)).status,200);
  const pulled=await call('/api/pull?protocol=5',null,b.accessToken);assert.equal(pulled.status,200);const rows=pulled.data.changes.filter(e=>e.entity==='record').map(e=>e.record);
  assert.equal(rows.find(r=>r.id===active.id).end,null);assert.equal(rows.find(r=>r.id===manual.id).end,manual.end);assert.equal(summary([rows.find(r=>r.id===manual.id)],'2026-11-18',now).sleep,30*60000);
  assert.equal((await call('/api/pull?protocol=3',null,b.accessToken)).status,200);
  const edited={...manual,end:+new Date('2026-11-19T01:30')};assert.equal((await call('/api/push',{operations:[op(edited,1)],recordEpoch:0},b.accessToken)).status,200);
  const result=await call('/api/pull?protocol=5&cursor='+pulled.data.cursor,null,a.accessToken);assert.equal(result.data.changes[0].record.end,edited.end);
 }finally{env.close();}
});
