import {validate} from '../app/model.js';

const SESSION_MS=12*60*60*1000;
const encoder=new TextEncoder();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const uuid=()=>crypto.randomUUID();
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
function fail(status,message,code){throw Object.assign(new Error(message),{status,code});}
function validText(value,max){return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
function childValid(child){return child&&validText(child.id,80)&&validText(child.name,30)&&typeof child.unborn==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(child.date)&&Number.isFinite(+new Date(child.date));}
async function pinHash(pin,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256)),b=>b.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
function checkPin(pin){if(typeof pin!=='string'||!/^\d{4}$/.test(pin))fail(400,'PIN 네 자리를 입력해주세요.');}
function statement(db,sql,...args){return db.prepare(sql).bind(...args);}
async function first(db,sql,...args){return statement(db,sql,...args).first();}
async function run(db,sql,...args){return statement(db,sql,...args).run();}
async function body(request){const len=Number(request.headers.get('content-length')??0);if(len>196608)fail(413,'한 번에 전송할 데이터가 너무 많아요.');const reader=request.body?.getReader();if(!reader)return {};let bytes=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>196608){await reader.cancel();fail(413,'한 번에 전송할 데이터가 너무 많아요.');}chunks.push(value);}const buffer=new Uint8Array(bytes);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}try{return JSON.parse(new TextDecoder().decode(buffer));}catch{fail(400,'올바른 요청이 아니에요.');}}
async function rate(db,key,max,windowMs){const now=Date.now();await run(db,'INSERT INTO auth_limits(id,count,resets_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END',key,now+windowMs,now,now);const row=await first(db,'SELECT count FROM auth_limits WHERE id=?',key);if(row.count>max)fail(429,'잠시 후 다시 시도해주세요.');}
async function newSession(db,deviceId){const access=token(),expiresAt=Date.now()+SESSION_MS;await run(db,'INSERT INTO sessions(key_hash,device_id,expires_at) VALUES(?,?,?)',await hash(access),deviceId,expiresAt);return {accessToken:access,expiresAt};}
async function newDevice(db,familyId,label){if(!validText(label,30))fail(400,'기기에서 사용할 보호자 이름을 입력해주세요.');const id=uuid(),deviceKey=token();await run(db,'INSERT INTO devices(id,family_id,key_hash,label,created_at) VALUES(?,?,?,?,?)',id,familyId,await hash(deviceKey),label.trim(),Date.now());return {deviceKey,deviceId:id,...await newSession(db,id)};}
async function authenticated(db,request){const auth=request.headers.get('Authorization')??'';if(!/^Bearer [a-f0-9]{64}$/.test(auth))fail(401,'PIN으로 다시 입장해주세요.');const row=await first(db,'SELECT d.id AS device_id,d.family_id,d.label,f.child_id,f.record_epoch FROM sessions s JOIN devices d ON d.id=s.device_id JOIN families f ON f.id=d.family_id WHERE s.key_hash=? AND s.expires_at>?',await hash(auth.slice(7)),Date.now());if(!row){const session=await first(db,'SELECT expires_at FROM sessions WHERE key_hash=?',await hash(auth.slice(7)));if(!session)fail(410,'이 기기의 가족 연결이 삭제되었어요.','CONNECTION_REMOVED');fail(401,'PIN으로 다시 입장해주세요.');}return row;}
function entryView(row){return {id:row.entry_id??row.id,entity:row.entity,revision:row.revision,deleted:!!row.deleted,record:row.deleted?null:JSON.parse(row.payload)};}
async function applyOperation(db,auth,op){
 if(!op||!validText(op.id,80)||!validText(op.key,80)||!Number.isSafeInteger(op.baseRevision)||op.baseRevision<0||!['child','record'].includes(op.entity)||!['put','delete'].includes(op.action))fail(400,'동기화 요청을 확인해주세요.');
 const fingerprint=await hash(JSON.stringify(op));
 const prior=await first(db,'SELECT fingerprint,entry_id,revision FROM mutations WHERE family_id=? AND id=?',auth.family_id,op.id);
 if(prior){if(prior.fingerprint!==fingerprint)fail(400,'중복 요청 식별자가 일치하지 않아요.');return {id:op.id,key:prior.entry_id,revision:prior.revision};}
 const current=await first(db,'SELECT * FROM entries WHERE family_id=? AND id=?',auth.family_id,op.key);
 let record=op.record,deleted=op.action==='delete';
 if(op.entity==='child'){
  if(deleted||!childValid(record)||record.id!==auth.child_id||op.key!==auth.child_id)fail(400,'아이 프로필을 확인해주세요.');
 }else if(!deleted){
  try{validate(record);}catch{fail(400,'저장할 기록의 값과 시각을 확인해주세요.');}
  if(record.id!==op.key||record.child_id!==auth.child_id||typeof record.memo!=='string'&&record.memo!==null||record.memo?.length>1000)fail(400,'아이와 기록 정보를 확인해주세요.');
  record={...record,created_by:current&&!current.deleted?(JSON.parse(current.payload).created_by??auth.label):auth.label,updated_by:auth.label,updated_at:Date.now()};
 }

 if(deleted&&!current)fail(409,'삭제할 기록이 없어요. 최신화 후 다시 확인해주세요.');
 if((current?.revision??0)!==op.baseRevision)return {id:op.id,key:op.key,conflict:current?entryView(current):{id:op.key,entity:op.entity,revision:0,deleted:true,record:null}};
 if(current&&current.entity!==op.entity)fail(400,'기록 유형이 일치하지 않아요.');
 if(!deleted&&op.entity==='record'&&record.type==='sleep'&&record.end===null){const active=await first(db,"SELECT id FROM entries WHERE family_id=? AND id<>? AND entity='record' AND deleted=0 AND json_extract(payload,'$.type')='sleep' AND json_extract(payload,'$.end') IS NULL",auth.family_id,op.key);if(active)return {id:op.id,key:op.key,reason:'다른 보호자가 이미 수면을 시작했어요. 가족 기록함의 내용을 사용해주세요.',conflict:current?entryView(current):{id:op.key,entity:'record',revision:0,deleted:true,record:null}};}
 const revision=op.baseRevision+1,payload=deleted?null:JSON.stringify(record);
 const put=current?statement(db,'UPDATE entries SET revision=?,payload=?,deleted=?,mutation_id=? WHERE family_id=? AND id=? AND revision=? AND EXISTS(SELECT 1 FROM families WHERE id=? AND record_epoch=?)',revision,payload,+deleted,op.id,auth.family_id,op.key,op.baseRevision,auth.family_id,auth.record_epoch??0):statement(db,'INSERT OR IGNORE INTO entries(family_id,id,entity,revision,payload,deleted,mutation_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM families WHERE id=? AND record_epoch=?)',auth.family_id,op.key,op.entity,revision,payload,+deleted,op.id,auth.family_id,auth.record_epoch??0);
 const result=await db.batch([
  put,
  statement(db,'INSERT OR IGNORE INTO changes(family_id,entry_id,revision,payload,entity,deleted,mutation_id) SELECT family_id,id,revision,payload,entity,deleted,mutation_id FROM entries WHERE family_id=? AND id=? AND mutation_id=?',auth.family_id,op.key,op.id),
  statement(db,'INSERT OR IGNORE INTO mutations(family_id,id,fingerprint,entry_id,revision) SELECT family_id,mutation_id,?,id,revision FROM entries WHERE family_id=? AND id=? AND mutation_id=?',fingerprint,auth.family_id,op.key,op.id)
 ]);
 if(!result[0].meta.changes){const latest=await first(db,'SELECT record_epoch FROM families WHERE id=?',auth.family_id);if(!latest)fail(410,'가족 기록함이 삭제되었어요.','CONNECTION_REMOVED');if(latest.record_epoch!==(auth.record_epoch??0))fail(409,'가족 기록이 초기화되었어요. 먼저 최신화해주세요.','RESET_REQUIRED');const retry=await first(db,'SELECT * FROM mutations WHERE family_id=? AND id=?',auth.family_id,op.id);if(retry&&retry.fingerprint===fingerprint)return {id:op.id,key:op.key,revision:retry.revision};const remote=await first(db,'SELECT * FROM entries WHERE family_id=? AND id=?',auth.family_id,op.key);return {id:op.id,key:op.key,conflict:entryView(remote)};}
 return {id:op.id,key:op.key,revision};
}
export async function api(request,env){
 const url=new URL(request.url),db=env.DB,path=url.pathname,now=Date.now();
 if(path==='/api/health'&&request.method==='GET')return {ok:true,version:'0.3.0'};
 if(!db)fail(503,'공동 기록 저장소를 준비 중이에요.');
 if(path==='/api/families'&&request.method==='POST'){
  const data=await body(request);checkPin(data.pin);if(!childValid(data.child)||data.consent!==true||!validText(data.label,30))fail(400,'아이 정보와 저장 동의를 확인해주세요.');
  await rate(db,'create:'+await hash(request.headers.get('CF-Connecting-IP')??'local'),5,3600000);
  const id=uuid(),salt=token(),pinDigest=await pinHash(data.pin,salt);
  await run(db,'INSERT INTO families(id,child_id,pin_salt,pin_hash,created_at) VALUES(?,?,?,?,?)',id,data.child.id,salt,pinDigest,now);
  const device=await newDevice(db,id,data.label);
  await applyOperation(db,{family_id:id,child_id:data.child.id,label:data.label},{id:uuid(),key:data.child.id,entity:'child',action:'put',baseRevision:0,record:data.child});
  return {familyId:id,childId:data.child.id,...device};
 }
 if(path==='/api/unlock'&&request.method==='POST'){
  const data=await body(request);checkPin(data.pin);if(!/^[a-f0-9]{64}$/.test(data.deviceKey??''))fail(401,'가족 초대 링크로 먼저 연결해주세요.');
  await rate(db,'unlock:'+await hash(request.headers.get('CF-Connecting-IP')??'local'),60,900000);
  const device=await first(db,'SELECT d.*,f.pin_salt,f.pin_hash,f.child_id FROM devices d JOIN families f ON f.id=d.family_id WHERE key_hash=?',await hash(data.deviceKey));
  if(!device)fail(410,'가족 기록함 또는 이 기기의 연결이 삭제되었어요.','CONNECTION_REMOVED');
  if(device.locked_until>now)fail(429,'PIN 입력을 여러 번 실패했어요. 15분 뒤 다시 시도해주세요.');
  if(!equal(await pinHash(data.pin,device.pin_salt),device.pin_hash)){await run(db,'UPDATE devices SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN ? ELSE 0 END WHERE id=?',now+900000,device.id);fail(401,'PIN을 확인해주세요.');}
  await run(db,'UPDATE devices SET failures=0,locked_until=0 WHERE id=?',device.id);
  return {familyId:device.family_id,childId:device.child_id,deviceId:device.id,...await newSession(db,device.id)};
 }
 if(path==='/api/join'&&request.method==='POST'){
  const data=await body(request);checkPin(data.pin);if(!/^[a-f0-9]{64}$/.test(data.invite??'')||!validText(data.label,30))fail(400,'초대 링크와 보호자 이름을 확인해주세요.');
  await rate(db,'join:'+await hash(request.headers.get('CF-Connecting-IP')??'local'),30,900000);
  const invite=await first(db,'SELECT i.*,f.pin_salt,f.pin_hash,f.child_id FROM invites i JOIN families f ON f.id=i.family_id WHERE i.key_hash=?',await hash(data.invite));
  if(!invite||invite.used||invite.expires_at<now)fail(401,'초대 링크가 만료되었거나 이미 사용되었어요.');
  if(invite.locked_until>now)fail(429,'잠시 후 다시 시도해주세요.');
  if(!equal(await pinHash(data.pin,invite.pin_salt),invite.pin_hash)){await run(db,'UPDATE invites SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN ? ELSE 0 END WHERE key_hash=?',now+900000,invite.key_hash);fail(401,'PIN을 확인해주세요.');}
  const claim=await run(db,'UPDATE invites SET used=1 WHERE key_hash=? AND used=0',invite.key_hash);if(!claim.meta.changes)fail(409,'이미 사용된 초대 링크예요.');
  return {familyId:invite.family_id,childId:invite.child_id,...await newDevice(db,invite.family_id,data.label)};
 }
 const auth=await authenticated(db,request);
 if(path==='/api/maintenance'&&request.method==='GET'){
  const row=await first(db,"SELECT e.payload,f.record_epoch,(SELECT COUNT(*) FROM entries WHERE family_id=e.family_id AND entity='record' AND deleted=0) AS record_count,(SELECT COUNT(*) FROM devices WHERE family_id=e.family_id) AS device_count,(SELECT COALESCE(MAX(seq),0) FROM changes WHERE family_id=e.family_id) AS cursor FROM entries e JOIN families f ON f.id=e.family_id WHERE e.family_id=? AND e.id=? AND e.entity='child'",auth.family_id,auth.child_id);
  return {childName:JSON.parse(row.payload).name,recordCount:row.record_count,deviceCount:row.device_count,recordEpoch:row.record_epoch,cursor:row.cursor};
 }
 if((path==='/api/reset-records'||path==='/api/delete-family')&&request.method==='POST'){
  const data=await body(request);checkPin(data.pin);
  const family=await first(db,'SELECT * FROM families WHERE id=?',auth.family_id);
  const device=await first(db,'SELECT failures,locked_until FROM devices WHERE id=?',auth.device_id);
  if(!family||!device)fail(410,'가족 연결이 삭제되었어요.','CONNECTION_REMOVED');
  if(device.locked_until>now)fail(429,'PIN 입력 실패가 누적되어 15분 뒤 다시 시도할 수 있어요.');
  if(!equal(await pinHash(data.pin,family.pin_salt),family.pin_hash)){await run(db,'UPDATE devices SET failures=failures+1,locked_until=CASE WHEN failures+1>=5 THEN ? ELSE 0 END WHERE id=?',now+900000,auth.device_id);fail(403,'가족 PIN을 확인해주세요.','PIN_INVALID');}
  await run(db,'UPDATE devices SET failures=0,locked_until=0 WHERE id=?',auth.device_id);
  const profile=await first(db,"SELECT payload FROM entries WHERE family_id=? AND id=? AND entity='child'",auth.family_id,auth.child_id);
  const action=path==='/api/reset-records'?'기록 초기화':'가족 기록함 삭제';
  if(data.confirmText!==action||data.childName!==JSON.parse(profile.payload).name||data.confirm!==true)fail(400,'아이 이름과 삭제 확인 문구를 정확히 입력해주세요.');
  if(!Number.isSafeInteger(data.expectedEpoch)||!Number.isSafeInteger(data.expectedCursor)||data.expectedEpoch<0||data.expectedCursor<0)fail(400,'삭제 전 최신 상태를 다시 확인해주세요.');
  const unchanged='id=? AND record_epoch=? AND (SELECT COALESCE(MAX(seq),0) FROM changes WHERE family_id=?)=?';
  const params=[auth.family_id,data.expectedEpoch,auth.family_id,data.expectedCursor];
  if(path==='/api/delete-family'){
   const result=await db.batch([
    statement(db,'DELETE FROM auth_limits WHERE id=? AND EXISTS(SELECT 1 FROM families WHERE '+unchanged+')','invite:'+auth.family_id,...params),
    statement(db,'DELETE FROM families WHERE '+unchanged,...params)
   ]);
   if(!result[1].meta.changes)fail(409,'확인 중 가족 기록이 바뀌었어요. 삭제 내용을 다시 확인해주세요.','MAINTENANCE_STALE');
   return {ok:true,deleted:true};
  }
  const resetId=uuid(),nextEpoch=data.expectedEpoch+1;
  const guard='EXISTS(SELECT 1 FROM families WHERE id=? AND reset_id=?)';
  const result=await db.batch([
   statement(db,'UPDATE families SET record_epoch=record_epoch+1,reset_id=? WHERE '+unchanged,resetId,...params),
   statement(db,'DELETE FROM mutations WHERE family_id=? AND entry_id<>? AND '+guard,auth.family_id,auth.child_id,auth.family_id,resetId),
   statement(db,"DELETE FROM changes WHERE family_id=? AND entity IN ('record','reset') AND "+guard,auth.family_id,auth.family_id,resetId),
   statement(db,"DELETE FROM entries WHERE family_id=? AND entity='record' AND "+guard,auth.family_id,auth.family_id,resetId),
   statement(db,"INSERT INTO changes(family_id,entry_id,revision,payload,entity,deleted,mutation_id) SELECT ?,?,?,?,'reset',0,? WHERE "+guard,auth.family_id,'__reset__',nextEpoch,JSON.stringify({epoch:nextEpoch}),resetId,auth.family_id,resetId)
  ]);
  if(!result[0].meta.changes)fail(409,'확인 중 가족 기록이 바뀌었어요. 초기화 내용을 다시 확인해주세요.','MAINTENANCE_STALE');
  return {ok:true,recordEpoch:nextEpoch};
 }
 if(path==='/api/invites'&&request.method==='POST'){
  await rate(db,'invite:'+auth.family_id,12,3600000);const invite=token(),expiresAt=now+86400000;
  await run(db,'INSERT INTO invites(key_hash,family_id,expires_at) VALUES(?,?,?)',await hash(invite),auth.family_id,expiresAt);
  return {invite,expiresAt};
 }
 if(path==='/api/push'&&request.method==='POST'){
  const data=await body(request);if(data.recordEpoch===undefined&&auth.record_epoch>0)fail(426,'기록 초기화가 반영된 최신 앱으로 업데이트해주세요.','UPDATE_REQUIRED');if(data.recordEpoch!==undefined&&data.recordEpoch!==auth.record_epoch)fail(409,'가족 기록이 초기화되었어요. 먼저 최신화해주세요.','RESET_REQUIRED');if(!Array.isArray(data.operations)||data.operations.length>30)fail(400,'동기화 요청을 나누어 보내주세요.');
  const results=[];for(const op of data.operations)results.push(await applyOperation(db,auth,op));return {results};
 }
 if(path==='/api/pull'&&request.method==='GET'){
  if(auth.record_epoch>0&&url.searchParams.get('protocol')!=='2')fail(426,'기록 초기화가 반영된 최신 앱으로 업데이트해주세요.','UPDATE_REQUIRED');
  const cursor=Number(url.searchParams.get('cursor')??0);if(!Number.isSafeInteger(cursor)||cursor<0)fail(400,'최신화 위치를 확인해주세요.');
  const {results}=await statement(db,'SELECT * FROM changes WHERE family_id=? AND seq>? ORDER BY seq LIMIT 100',auth.family_id,cursor).all();
  return {recordEpoch:auth.record_epoch,changes:results.map(entryView),cursor:results.at(-1)?.seq??cursor,hasMore:results.length===100};
 }
 if(path==='/api/disconnect'&&request.method==='POST'){await run(db,'DELETE FROM devices WHERE id=?',auth.device_id);return {ok:true};}
 fail(404,'요청한 기능을 찾을 수 없어요.');
}
export async function handle(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const allowedOrigin=origin===url.origin||origin==='https://app.ssukssuk.local';
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 if(origin&&allowedOrigin){headers['Access-Control-Allow-Origin']=origin;headers['Vary']='Origin';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';}
 if(url.pathname.startsWith('/api/')){
  if(origin&&!allowedOrigin)return new Response(JSON.stringify({error:'허용되지 않은 접속 경로예요.'}),{status:403,headers:{...headers,'Content-Type':'application/json'}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{return Response.json(await api(request,env),{headers});}catch(error){return Response.json({error:error.status?error.message:'저장소에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',...(error.code?{code:error.code}:{})},{status:error.status??500,headers});}
 }
 const path=url.pathname==='/'?'/index.html':url.pathname;
 const asset=typeof STATIC_ASSETS!=='undefined'?STATIC_ASSETS[path]:null;
 if(!asset||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404,headers});
 headers['Content-Type']=asset.type;
 headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'";
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers});
}
export default {fetch:handle};
