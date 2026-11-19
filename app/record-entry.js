import {dateTimeField,localDateTime,parseRecordTime} from './time-picker.js';

export function recordAt(record, value, now = Date.now()) {
  return {...record, at:value ? parseRecordTime(value,now) : record.at};
}

// Each entry owns its time selection, including when returning to an earlier step.
export function createTimedRecordUI({modal, base}) {
  let value = '';
  function timedModal(title, body, bind) {
    const field = dateTimeField('record-at','기록 시각',value,{allowEmpty:true,emptyText:'지금 · 지난 기록은 눌러서 선택',clearText:'지금으로 되돌리기'});
    modal(title,field+body,()=>{
      const input=document.querySelector('#record-at');
      input.value=value;
      input.oninput=()=>{value=input.value;};
      bind?.();
    });
  }
  function choose(title,items,callback) {
    timedModal(title,`<div class="choices">${items.map((text,i)=>`<button data-choice="${i}">${text}</button>`).join('')}</div>`,()=>document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>callback(items[Number(button.dataset.choice)])));
  }
  function numeric(title,unit,min,max,step,callback) {
    timedModal(title,`<form id="numeric"><label>${unit}<input id="value" type="number" min="${min}" max="${max}" step="${step}" required inputmode="decimal"></label><button class="primary full">저장하기</button></form>`,()=>{
      const input=document.querySelector('#value');
      document.querySelector('#numeric').onsubmit=event=>{event.preventDefault();if(!input.checkValidity()||!input.value)return input.reportValidity();callback(Number(input.value));};
    });
  }
  return {modal:timedModal,choose,numeric,base:type=>recordAt(base(type),value),get past(){return !!value;},setTime:at=>{value=localDateTime(at);}};
}
