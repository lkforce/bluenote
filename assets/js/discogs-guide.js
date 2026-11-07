'use strict';
(async function () {
  const root=document.querySelector('.visual-guide');if(!root)return;
  const target=document.querySelector('#discogs-status');let data;
  function add(parent,tag,text){const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;}
  function clear(){for(const box of document.querySelectorAll('.discogs-live'))box.replaceChildren();target.textContent='Discogs 정보 갱신 대기 또는 6시간 유효기간 만료. 원문에서 확인해 주세요.';}
  function fresh(){const start=Date.parse(data.retrieved_at),end=Date.parse(data.expires_at),now=Date.now();return Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end&&end-start===21600000;}
  function cite(box,type){add(box,'p',type==='MASTER'?'Discogs Master 기준':'선택한 Discogs Key Release 기준 · Master 자체 정보와 구분');const a=add(box,'a','Data provided by Discogs.');a.href=type==='MASTER'?data.master_url:data.release_url;}
  try{
    const response=await fetch('/bluenote/data/albums/blp-'+root.dataset.number+'.json',{cache:'no-store'});if(!response.ok)throw new Error('metadata unavailable');
    const documentData=await response.json();const row=documentData.records.find(r=>r.kind==='album_stories'&&r.fields.title?.value==='Discogs metadata · 공개 기본 정보');
    if(!row){target.textContent='Discogs 기본 정보 대조 중 · 기존 출처 확인 자료를 아래에 표시합니다.';return;}
    data=JSON.parse(row.fields.body.value);
    if(data.schema!=='discogs-public-v1'||!/^https:\/\/www\.discogs\.com\/master\/\d+$/.test(data.master_url)||!/^https:\/\/www\.discogs\.com\/release\/\d+$/.test(data.release_url))throw new Error('metadata contract');
    if(!fresh()){clear();return;}
    target.textContent='Discogs 확인: '+data.retrieved_at+' · Master / Key Release 출처 구분';
    const genre=document.querySelector('#discogs-genre');add(genre,'h3','Discogs · Genre / Style');add(genre,'p','Genre: '+(data.genres.join(' · ')||'미확인'));add(genre,'p','Style: '+(data.styles.join(' · ')||'미확인'));cite(genre,'MASTER');
    const year=document.querySelector('#discogs-year');add(year,'h3','Discogs 발매 연도');add(year,'p','Master: '+(data.year||'미확인')+' · Key Release: '+(data.release_year||'미확인')+' · '+(data.release_country||'국가 미확인'));add(year,'p','녹음 연도 및 정확한 최초 발매일과 구분합니다.');cite(year,'RELEASE');
    const tracks=document.querySelector('#discogs-tracks');add(tracks,'h3','Discogs 수록곡');const list=add(tracks,'ol','');for(const t of data.tracklist)add(list,'li',[t.position,t.title,t.duration].filter(Boolean).join(' · '));cite(tracks,data.tracklist_source);
    const credits=document.querySelector('#discogs-credits');add(credits,'h3','악기별 크레딧');const musicians=add(credits,'ul','');for(const p of data.credits)add(musicians,'li',p.instrument+' — '+p.name+(p.tracks?' · 트랙 '+p.tracks:' · 판본 크레딧; 전곡 참여를 뜻하지 않음'));if(!data.credits.length)add(credits,'p','악기별 크레딧 미확인');cite(credits,data.credits_source);
    const notes=document.querySelector('#discogs-notes');add(notes,'h3','Discogs Notes · 원문 발췌');add(notes,'p',data.notes||'등록된 메모 없음');cite(notes,data.notes_source);
    setTimeout(clear,Math.max(0,Date.parse(data.expires_at)-Date.now()));
    document.addEventListener('visibilitychange',()=>{if(!fresh())clear();});
    window.addEventListener('pageshow',()=>{if(!fresh())clear();});
  }catch{clear();}
})();
