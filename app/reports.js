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
export function rhythmClock(records,day,filter='all',now=Date.now()){
 const [a,b]=bounds(day),s=summary(records,day,now),polar=(minute,r)=>{const angle=minute/1440*Math.PI*2-Math.PI/2;return [260+Math.cos(angle)*r,260+Math.sin(angle)*r];};
 const radii={sleep:194,feeding:156,diaper:118,temperature:80},trackColor={sleep:'#3182f6',feeding:'#dc790c',diaper:'#138970',temperature:'#8a63d2'};
 const ticks=Array.from({length:48},(_,i)=>{const p=polar(i*30,216),q=polar(i*30,i%2?220:225);return `<path d="M${p} L${q}" stroke="${i%12===0?'#6e819c':'#d2dce9'}" stroke-width="${i%12===0?2.5:1}"/>`;}).join('');
 const rings=Object.entries(radii).map(([track,r])=>`<circle cx="260" cy="260" r="${r}" fill="none" stroke="${filter==='all'||filter===track?'#e8eef5':'#f3f5f8'}" stroke-width="${track==='sleep'?20:2}" ${track==='sleep'?'':'stroke-dasharray="3 5"'}/>`).join('');
 const sleep=filter==='all'||filter==='sleep'?segments(records,day,now).map(r=>{const from=(r.from-a)/(b-a)*1440,to=(r.to-a)/(b-a)*1440,p=polar(from,radii.sleep),q=polar(Math.min(to,from+1439.99),radii.sleep);return `<g class="clock-event" data-edit="${escapeHTML(r.id)}" role="button" tabindex="0" aria-label="수면 기록 상세 보기"><title>수면 ${new Date(r.from).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}부터 ${new Date(r.to).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}까지</title><path d="M${p} A194 194 0 ${to-from>720?1:0} 1 ${q}" fill="none" stroke="transparent" stroke-width="36"/><path d="M${p} A194 194 0 ${to-from>720?1:0} 1 ${q}" fill="none" stroke="#3182f6" stroke-width="20" stroke-linecap="round"/></g>`;}).join(''):'';
 const dots=patternGroups(records,day,filter).map(g=>{const [x,y]=polar(g.minute,radii[g.track]),r=g.records[0];const letter=r.type==='food'?'식':g.track==='feeding'?r.kind?.startsWith('모유')?'모':r.kind==='유축유'?'유':r.kind==='혼합'?'혼':r.kind==='분유'?'분':'기':g.track==='diaper'?r.kind==='소변'?'소':r.kind==='대변'?'대':'함':g.records.length>1?'체온':String(r.value?.toFixed(1));
  return `<g class="clock-event" transform="translate(${x} ${y})" data-pattern-ids="${escapeHTML(JSON.stringify(g.records.map(r=>r.id)))}" role="button" tabindex="0" aria-label="${escapeHTML(g.track==='feeding'?'수유·이유식':g.track==='diaper'?'기저귀':'체온')} 기록 ${g.records.length}건 상세 보기"><title>${g.records.length>1?`가까운 시각의 기록 ${g.records.length}건`:escapeHTML(r.kind??'체온 기록')}</title><circle r="22" fill="transparent"/><circle r="${g.track==='temperature'?19:15}" fill="${r.type==='food'?'#c96241':trackColor[g.track]}" stroke="white" stroke-width="3"/><text text-anchor="middle" y="5" fill="white" font-size="${g.track==='temperature'?13:14}" font-weight="750" pointer-events="none">${escapeHTML(letter)}</text>${g.records.length>1?`<circle cx="12" cy="-13" r="10" fill="#25334c" stroke="white" stroke-width="2"/><text x="12" y="-9" text-anchor="middle" font-size="11" font-weight="700" fill="white" pointer-events="none">${g.records.length}</text>`:''}</g>`;
 }).join('');
 return `<svg class="rhythm-clock" viewBox="0 0 520 520" role="group" aria-label="${escapeHTML(day)} 24시간 생활 패턴. 위쪽 자정, 오른쪽 오전 6시, 아래쪽 정오, 왼쪽 오후 6시. 바깥부터 수면, 수유와 이유식, 기저귀, 체온."><circle cx="260" cy="260" r="229" fill="#fbfcfe"/><path d="M31 260 A229 229 0 0 1 489 260Z" fill="#f0f5fc"/>${ticks}${rings}<g fill="#6b7684" font-size="14" text-anchor="middle"><text x="425" y="97">03</text><text x="425" y="437">09</text><text x="95" y="437">15</text><text x="95" y="97">21</text></g><g fill="#344765" font-size="18" font-weight="750" text-anchor="middle"><text x="260" y="19">00 · 자정</text><text x="487" y="250">06</text><text x="260" y="510">12 · 정오</text><text x="33" y="250">18</text></g><g fill="#6b7684" font-size="12" text-anchor="middle"><text x="487" y="270">아침</text><text x="33" y="270">저녁</text></g>${sleep}${dots}<circle cx="260" cy="260" r="53" fill="white"/><text x="260" y="238" text-anchor="middle" fill="#6b7684" font-size="13">기록된 수면</text><text x="260" y="269" text-anchor="middle" fill="#25334c" font-size="25" font-weight="800">${s.sleep===null?'—':Math.floor(s.sleep/3600000)+'시간'}</text><text x="260" y="291" text-anchor="middle" fill="#55708f" font-size="16">${s.sleep===null?'미기록':Math.floor(s.sleep%3600000/60000)+'분'}</text></svg>`;
}
