import test from 'node:test';
import assert from 'node:assert/strict';
import {summary,segments,average,validate,dayKey,age} from '../app/model.js';
const at=s=>+new Date(s);
test('미기록은 0이 아니라 null이다',()=>{const s=summary([],'2026-11-08');assert.equal(s.amount,null);assert.equal(s.sleep,null);assert.equal(s.temperature,null);assert.equal(average([null,null]),null);});
test('자정을 넘는 수면을 날짜별로 분할한다',()=>{const r=[{type:'sleep',at:at('2026-11-07T23:00:00'),end:at('2026-11-08T02:00:00')}];assert.equal(summary(r,'2026-11-07').sleep,3600000);assert.equal(summary(r,'2026-11-08').sleep,7200000);assert.equal(summary(r,'2026-11-09').sleep,null);});
test('진행 중 수면은 현재 시각까지 계산한다',()=>{const r=[{type:'sleep',at:at('2026-11-08T23:00:00'),end:null}];assert.equal(segments(r,'2026-11-09',at('2026-11-09T01:00:00'))[0].to,at('2026-11-09T01:00:00'));assert.equal(summary(r,'2026-11-09',at('2026-11-09T01:00:00')).sleep,3600000);});
test('소변과 대변 동시 기록은 각각 1회, 교체는 1회다',()=>{const s=summary([{type:'diaper',at:at('2026-11-08T10:00:00'),kind:'소변 + 대변'}],'2026-11-08');assert.equal(s.urine,1);assert.equal(s.stool,1);assert.equal(s.diapers,1);});
test('직수 섭취량은 추정하지 않는다',()=>{const s=summary([{type:'feeding',at:at('2026-11-08T10:00:00'),amount:null},{type:'feeding',at:at('2026-11-08T12:00:00'),amount:80}],'2026-11-08');assert.equal(s.feeds,2);assert.equal(s.amount,80);});
test('기록 수정과 삭제 후 집계가 바뀐다',()=>{const r={type:'feeding',at:at('2026-11-08T10:00:00'),amount:80};assert.equal(summary([r],'2026-11-08').amount,80);assert.equal(summary([{...r,amount:100}],'2026-11-08').amount,100);assert.equal(summary([],'2026-11-08').amount,null);});
test('체온 미완성값과 역전된 수면은 저장할 수 없다',()=>{assert.throws(()=>validate({id:'a',type:'temperature',at:1,value:null}));assert.throws(()=>validate({id:'a',type:'sleep',at:100,end:99}));assert.throws(()=>validate({id:'a',type:'feeding',at:1,amount:-1}));});
test('평균은 미기록 날짜를 제외하고 실제 0은 유지한다',()=>{assert.equal(average([null,0,10]),5);});
test('출생 예정일과 생후 일수를 표시한다',()=>{assert.match(age({date:'2026-11-10',unborn:true},at('2026-11-09T12:00:00')),/D-1/);assert.match(age({date:'2026-11-01',unborn:false},at('2026-11-09T12:00:00')),/생후 8일/);assert.equal(dayKey(at('2026-11-09T12:00:00')),'2026-11-09');});

test('겹치는 수면을 중복 집계하지 않는다',()=>{const rows=[{type:'sleep',at:at('2026-11-08T01:00:00'),end:at('2026-11-08T03:00:00')},{type:'sleep',at:at('2026-11-08T02:00:00'),end:at('2026-11-08T04:00:00')}];assert.equal(summary(rows,'2026-11-08').sleep,3*3600000);assert.equal(segments(rows,'2026-11-08').length,2);});
