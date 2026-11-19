import {dateTimeField} from './time-picker.js';
import {validate,dayKey} from './model.js';
export function sleepInputDate(value){const d=new Date(value);return `${dayKey(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function parseSleepDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('시작·종료 날짜와 시각을 입력해주세요.');const time=+new Date(value);if(!Number.isFinite(time)||sleepInputDate(time)!==value)throw Error('실제로 존재하는 날짜와 시각을 입력해주세요.');return time;}
export function manualSleepRecord(base,startInput,endInput,memo='',now=Date.now()){
 const at=parseSleepDate(startInput),end=parseSleepDate(endInput);
 if(end<=at)throw Error('종료 시각은 시작 시각보다 뒤여야 해요. 자정을 넘었다면 종료 날짜도 바꿔주세요.');
 if(at>now||end>now)throw Error('이미 잠을 잔 시간만 기록할 수 있어요. 날짜와 시각을 확인해주세요.');
 if(typeof memo!=='string'||memo.length>1000)throw Error('메모는 1,000자 이내로 입력해주세요.');
 return validate({...base,type:'sleep',at,end,memo:memo.trim()||null,updated_at:now});
}
export function sleepDefaults(day,records,now=Date.now()){
 const active=records.find(r=>r.type==='sleep'&&r.end===null),end=day===dayKey(now)?Math.min(now,active?.at??now):+new Date(`${day}T14:00:00`);
 return {start:sleepInputDate(end-3600000),end:sleepInputDate(end)};
}
export function createSleepUI({read,day,base,save,modal,toggle,esc,icon}){
 function manual(){const defaults=sleepDefaults(day(),read().records);modal('지난 수면 기록',`<form id="manual-sleep-form"><p class="sleep-form-intro">놓친 수면도 괜찮아요.<br>실제로 잠든 시간과 깬 시간을 알려주세요.</p>${dateTimeField('sleep-from','잠든 날짜와 시각',defaults.start)}${dateTimeField('sleep-to','깬 날짜와 시각',defaults.end)}<p class="sleep-duration-preview" id="sleep-duration-preview" aria-live="polite"></p><label>메모 (선택)<input id="sleep-note" maxlength="1000" placeholder="예: 오후 낮잠"></label><p class="form-help">자정을 넘겼다면 종료 날짜를 다음 날로 선택해주세요. 진행 중인 수면은 그대로 유지해요.</p><p class="cloud-form-error" id="sleep-entry-error" role="alert"></p><button type="submit" class="primary full">수면 기록 저장</button></form>`,()=>{
  const $=s=>document.querySelector(s);const preview=()=>{const start=+new Date($('#sleep-from').value),end=+new Date($('#sleep-to').value),minutes=Math.floor((end-start)/60000);$('#sleep-duration-preview').textContent=Number.isFinite(minutes)&&minutes>0?`${Math.floor(minutes/60)}시간 ${minutes%60}분의 수면`:'시작과 종료 시각을 확인해주세요.';};
  $('#sleep-from').oninput=preview;$('#sleep-to').oninput=preview;preview();
  $('#manual-sleep-form').onsubmit=e=>{e.preventDefault();try{const record=manualSleepRecord(base('sleep'),$('#sleep-from').value,$('#sleep-to').value,$('#sleep-note').value);save(record);}catch(error){$('#sleep-entry-error').textContent=error.message;}};
 });}
 function menu(){const active=read().records.find(r=>r.type==='sleep'&&r.end===null);modal('수면을 기록해요',`<div class="sleep-options"><button id="sleep-now" class="sleep-option"><span class="option-icon">${icon('sleep',28)}</span><span><strong>${active?'지금 수면 종료':'지금 수면 시작'}</strong><small>${active?'잠에서 깼다면 지금 종료해요':'잠들기 시작한 시간을 남겨요'}</small></span></button><button id="sleep-past" class="sleep-option"><span class="option-icon">${icon('calendar',28)}</span><span><strong>지난 수면 기록</strong><small>몇 시부터 몇 시까지 잤는지 직접 입력해요</small></span></button></div>${active?`<p class="form-help">현재 진행 중인 수면 시작: ${esc(new Date(active.at).toLocaleString('ko-KR'))}</p>`:''}`,()=>{document.querySelector('#sleep-now').onclick=toggle;document.querySelector('#sleep-past').onclick=manual;});}
 return {menu,manual};
}
