import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {handle} from '../cloud/worker.js';
function database(schema){const raw=new DatabaseSync(':memory:');raw.exec('PRAGMA foreign_keys=ON;');raw.exec(schema);const db={prepare(sql){return {bind(...values){return {first:async()=>raw.prepare(sql).get(...values)??null,all:async()=>({results:raw.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(raw.prepare(sql).run(...values).changes)}})};} };},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}}};return {DB:db,close:()=>raw.close()};}
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8');
test('가족 API: 초대·PIN·기기 간 최신화·격리·멱등성·충돌',async()=>{
 const env=database(schema),site='https://test-family.example';
 async function call(path,{body,access,origin=site}={}){const response=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:response.status,data:await response.json()};}
 try{
  const child={id:crypto.randomUUID(),name:'연결테스트',date:'2026-01-01',unborn:false};const pin=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
  const created=await call('/api/families',{body:{child,pin,label:'보호자A',consent:true}});assert.equal(created.status,200);
  const a=created.data;
  assert.equal((await call('/api/pull')).status,401);
  assert.equal((await call('/api/pull',{access:a.accessToken,origin:'https://untrusted.example'})).status,403);
  const invite=(await call('/api/invites',{access:a.accessToken,body:{}})).data;
  const joined=await call('/api/join',{body:{invite:invite.invite,pin,label:'보호자B'}});assert.equal(joined.status,200);const b=joined.data;
  assert.equal((await call('/api/join',{body:{invite:invite.invite,pin,label:'보호자C'}})).status,401);
  const record={id:crypto.randomUUID(),child_id:child.id,type:'feeding',kind:'분유',amount:80,at:1,memo:null};
  const op={id:crypto.randomUUID(),key:record.id,entity:'record',action:'put',baseRevision:0,record};
  assert.equal((await call('/api/push',{access:a.accessToken,body:{operations:[op]}})).data.results[0].revision,1);
  assert.equal((await call('/api/push',{access:a.accessToken,body:{operations:[op]}})).data.results[0].revision,1);
  const pulled=await call('/api/pull',{access:b.accessToken});assert.equal(pulled.data.changes.filter(c=>c.id===record.id).length,1);assert.equal(pulled.data.changes.find(c=>c.id===record.id).record.created_by,'보호자A');
  const changed={...op,id:crypto.randomUUID(),baseRevision:1,record:{...record,amount:100}};
  await call('/api/push',{access:b.accessToken,body:{operations:[changed]}});
  const conflict=await call('/api/push',{access:a.accessToken,body:{operations:[{...changed,id:crypto.randomUUID(),record:{...record,amount:120}}]}});assert.equal(conflict.data.results[0].conflict.record.amount,100);
  const sleeping={id:crypto.randomUUID(),child_id:child.id,type:'sleep',at:1,end:null,memo:null};
  const sleepOp={id:crypto.randomUUID(),key:sleeping.id,entity:'record',action:'put',baseRevision:0,record:sleeping};
  assert.equal((await call('/api/push',{access:a.accessToken,body:{operations:[sleepOp]}})).data.results[0].revision,1);
  const secondSleep={...sleeping,id:crypto.randomUUID()};
  assert.equal((await call('/api/push',{access:b.accessToken,body:{operations:[{...sleepOp,id:crypto.randomUUID(),key:secondSleep.id,record:secondSleep}]}})).data.results[0].conflict.deleted,true);
  const otherChild={...child,id:crypto.randomUUID(),name:'다른테스트'};
  const other=(await call('/api/families',{body:{child:otherChild,pin,label:'다른가족',consent:true}})).data;
  const isolated=await call('/api/pull',{access:other.accessToken});assert.equal(isolated.data.changes.length,1);assert.equal(isolated.data.changes[0].id,otherChild.id);
  const wrongChild=await call('/api/push',{access:other.accessToken,body:{operations:[{...op,id:crypto.randomUUID()}]}});assert.equal(wrongChild.status,400);
  const deleted=await call('/api/push',{access:b.accessToken,body:{operations:[{id:crypto.randomUUID(),key:record.id,entity:'record',action:'delete',baseRevision:2,record:null}]}});assert.equal(deleted.data.results[0].revision,3);
  const deletion=await call('/api/pull?cursor='+pulled.data.cursor,{access:a.accessToken});assert.equal(deletion.data.changes.at(-1).deleted,true);
  const wrongPin=pin==='9999'?'0000':'9999';for(let i=0;i<5;i++)assert.equal((await call('/api/unlock',{body:{deviceKey:b.deviceKey,pin:wrongPin}})).status,401);
  assert.equal((await call('/api/unlock',{body:{deviceKey:b.deviceKey,pin}})).status,429);
  assert.equal((await call('/api/unlock',{body:{deviceKey:a.deviceKey,pin}})).status,200);
 }finally{env.close();}
});
