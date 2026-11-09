import {validateHealthRecord} from './health-model.js';
export const dayKey = (value = Date.now()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function bounds(day) { const start = new Date(`${day}T00:00:00`); const end = new Date(start); end.setDate(end.getDate()+1); return [+start,+end]; }
export function segments(records, day, now=Date.now()) { const [a,b]=bounds(day); return records.filter(r=>r.type==='sleep').map(r=>({...r,from:Math.max(a,r.at),to:Math.min(b,r.end??now)})).filter(r=>r.to>r.from); }
export const FEEDING_KINDS=['분유','모유','유축유','혼합','기타'];
const knownAmount=r=>Number.isFinite(r.amount)&&r.amount>=0;
const amountTotal=rows=>{const known=rows.filter(knownAmount);return known.length?known.reduce((total,r)=>total+r.amount,0):null;};
export function intakeBreakdown(rows){
 const feeds=rows.filter(r=>r.type==='feeding'),foods=rows.filter(r=>r.type==='food'),diapers=rows.filter(r=>r.type==='diaper');
 const kindOf=r=>r.kind?.startsWith('모유')?'모유':FEEDING_KINDS.includes(r.kind)?r.kind:'기타';
 return {
  feedingKinds:FEEDING_KINDS.map(kind=>{const group=feeds.filter(r=>kindOf(r)===kind);return {kind,count:group.length,amount:amountTotal(group),unknown:group.filter(r=>!knownAmount(r)).length,duration:group.reduce((total,r)=>total+(Number.isFinite(r.duration)?r.duration:0),0)};}),
  food:{count:foods.length,amount:amountTotal(foods),unknown:foods.filter(r=>!knownAmount(r)).length},
  diaperKinds:['소변','대변','소변 + 대변'].map(kind=>({kind,count:diapers.filter(r=>r.kind===kind).length}))
 };
}
export function summary(records,day,now=Date.now()) {
 const [a,b]=bounds(day),rows=records.filter(r=>r.at>=a&&r.at<b),feeds=rows.filter(r=>r.type==='feeding'),temps=rows.filter(r=>r.type==='temperature'),diapers=rows.filter(r=>r.type==='diaper'),sleeps=segments(records,day,now);
 return {rows,feeds:feeds.length,amount:amountTotal(feeds),sleep:sleeps.length?sleepTotal(sleeps):null,diapers:diapers.length,urine:diapers.filter(r=>r.kind!=='대변').length,stool:diapers.filter(r=>r.kind!=='소변').length,temperature:temps.length?temps.reduce((s,r)=>s+r.value,0)/temps.length:null,latestTemperature:temps.sort((x,y)=>y.at-x.at)[0]??null,...intakeBreakdown(rows)};
}
export function average(values) { const known=values.filter(v=>v!==null); return known.length?known.reduce((a,b)=>a+b,0)/known.length:null; }
export function validate(r) { if(!r||!r.id||!Number.isFinite(r.at)||r.at>Date.now()+60000) throw Error('기록 시각을 확인해주세요.'); if(!['feeding','food','diaper','sleep','temperature','growth','activity','hospital','note'].includes(r.type)) throw Error('지원하지 않는 기록입니다.'); if(r.type==='hospital'||r.type==='note')validateHealthRecord(r); if(r.type==='growth'&&(!['체중','신장','머리둘레'].includes(r.kind)||!Number.isFinite(r.value)||r.value<=0||r.value>200||!['kg','cm'].includes(r.unit)))throw Error('성장 기록을 확인해주세요.'); if(r.type==='activity'&& !['목욕','터미타임','배꼽 관리'].includes(r.kind))throw Error('생활 기록을 확인해주세요.'); if(r.type==='feeding'&&(typeof r.kind!=='string'||r.kind.length>40))throw Error('수유 유형을 확인해주세요.'); if(r.type==='temperature'&&(!Number.isFinite(r.value)||r.value<30||r.value>45)) throw Error('체온을 정확하게 입력해주세요 (30~45°C).'); if(r.type==='feeding'&&(r.amount!==null&&(!Number.isFinite(r.amount)||r.amount<=0||r.amount>2000))) throw Error('수유량을 확인해주세요.'); if(r.type==='food'&&(r.kind!=='이유식'||r.unit!=='g'||typeof r.foodName!=='string'||r.foodName.length>80||r.amount!==null&&(!Number.isFinite(r.amount)||r.amount<=0||r.amount>2000)))throw Error('이유식 이름과 먹은 양(g)을 확인해주세요.'); if(r.type==='diaper'&&!['소변','대변','소변 + 대변'].includes(r.kind)) throw Error('기저귀 상태를 선택해주세요.'); if(r.type==='sleep'&&r.end!==null&&(!Number.isFinite(r.end)||r.end<=r.at||r.end>Date.now()+60000)) throw Error('수면 종료 시각을 확인해주세요.'); return r; }
export function age(child,now=Date.now()) { const target=new Date(`${child.date}T00:00:00`); const today=new Date(`${dayKey(now)}T00:00:00`); const days=Math.round((today-target)/86400000); return child.unborn?`만날 날까지 D${days<0?'-':'+'}${Math.abs(days)}`:`생후 ${days}일 · ${Math.floor(days/7)}주 ${days%7}일`; }

export function sleepTotal(intervals) {const sorted=[...intervals].sort((a,b)=>a.from-b.from);let total=0,end=-Infinity;for(const r of sorted){if(r.to>end){total+=r.to-Math.max(end,r.from);end=r.to;}}return total;}
