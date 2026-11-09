import {PREP_ITEMS} from './preparation-catalog.js';
export const PREP_STATES={undecided:'미정',planned:'구매 예정',bought:'구매 완료',skip:'필요 없음'};
export const PREP_TASK_RULES=[
 {id:'bath-clean',tag:'bathroom',days:24,title:'욕실 청소와 목욕 공간 정리',detail:'욕조·비데를 둘 자리를 정리하고 청소 후 충분히 환기·건조해요.'},
 {id:'car-clean',tag:'carseat',days:24,title:'차량 실내 청소와 뒷좌석 정리',detail:'카시트를 설치할 자리를 비우고 차량 설명서를 찾아두세요.'},
 {id:'bidet-fit',tag:'bidet',days:17,title:'아기 비데·수전 설치와 고정 확인',detail:'제품 설명서에 맞게 설치하고 고정 상태·누수를 확인해요.',before:'bath-clean'},
 {id:'carseat-fit',tag:'carseat',days:17,title:'신생아용 카시트 설치와 적합성 확인',detail:'차량과 카시트 설명서에 따라 뒤보기 설치, 허용 신장·체중과 고정 상태를 확인해요. 임의의 추가 패드·보호매트는 설명서의 허용 여부를 먼저 확인하세요.',before:'car-clean',source:1},
 {id:'appliance-check',tag:'appliance',days:17,title:'가전 배치·청소·작동 확인',detail:'제품 설명서에 맞춰 청소·건조하고 전선과 설치 위치를 정리해요.'},
 {id:'clothes-wash',tag:'wash',days:14,title:'아기 옷·수건 세탁과 수납',detail:'제품 세탁 표시대로 세탁하고 완전히 말려 깨끗한 공간에 보관해요.'},
 {id:'bath-wash',tag:'bathroom',days:14,title:'욕조·목욕용품 세척과 보관',detail:'제품 설명서에 맞게 세척·건조하고 사용할 자리에 보관해요.',before:'bath-clean'},
 {id:'feeding-check',tag:'feeding',days:14,title:'수유용품 세척·조립·작동 확인',detail:'제품별 설명서에 따라 세척·건조하고 조립을 연습해요. 소독 방법은 제품마다 확인하세요.'},
 {id:'sleep-check',tag:'sleep-space',days:14,title:'아기 침대와 수면 공간 안전 확인',detail:'평평하고 단단한 수면면을 확인하고, 베개·쿠션·범퍼·느슨한 이불을 수면 공간에서 치워요.',source:0},
 {id:'bag-pack',tag:'bag',days:10,title:'출산 가방 구성과 병원 준비물 확인',detail:'구매한 물품 중 병원·조리원이 실제로 요청하는 것만 골라 가방에 정리해요.'},
 {id:'route-check',days:7,title:'병원 이동 동선과 연락처 확인',detail:'가족과 이동 방법·연락처를 확인하고 병원에서 받은 입원 안내를 다시 살펴보세요.'},
 {id:'carseat-final',tag:'carseat',days:7,title:'퇴원 이동용 카시트 최종 확인',detail:'설치 설명서와 신생아 사용 범위를 다시 확인하고 가족과 사용법을 함께 살펴봐요.',before:'carseat-fit',source:1}
];
const prepDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export const prepKey=(kind,key)=>`prep.${kind}.${key}`;
export function validatePreparation(record,childId){
 if(!record||record.child_id!==childId||!Number.isFinite(record.at)||record.at>Date.now()+60000)throw Error('준비 기록의 아이와 시각을 확인해주세요.');
 if(record.kind==='item'){
  if(!PREP_ITEMS.some(item=>item.id===record.itemId)||!Object.hasOwn(PREP_STATES,record.status)||record.id!==prepKey('item',record.itemId))throw Error('준비물과 상태를 확인해주세요.');
 }else if(record.kind==='task'){
  if(!PREP_TASK_RULES.some(task=>task.id===record.taskId)||typeof record.done!=='boolean'||record.id!==prepKey('task',record.taskId))throw Error('준비 일정의 체크 상태를 확인해주세요.');
 }else throw Error('지원하지 않는 준비 기록이에요.');
 return record;
}
export function prepStatus(preparation,itemId){return preparation?.[prepKey('item',itemId)]?.status??'undecided';}
export function setPrepItem(state,itemId,status,now=Date.now()){
 const id=prepKey('item',itemId),record={id,child_id:state.child.id,kind:'item',itemId,status,at:now};validatePreparation(record,state.child.id);
 return {...state,preparation:{...state.preparation,[id]:record}};
}
export function setPrepTask(state,taskId,done,now=Date.now()){
 const id=prepKey('task',taskId),record={id,child_id:state.child.id,kind:'task',taskId,done,at:now};validatePreparation(record,state.child.id);
 return {...state,preparation:{...state.preparation,[id]:record}};
}
export function prepProgress(preparation){
 const counts={undecided:0,planned:0,bought:0,skip:0};for(const item of PREP_ITEMS)counts[prepStatus(preparation,item.id)]++;
 return {...counts,total:PREP_ITEMS.length,reviewed:counts.planned+counts.bought+counts.skip};
}
export function prepWeek(date){
 if(!prepDate(date))throw Error('출산 예정일을 확인해주세요.');
 const [year,month,day]=date.split('-').map(Number),week=Math.floor((day-1)/7)+1,lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
 const start=`${year}-${String(month).padStart(2,'0')}-${String((week-1)*7+1).padStart(2,'0')}`,end=`${year}-${String(month).padStart(2,'0')}-${String(Math.min(week*7,lastDay)).padStart(2,'0')}`;
 return {key:start,label:`${year}년 ${month}월 ${week}주`,start,end};
}
function prepBefore(due,days){const d=new Date(due+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);}
export function prepSchedule(child,preparation={},today=new Date().toISOString().slice(0,10)){
 if(!child?.unborn||!prepDate(child.date))return [];
 const tasks=[];
 for(const item of PREP_ITEMS){
  if(prepStatus(preparation,item.id)!=='planned'||item.later||item.review)continue;
  tasks.push({id:'buy-'+item.id,title:item.name+' 구매·수령 확인',detail:'이미 있는 물품·선물·대여 여부를 확인하고 필요한 수량만 준비해요.',action:'buy',itemId:item.id,related:[item.name],date:prepBefore(child.date,35),done:false});
 }
 for(const rule of PREP_TASK_RULES){
  const related=PREP_ITEMS.filter(item=>prepStatus(preparation,item.id)==='bought'&&item.tags.includes(rule.tag));
  if(rule.tag&&!related.length)continue;
  tasks.push({...rule,action:'check',related:related.map(item=>item.name),date:prepBefore(child.date,rule.days),done:preparation[prepKey('task',rule.id)]?.done??false});
 }
 const groups=new Map();
 for(const task of tasks){const week=prepWeek(task.date);if(!groups.has(week.key))groups.set(week.key,{...week,overdue:week.end<today,tasks:[]});groups.get(week.key).tasks.push(task);}
 return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
export function restorePreparation(value,childId){
 if(value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>PREP_ITEMS.length+PREP_TASK_RULES.length)throw Error('준비 기록 형식을 확인해주세요.');
 const result={};for(const [key,record] of Object.entries(value)){validatePreparation(record,childId);if(key!==record.id)throw Error('준비 기록 식별자를 확인해주세요.');result[key]=record;}return result;
}
