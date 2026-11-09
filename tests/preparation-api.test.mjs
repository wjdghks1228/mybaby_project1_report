import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/db.mjs';
import {handle} from '../cloud/worker.js';
import {PREP_ITEMS} from '../app/preparation-catalog.js';
import {prepKey} from '../app/preparation-model.js';
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'),site='https://test-family.example';
test('준비 체크는 가족별 격리·독립 편집·동일 항목 충돌·기록 초기화 보존·가족 삭제를 지원한다',async()=>{
 const env=database(schema);
 async function call(path,body,access){const r=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
 try{
  const child={id:crypto.randomUUID(),name:'가상 출산 준비',date:'2026-12-27',unborn:true},pin=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
  const a=(await call('/api/families',{child,pin,label:'검증 A',consent:true})).data,inv=(await call('/api/invites',{},a.accessToken)).data,b=(await call('/api/join',{invite:inv.invite,pin,label:'검증 B'})).data;
  const otherChild={...child,id:crypto.randomUUID()},other=(await call('/api/families',{child:otherChild,pin,label:'다른 가족',consent:true})).data;
  const makeItem=(name,status,kid=child)=>{const itemId=PREP_ITEMS.find(i=>i.name===name).id;return {id:prepKey('item',itemId),child_id:kid.id,kind:'item',itemId,status,at:Date.now()};};
  const operation=(record,baseRevision=0)=>({id:crypto.randomUUID(),key:record.id,entity:'preparation',action:'put',baseRevision,record});
  const tub=makeItem('아기 욕조','bought'),bidet=makeItem('아기 비데','planned');
  const results=await Promise.all([call('/api/push',{operations:[operation(tub)],recordEpoch:0},a.accessToken),call('/api/push',{operations:[operation(bidet)],recordEpoch:0},b.accessToken)]);assert.ok(results.every(r=>r.status===200));
  const fresh=await call('/api/pull?protocol=4',null,b.accessToken);assert.equal(fresh.data.changes.filter(e=>e.entity==='preparation').length,2);
  assert.equal((await call('/api/pull?protocol=3',null,b.accessToken)).status,426);
  const foreign=await call('/api/push',{operations:[operation(tub)],recordEpoch:0},other.accessToken);assert.equal(foreign.status,400);
  assert.equal((await call('/api/push',{operations:[operation(makeItem('아기 욕조','skip',otherChild))],recordEpoch:0},other.accessToken)).status,200);
  assert.equal((await call('/api/push',{operations:[operation({...bidet,status:'bought'},1)],recordEpoch:0},a.accessToken)).status,200);
  const collision=await call('/api/push',{operations:[operation({...bidet,status:'skip'},1)],recordEpoch:0},b.accessToken);assert.equal(collision.data.results[0].conflict.record.status,'bought');
  const task={id:prepKey('task','bath-clean'),child_id:child.id,kind:'task',taskId:'bath-clean',done:true,at:Date.now()};assert.equal((await call('/api/push',{operations:[operation(task)],recordEpoch:0},b.accessToken)).status,200);
  const invalid={...tub,id:'prep.item.fake',itemId:'fake'};assert.equal((await call('/api/push',{operations:[operation(invalid)],recordEpoch:0},a.accessToken)).status,400);
  const milk={id:crypto.randomUUID(),child_id:child.id,type:'feeding',kind:'분유',amount:80,at:1,memo:null};assert.equal((await call('/api/push',{operations:[{...operation(milk),entity:'record'}],recordEpoch:0},a.accessToken)).status,200);
  let preview=(await call('/api/maintenance',null,a.accessToken)).data;assert.equal(preview.recordCount,1);
  const confirm=action=>({pin,childName:child.name,confirm:true,confirmText:action,expectedEpoch:preview.recordEpoch,expectedCursor:preview.cursor});
  assert.equal((await call('/api/reset-records',confirm('기록 초기화'),a.accessToken)).status,200);
  const reset=await call('/api/pull?protocol=4',null,b.accessToken);assert.equal(reset.status,200);assert.equal(reset.data.recordEpoch,1);assert.equal(reset.data.changes.filter(e=>e.entity==='record').length,0);assert.ok(reset.data.changes.some(e=>e.id===task.id&&e.record.done));
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM entries WHERE family_id=? AND entity='preparation'").get(a.familyId).n,3);
  assert.ok(env.raw.prepare('SELECT COUNT(*) n FROM mutations WHERE family_id=? AND entry_id=?').get(a.familyId,task.id).n>0);
  const isolated=await call('/api/pull?protocol=4',null,other.accessToken);assert.equal(isolated.data.changes.filter(e=>e.entity==='preparation').length,1);assert.equal(isolated.data.changes.at(-1).record.status,'skip');
  preview=(await call('/api/maintenance',null,a.accessToken)).data;assert.equal((await call('/api/delete-family',confirm('가족 기록함 삭제'),a.accessToken)).status,200);
  assert.equal(env.raw.prepare('SELECT COUNT(*) n FROM entries WHERE family_id=?').get(a.familyId).n,0);assert.equal((await call('/api/pull?protocol=4',null,b.accessToken)).status,410);
 }finally{env.close();}
});
