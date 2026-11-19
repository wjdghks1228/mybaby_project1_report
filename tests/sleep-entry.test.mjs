import test from 'node:test';
import assert from 'node:assert/strict';
import {manualSleepRecord,sleepDefaults} from '../app/sleep-entry.js';
import {summary} from '../app/model.js';
import {queueChanges,emptySync} from '../app/sync-core.js';
const at=value=>+new Date(value),now=at('2026-11-19T18:00:00');
const base=()=>({id:crypto.randomUUID(),child_id:'synthetic-child',type:'sleep',at:now,memo:null,created_at:now});
test('지난 수면은 실제 시작·종료 시각으로 기록하며 오늘의 수면 합계에 반영한다',()=>{
 const r=manualSleepRecord(base(),'2026-11-19T13:10','2026-11-19T14:40','오후 낮잠',now);assert.equal(r.type,'sleep');assert.equal(r.at,at('2026-11-19T13:10'));assert.equal(r.end,at('2026-11-19T14:40'));assert.equal(r.memo,'오후 낮잠');assert.equal(summary([r],'2026-11-19',now).sleep,90*60000);
});
test('자정을 넘는 수동 수면은 날짜별로 나눠 계산하고 기존 수면 중복은 한 번만 계산한다',()=>{
 const r=manualSleepRecord(base(),'2026-11-18T23:10','2026-11-19T01:20','',now);assert.equal(summary([r],'2026-11-18',now).sleep,50*60000);assert.equal(summary([r],'2026-11-19',now).sleep,80*60000);
 const overlap={...r,id:'overlap',at:at('2026-11-19T00:30'),end:at('2026-11-19T02:00')};assert.equal(summary([r,overlap],'2026-11-19',now).sleep,120*60000);
});
test('진행 중 수면을 종료하거나 덮어쓰지 않고 별도 과거 기록을 전송 대기에 넣는다',()=>{
 const active={...base(),id:'active',at:at('2026-11-19T17:00'),end:null},before={child:{id:'synthetic-child'},records:[active],sync:emptySync()};
 const r=manualSleepRecord(base(),'2026-11-19T13:00','2026-11-19T14:00','',now),next=queueChanges(before,{...before,records:[active,r]});assert.equal(next.records.find(r=>r.id==='active').end,null);assert.equal(Object.values(next.sync.pending).length,1);assert.equal(Object.values(next.sync.pending)[0].record.end,r.end);assert.equal(r.memo,null);
});
test('역전·같은 시각·미래·불가능한 날짜·미입력·긴 메모를 차단한다',()=>{
 for(const [a,b] of [['2026-11-19T14:00','2026-11-19T13:00'],['2026-11-19T14:00','2026-11-19T14:00'],['2026-11-19T18:01','2026-11-19T19:00'],['2026-02-30T10:00','2026-03-02T11:00'],['','2026-11-19T14:00']])assert.throws(()=>manualSleepRecord(base(),a,b,'',now));
 assert.throws(()=>manualSleepRecord(base(),'2026-11-19T13:00','2026-11-19T14:00','a'.repeat(1001),now));
});
test('기본 입력 날짜는 선택한 날을 따르고 진행 중 수면 이전 시각을 제안한다',()=>{
 const active={...base(),at:at('2026-11-19T17:00'),end:null};assert.deepEqual(sleepDefaults('2026-11-19',[active],now),{start:'2026-11-19T16:00',end:'2026-11-19T17:00'});assert.deepEqual(sleepDefaults('2026-11-18',[],now),{start:'2026-11-18T13:00',end:'2026-11-18T14:00'});
});
