import {dayClock} from './day-view.js';
import {bounds,segments,summary,intakeBreakdown} from './model.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>value===null?'—':value.toLocaleString('ko-KR',{maximumFractionDigits:1});
const minutes=value=>`${Math.floor(value/60000)}분`;
const colors={'분유':'#dc790c','모유':'#d65b8d','유축유':'#8a63d2','혼합':'#2a93a5','기타':'#758296'};

export function breakdownCards(rows,label='선택한 날짜'){
 const data=intakeBreakdown(rows),known=data.feedingKinds.filter(r=>r.amount!==null),total=known.length?known.reduce((s,r)=>s+r.amount,0):null;
 let offset=0;
 const slices=data.feedingKinds.filter(r=>r.amount>0).map(r=>{const size=r.amount/total*100;const markup=`<circle cx="90" cy="90" r="67" pathLength="100" fill="none" stroke="${colors[r.kind]}" stroke-width="22" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"/>`;offset+=size;return markup;}).join('');
 const feedRows=data.feedingKinds.filter(r=>r.kind!=='기타'||r.count).map(r=>`<tr><th scope="row"><span class="report-swatch" style="--color:${colors[r.kind]}"></span>${r.kind}${r.duration?`<small>직수 시간 ${minutes(r.duration)}</small>`:''}</th><td>${r.count}회</td><td><strong>${num(r.amount)}</strong>${r.amount!==null?' mL':''}${r.unknown?`<small>측정량 없는 기록 ${r.unknown}회</small>`:''}</td></tr>`).join('');
 const totalDiapers=data.diaperKinds.reduce((s,r)=>s+r.count,0);
 return `<div class="report-columns"><section class="card intake-card"><div class="section-head"><h2>수유 종류별 기록</h2><small>${escapeHTML(label)} 합계</small></div><div class="intake-overview"><div class="intake-donut"><svg viewBox="0 0 180 180" role="img" aria-label="기록된 수유량 ${num(total)} mL의 종류별 구성"><circle cx="90" cy="90" r="67" fill="none" stroke="#f0f3f7" stroke-width="22"/>${slices}</svg><div class="donut-center"><small>기록된 수유량</small><strong>${num(total)}</strong><span>mL</span></div></div><p>분유·모유·유축유·혼합을<br>종류별로 모았어요.<br><small>양을 입력한 기록 기준</small></p></div><table class="report-table"><caption class="sr-only">수유 종류별 횟수와 측정량</caption><thead><tr><th scope="col">종류</th><th scope="col">횟수</th><th scope="col">기록된 양</th></tr></thead><tbody>${feedRows}</tbody></table><p class="report-hint">모유 직수는 시간·횟수로 확인해요. 실제 측정량을 입력한 경우에만 mL로 합산하며, 혼합 수유의 구성은 임의로 나누지 않아요.</p><div class="food-summary"><span class="food-label">이유식</span><strong>${data.food.count}회 · ${num(data.food.amount)}${data.food.amount!==null?' g':''}</strong><small>${data.food.unknown?`양을 입력하지 않은 기록 ${data.food.unknown}회`:'먹은 양을 g으로 별도 집계해요'}</small></div></section><section class="card diaper-card"><div class="section-head"><h2>기저귀 종류별 기록</h2><small>${escapeHTML(label)} 합계</small></div><div class="diaper-total"><small>총 교체 횟수</small><strong>${totalDiapers}<span>회</span></strong></div><div class="diaper-breakdown">${data.diaperKinds.map((r,i)=>`<div><span class="diaper-kind-symbol" aria-hidden="true">${['소','대','함께'][i]}</span><div><strong>${r.kind}</strong><div class="diaper-meter"><i style="width:${totalDiapers?r.count/totalDiapers*100:0}%"></i></div></div><b>${r.count}<small>회</small></b></div>`).join('')}</div><p class="report-hint">소변만 · 대변만 · 함께 나온 기저귀를 나눠 세요. 함께 나온 기저귀도 교체 횟수에는 1회로 집계해요.</p></section></div>`;
}

const trackOf=r=>r.type==='food'?'feeding':r.type;
export function patternGroups(records,day,filter='all'){
 const [a,b]=bounds(day),result=[];
 for(const track of ['feeding','diaper','temperature']){
  if(filter!=='all'&&filter!==track)continue;
  const spacing={feeding:52,diaper:68,temperature:120}[track],groups=[];
  for(const r of records.filter(r=>r.at>=a&&r.at<b&&trackOf(r)===track).sort((x,y)=>x.at-y.at)){
   const minute=(r.at-a)/(b-a)*1440,last=groups.at(-1);
   if(last&&minute-last.minute<spacing){last.minute=(last.minute*last.records.length+minute)/(last.records.length+1);last.records.push(r);}
   else groups.push({track,minute,records:[r]});
  }
  const first=groups[0],last=groups.at(-1);
  if(groups.length>1&&first.minute+1440-last.minute<spacing){first.minute=((first.minute*first.records.length+(last.minute-1440)*last.records.length)/(first.records.length+last.records.length)+1440)%1440;first.records.push(...last.records);groups.pop();}
  result.push(...groups);
 }
 return result;
}
export function rhythmClock(records,day,filter='all',now=Date.now()){return dayClock(records,day,filter,now);}
