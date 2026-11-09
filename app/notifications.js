const noticeEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createNotifications(element,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let timer;
 function show(message,{saved=false,action,duration=saved?1000:3500}={}){
  clearTimer(timer);element.className=saved?'record-saved':'';
  element.innerHTML=saved?`<span class="notice-heart" aria-hidden="true">♥</span><span>${noticeEscape(message)}</span><span class="notice-spark" aria-hidden="true">✦</span>`:`<span>${noticeEscape(message)}</span>${action?'<button type="button">실행 취소</button>':''}`;
  element.style.display='flex';if(action)element.querySelector('button').onclick=action;
  timer=setTimer(()=>{element.style.display='none';element.innerHTML='';},duration);
 }
 return {show,saved:childName=>show(`${childName||'우리 아이'} 성장일지 기록이 완료됐어요`,{saved:true}),checked:()=>show('탄생 준비를 체크했어요',{saved:true})};
}
