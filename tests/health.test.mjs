import test from 'node:test';
import assert from 'node:assert/strict';
import {VACCINES,VACCINE_SOURCE,healthHistory,vaccineHistory,customVaccineNames,healthDetail} from '../app/health-model.js';
import {validate,summary,dayKey} from '../app/model.js';
import {createHealthUI} from '../app/health-ui.js';
const base=()=>({id:crypto.randomUUID(),child_id:'synthetic-child',at:Date.now()-1000,memo:null});
const vaccine=(patch={})=>({...base(),type:'hospital',kind:'예방접종',vaccineId:'hepb',title:VACCINES.find(v=>v.id==='hepb').name,dose:'1차',hospitalName:'가상 검증 병원',...patch});
const note=(patch={})=>({...base(),type:'note',kind:'구토',title:'수유 후 관찰 기록',memo:'가상 기록 내용',...patch});

test('접종 목록은 공식 출처와 중복 없는 19개 선택지를 제공하며 차수·시기를 자동 지정하지 않는다',()=>{
 assert.equal(VACCINES.length,19);assert.equal(new Set(VACCINES.map(v=>v.id)).size,19);assert.equal(new URL(VACCINE_SOURCE.url).hostname,'nip.kdca.go.kr');
 assert.ok(VACCINES.some(v=>v.id==='dtap-ipv-hib-hepb'));assert.ok(VACCINES.every(v=>!Object.hasOwn(v,'nextDate')&&!Object.hasOwn(v,'requiredDoses')));
});
test('접종·직접 작성·진료·검진·특이사항을 검증하고 백업 왕복 시 날짜와 메모를 유지한다',()=>{
 const records=[vaccine(),vaccine({vaccineId:null,title:'직접 등록한 접종',dose:''}),vaccine({kind:'진료',vaccineId:null,title:'병원 방문 메모',dose:''}),vaccine({kind:'건강검진',vaccineId:null,title:'검진 방문',dose:''}),note(),note({kind:'기타',title:'자유롭게 적은 특이사항'})];
 for(const r of records)assert.doesNotThrow(()=>validate(r));const restored=JSON.parse(JSON.stringify(records));for(const r of restored)validate(r);assert.deepEqual(restored,records);
});
test('잘못된 접종 ID·이름·차수·분류·길이·날짜를 저장하지 않는다',()=>{
 for(const patch of [{vaccineId:'unknown'},{title:'다른 백신 이름'},{title:''},{title:'a'.repeat(101)},{dose:'a'.repeat(31)},{hospitalName:'a'.repeat(101)},{kind:'unknown'},{memo:'a'.repeat(1001)},{at:Date.now()+120000}])assert.throws(()=>validate(vaccine(patch)));
 assert.throws(()=>validate(vaccine({kind:'진료',vaccineId:null,dose:'1차'})));assert.throws(()=>validate(note({kind:'unknown'})));assert.throws(()=>validate(note({title:'   '})));
});
test('병원·특이사항은 날짜순으로 구분하고 수유량·수면·기저귀·평균 체온에 섞지 않는다',()=>{
 const v=vaccine(),n=note({at:v.at+1}),visit=vaccine({kind:'진료',vaccineId:null,dose:'',title:'진료',at:v.at+2}),milk={...base(),type:'feeding',kind:'분유',amount:80};
 const rows=[v,n,visit,milk];assert.deepEqual(healthHistory(rows).map(r=>r.id),[visit.id,n.id,v.id]);assert.equal(healthHistory(rows,'vaccines').length,1);assert.equal(healthHistory(rows,'notes').length,1);assert.equal(healthHistory(rows,'visits').length,1);
 const s=summary(rows,dayKey(v.at));assert.equal(s.amount,80);assert.equal(s.feeds,1);assert.equal(s.sleep,null);assert.equal(s.diapers,0);assert.equal(s.temperature,null);
});
test('혼합백신을 단일 백신 접종으로 복제하지 않고 같은 접종의 여러 차수를 보존한다',()=>{
 const combo=VACCINES.find(v=>v.id==='dtap-ipv-hib-hepb'),a=vaccine({vaccineId:combo.id,title:combo.name}),b=vaccine({dose:'2차',at:a.at+1});
 const result=vaccineHistory([a,vaccine(),b]);assert.equal(result.find(v=>v.id===combo.id).records.length,1);assert.equal(result.find(v=>v.id==='dtap').records.length,0);assert.equal(result.find(v=>v.id==='hepb').records.length,2);
 assert.ok(healthDetail(b).includes('2차'));assert.ok(healthDetail(note()).includes('구토'));
});
test('직접 등록한 접종 이름을 가족 기록에서 다시 선택하며 삭제한 이름은 제거한다',()=>{
 const a=vaccine({vaccineId:null,title:'직접 접종',at:1}),b=vaccine({vaccineId:null,title:'직접 접종',at:2}),c=vaccine({vaccineId:null,title:'다른 접종',at:3});
 assert.deepEqual(customVaccineNames([a,b,c]),['다른 접종','직접 접종']);assert.deepEqual(customVaccineNames([c]),['다른 접종']);assert.deepEqual(customVaccineNames([]),[]);
});
test('입력·이력 화면은 아이가 남긴 자유 텍스트를 HTML로 실행하지 않는다',()=>{
 const r=vaccine({vaccineId:null,title:'<img src=x onerror=alert(1)>',hospitalName:'<script>bad</script>',memo:'<svg onload=bad>'});
 let body;const ui=createHealthUI({read:()=>({records:[r],sync:{}}),base:()=>base(),save(){},modal:(_title,html)=>{body=html;},render(){},edit(){},remove(){},canEdit:()=>true,icon:()=>''});
 ui.form('hospital',r);assert.ok(body.includes('&lt;img'));assert.ok(!body.includes('<img src=x'));assert.ok(!body.includes('<script>bad'));
 const page=ui.page();assert.ok(page.includes('&lt;script&gt;'));assert.ok(!page.includes('<svg onload=bad>'));assert.ok(page.includes('&lt;svg onload=bad&gt;'));
});
