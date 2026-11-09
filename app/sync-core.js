export const emptySync=()=>({versions:{},pending:{},conflicts:{},cursor:0,recordEpoch:0,lastSyncedAt:null});
const copy=value=>structuredClone(value);
function entries(state){const values=new Map();if(state.child)values.set(state.child.id,{entity:'child',record:state.child});for(const r of Object.values(state.preparation??{}))values.set(r.id,{entity:'preparation',record:r});for(const r of state.records??[])values.set(r.id,{entity:'record',record:r});return values;}
export function queueChanges(before,after,inFlight=new Set()){
 const next=copy(after),sync=next.sync??emptySync();next.sync=sync;
 const oldEntries=entries(before),newEntries=entries(after);
 for(const key of new Set([...oldEntries.keys(),...newEntries.keys()])){
  const old=oldEntries.get(key),value=newEntries.get(key);
  if(JSON.stringify(old)===JSON.stringify(value))continue;
  const previous=sync.pending[key];
  if(!value&&previous&&previous.baseRevision===0&&previous.action==='put'&&!inFlight.has(key)){delete sync.pending[key];delete sync.conflicts[key];continue;}
  sync.pending[key]={id:crypto.randomUUID(),key,entity:value?.entity??old.entity,action:value?'put':'delete',baseRevision:previous?.baseRevision??sync.versions[key]??0,record:value?.record??null};
 }
 return next;
}
export function acceptResults(state,sent,results){
 const next=copy(state),sync=next.sync??emptySync();next.sync=sync;
 for(const result of results){const original=sent.find(op=>op.id===result.id);if(!original)continue;
  if(result.conflict){sync.conflicts[result.key]={remote:result.conflict,reason:result.reason??null};continue;}
  sync.versions[result.key]=Math.max(sync.versions[result.key]??0,result.revision);
  const pending=sync.pending[result.key];
  if(pending?.id===result.id){delete sync.pending[result.key];delete sync.conflicts[result.key];}
  else if(pending&&pending.baseRevision===original.baseRevision)pending.baseRevision=result.revision;
 }
 return next;
}
function applyEntry(state,entry){
 if(entry.entity==='preparation'){state.preparation??={};if(entry.deleted)delete state.preparation[entry.id];else state.preparation[entry.id]=copy(entry.record);return;}
 if(entry.entity==='child'){if(!entry.deleted)state.child=copy(entry.record);return;}
 state.records=state.records.filter(r=>r.id!==entry.id);if(!entry.deleted)state.records.push(copy(entry.record));
}
export function applyReset(state,epoch){
 const next=copy(state),sync=next.sync??emptySync();next.sync=sync;
 if(epoch<=(sync.recordEpoch??0))return next;
 next.records=[];next.nursing=null;
 sync.versions=Object.fromEntries(Object.entries(sync.versions).filter(([key])=>key===next.child?.id||Object.hasOwn(next.preparation??{},key)));
 sync.pending=Object.fromEntries(Object.entries(sync.pending).filter(([,op])=>op.entity==='child'||op.entity==='preparation'));
 sync.conflicts=Object.fromEntries(Object.entries(sync.conflicts).filter(([key])=>key===next.child?.id||Object.hasOwn(next.preparation??{},key)));
 sync.recordEpoch=epoch;return next;
}
export function applyChanges(state,changes,cursor,recordEpoch=state.sync?.recordEpoch??0){
 if(recordEpoch<(state.sync?.recordEpoch??0))return copy(state);
 let next=applyReset(state,recordEpoch),sync=next.sync;
 for(const entry of changes){
  if(entry.entity==='reset'){next=applyReset(next,entry.record.epoch);sync=next.sync;continue;}
  if(entry.revision<(sync.versions[entry.id]??0))continue;
  const pending=sync.pending[entry.id];
  if(pending){if(entry.revision>pending.baseRevision)sync.conflicts[entry.id]={remote:entry};continue;}
  applyEntry(next,entry);sync.versions[entry.id]=entry.revision;
 }
 sync.cursor=Math.max(sync.cursor,cursor);return next;
}
export function resolveConflict(state,key,choice){
 const next=copy(state),sync=next.sync,conflict=sync?.conflicts[key],pending=sync?.pending[key];if(!conflict)return next;
 if(choice==='remote'||!pending){applyEntry(next,conflict.remote);sync.versions[key]=conflict.remote.revision;delete sync.pending[key];}
 else if(choice==='local'){sync.pending[key]={...pending,id:crypto.randomUUID(),baseRevision:conflict.remote.revision};sync.versions[key]=conflict.remote.revision;}
 delete sync.conflicts[key];return next;
}
