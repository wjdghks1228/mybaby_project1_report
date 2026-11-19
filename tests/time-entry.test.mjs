import test from 'node:test';
import assert from 'node:assert/strict';
import {localDateTime,parseRecordTime,selectedTime,dateTimeField} from '../app/time-picker.js';
import {recordAt,createTimedRecordUI} from '../app/record-entry.js';
import {manualSleepRecord} from '../app/sleep-entry.js';
import {summary,validate} from '../app/model.js';
import {queueChanges,emptySync} from '../app/sync-core.js';

const now=+new Date('2026-11-19T18:45:00');
const base=type=>({id:crypto.randomUUID(),child_id:'synthetic-child',type,at:now,created_at:now,updated_at:now,memo:null});

test('24시간과 60가지 분 조합을 00:00부터 23:59까지 정확히 선택한다',()=>{
 const end=+new Date('2026-11-19T23:59:59');
 for(let hour=0;hour<24;hour++)for(let minute=0;minute<60;minute++){
  const value=selectedTime('2026-11-19',hour,Math.floor(minute/10),minute%10,end);
  assert.equal(new Date(parseRecordTime(value,end)).getHours(),hour);
  assert.equal(new Date(parseRecordTime(value,end)).getMinutes(),minute);
  assert.equal(localDateTime(parseRecordTime(value,end)),value);
 }
});

test('미래·불가능한 날짜·누락·범위를 벗어난 시와 분을 거절한다',()=>{
 for(const value of ['2026-02-30T10:00','2026-11-19T18:46','2026-11-20T00:00','2026-11-19T24:00','2026-11-19T18:60','','2026-11-19T8:01']) assert.throws(()=>parseRecordTime(value,now));
 for(const args of [[24,0,0],[-1,0,0],[1,6,0],[1,0,10],[1,0,-1],[1.5,0,0],[1,NaN,0]])assert.throws(()=>selectedTime('2026-11-19',...args,now));
 assert.throws(()=>selectedTime('',1,0,0,now));
 assert.equal(localDateTime(parseRecordTime('2024-02-29T00:00',now)),'2024-02-29T00:00');
});

test('수유·이유식·체온·기저귀 등 과거 기록은 실제 발생일에 집계하고 업로드 시각과 구분한다',()=>{
 const value=selectedTime('2026-11-18',23,5,9,now);
 const records=[
  {...base('feeding'),kind:'유축유',amount:80},
  {...base('food'),kind:'이유식',foodName:'쌀미음',amount:30,unit:'g'},
  {...base('diaper'),kind:'소변 + 대변'},
  {...base('temperature'),value:36.8},
  {...base('growth'),kind:'체중',value:4,unit:'kg'},
  {...base('activity'),kind:'목욕'},
 ].map(record=>recordAt(record,value,now));
 for(const record of records){validate(record);assert.equal(record.created_at,now);assert.equal(record.updated_at,now);assert.equal(localDateTime(record.at),value);}
 const day=summary(records,'2026-11-18',now),today=summary(records,'2026-11-19',now);
 assert.equal(day.amount,80);assert.equal(day.food.amount,30);assert.equal(day.diapers,1);assert.equal(day.urine,1);assert.equal(day.stool,1);assert.equal(day.latestTemperature.value,36.8);assert.equal(today.rows.length,0);
 const before={child:{id:'synthetic-child'},records:[],sync:emptySync()},queued=queueChanges(before,{...before,records});
 assert.equal(Object.values(queued.sync.pending).length,6);
 for(const operation of Object.values(queued.sync.pending))assert.equal(operation.record.at,records[0].at);
 assert.equal(JSON.parse(JSON.stringify(records))[0].at,records[0].at);
});

test('날짜가 다른 수면 시작·종료에도 동일한 시·분 선택 값을 사용한다',()=>{
 const start=selectedTime('2026-11-18',23,5,9,now),end=selectedTime('2026-11-19',0,0,9,now);
 const record=manualSleepRecord(base('sleep'),start,end,'',now);
 assert.equal(record.end-record.at,10*60000);
 assert.equal(summary([record],'2026-11-18',now).sleep,60000);
 assert.equal(summary([record],'2026-11-19',now).sleep,9*60000);
});

test('항목별 입력 세션이 시각을 공유하지 않고 지금 기록과 기존 타이머 시각을 유지한다',()=>{
 const make=()=>createTimedRecordUI({modal:()=>{},base});
 const milk=make(),diaper=make();
 milk.setTime(+new Date('2026-11-18T02:03:00'));
 assert.equal(localDateTime(milk.base('feeding').at),'2026-11-18T02:03');
 assert.equal(diaper.base('diaper').at,now);
 assert.equal(base('sleep').at,now);
 assert.equal(milk.past,true);assert.equal(diaper.past,false);
});

test('시각 선택 필드는 기본 스크롤 시계 대신 버튼을 사용하고 임의 문자열을 실행하지 않는다',()=>{
 const field=dateTimeField('synthetic-at','<img src=x onerror=alert(1)>','',{allowEmpty:true,emptyText:'<script>alert(1)</script>'});
 assert.doesNotMatch(field,/<script>|<img|datetime-local/);
 assert.match(field,/type="hidden"/);assert.match(field,/data-time-field="synthetic-at"/);
 assert.match(field,/&lt;script&gt;/);
});
