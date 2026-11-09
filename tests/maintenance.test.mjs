import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/db.mjs';
import {handle} from '../cloud/worker.js';
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8');
const site='https://test-family.example';
function caller(env){return async(path,{body,access}={})=>{const r=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};};}
const newChild=()=>({id:crypto.randomUUID(),name:'초기화 검증용',date:'2026-01-01',unborn:false});
const newPin=()=>String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
const operation=child=>{const record={id:crypto.randomUUID(),child_id:child.id,type:'diaper',kind:'소변',at:1,memo:null};return {id:crypto.randomUUID(),key:record.id,entity:'record',action:'put',baseRevision:0,record};};
test('기존 DB 추가 마이그레이션이 프로필을 지우지 않고 초기화 시점을 0으로 설정한다',async()=>{
 const original=await readFile(new URL('../drizzle/0000_family.sql',import.meta.url),'utf8');const migration=await readFile(new URL('../drizzle/0001_family_reset.sql',import.meta.url),'utf8');
 const env=database(original);try{env.raw.prepare('INSERT INTO families(id,child_id,pin_salt,pin_hash,created_at) VALUES(?,?,?,?,?)').run('legacy-family','legacy-child','test-salt','test-hash',1);env.raw.exec(migration);const row=env.raw.prepare('SELECT child_id,record_epoch,reset_id FROM families').get();assert.equal(row.child_id,'legacy-child');assert.equal(row.record_epoch,0);assert.equal(row.reset_id,null);}finally{env.close();}
});
test('기록 초기화는 프로필·연결·초대를 유지하고 오래된 기록의 부활을 차단한다',async()=>{
 const env=database(schema),call=caller(env),pin=newPin(),child=newChild();
 try{
  const a=(await call('/api/families',{body:{child,pin,label:'보호자A',consent:true}})).data;
  const invitation=(await call('/api/invites',{body:{},access:a.accessToken})).data;
  const b=(await call('/api/join',{body:{invite:invitation.invite,pin,label:'보호자B'}})).data;
  const spare=(await call('/api/invites',{body:{},access:a.accessToken})).data;
  const other=(await call('/api/families',{body:{child:newChild(),pin,label:'다른가족',consent:true}})).data;
  const op=operation(child);await call('/api/push',{body:{operations:[op],recordEpoch:0},access:a.accessToken});
  const preview=(await call('/api/maintenance',{access:a.accessToken})).data;
  const request={pin,childName:child.name,confirm:true,confirmText:'기록 초기화',expectedEpoch:preview.recordEpoch,expectedCursor:preview.cursor};
  assert.equal((await call('/api/reset-records',{body:request})).status,401);
  const wrong=pin==='9999'?'0000':'9999';assert.equal((await call('/api/reset-records',{access:a.accessToken,body:{...request,pin:wrong}})).status,403);
  assert.equal((await call('/api/reset-records',{access:a.accessToken,body:{...request,confirmText:'틀린 확인'}})).status,400);
  assert.equal((await call('/api/reset-records',{access:a.accessToken,body:{...request,childName:'다른 이름'}})).status,400);
  const additional=operation(child);await call('/api/push',{access:b.accessToken,body:{operations:[additional],recordEpoch:0}});
  assert.equal((await call('/api/reset-records',{access:a.accessToken,body:request})).status,409);
  const refreshed=(await call('/api/maintenance',{access:a.accessToken})).data;assert.equal(refreshed.recordCount,2);
  const reset=await call('/api/reset-records',{access:a.accessToken,body:{...request,expectedCursor:refreshed.cursor}});assert.equal(reset.status,200);assert.equal(reset.data.recordEpoch,1);
  const count=(table,where='')=>env.raw.prepare('SELECT COUNT(*) AS n FROM '+table+' WHERE family_id=?'+where).get(a.familyId).n;
  assert.equal(count('entries'," AND entity='record'"),0);assert.equal(count('changes'," AND entity='record'"),0);assert.equal(count('mutations'),1);assert.equal(count('entries'," AND entity='child'"),1);assert.equal(count('devices'),2);
  assert.equal((await call('/api/pull',{access:b.accessToken})).status,426);
  assert.equal((await call('/api/push',{access:b.accessToken,body:{operations:[op]}})).status,426);
  const stale=await call('/api/push',{access:b.accessToken,body:{operations:[op],recordEpoch:0}});assert.equal(stale.status,409);assert.equal(stale.data.code,'RESET_REQUIRED');
  const pulled=await call('/api/pull?protocol=2',{access:b.accessToken});assert.equal(pulled.status,200);assert.equal(pulled.data.recordEpoch,1);assert.equal(pulled.data.changes.some(e=>e.entity==='reset'),true);
  const joined=await call('/api/join',{body:{invite:spare.invite,pin,label:'보호자C'}});assert.equal(joined.status,200);
  assert.equal((await call('/api/pull?protocol=2',{access:other.accessToken})).data.changes.length,1);
  assert.equal((await call('/api/push',{access:b.accessToken,body:{operations:[operation(child)],recordEpoch:1}})).status,200);
  const retry=await call('/api/reset-records',{access:a.accessToken,body:request});assert.equal(retry.status,409);assert.equal((await call('/api/maintenance',{access:a.accessToken})).data.recordCount,1);
 }finally{env.close();}
});
test('가족 삭제는 최신 확인·PIN을 요구하고 모든 관련 원본 행과 기기 권한을 삭제한다',async()=>{
 const env=database(schema),call=caller(env),pin=newPin(),child=newChild();
 try{
  const a=(await call('/api/families',{body:{child,pin,label:'삭제 검증',consent:true}})).data;
  const invite=(await call('/api/invites',{access:a.accessToken,body:{}})).data;
  const b=(await call('/api/join',{body:{invite:invite.invite,pin,label:'다른 기기'}})).data;
  const unused=(await call('/api/invites',{access:a.accessToken,body:{}})).data;
  const other=(await call('/api/families',{body:{child:newChild(),pin,label:'유지 가족',consent:true}})).data;
  let preview=(await call('/api/maintenance',{access:a.accessToken})).data;
  const makeRequest=()=>({pin,childName:child.name,confirm:true,confirmText:'가족 기록함 삭제',expectedEpoch:preview.recordEpoch,expectedCursor:preview.cursor});
  const stale=makeRequest();await call('/api/push',{access:b.accessToken,body:{operations:[operation(child)],recordEpoch:0}});
  assert.equal((await call('/api/delete-family',{access:a.accessToken,body:stale})).status,409);
  preview=(await call('/api/maintenance',{access:a.accessToken})).data;
  assert.equal((await call('/api/delete-family',{access:a.accessToken,body:{...makeRequest(),confirm:false}})).status,400);
  assert.equal((await call('/api/delete-family',{access:a.accessToken,body:makeRequest()})).status,200);
  assert.equal(env.raw.prepare('SELECT COUNT(*) n FROM families WHERE id=?').get(a.familyId).n,0);
  for(const table of ['devices','invites','entries','changes','mutations'])assert.equal(env.raw.prepare('SELECT COUNT(*) n FROM '+table+' WHERE family_id=?').get(a.familyId).n,0);
  assert.equal(env.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  assert.equal((await call('/api/pull?protocol=2',{access:b.accessToken})).status,410);
  assert.equal((await call('/api/unlock',{body:{deviceKey:a.deviceKey,pin}})).status,410);
  assert.equal((await call('/api/join',{body:{invite:unused.invite,pin,label:'재사용'}})).status,401);
  assert.equal((await call('/api/pull?protocol=2',{access:other.accessToken})).status,200);
 }finally{env.close();}
});
test('동시에 요청한 초기화는 한 번만 적용하고 잘못된 PIN 반복은 차단한다',async()=>{
 const env=database(schema),call=caller(env),pin=newPin(),child=newChild();
 try{
  const a=(await call('/api/families',{body:{child,pin,label:'동시 검증',consent:true}})).data;
  const p=(await call('/api/maintenance',{access:a.accessToken})).data;
  const request={pin,childName:child.name,confirm:true,confirmText:'기록 초기화',expectedEpoch:p.recordEpoch,expectedCursor:p.cursor};
  const results=await Promise.all([call('/api/reset-records',{access:a.accessToken,body:request}),call('/api/reset-records',{access:a.accessToken,body:request})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await call('/api/maintenance',{access:a.accessToken})).data.recordEpoch,1);
  const wrong=pin==='9999'?'0000':'9999';for(let i=0;i<5;i++)assert.equal((await call('/api/reset-records',{access:a.accessToken,body:{...request,pin:wrong}})).status,403);
  assert.equal((await call('/api/reset-records',{access:a.accessToken,body:request})).status,429);
 }finally{env.close();}
});
