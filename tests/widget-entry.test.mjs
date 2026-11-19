import test from 'node:test';
import assert from 'node:assert/strict';
import {createWidgetEntry,WIDGET_ACTIONS} from '../app/widget-entry.js';
function fixture(){let state={child:{id:'child'}},status={connected:true,unlocked:false,busy:false},timer;const opened=[],modes=[];let finished=0,main=0;const widget=createWidgetEntry({read:()=>state,status:()=>status,render(){},open:action=>opened.push(action),close(){},finish:()=>finished++,main:()=>main++,setMode:value=>modes.push(value),setTimer:fn=>{timer=fn;}});return {widget,opened,modes,setStatus:value=>{status=value;},setChild:value=>{state.child=value;},tick:()=>timer(),counts:()=>({finished,main})};}
test('네 위젯 버튼만 허용하고 임의 액션을 실행하지 않는다',()=>{
 const f=fixture();assert.equal(WIDGET_ACTIONS.length,4);assert.equal(f.widget.enter('delete-family'),false);assert.equal(f.widget.info().active,false);assert.deepEqual(f.opened,[]);
});
test('가족 PIN 입장과 최신화를 기다린 뒤 요청한 입력창을 정확히 한 번 연다',()=>{
 const f=fixture();f.widget.enter('diaper');f.widget.tryOpen();assert.deepEqual(f.opened,[]);f.setStatus({connected:true,unlocked:true,busy:true});f.widget.tryOpen();assert.deepEqual(f.opened,[]);f.setStatus({connected:true,unlocked:true,busy:false});f.widget.tryOpen();f.widget.tryOpen();assert.deepEqual(f.opened,['diaper']);
});
test('개인 모드는 프로필이 있을 때만 입력하고 앱 열기·취소는 저장을 만들지 않는다',()=>{
 const f=fixture();f.setStatus({connected:false,unlocked:false,busy:false});f.setChild(null);f.widget.enter('sleep');f.widget.tryOpen();assert.deepEqual(f.opened,[]);f.setChild({id:'child'});f.widget.tryOpen();assert.deepEqual(f.opened,['sleep']);f.widget.goMain();assert.equal(f.counts().main,1);assert.equal(f.widget.info().active,false);f.widget.enter('feeding');f.widget.cancel();assert.equal(f.counts().finished,1);
});
test('저장 후 1초와 기존 동기화가 끝나기 전에는 위젯 입력창을 닫지 않는다',async()=>{
 const f=fixture();f.widget.enter('feeding');let synced;const sync=new Promise(resolve=>{synced=resolve;});const done=f.widget.saved(()=>sync);f.tick();await Promise.resolve();assert.equal(f.counts().finished,0);synced();await done;assert.equal(f.counts().finished,1);assert.equal(f.widget.info().active,false);
});
test('기존 저장 처리 중 다른 위젯을 눌러도 예전 완료 콜백이 새 입력창을 닫지 않는다',async()=>{
 const f=fixture();f.widget.enter('feeding');const done=f.widget.saved(async()=>{});f.widget.enter('temperature');f.tick();await done;assert.equal(f.counts().finished,0);assert.equal(f.widget.info().pending,'temperature');
});
