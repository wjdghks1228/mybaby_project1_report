import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './helpers/db.mjs';
import {handle} from '../cloud/worker.js';
import {VACCINES} from '../app/health-model.js';
const schema=await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'),site='https://test-family.example';
test('병원·특이사항은 기기 간 추가·수정·삭제·충돌과 초기화를 지원하고 구버전에 새 형식을 보내지 않는다',async()=>{
 const env=database(schema);
 async function call(path,body,access){const r=await handle(new Request(site+path,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
 try{
  const child={id:crypto.randomUUID(),name:'가상 병원 기록 검증',date:'2026-01-01',unborn:false},pin=String(crypto.getRandomValues(new Uint16Array(1))[0]%10000).padStart(4,'0');
  const a=(await call('/api/families',{child,pin,label:'검증 A',consent:true})).data,inv=(await call('/api/invites',{},a.accessToken)).data,b=(await call('/api/join',{invite:inv.invite,pin,label:'검증 B'})).data;
  const otherChild={...child,id:crypto.randomUUID()},other=(await call('/api/families',{child:otherChild,pin,label:'다른 가상 가족',consent:true})).data;
  const common={child_id:child.id,at:1,memo:null},v={...common,id:crypto.randomUUID(),type:'hospital',kind:'예방접종',vaccineId:'hepb',title:VACCINES.find(r=>r.id==='hepb').name,dose:'1차',hospitalName:'가상 병원'},n={...common,id:crypto.randomUUID(),type:'note',kind:'구토',title:'가상 특이사항',memo:'자유 기록'};
  const custom={...v,id:crypto.randomUUID(),vaccineId:null,title:'목록에 없는 가상 접종'};
  const operation=(record,baseRevision=0)=>({id:crypto.randomUUID(),key:record.id,entity:'record',action:'put',baseRevision,record});
  assert.equal((await call('/api/push',{operations:[operation(v),operation(n),operation(custom)],recordEpoch:0},a.accessToken)).status,200);
  assert.equal((await call('/api/pull?protocol=4',null,b.accessToken)).status,426);
  const fresh=await call('/api/pull?protocol=5',null,b.accessToken);assert.equal(fresh.status,200);assert.equal(fresh.data.changes.filter(e=>e.entity==='record').length,3);
  assert.equal((await call('/api/pull?protocol=5',null,other.accessToken)).data.changes.length,1);
  assert.equal((await call('/api/push',{operations:[operation(v)],recordEpoch:0},other.accessToken)).status,400);
  assert.equal((await call('/api/push',{operations:[operation({...v,dose:'2차'},1)],recordEpoch:0},b.accessToken)).status,200);
  const conflict=await call('/api/push',{operations:[operation({...v,dose:'수정된 차수'},1)],recordEpoch:0},a.accessToken);assert.equal(conflict.data.results[0].conflict.record.dose,'2차');
  const edited=await call('/api/pull?protocol=5&cursor='+fresh.data.cursor,null,a.accessToken);assert.equal(edited.data.changes[0].record.dose,'2차');
  assert.equal((await call('/api/push',{operations:[{...operation(n,1),action:'delete',record:null}],recordEpoch:0},a.accessToken)).status,200);
  const deleted=await call('/api/pull?protocol=5&cursor='+edited.data.cursor,null,b.accessToken);assert.ok(deleted.data.changes.some(e=>e.id===n.id&&e.deleted));
  const invalid={...v,id:crypto.randomUUID(),title:''};assert.equal((await call('/api/push',{operations:[operation(invalid)],recordEpoch:0},a.accessToken)).status,400);
  const preview=(await call('/api/maintenance',null,a.accessToken)).data;assert.equal(preview.recordCount,2);
  assert.equal((await call('/api/reset-records',{pin,childName:child.name,confirm:true,confirmText:'기록 초기화',expectedEpoch:preview.recordEpoch,expectedCursor:preview.cursor},a.accessToken)).status,200);
  const reset=await call('/api/pull?protocol=5',null,b.accessToken);assert.equal(reset.status,200);assert.equal(reset.data.recordEpoch,1);assert.equal(reset.data.changes.filter(e=>e.entity==='record').length,0);
 }finally{env.close();}
});
