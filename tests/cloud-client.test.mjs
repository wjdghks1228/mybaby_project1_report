import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {emptySync,queueChanges} from '../app/sync-core.js';

async function fixture(t,route){
 const originals=new Map(['localStorage','window','location','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const child={id:randomUUID(),name:'가상 테스트',date:'2026-01-01',unborn:false};
 const storage=new Map([['ssukssuk-family-connection-v1',JSON.stringify({familyId:randomUUID(),childId:child.id,deviceKey:randomBytes(32).toString('hex'),label:'테스트 기기'})]]);
 let state={child,records:[],sync:emptySync()},resetCount=0,revokedCount=0;
 const calls=[];
 const globals={localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},window:{addEventListener(){}},location:{protocol:'https:',hostname:'fixture.invalid',origin:'https://fixture.invalid'},fetch:async(url,options)=>{
  const path=new URL(url).pathname,data=options.body?JSON.parse(options.body):null;calls.push(path);
  if(path==='/api/unlock')return Response.json({accessToken:randomBytes(32).toString('hex'),expiresAt:Date.now()+60000});
  return route(path,data);
 }};
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const {createCloud,hasConnection}=await import('../app/cloud.js?test='+randomUUID());
 const cloud=createCloud({read:()=>state,commit:next=>(state=next,true),attach:next=>(state=next,true),changed(){},notify(){},onReset(){resetCount++;},revoked(){revokedCount++;state={child:null,records:[]};}});
 return {cloud,child,storage,calls,hasConnection,read:()=>state,set:next=>{state=next;},counts:()=>({resetCount,revokedCount})};
}
const pulled=epoch=>Response.json({recordEpoch:epoch,changes:[],cursor:0,hasMore:false});

test('클라이언트는 초기화 상태를 먼저 내려받아 이전 오프라인 기록의 업로드를 막는다',async t=>{
 let epoch=0,pushes=0;
 const f=await fixture(t,path=>{if(path==='/api/pull')return pulled(epoch);if(path==='/api/push'){pushes++;return Response.json({results:[]});}throw Error('Unexpected test route');});
 await f.cloud.unlock('0000');
 const before=f.read();f.set(queueChanges(before,{...before,records:[{id:randomUUID(),type:'diaper'}],nursing:{at:1}}));
 epoch=1;await f.cloud.sync(true);
 assert.equal(pushes,0);assert.equal(f.read().records.length,0);assert.equal(f.read().nursing,null);assert.equal(f.cloud.status().pending,0);assert.equal(f.read().child.id,f.child.id);assert.equal(f.counts().resetCount,1);
});

test('확정된 서버 초기화 뒤 통신이 끊겨도 기기 기록을 지우고 성공 여부를 구분한다',async t=>{
 let reset=false;
 const f=await fixture(t,path=>{if(path==='/api/reset-records'){reset=true;return Response.json({ok:true,recordEpoch:1});}if(path==='/api/pull')return reset?Response.json({error:'테스트 연결 실패'},{status:503}):pulled(0);throw Error('Unexpected test route');});
 await f.cloud.unlock('0000');const before=f.read();f.set(queueChanges(before,{...before,records:[{id:randomUUID()}],nursing:{at:1}}));
 const result=await f.cloud.maintain('reset',{});
 assert.equal(result.syncWarning,true);assert.equal(f.read().records.length,0);assert.equal(f.cloud.status().pending,0);assert.equal(f.counts().resetCount,1);assert.equal(f.hasConnection(),true);
});

test('가족 삭제는 기기 연결 정보를 제거하고 캐시 정리 콜백을 호출한다',async t=>{
 const f=await fixture(t,path=>path==='/api/delete-family'?Response.json({ok:true,deleted:true}):pulled(0));
 await f.cloud.unlock('0000');await f.cloud.maintain('delete',{});
 assert.equal(f.hasConnection(),false);assert.equal(f.storage.has('ssukssuk-family-connection-v1'),false);assert.equal(f.read().child,null);assert.equal(f.counts().revokedCount,1);
});

test('다른 기기에서 삭제된 연결은 다음 최신화 때 해제되지만 PIN 오류는 기록을 보존한다',async t=>{
 let failure=null;
 const f=await fixture(t,path=>{if(path==='/api/pull')return failure?Response.json(failure.body,{status:failure.status}):pulled(0);if(path==='/api/reset-records')return Response.json({error:'PIN 확인 실패',code:'PIN_INVALID'},{status:403});throw Error('Unexpected test route');});
 await f.cloud.unlock('0000');
 await assert.rejects(f.cloud.maintain('reset',{}),e=>e.code==='PIN_INVALID');
 assert.equal(f.hasConnection(),true);assert.equal(f.cloud.status().unlocked,true);assert.equal(f.read().child.id,f.child.id);
 failure={status:410,body:{error:'연결 삭제',code:'CONNECTION_REMOVED'}};
 await assert.rejects(f.cloud.sync(true),e=>e.code==='CONNECTION_REMOVED');
 assert.equal(f.hasConnection(),false);assert.equal(f.read().child,null);assert.equal(f.counts().revokedCount,1);
});
