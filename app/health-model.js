export const VACCINE_SOURCE={title:'질병관리청 예방접종도우미 · 국가예방접종사업',url:'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuCd=13&menuLv=1',checked:'2026-11-09'};
export const VACCINES=[
 {id:'bcg',name:'BCG · 결핵 (피내용)'},
 {id:'hepb',name:'B형간염 (HepB)'},
 {id:'dtap',name:'DTaP · 디프테리아·파상풍·백일해'},
 {id:'ipv',name:'폴리오 (IPV)'},
 {id:'hib',name:'b형헤모필루스인플루엔자 (Hib)'},
 {id:'pcv',name:'폐렴구균 (PCV)'},
 {id:'rv',name:'로타바이러스 (RV)'},
 {id:'mmr',name:'MMR · 홍역·유행성이하선염·풍진'},
 {id:'var',name:'수두 (VAR)'},
 {id:'hepa',name:'A형간염 (HepA)'},
 {id:'ijev',name:'일본뇌염 · 불활성화 백신'},
 {id:'ljev',name:'일본뇌염 · 약독화 생백신'},
 {id:'iiv',name:'인플루엔자 (독감)'},
 {id:'dtap-ipv',name:'DTaP-IPV · 4가 혼합백신'},
 {id:'dtap-ipv-hib',name:'DTaP-IPV-Hib · 5가 혼합백신'},
 {id:'dtap-ipv-hib-hepb',name:'DTaP-IPV-Hib-HepB · 6가 혼합백신'},
 {id:'tdap',name:'Tdap · 파상풍·디프테리아·백일해'},
 {id:'td',name:'Td · 파상풍·디프테리아'},
 {id:'hpv',name:'사람유두종바이러스 (HPV)'}
];
export const HOSPITAL_KINDS=['예방접종','진료','건강검진','기타'];
export const SPECIAL_KINDS=['구토','아팠어요','기침·콧물','발진·피부','설사','기타'];
const healthText=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&(!required||value.trim().length>0);
export function validateHealthRecord(record){
 if(!healthText(record.title,100,true))throw Error('접종 이름 또는 특이사항 제목을 입력해주세요 (100자 이내).');
 if(record.memo!==null&&!healthText(record.memo,1000))throw Error('메모는 1,000자 이내로 입력해주세요.');
 if(record.type==='hospital'){
  if(!HOSPITAL_KINDS.includes(record.kind)||!healthText(record.hospitalName,100)||!healthText(record.dose,30))throw Error('병원 기록의 분류·병원·차수를 확인해주세요.');
  if(record.kind==='예방접종'){
   if(record.vaccineId!==null){const vaccine=VACCINES.find(v=>v.id===record.vaccineId);if(!vaccine||record.title!==vaccine.name)throw Error('목록의 접종 이름을 확인하거나 직접 작성을 선택해주세요.');}
  }else if(record.vaccineId!==null||record.dose!=='')throw Error('접종 외 병원 기록에는 접종 차수를 입력할 수 없어요.');
 }else if(record.type==='note'){
  if(!SPECIAL_KINDS.includes(record.kind))throw Error('특이사항 분류를 확인해주세요.');
 }else throw Error('지원하지 않는 건강 기록이에요.');
 return record;
}
export function healthDetail(record){return [record.kind,record.title,record.type==='hospital'?record.dose:null,record.type==='hospital'?record.hospitalName:null].filter(Boolean).join(' · ');}
export function healthHistory(records,filter='all'){
 return records.filter(r=>r.type==='hospital'||r.type==='note').filter(r=>filter==='all'||filter==='vaccines'&&r.type==='hospital'&&r.kind==='예방접종'||filter==='visits'&&r.type==='hospital'&&r.kind!=='예방접종'||filter==='notes'&&r.type==='note').sort((a,b)=>b.at-a.at);
}
export function vaccineHistory(records){
 const vaccinations=healthHistory(records,'vaccines');
 return VACCINES.map(v=>({...v,records:vaccinations.filter(r=>r.vaccineId===v.id)}));
}
export function customVaccineNames(records){
 const names=new Map();for(const r of healthHistory(records,'vaccines'))if(r.vaccineId===null&&!names.has(r.title.trim().toLocaleLowerCase()))names.set(r.title.trim().toLocaleLowerCase(),r.title.trim());return [...names.values()];
}
