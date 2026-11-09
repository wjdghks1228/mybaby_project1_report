import {CLOUD_ORIGIN} from './cloud-config.js';
import {emptySync,queueChanges,acceptResults,applyChanges,resolveConflict} from './sync-core.js';
const CONNECTION='ssukssuk-family-connection-v1';
let connection=null;
try{const raw=localStorage.getItem(CONNECTION);if(raw){const value=JSON.parse(raw);if(typeof value.deviceKey==='string'&&typeof value.familyId==='string')connection=value;}}catch{}
export const hasConnection=()=>!!connection;
export function createCloud({read,commit,attach,changed,notify}){
 let access=null,expiresAt=0,busy=false,timer=null,lastError=null;
 const inFlight=new Set();
 const origin=CLOUD_ORIGIN??(location.protocol==='https:'&&location.hostname!=='app.ssukssuk.local'?location.origin:null);
 const unlocked=()=>!!access&&Date.now()<expiresAt;
 async function request(path,{method='GET',data,authenticated=true}={}){
  if(!origin)throw Error('공동 기록 서버가 아직 연결되지 않았어요.');
  if(authenticated&&!unlocked())throw Object.assign(Error('PIN으로 입장해주세요.'),{status:401});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  let response;
  try{response=await fetch(origin+path,{method,credentials:'omit',headers:{...(data?{'Content-Type':'application/json'}:{}),...(authenticated?{Authorization:`Bearer ${access}`}:{})},body:data?JSON.stringify(data):undefined,signal:controller.signal});}catch{throw Error(navigator.onLine?'서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.':'인터넷 연결을 기다리고 있어요. 기록은 이 기기에 보관돼요.');}finally{clearTimeout(timeout);}
  let result;try{result=await response.json();}catch{throw Error('공동 기록 서버의 응답을 확인하지 못했어요.');}
  if(!response.ok){if(response.status===401&&authenticated){access=null;expiresAt=0;}throw Object.assign(Error(result.error??'요청을 처리하지 못했어요.'),{status:response.status});}
  return result;
 }
 function schedule(){clearTimeout(timer);if(connection&&unlocked())timer=setTimeout(()=>sync(),800);}
 function queued(before,next){return connection?queueChanges(before,next,inFlight):next;}
 async function remember(result,label){
  const saved={familyId:result.familyId,childId:result.childId,deviceId:result.deviceId,deviceKey:result.deviceKey,label};
  localStorage.setItem(CONNECTION,JSON.stringify(saved));connection=saved;access=result.accessToken;expiresAt=result.expiresAt;lastError=null;
 }
 async function create(pin,label,consent){
  const current=read();if(!current.child)throw Error('먼저 아이 프로필을 등록해주세요.');
  const result=await request('/api/families',{method:'POST',authenticated:false,data:{child:current.child,pin,label,consent}});
  await remember(result,label);
  let next={...current,sync:emptySync()};next.sync.versions[current.child.id]=1;
  next=queueChanges({child:current.child,records:[]},next);
  if(!attach(next)){access=null;throw Error('이 기기에 연결 정보를 저장하지 못했어요.');}
  await sync(true);
 }
 async function join(invite,pin,label){
  const result=await request('/api/join',{method:'POST',authenticated:false,data:{invite,pin,label}});
  await remember(result,label);
  if(!attach({child:null,records:[],sync:emptySync()}))throw Error('이 기기에 연결 정보를 저장하지 못했어요.');
  await sync(true);
 }
 async function unlock(pin){if(!connection)throw Error('가족 연결이 필요해요.');const result=await request('/api/unlock',{method:'POST',authenticated:false,data:{deviceKey:connection.deviceKey,pin}});access=result.accessToken;expiresAt=result.expiresAt;lastError=null;await sync(true);}
 async function sync(rethrow=false){
  if(busy||!connection||!unlocked())return;
  busy=true;lastError=null;changed();
  try{
   let pushed=0;
   while(pushed<10){
    const state=read(),ops=Object.values(state.sync?.pending??{}).filter(op=>!state.sync?.conflicts?.[op.key]).slice(0,30);
    if(!ops.length)break;ops.forEach(op=>inFlight.add(op.key));
    const result=await request('/api/push',{method:'POST',data:{operations:ops}});
    if(!commit(acceptResults(read(),ops,result.results)))throw Error('최신화 정보를 이 기기에 저장하지 못했어요.');
    inFlight.clear();pushed++;
   }
   let more=true,pages=0;
   while(more&&pages<100){const cursor=read().sync?.cursor??0;const result=await request('/api/pull?cursor='+cursor);if(!commit(applyChanges(read(),result.changes,result.cursor)))throw Error('내려받은 기록을 이 기기에 저장하지 못했어요.');more=result.hasMore;pages++;}
   if(more)schedule();else{const next=structuredClone(read());next.sync??=emptySync();next.sync.lastSyncedAt=Date.now();if(!commit(next))throw Error('최신화 시각을 저장하지 못했어요.');}
   if(Object.keys(read().sync?.conflicts??{}).length)notify('같이 수정한 기록이 있어요. 최신화 카드에서 확인해주세요.');
  }catch(error){lastError=error.message;if(rethrow)throw error;}
  finally{inFlight.clear();busy=false;changed();}
 }
 async function invite(){const data=await request('/api/invites',{method:'POST',data:{}});return {...data,url:origin+'/#invite='+data.invite};}
 function resolve(key,choice){const next=resolveConflict(read(),key,choice);if(commit(next)){changed();schedule();}}
 function lock(){access=null;expiresAt=0;changed();}
 function status(){return {connected:!!connection,configured:!!origin,unlocked:unlocked(),busy,error:lastError,label:connection?.label,pending:Object.keys(read().sync?.pending??{}).length,conflicts:Object.keys(read().sync?.conflicts??{}).length,lastSyncedAt:read().sync?.lastSyncedAt??null};}
 async function detach(){if(Object.keys(read().sync?.pending??{}).length)throw Error('전송 대기 기록을 먼저 최신화해주세요. 백업은 마이에서 할 수 있어요.');await request('/api/disconnect',{method:'POST',data:{}});localStorage.removeItem(CONNECTION);connection=null;access=null;expiresAt=0;changed();}
 window.addEventListener('online',schedule);
 return {status,queued,schedule,sync,create,join,unlock,invite,resolve,lock,detach};
}
