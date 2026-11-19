import {dayKey} from './model.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = value => String(value).padStart(2, '0');
export function localDateTime(value) {
  const date = new Date(value);
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function parseRecordTime(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('날짜와 시각을 선택해주세요.');
  const at = +new Date(value);
  if (!Number.isFinite(at) || localDateTime(at) !== value) throw Error('실제로 존재하는 날짜와 시각을 선택해주세요.');
  if (at > now) throw Error('미래 시각은 기록할 수 없어요. 날짜와 시간을 확인해주세요.');
  return at;
}
export function selectedTime(date, hour, tens, ones, now = Date.now()) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(tens) || tens < 0 || tens > 5 || !Number.isInteger(ones) || ones < 0 || ones > 9) throw Error('시와 분을 다시 선택해주세요.');
  const value = `${date}T${pad(hour)}:${tens}${ones}`;
  parseRecordTime(value, now);
  return value;
}
export function timeLabel(value, emptyText = '지금 · 지난 기록은 눌러서 선택') {
  if (!value) return emptyText;
  const date = new Date(value);
  if (!Number.isFinite(+date)) return '날짜와 시각 선택';
  return `${date.getMonth()+1}월 ${date.getDate()}일 · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function dateTimeField(id, label, value = '', {allowEmpty = false, emptyText = '진행 중 · 종료 시각 없음', clearText = '시각 비우기'} = {}) {
  return `<div class="date-time-field"><span class="date-time-caption" id="${id}-label">${escape(label)}</span><input id="${id}" type="hidden" value="${escape(value)}"><button type="button" class="date-time-trigger" data-time-field="${id}" data-time-empty="${escape(emptyText)}" data-time-clear="${escape(clearText)}" data-time-optional="${allowEmpty}" aria-labelledby="${id}-label ${id}-value" aria-expanded="false" aria-controls="${id}-picker"><span id="${id}-value">${escape(timeLabel(value, emptyText))}</span><span class="date-time-change">선택</span></button><div class="time-picker" id="${id}-picker" hidden></div></div>`;
}

export function closeTimePicker(root = document) {
  const trigger = root.querySelector('[data-time-field][aria-expanded="true"]');
  if (!trigger) return false;
  trigger.click();
  return true;
}

export function bindTimeFields(root) {
  // A partially selected clock must never silently save the previous value.
  const surface = root.querySelector('.modal') || root;
  if (!surface.dataset.timeGuard) {
    surface.dataset.timeGuard = 'true';
    const pending = () => root.querySelector('[data-time-field][aria-expanded="true"]');
    const explain = () => {
      const trigger = pending();
      const panel = root.querySelector('#'+trigger.getAttribute('aria-controls'));
      panel.querySelector('[data-time-error]').textContent = '끝자리 분까지 선택하거나 취소해주세요.';
    };
    surface.addEventListener('submit', event => {
      if (pending()) { event.preventDefault(); event.stopImmediatePropagation(); explain(); }
    }, true);
    surface.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (pending() && button && !button.closest('.time-picker') && !button.matches('[data-time-field],#close-modal,#modal-back')) {
        event.preventDefault(); event.stopImmediatePropagation(); explain();
      }
    }, true);
  }
  root.querySelectorAll('[data-time-field]').forEach(trigger => {
    const input = root.querySelector('#'+trigger.dataset.timeField);
    const panel = root.querySelector('#'+trigger.getAttribute('aria-controls'));
    const label = trigger.querySelector('span');
    const refresh = () => { label.textContent = timeLabel(input.value, trigger.dataset.timeEmpty); };
    refresh();
    const close = () => { panel.hidden = true; panel.innerHTML = ''; trigger.setAttribute('aria-expanded','false'); trigger.focus({preventScroll:true}); };
    const commit = value => { input.value = value; input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); refresh(); close(); };
    trigger.onclick = () => {
      if (!panel.hidden) return close();
      closeTimePicker(root);
      const initial = input.value || localDateTime(Date.now());
      let date = initial.slice(0,10), hour = Number(initial.slice(11,13)), tens = Number(initial[14]), ones = Number(initial[15]), stage = 0, error = '';
      panel.hidden = false;
      trigger.setAttribute('aria-expanded','true');
      const render = () => {
        const heading = ['몇 시인가요?', '몇십 분인가요?', '끝자리 분을 선택해주세요'][stage];
        const choices = stage === 0 ? Array.from({length:24},(_,i)=>i) : stage === 1 ? [0,1,2,3,4,5] : Array.from({length:10},(_,i)=>i);
        const selected = [hour,tens,ones][stage];
        panel.innerHTML = `<div class="time-picker-date"><span>날짜</span><input type="date" data-picker-date aria-label="기록 날짜" value="${escape(date)}" max="${dayKey()}"></div><div class="time-picker-steps" role="group" aria-label="시각 선택 단계">${['시','10분 단위','끝자리 분'].map((text,i)=>`<button type="button" data-time-step="${i}" ${i>stage?'disabled':''} aria-pressed="${i===stage}">${text}</button>`).join('')}</div><p class="time-picker-heading" aria-live="polite">${heading}</p><div class="time-picker-grid ${stage===2?'time-picker-digits':''}" role="group" aria-label="${heading}">${choices.map(n=>`<button type="button" data-time-choice="${n}" aria-pressed="${selected===n}">${stage===0?pad(n)+'시':stage===1?pad(n*10)+'분':n}</button>`).join('')}</div><p class="time-picker-selected">${escape(date)} · ${pad(hour)}:${tens}${ones}</p><p class="cloud-form-error" data-time-error role="alert">${escape(error)}</p><div class="time-picker-actions"><button type="button" data-time-cancel>취소</button>${trigger.dataset.timeOptional==='true'?`<button type="button" data-time-clear-value>${escape(trigger.dataset.timeClear)}</button>`:''}</div>`;
        panel.querySelector('[data-picker-date]').onchange = event => { date = event.target.value; stage = 0; error = ''; render(); };
        panel.querySelectorAll('[data-time-step]').forEach(button => button.onclick = () => { stage = Number(button.dataset.timeStep); error=''; render(); });
        panel.querySelectorAll('[data-time-choice]').forEach(button => button.onclick = () => {
          const n = Number(button.dataset.timeChoice);
          if (stage===0) hour=n;
          if (stage===1) tens=n;
          if (stage===2) ones=n;
          if (stage<2) { stage++; error=''; render(); return; }
          try { commit(selectedTime(date,hour,tens,ones)); } catch (failure) { error=failure.message; render(); }
        });
        panel.querySelector('[data-time-cancel]').onclick=close;
        const clear=panel.querySelector('[data-time-clear-value]');
        if (clear) clear.onclick=()=>commit('');
        panel.querySelector(`[data-time-choice="${selected}"]`)?.focus({preventScroll:true});
      };
      render();
    };
    panel.onkeydown = event => { if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();} };
  });
}
