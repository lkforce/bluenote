'use strict';
(async function () {
  const root=document.querySelector('.visual-guide');if(!root)return;
  const target=document.querySelector('#discogs-status');if(!target)return;let data;
  const artist=document.querySelector('.visual-guide-artist');const initialArtist=artist.textContent;
  function add(parent,tag,text){const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;}
  function clear(){for(const box of document.querySelectorAll('.discogs-live'))box.replaceChildren();artist.textContent=initialArtist;root.dataset.discogsReady='false';target.textContent='Discogs 정보 갱신 대기 또는 6시간 유효기간 만료. 원문에서 확인해 주세요.';}
  function fresh(){const start=Date.parse(data.retrieved_at),end=Date.parse(data.expires_at),now=Date.now();return Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end&&end-start===21600000;}
  function cite(box,type){add(box,'p',type==='MASTER'?'Discogs Master 기준':'선택한 Discogs Key Release 기준 · Master 자체 정보와 구분');const a=add(box,'a','Data provided by Discogs.');a.href=type==='MASTER'?data.master_url:data.release_url;}
  try{
    const album='blp-'+root.dataset.number;
    const indexResponse=await fetch('/bluenote/assets/data/discogs-index.json',{cache:'no-store'});if(!indexResponse.ok)throw new Error('metadata index unavailable');
    const index=await indexResponse.json();const path=index.albums?.[album];
    if(index.schema_version!==1||index.data_version!==document.querySelector('main').dataset.jsonVersion||!/^\/bluenote\/data\/albums\/blp-1[56]\d{2}\.json$/.test(path||''))throw new Error('metadata package');
    const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('metadata unavailable');
    const documentData=await response.json();const row=documentData.records.find(r=>r.kind==='album_stories'&&r.links.album_key===album&&r.fields.title?.value==='Discogs metadata · 공개 기본 정보');
    if(!row){target.textContent='Discogs 기본 정보 대조 중 · 기존 출처 확인 자료를 아래에 표시합니다.';return;}
    data=JSON.parse(row.fields.body.value);
    if(data.schema!=='discogs-public-v1'||!/^https:\/\/www\.discogs\.com\/master\/\d+$/.test(data.master_url)||!/^https:\/\/www\.discogs\.com\/release\/\d+$/.test(data.release_url))throw new Error('metadata contract');
    if(!fresh()){clear();return;}
    if(!initialArtist)artist.textContent=data.artists.join(' / ');
    target.textContent='Discogs 확인: '+data.retrieved_at+' · Master / Key Release 출처 구분';
    const genre=document.querySelector('#discogs-genre');add(genre,'h3','Genre / Style');add(genre,'p',data.genres.join(' · '));add(genre,'p',data.styles.join(' · '));cite(genre,'MASTER');
    const year=document.querySelector('#discogs-year');add(year,'h3','발매 연도');add(year,'p','Master: '+(data.year||'')+' · Key Release: '+(data.release_year||'')+(data.release_country?' · '+data.release_country:''));cite(year,'RELEASE');
    const tracks=document.querySelector('#discogs-tracks');add(tracks,'h3','Discogs 수록곡');const list=add(tracks,'ol','');for(const t of data.tracklist)add(list,'li',[t.position,t.title,t.duration].filter(Boolean).join(' · '));cite(tracks,data.tracklist_source);
    const credits=document.querySelector('#discogs-credits');add(credits,'h3','악기별 크레딧');const musicians=add(credits,'ul','');const grouped=new Map();for(const p of data.credits){const key=p.instrument+' — '+p.name;if(!grouped.has(key))grouped.set(key,new Set());if(p.tracks)grouped.get(key).add(p.tracks);}for(const [name,scope] of grouped)add(musicians,'li',name+(scope.size?' ('+[...scope].join('; ')+')':''));add(credits,'p','트랙 표시는 해당 크레딧의 범위입니다.');cite(credits,data.credits_source);
    const notes=document.querySelector('#discogs-notes');if(data.notes){add(notes,'h3','Discogs Notes · 발췌');const excerpt=data.notes.length>280?data.notes.slice(0,280).replace(/\s+\S*$/,'')+'…':data.notes;add(notes,'p',excerpt);cite(notes,data.notes_source);}
    setTimeout(clear,Math.max(0,Date.parse(data.expires_at)-Date.now()));
    document.addEventListener('visibilitychange',()=>{if(!fresh())clear();});
    window.addEventListener('pageshow',()=>{if(!fresh())clear();});
    root.dataset.discogsReady='true';root.dataset.discogsMaster=String(data.master_id);root.dataset.discogsTracks=String(data.tracklist.length);
  }catch{clear();}
})();
