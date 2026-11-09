import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotifications} from '../app/notifications.js';
function fixture(){let time=0,next=0;const jobs=new Map(),button={},element={className:'',innerHTML:'',style:{},querySelector:()=>button};const n=createNotifications(element,{setTimer(fn,delay){const id=++next;jobs.set(id,{fn,at:time+delay});return id;},clearTimer:id=>jobs.delete(id)});return {element,button,n,tick(ms){time+=ms;for(const [id,job] of jobs)if(job.at<=time){jobs.delete(id);job.fn();}}};}
test('저장 알림은 아이 이름·하트를 보여주고 실행 취소 없이 정확히 1초 뒤 사라진다',()=>{
 const f=fixture();f.n.saved('가상 행운이');assert.equal(f.element.style.display,'flex');assert.equal(f.element.className,'record-saved');assert.ok(f.element.innerHTML.includes('가상 행운이 성장일지 기록이 완료됐어요'));assert.ok(f.element.innerHTML.includes('♥'));assert.ok(!f.element.innerHTML.includes('실행 취소'));f.tick(999);assert.equal(f.element.style.display,'flex');f.tick(1);assert.equal(f.element.style.display,'none');assert.equal(f.element.innerHTML,'');
});
test('연속 저장은 마지막 저장 시각부터 1초를 유지하고 아이 이름을 HTML로 실행하지 않는다',()=>{
 const f=fixture();f.n.saved('첫 기록');f.tick(600);f.n.saved('<img src=x>');f.tick(400);assert.equal(f.element.style.display,'flex');assert.ok(!f.element.innerHTML.includes('<img src=x>'));f.tick(600);assert.equal(f.element.style.display,'none');
});
test('오류 안내와 삭제 실행 취소는 저장 알림과 구분하며 알림 교체 뒤 예전 타이머가 새 알림을 지우지 않는다',()=>{
 const f=fixture();f.n.saved('가상 기록');f.tick(500);let called=false;f.n.show('삭제했어요',{action:()=>{called=true;}});f.button.onclick();assert.equal(called,true);f.tick(500);assert.equal(f.element.style.display,'flex');assert.equal(f.element.className,'');f.tick(3000);assert.equal(f.element.style.display,'none');
});
