import {SEARCH_TYPES,SEARCH_SORTS,buildSearchDocuments,searchDocuments,groupSearchResults} from '../shared/unified-search.mjs';
import {GAMES,categoryLabel} from '../shared/catalog.mjs';
import {columnOptions,layoutSetting,gridLayout} from './responsive-layout.mjs';
import {groupBannerPeriods,bannerHistoryLayout} from '../shared/banner-history.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function bindSearchInput(input,submit,{delay=180}={}){
 let timer,composing=false;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 const schedule=()=>{cancel();timer=setTimeout(()=>{timer=null;submit(input.value);},delay);};
 const onInput=event=>{if(!composing&&!event.isComposing)schedule();};
 const onStart=()=>{composing=true;cancel();},onEnd=()=>{composing=false;schedule();};
 const onKey=event=>{if(event.key==='Enter'&&!composing&&!event.isComposing){event.preventDefault();cancel();submit(input.value);}};
 input.addEventListener('input',onInput);input.addEventListener('compositionstart',onStart);input.addEventListener('compositionend',onEnd);input.addEventListener('keydown',onKey);
 return {cancel,dispose(){cancel();input.removeEventListener('input',onInput);input.removeEventListener('compositionstart',onStart);input.removeEventListener('compositionend',onEnd);input.removeEventListener('keydown',onKey);}};
}

export async function mountUnifiedSearch({host,game,gameName,entries=[],query,type='all',scope='current',sort='relevance',direction='desc',loadCatalog,loadVersions,loadArtwork,renderEntry,renderVersion,renderArtwork,switchArtwork,renderBanner,rememberCards=()=>{},onChange=()=>{},footer=''}){
 rememberCards();
 const root=document.createElement('div');root.className='search-results-root';host.replaceChildren(root);
 const games=scope==='all'?Object.keys(GAMES):[game],heading=`<div class="heading"><div><h1>搜索</h1><p>${escape(scope==='all'?'全部游戏':gameName)}</p></div><div class="catalog-actions"></div></div>`;
 if(!query.trim()){root.innerHTML=heading+'<div class="panel empty">输入名称、别名、版本号或关键词，搜索已收录的资料。</div>'+footer;return;}
 root.innerHTML=heading+'<div class="panel loading">正在搜索…</div>';
 const tasks=games.flatMap(game=>[
  {game,kind:'catalog',label:'条目',run:()=>loadCatalog?loadCatalog(game):entries.filter(e=>e.game===game)},
  {game,kind:'versions',label:'版本档案',run:()=>loadVersions(game)}
 ]);
 tasks.push({kind:'artwork',label:'立绘索引',run:()=>loadArtwork()});
 const loaded=await Promise.allSettled(tasks.map(task=>Promise.resolve().then(task.run)));if(!root.isConnected)return;
 const resources=new Map(games.map(game=>[game,{entries:[],versions:[]}])),errors=[];let artwork={};
 loaded.forEach((result,index)=>{
  const task=tasks[index];
  if(result.status==='rejected'){errors.push((task.game?GAMES[task.game].short+' · ':'')+task.label+'暂时无法读取：'+(result.reason.message??result.reason));return;}
  if(task.kind==='artwork')artwork=result.value;
  else if(task.kind==='catalog')resources.get(task.game).entries=result.value;
  else resources.get(task.game).versions=result.value.versions??[];
 });
 const documents=games.flatMap(game=>buildSearchDocuments({game,...resources.get(game),artwork})),allMatches=searchDocuments(documents,query);
 const settings={type:Object.hasOwn(SEARCH_TYPES,type)?type:'all',sort:Object.hasOwn(SEARCH_SORTS,sort)?sort:'relevance',direction:direction==='asc'?'asc':'desc'},limits=new Map(),chosenArtworks=new Map();
 const count=key=>allMatches.filter(r=>key==='all'||r.category===key).length;
 const typeLabel=key=>scope!=='all'&&['characters','weapons','sets','materials'].includes(key)?categoryLabel(game,key):SEARCH_TYPES[key];
 root.innerHTML=heading+`<div class="panel search-result-controls"><div class="facet-row"><div class="facet-label">资料类别</div><div class="facet-options">${Object.keys(SEARCH_TYPES).map(key=>`<button type="button" class="chip" data-search-type="${key}">${escape(typeLabel(key))}<span>${count(key)}</span></button>`).join('')}</div></div><div class="result-meta"><span data-search-count></span><div class="sort-controls"><label for="search-result-sort">排序</label><select id="search-result-sort" class="sort-select">${Object.entries(SEARCH_SORTS).map(([key,label])=>`<option value="${key}" ${settings.sort===key?'selected':''}>${label}</option>`).join('')}</select><button type="button" class="direction-button" data-search-direction aria-label="切换搜索排序方向"></button></div></div></div>${errors.map(message=>`<p class="panel search-warning">${escape(message)}</p>`).join('')}<div data-search-groups></div>${footer}`;
 const groups=root.querySelector('[data-search-groups]');
 const artworkHref=(entry,choice)=>'/?'+new URLSearchParams({game:entry.game,screen:'artwork',q:entry.name,artwork:entry.id,variant:choice.key});
 const lookupEntry=(game,id)=>resources.get(game)?.entries.find(e=>e.id===id)??(artwork.entries??artwork.galleryEntries??[]).find(e=>e.game===game&&e.id===id);
 function renderGroups(){
  rememberCards();
  const results=searchDocuments(documents,query,settings),grouped=groupSearchResults(results);
  for(const button of root.querySelectorAll('[data-search-type]')){const active=button.dataset.searchType===settings.type;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  root.querySelector('[data-search-count]').textContent=`「${query}」 · ${results.length} / ${allMatches.length} 项`;
  root.querySelector('[data-search-direction]').textContent=settings.direction==='asc'?'升序 ↑':'降序 ↓';
  groups.innerHTML=grouped.map(group=>{
   const {game,category}=group,resource=resources.get(game),key=game+':'+category;
   let items=group.items;
   if(category==='banners')items=groupBannerPeriods(items.map(r=>lookupEntry(game,r.id)).filter(Boolean));
   const limit=limits.get(key)??20,shown=items.slice(0,limit),label=SEARCH_TYPES[category==='versions'||category==='artwork'?category:'all'];
   let cards='',className='characters configurable-grid',base=category==='characters'||category==='materials'?5:category==='weapons'?(game==='starrail'?3:4):category==='sets'?4:2,max=6,minCell=['weapons','sets'].includes(category)?260:190,layoutKey=`wiki-layout-v3:${game}:${category}`;
   if(category==='versions'){
    className='version-card-grid';base=3;max=5;minCell=280;layoutKey=`wiki-version-columns:${game}:index`;
    cards=shown.map(r=>renderVersion(resource.versions.find(v=>v.version===r.id),{game,entries:resource.entries,targetHref:r.href})).join('');
   }else if(category==='artwork'){
    className='artwork-gallery-grid';base=game==='genshin'?2:3;max=5;minCell=game==='genshin'?440:280;layoutKey=`wiki-search-artwork-columns:${game}`;
    const selected=Object.fromEntries(shown.map(r=>[r.entryId,chosenArtworks.get(game+':'+r.entryId)??r.variantKey]));
    cards=renderArtwork(shown.map(r=>lookupEntry(game,r.entryId)).filter(Boolean),artwork.images??{},escape,artwork.variants??{},{selected,hrefFor:artworkHref});
   }else if(category==='banners'){
    const policy=bannerHistoryLayout(group.items.map(r=>lookupEntry(game,r.id)).filter(Boolean));className='banner-history-grid';base=policy.base;max=2;minCell=600;layoutKey=`wiki-layout-v3:${game}:${policy.scope}`;
    cards=shown.map(period=>renderBanner(period,resource.entries)).join('');
   }else cards=shown.map(r=>lookupEntry(game,r.id)).filter(Boolean).map(renderEntry).join('');
   const title=category==='versions'||category==='artwork'?label:categoryLabel(game,category),setting=layoutSetting(layoutKey);
   const detail=category==='artwork'?`${group.matches.length} 张 · ${items.length} 位角色`:category==='banners'?`${group.matches.length} 个卡池 · ${items.length} 组安排`:`${items.length} 项`;
   return `<section class="panel search-card-group ${category==='artwork'?'artwork-gallery-root':''}" data-game="${game}" data-search-category="${category}"><div class="search-group-heading"><h2>${scope==='all'?escape(GAMES[game].short)+' · ':''}${escape(title)} <small>${detail}</small></h2><label>每行 <select data-layout-key="${layoutKey}" aria-label="${escape(GAMES[game].short+' '+title)}每行数量">${columnOptions(setting,max)}</select></label></div><div class="${className}" ${gridLayout(layoutKey,base,{max,minCell})}>${cards}</div>${limit<items.length?`<button type="button" class="subtle-action" data-search-more="${key}">显示更多（剩余 ${items.length-limit}${category==='artwork'?' 位角色':category==='banners'?' 组':' 项'}）</button>`:''}</section>`;
  }).join('')||'<div class="panel empty">没有匹配的资料，试试其他关键词或资料类别。</div>';
 }
 root.addEventListener('click',event=>{
  const choice=event.target.closest('[data-artwork-choice]');
  if(choice&&root.contains(choice)){
   const group=choice.closest('[data-game]'),id=choice.closest('[data-entry-id]').dataset.entryId,entry=lookupEntry(group.dataset.game,id);
   switchArtwork(choice,entry,artwork.images??{},artwork.variants??{},{hrefFor:artworkHref});chosenArtworks.set(group.dataset.game+':'+id,choice.dataset.artworkChoice);return;
  }
  const button=event.target.closest('[data-search-type],[data-search-more],[data-search-direction]');if(!button||!root.contains(button))return;
  if(button.dataset.searchType){settings.type=button.dataset.searchType;limits.clear();onChange({searchType:settings.type});}
  else if(button.hasAttribute('data-search-direction')){settings.direction=settings.direction==='asc'?'desc':'asc';onChange({searchDirection:settings.direction});}
  else {const key=button.dataset.searchMore;limits.set(key,(limits.get(key)??20)+20);}
  renderGroups();if(button.dataset.searchMore)groups.querySelector(`[data-search-more="${button.dataset.searchMore}"]`)?.focus({preventScroll:true});
 });
 root.addEventListener('change',event=>{if(event.target.id!=='search-result-sort')return;settings.sort=event.target.value;settings.direction=settings.sort==='name'?'asc':'desc';onChange({searchSort:settings.sort,searchDirection:settings.direction});renderGroups();});
 renderGroups();
}

