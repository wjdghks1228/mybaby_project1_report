import test from 'node:test';
import assert from 'node:assert/strict';
import {summary,intakeBreakdown,validate,bounds} from '../app/model.js';
import {patternGroups,rhythmClock,breakdownCards} from '../app/reports.js';
const day='2026-11-08',start=bounds(day)[0],at=hour=>start+hour*3600000;
const milk=(kind,amount,hour=10,extra={})=>({id:crypto.randomUUID(),type:'feeding',kind,amount,at:at(hour),...extra});
const food=(amount,hour=12)=>({id:crypto.randomUUID(),type:'food',kind:'이유식',foodName:'쌀미음',amount,unit:'g',at:at(hour),memo:null});

test('하루 소분류는 모유 좌우·측정량·직수 시간을 모으고 이유식 g을 수유 mL에서 제외한다',()=>{
 const rows=[milk('분유',100),milk('분유',80),milk('모유 (왼쪽)',null,11,{duration:600000}),milk('모유 (양쪽)',null,12,{duration:900000}),milk('모유',35),milk('유축유',70),milk('혼합',90),food(55.5),food(null),milk('분유',120,25)];
 const s=summary(rows,day),k=kind=>s.feedingKinds.find(r=>r.kind===kind);
 assert.equal(s.amount,375);assert.equal(s.feeds,7);assert.deepEqual(k('모유'),{kind:'모유',count:3,amount:35,unknown:2,duration:1500000});
 assert.equal(k('분유').amount,180);assert.equal(k('유축유').amount,70);assert.equal(k('혼합').amount,90);assert.deepEqual(s.food,{count:2,amount:55.5,unknown:1});
});

test('소분류의 미측정량은 0으로 추정하지 않고 기간 합계에 기타 수유도 보존한다',()=>{
 const data=intakeBreakdown([milk('모유 (오른쪽)',null),milk('혼합',null),milk('기존 사용자 유형',40),food(null)]);
 assert.equal(data.feedingKinds.find(r=>r.kind==='모유').amount,null);assert.equal(data.feedingKinds.find(r=>r.kind==='분유').amount,null);assert.equal(data.feedingKinds.find(r=>r.kind==='기타').amount,40);assert.equal(data.food.amount,null);
});

test('기저귀 소분류는 서로 겹치지 않고 합이 교체 횟수와 같다',()=>{
 const rows=['소변','소변','대변','소변 + 대변','소변 + 대변'].map(kind=>({type:'diaper',kind,at:at(10)}));
 const s=summary(rows,day);assert.deepEqual(s.diaperKinds.map(r=>r.count),[2,1,2]);assert.equal(s.diaperKinds.reduce((n,r)=>n+r.count,0),s.diapers);assert.equal(s.urine,4);assert.equal(s.stool,3);
});

test('이유식은 g 단위·빈 양을 허용하고 잘못된 단위와 값은 저장하지 않는다',()=>{
 assert.doesNotThrow(()=>validate(food(75.5)));assert.doesNotThrow(()=>validate(food(null)));
 for(const patch of [{amount:-1},{amount:0},{amount:2001},{amount:Infinity},{unit:'mL'},{foodName:'a'.repeat(81)}])assert.throws(()=>validate({...food(50),...patch}));
 const record=food(80);assert.deepEqual(JSON.parse(JSON.stringify(record)),record);
});

test('수정·삭제와 날짜 변경이 종류별 합계에 반영된다',()=>{
 const r=food(40);assert.equal(summary([r],day).food.amount,40);assert.equal(summary([{...r,amount:65}],day).food.amount,65);assert.equal(summary([],day).food.amount,null);
 const milkRecord=milk('분유',100);assert.equal(summary([{...milkRecord,kind:'유축유'}],day).feedingKinds.find(r=>r.kind==='분유').count,0);assert.equal(summary([milkRecord],'2026-11-07').amount,null);
});

test('생활 시계는 같은 트랙의 가까운 기록만 묶고 자정 양쪽도 모든 ID를 유지한다',()=>{
 const a=milk('분유',80,0.05),b=food(30,23.95),c={id:crypto.randomUUID(),type:'diaper',kind:'대변',at:a.at},d=milk('유축유',60,12);
 const groups=patternGroups([a,b,c,d],day);assert.equal(groups.length,3);const joined=groups.find(g=>g.records.length===2);assert.ok(joined.records.some(r=>r.id===a.id)&&joined.records.some(r=>r.id===b.id));assert.ok(joined.minute<10||joined.minute>1430);assert.equal(patternGroups([a,b,c,d],day,'diaper').length,1);assert.equal(patternGroups([a,b,c,d],day,'sleep').length,0);
 const ids=groups.flatMap(g=>g.records.map(r=>r.id));assert.equal(new Set(ids).size,4);
});

test('원형 차트는 빈 데이터와 하루 전체 수면에서도 유효하고 표식 이름을 안전하게 표시한다',()=>{
 const empty=breakdownCards([]);assert.ok(empty.includes('수유 종류별 기록'));assert.ok(!empty.includes('NaN'));assert.ok(!empty.includes('Infinity'));
 const [a,b]=bounds(day),clock=rhythmClock([{id:'sleep',type:'sleep',at:a,end:b}],day,'all',b);assert.ok(clock.includes('24시간 생활 패턴'));assert.ok(clock.includes('24시간'));assert.ok(!clock.includes('NaN'));
 const html=rhythmClock([{...milk('<script>',30),id:'\" onclick=\"alert(1)'}],day);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-edit="" onclick='));
 assert.ok(breakdownCards([food(100)]).includes('100'));assert.ok(breakdownCards([food(100)]).includes('g'));
});
