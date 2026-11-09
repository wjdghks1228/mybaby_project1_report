import test from 'node:test';
import assert from 'node:assert/strict';
import {PREP_ITEMS,PREP_CATEGORIES} from '../app/preparation-catalog.js';
import {prepSchedule,prepWeek,prepProgress,setPrepItem,setPrepTask,restorePreparation,prepKey} from '../app/preparation-model.js';
import {createPreparationUI} from '../app/preparation-ui.js';
import {queueChanges,applyChanges,applyReset,emptySync,resolveConflict} from '../app/sync-core.js';
import {summary} from '../app/model.js';
const child=()=>({id:crypto.randomUUID(),name:'가상 행운이',date:'2026-12-27',unborn:true});
const item=name=>PREP_ITEMS.find(i=>i.name===name).id;
const initial=()=>({child:child(),records:[],preparation:{},sync:emptySync()});

test('첨부 목록의 11개 분야와 준비물 식별자는 중복 없이 유지된다',()=>{
 assert.equal(PREP_CATEGORIES.length,11);assert.equal(PREP_ITEMS.length,176);assert.equal(new Set(PREP_ITEMS.map(i=>i.id)).size,PREP_ITEMS.length);
 for(const i of PREP_ITEMS)assert.ok(PREP_CATEGORIES.some(c=>c.id===i.category));
 assert.ok(item('아기 욕조'));assert.ok(item('아기 비데'));assert.ok(item('카시트 (바구니형)'));
});

test('12월 27일 예정일과 구매 상태로 12월 첫째 주 청소·둘째 주 설치를 생성한다',()=>{
 let state=initial();for(const name of ['아기 욕조','아기 비데','카시트 (바구니형)'])state=setPrepItem(state,item(name),'bought');
 const groups=prepSchedule(state.child,state.preparation,'2026-11-09'),find=id=>groups.find(g=>g.tasks.some(t=>t.id===id));
 assert.equal(find('bath-clean').key,'2026-12-01');assert.equal(find('car-clean').label,'2026년 12월 1주');assert.equal(find('bidet-fit').key,'2026-12-08');assert.equal(find('carseat-fit').label,'2026년 12월 2주');
 assert.equal(groups.flatMap(g=>g.tasks).filter(t=>t.id==='bath-clean').length,1);
 state=setPrepTask(state,'bath-clean',true);assert.equal(prepSchedule(state.child,state.preparation).flatMap(g=>g.tasks).find(t=>t.id==='bath-clean').done,true);
});

test('구매 예정은 구매 일정, 구매 완료는 후속 준비, 필요 없음은 관련 일정에서 제외한다',()=>{
 let state=setPrepItem(initial(),item('아기 비데'),'planned');
 let tasks=prepSchedule(state.child,state.preparation).flatMap(g=>g.tasks);assert.ok(tasks.some(t=>t.itemId===item('아기 비데')));assert.ok(!tasks.some(t=>t.id==='bidet-fit'));
 state=setPrepItem(state,item('아기 비데'),'bought');tasks=prepSchedule(state.child,state.preparation).flatMap(g=>g.tasks);assert.ok(tasks.some(t=>t.id==='bidet-fit'));assert.ok(!tasks.some(t=>t.itemId===item('아기 비데')));
 state=setPrepItem(state,item('아기 비데'),'skip');tasks=prepSchedule(state.child,state.preparation).flatMap(g=>g.tasks);assert.ok(!tasks.some(t=>t.id==='bidet-fit'||t.id==='bath-clean'));assert.equal(prepProgress(state.preparation).skip,1);
});

test('성장 후 물품·수면 안전 확인·의료진 확인 물품은 자동 구매 일정에서 제외한다',()=>{
 let state=initial();for(const name of ['짱구 베개','카시트 (주니어)','철분제','목튜브'])state=setPrepItem(state,item(name),'planned');
 assert.equal(prepSchedule(state.child,state.preparation).flatMap(g=>g.tasks).filter(t=>t.action==='buy').length,0);
});

test('예정일 변경·연말·윤년·이미 지난 일정과 출생 후 상태를 처리한다',()=>{
 let state=setPrepItem(initial(),item('카시트 (바구니형)'),'bought');
 const moved={...state.child,date:'2027-01-10'},tasks=prepSchedule(moved,state.preparation,'2027-01-09');assert.ok(tasks.some(g=>g.start.startsWith('2026-12')));assert.ok(tasks.some(g=>g.overdue));
 assert.equal(prepWeek('2028-02-29').end,'2028-02-29');assert.throws(()=>prepWeek('2026-02-30'));assert.deepEqual(prepSchedule({...moved,unborn:false},state.preparation),[]);
});

test('준비 체크는 기록 통계에 들어가지 않고 다른 준비물의 변경과 합쳐진다',()=>{
 const before=initial(),changed=setPrepItem(before,item('아기 욕조'),'bought'),queued=queueChanges(before,changed);
 const pending=Object.values(queued.sync.pending);assert.equal(pending.length,1);assert.equal(pending[0].entity,'preparation');assert.equal(queued.records.length,0);assert.equal(summary(queued.records,'2026-11-09').feeds,0);
 const remote=setPrepItem(before,item('아기 비데'),'planned'),r=Object.values(remote.preparation)[0];const merged=applyChanges(queued,[{id:r.id,entity:'preparation',revision:1,deleted:false,record:r}],1);
 assert.equal(Object.keys(merged.preparation).length,2);assert.equal(Object.keys(merged.sync.pending).length,1);
});

test('기록 초기화는 준비 체크·그 전송 대기와 충돌을 보존하며 가족 삭제 때 함께 제거할 수 있다',()=>{
 const before=initial(),after=queueChanges(before,setPrepItem(before,item('아기 욕조'),'bought')),key=prepKey('item',item('아기 욕조'));
 const remote={...after.preparation[key],status:'skip'};const conflict=applyChanges(after,[{id:key,entity:'preparation',revision:1,record:remote,deleted:false}],1);
 assert.ok(conflict.sync.conflicts[key]);const reset=applyReset(conflict,1);assert.ok(reset.preparation[key]);assert.ok(reset.sync.pending[key]);assert.ok(reset.sync.conflicts[key]);
 const resolved=resolveConflict(reset,key,'remote');assert.equal(resolved.preparation[key].status,'skip');assert.equal(Object.keys(resolved.sync.pending).length,0);
 const deleted=applyChanges(resolved,[{id:key,entity:'preparation',revision:2,deleted:true,record:null}],2,1);assert.equal(Object.keys(deleted.preparation).length,0);
});

test('새 준비 백업은 검증 후 복원하고 이전 백업과 잘못된 상태·다른 아이·임의 ID를 구별한다',()=>{
 const state=setPrepItem(initial(),item('아기 비데'),'bought'),value=JSON.parse(JSON.stringify(state.preparation)),key=Object.keys(value)[0];
 assert.deepEqual(restorePreparation(value,state.child.id),value);assert.deepEqual(restorePreparation(undefined,state.child.id),{});
 for(const record of [{...value[key],status:'invalid'},{...value[key],child_id:'other'},{...value[key],id:'arbitrary'}])assert.throws(()=>restorePreparation({[key]:record},state.child.id));
});

test('준비 메뉴는 출생 전 홈에만 표시하고 출생 후에도 별도 메뉴에서 기록을 보존한다',()=>{
 let state=initial();state.child.name='<img src=x onerror=alert(1)>';
 const ui=createPreparationUI({read:()=>state,persist(){},render(){},notify(){},editChild(){},today:()=> '2026-11-09'});
 assert.ok(ui.entry().includes('탄생 준비 가이드'));assert.ok(!ui.entry().includes('<img src=x'));assert.ok(ui.page().includes('준비물 체크리스트'));
 state={...state,child:{...state.child,unborn:false}};assert.equal(ui.entry(),'');assert.ok(ui.entry(true).includes('출산 준비 기록'));
});
