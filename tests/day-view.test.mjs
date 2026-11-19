import test from 'node:test';
import assert from 'node:assert/strict';
import {dayClock,dayTimeline,weekDates,dayStrip} from '../app/day-view.js';
import {bounds} from '../app/model.js';
const day='2026-11-19',[a,b]=bounds(day),now=a+20*3600000;
test('주간 날짜 선택은 일요일부터 토요일까지 연말·월 경계도 정확히 표시한다',()=>{
 assert.deepEqual(weekDates('2027-01-01'),['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);const strip=dayStrip([],day,day);assert.ok(strip.includes('aria-pressed="true"'));assert.ok(strip.includes('2026-11-20 선택됨')===false);assert.ok(strip.includes('disabled'));
});
test('새 타임라인은 실제 수면만 시간 띠로 사용하고 이벤트 사이 시간을 추정하지 않는다',()=>{
 const records=[{id:'sleep',type:'sleep',at:a+3600000,end:a+3*3600000},{id:'feeding',type:'feeding',kind:'분유',amount:80,at:a+5*3600000},{id:'diaper',type:'diaper',kind:'소변',at:a+9*3600000}];
 const model=dayTimeline(records,day,'all',now);assert.equal(model.sleeps.length,1);assert.equal(model.sleeps[0].to-model.sleeps[0].from,2*3600000);assert.equal(model.events.length,2);assert.equal(model.summary.amount,80);assert.equal(model.summary.sleep,2*3600000);
});
test('가까운 서로 다른 활동과 자정 양쪽 이벤트를 묶어도 모든 실제 기록 ID를 유지한다',()=>{
 const rows=[{id:'milk',type:'feeding',amount:80,at:a+60000},{id:'temp',type:'temperature',value:36.5,at:b-60000},{id:'diaper',type:'diaper',kind:'대변',at:a+10*60000}];
 const model=dayTimeline(rows,day,'all',now);assert.equal(model.events.length,1);assert.deepEqual(new Set(model.events[0].records.map(r=>r.id)),new Set(['milk','temp','diaper']));assert.equal(dayTimeline(rows,day,'temperature',now).events[0].records.length,1);
});
test('자정 이전에 시작한 수면·하루 전체 수면·빈 날을 처리하고 요약을 원형 중심에 배치한다',()=>{
 const overnight={id:'night',type:'sleep',at:a-3600000,end:a+2*3600000};assert.equal(dayTimeline([overnight],day,'all',now).summary.sleep,2*3600000);
 const full=dayClock([{id:'full',type:'sleep',at:a,end:b}],day,'all',b);assert.ok(full.includes('24시간'));assert.ok(full.includes('daily-clock-center'));assert.ok(full.includes('24시간'));
 const empty=dayClock([],day,'all',now);assert.ok(empty.includes('미기록'));assert.ok(!empty.includes('NaN'));assert.ok(!empty.includes('Infinity'));
});
test('새 그래프의 클릭 표식에 임의 텍스트가 HTML이나 이벤트 코드로 삽입되지 않는다',()=>{
 const html=dayClock([{id:'" onclick="bad',type:'feeding',kind:'<img src=x>',amount:80,at:a+3600000}],day,'all',now);assert.ok(!html.includes('<img src=x>'));assert.ok(!html.includes('data-edit="" onclick='));assert.ok(html.includes('&quot;'));
});
