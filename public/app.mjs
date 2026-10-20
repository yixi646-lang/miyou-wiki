import {artworkFigure,setPartsHTML} from './visual-assets.mjs';
import {homeHTML,mountHome,updateHomeStatus} from './home.mjs';
import {focusNameInput} from '/shared/name-input.mjs';
import {withResourceTimeout} from '/shared/resource-loading.mjs';
import {createPageMemory,installScrollStability} from './page-state.mjs';
import {materialUsageHTML} from './material-usage.mjs';
import {materialAcquisitionHTML} from './material-acquisition.mjs';
import {characterMaterialsHTML} from './character-materials.mjs';
import {characterMaterialGroups} from '/shared/character-materials.mjs';
import {mountArtworkGallery,loadArtworkIndex,galleryCards,switchGalleryCard} from './artwork-gallery.mjs';
import {mountUnifiedSearch,bindSearchInput} from './unified-search.mjs';
import {SEARCH_TYPES,SEARCH_SORTS} from '/shared/unified-search.mjs';
import {mountVersionArchives,mountVersionSources,loadVersionArchive,versionCardHTML} from './version-archives.mjs';
import {installSidebarEdge} from './sidebar-edge.mjs';
import { createListDisclosureState, foldButtons, installDisclosureControls } from './disclosures.mjs';
import {layoutSetting,columnOptions,gridLayout,installResponsiveLayout} from './responsive-layout.mjs';
import {skillExplanations,skillDescriptionHTML} from '/shared/skill-terms.mjs';
import {supplementSummaries,supplementCharacter} from './catalog-supplements.mjs';
import { detailEntry, travelerVariant, TRAVELER_ELEMENTS } from '/shared/traveler.mjs';
import { rarityClass, elementIcon } from '/shared/appearance.mjs';
import { imageHTML, isLocalImage } from '/shared/asset-image.mjs';
import { BANNER_PHASES, withBannerSchedules } from '/shared/banner-schedule.mjs';
import { groupBannerPeriods, bannerHistoryLayout } from '/shared/banner-history.mjs';
import { bannerPeriodHTML } from './banner-history.mjs';
import { parseBackupFile } from '/shared/backup-file.mjs';
import { trackPageLifetime } from './page-lifecycle.mjs';
import { versionFiltersHTML } from './version-filters.mjs';
import { formatCoreValue } from '/shared/core-stats.mjs';
const mountBannerStats=async options=>{const module=await import('./banner-stats.mjs');if(state.screen==='banner-stats'&&state.game===options.game)return module.mountBannerStats(options);};
import { buildBannerStatistics } from '/shared/banner-stats.mjs';
import { GAMES, CATEGORIES, SORTS, PAGE_SIZES, normalizePageSize, summarizeEntry, categoryLabel, rarityLabel, facetLabel, selectEntries, buildFacets, availableSorts, toggleFacet, versionLabel } from '/shared/catalog.mjs';

const $ = selector => document.querySelector(selector);
const content = $('#content'), search = $('#search'), dialog = $('#editor-dialog');
const scrollStability=installScrollStability({window,host:content});
const pageMemory=createPageMemory({window,prepareScroll:scrollStability.prepare});
let contentMinimum=null;
content.style.overflowAnchor='none';
if('scrollRestoration'in history)history.scrollRestoration='manual';
window.addEventListener('pagehide',()=>pageMemory.remember());
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="/icons.svg#i-${name}"/></svg>`;
const colors = {genshin:['#eef6f1','#b9d5c7','#599b86'],starrail:['#f2eff9','#cfc2e3','#9881bd'],zenless:['#fff4eb','#e9cdb1','#b78c62']};
const workspacePath='D:'+String.fromCharCode(92)+'Wiki';
const backupFolder=[workspacePath,'data','backups'].join(String.fromCharCode(92));
const tile = game => { const c=colors[game]??colors.genshin;return `--tile-bg:${c[0]};--tile-ink:${c[1]};--tile-color:${c[2]}`; };
const button = (action,label,extra='') => `<button class="subtle-action" data-action="${action}" ${extra}>${label}</button>`;
let assessmentModule=null,assessmentGeneration=0,assessmentLoad=null;
function disposeAssessment(){assessmentGeneration++;assessmentLoad?.abort();assessmentLoad=null;assessmentModule?.disposeAssessment();}
async function mountAssessment(options){
  const generation=assessmentGeneration,loading=new AbortController();assessmentLoad=loading;options.host.innerHTML='<div class="panel loading">正在加载养成与评估…</div>';
  try{
    const module=await withResourceTimeout(()=>import('/assessment/ui.mjs'),{signal:loading.signal,message:'养成与评估模块加载超时，请刷新后重试。'});
    if(generation===assessmentGeneration&&options.isActive()){assessmentModule=module;await module.mountAssessment(options);}
  }catch(error){
    if(generation===assessmentGeneration&&options.isActive())options.host.innerHTML=`<div class="panel empty"><strong>养成与评估暂时无法加载</strong><p>${escape(error.message)}</p><p>请关闭 Wiki 页面后重新启动 Wiki，以加载更新后的本地服务。</p></div>`;
  }finally{if(assessmentLoad===loading)assessmentLoad=null;}
}
const state = {game:'genshin',category:'characters',screen:'list',search:'',searchType:'all',searchScope:'current',searchSort:'relevance',searchDirection:'desc',filters:{},sort:'release',direction:'desc',page:1,pageSize:'all',entryId:null,travelerElement:'冰',featured:null,archiveVersion:null,archiveMajor:'',archiveSection:'',since:'',until:''};
let counts=[], favoriteCounts=[], renderGeneration=0,disposeHome=()=>{};const loadedGames=new Set(),catalogRequests=new Map();
const countFor=(game,category)=>counts.filter(r=>(!game||r.game===game)&&(!category||r.category===category)).reduce((n,r)=>n+r.count,0);
async function loadGame(game){if(loadedGames.has(game))return;if(!catalogRequests.has(game))catalogRequests.set(game,api(`catalog?game=${encodeURIComponent(game)}`).then(async data=>{entries=withBannerSchedules([...entries.filter(e=>e.game!==game),...await supplementSummaries(data.entries)]);loadedGames.add(game);}).finally(()=>catalogRequests.delete(game)));await catalogRequests.get(game);}
async function refreshCatalog(){const data=await api('bootstrap');counts=data.counts??[];favoriteCounts=data.favoriteCounts??[];favorites=new Set(data.favorites);token=data.token;sourceManifest=data.sourceManifest;entries=[];loadedGames.clear();}
let entries=[], favorites=new Set(), token='', currentEntry=null, detailGeneration=0, toastTimer, pendingImport=null, editorEntry=null, editorInitial='',editorGeneration=0, sourceManifest=null;
let view; try { view=localStorage.getItem('wiki-view')??'cards'; } catch { view='cards'; }
const expandedFacets=new Set();
const listDisclosures=createListDisclosureState();
const preference=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const savePreference=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
let searchInput=null;
const savedSize=(game,category)=>normalizePageSize(preference(`wiki-page-size-v2:${game}:${category}`,'all'));
let sidebarMode=preference('wiki-sidebar','wide');
let sidebarWidth=sidebarMode==='narrow'?'narrow':preference('wiki-sidebar-width','wide');
let homeSidebarOpen=false;
if(!['wide','narrow'].includes(sidebarWidth))sidebarWidth='wide';
function applySidebarMode(){
  if(!['wide','narrow','hidden'].includes(sidebarMode))sidebarMode='wide';
  const effectiveMode=state.screen==='home'?(homeSidebarOpen?sidebarWidth:'hidden'):sidebarMode;
  document.documentElement.dataset.sidebar=effectiveMode;
  const label=effectiveMode==='hidden'?'打开边栏':'关闭边栏';
  $('#sidebar-toggle').title=label;$('#sidebar-toggle').setAttribute('aria-label',label);$('#sidebar-toggle').setAttribute('aria-expanded',String(effectiveMode!=='hidden'));
  const widthLabel=sidebarWidth==='wide'?'缩窄边栏':'展开边栏',widthButton=$('#sidebar-width-toggle');
  widthButton.title=widthLabel;widthButton.setAttribute('aria-label',widthLabel);widthButton.setAttribute('aria-pressed',String(sidebarWidth==='narrow'));widthButton.textContent=sidebarWidth==='wide'?'‹':'›';
  savePreference('wiki-sidebar',sidebarMode);savePreference('wiki-sidebar-width',sidebarWidth);
}
applySidebarMode();
const closeSidebarEdge=installSidebarEdge({sidebar:$('#sidebar'),edge:$('#sidebar-edge')});

async function api(path,{method='GET',body}={}) {
  const response=await fetch(`/api/${path}`,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Wiki-Token':token},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  let result;try{result=await response.json();}catch{throw new Error('本地服务没有返回有效数据。');}
  if(!response.ok)throw new Error(result.error??'操作失败。');
  return result;
}
function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
const summary=summarizeEntry;
function updateSummary(entry){const index=entries.findIndex(item=>item.id===entry.id);if(index<0)entries.push(summary(entry));else entries[index]=summary(entry);entries=withBannerSchedules(entries);}
function parseLocation() {
  searchInput?.cancel();
  const q=new URLSearchParams(location.search);
  const rememberedGame=preference('wiki-game','genshin');
  state.game=Object.hasOwn(GAMES,q.get('game'))?q.get('game'):Object.hasOwn(GAMES,rememberedGame)?rememberedGame:'genshin';
  state.category=q.get('category')!=='materials'&&Object.hasOwn(CATEGORIES,q.get('category'))?q.get('category'):q.get('category')==='all'&&(q.get('q')||q.get('screen')==='favorites')?'all':'characters';
  state.screen=q.size===0?'home':['favorites','manage','banner-stats','artwork','versions','assessment','search'].includes(q.get('screen'))?q.get('screen'):'list';
  state.archiveVersion=q.get('version');state.archiveMajor=q.get('major')??'';state.archiveSection=q.get('topic')??'';state.since=q.get('since')??'';state.until=q.get('until')??'';
  if(state.screen==='assessment'&&state.game!=='genshin')state.screen='list';
  if(state.screen==='home')homeSidebarOpen=false;
  if(state.screen==='banner-stats')state.category='banners';
  if(state.screen==='favorites'&&!q.has('category'))state.category='all';
  state.travelerElement=q.get('element')??'冰';state.entryId=q.get('entry');if(state.entryId)state.screen='detail';
  if(state.entryId)state.game=entries.find(e=>e.id===state.entryId)?.game??Object.keys(GAMES).find(game=>state.entryId.startsWith(game+'-'))??state.game;
  savePreference('wiki-game',state.game);
  state.pageSize=q.has('size')?normalizePageSize(q.get('size')):savedSize(state.game,state.category);
  state.featured=state.category==='banners'?q.get('featured'):null;
  state.searchType=Object.hasOwn(SEARCH_TYPES,q.get('type'))?q.get('type'):'all';
  state.searchScope=state.screen==='search'&&q.get('scope')==='all'?'all':'current';
  state.searchSort=Object.hasOwn(SEARCH_SORTS,q.get('searchSort'))?q.get('searchSort'):'relevance';state.searchDirection=q.get('searchDirection')==='asc'?'asc':'desc';
  state.search=q.get('q')??'';state.sort=Object.hasOwn(SORTS,q.get('sort'))?q.get('sort'):'release';state.direction=q.get('direction')==='asc'?'asc':'desc';
  state.page=Math.max(1,Number.parseInt(q.get('page')??'1')||1);state.filters={};
  for(const [key,value] of q)if(key.startsWith('f_')&&(['category','rarity','element','type','region','secondary','kind','releaseMajor','releaseVersion','ascensionStat','effect2','effect4','bannerPhase','acquisitionChannels'].includes(key.slice(2))||state.screen==='artwork'&&key==='f_hasSkin')){(state.filters[key.slice(2)]??=[]).push(value);}
  if(search.value!==state.search)search.value=state.search;
}
function urlFor(patch={}){
  const s={...state,...patch},q=new URLSearchParams();
  q.set('game',s.game);
  if(s.screen==='search'){q.set('screen','search');if(s.search)q.set('q',s.search);if(s.searchType!=='all')q.set('type',s.searchType);if(s.searchScope==='all')q.set('scope','all');if(s.searchSort!=='relevance')q.set('searchSort',s.searchSort);if(s.searchDirection!=='desc')q.set('searchDirection',s.searchDirection);return '/?'+q;}
  if(s.screen==='versions'){q.set('screen','versions');for(const [key,value] of Object.entries({version:s.archiveVersion,major:s.archiveMajor,topic:s.archiveSection,since:s.since,until:s.until,q:s.search,direction:s.direction==='asc'?'asc':''}))if(value)q.set(key,value);return '/?'+q;}
  if(s.screen==='detail'&&s.entryId){q.set('entry',s.entryId);if(s.travelerElement&&s.travelerElement!=='冰')q.set('element',s.travelerElement);return '/?'+q;}
  if(s.category!=='characters')q.set('category',s.category);
  if(s.pageSize!=='all')q.set('size',s.pageSize);
  if(s.featured&&s.category==='banners')q.set('featured',s.featured);
  if(['favorites','manage','banner-stats','artwork','assessment'].includes(s.screen))q.set('screen',s.screen);
  if(s.search)q.set('q',s.search);if(s.sort!=='release')q.set('sort',s.sort);if(s.direction!=='desc')q.set('direction',s.direction);if(s.page>1)q.set('page',s.page);
  for(const [key,values]of Object.entries(s.filters??{}))for(const v of values)q.append(`f_${key}`,v);
  return q.size?'/?'+q:'/';
}
function openPage(url,{replace=false,resume=false,position,historyData={}}={}){pageMemory.remember();if(resume)url=pageMemory.destination(url,state.game);history[replace?'replaceState':'pushState'](historyData,'',url);parseLocation();closeSidebar();void render({position});}
function navigate(patch,{replace=false,scroll=true,resume=false}={}){searchInput?.cancel();const position=scroll?undefined:{left:window.scrollX,top:window.scrollY};if(('game'in patch&&patch.game!==state.game)||('category'in patch&&patch.category!==state.category)){patch.pageSize??=savedSize(patch.game??state.game,patch.category??state.category);if(!('featured'in patch))patch.featured=null;}Object.assign(state,patch);savePreference('wiki-game',state.game);openPage(urlFor(),{replace,resume,position});}
function closeSidebar(){closeSidebarEdge();$('#sidebar').classList.remove('mobile-open');$('#sidebar-shade').hidden=true;$('#mobile-menu').setAttribute('aria-expanded','false');}
function updateChrome(){
  document.documentElement.dataset.screen=state.screen;applySidebarMode();
  const detailGame=state.screen==='detail'?entries.find(e=>e.id===state.entryId)?.game:null;
  const game=detailGame??state.game;
  document.querySelectorAll('.game-switch button').forEach(b=>{b.classList.toggle('active',b.dataset.game===game);b.setAttribute('aria-pressed',String(b.dataset.game===game));});
  $('#category-nav-label').textContent=GAMES[game].name;
  const activeCategory=state.screen==='detail'?entries.find(e=>e.id===state.entryId)?.category:state.category;
  $('#category-nav').innerHTML=Object.keys(CATEGORIES).filter(key=>key!=='materials').map(key=>`<a class="nav ${!['home','favorites','manage','artwork','versions','assessment','search'].includes(state.screen)&&activeCategory===key?'active':''}" href="/?game=${game}&category=${key}" title="${escape((key==='all'?'全部资料':categoryLabel(game,key)))}">${icon(key==='characters'?'user':key==='banners'?'book':key==='weapons'?'layer':'grid')}<span class="nav-text">${escape(key==='all'?'全部资料':categoryLabel(game,key))}</span></a>`).join('')+`<a class="nav ${state.screen==='versions'?'active':''}" href="/?game=${game}&screen=versions" title="版本档案">${icon('book')}<span class="nav-text">版本档案</span></a><a class="nav ${state.screen==='artwork'?'active':''}" href="/?game=${game}&screen=artwork" title="角色立绘展示">${icon('grid')}<span class="nav-text">角色立绘展示</span></a>`+(game==='genshin'?`<a class="nav ${state.screen==='assessment'?'active':''}" href="/?game=genshin&screen=assessment" title="养成与评估">${icon('layer')}<span class="nav-text">养成与评估</span></a>`:'');
  $('#favorites-nav').href=`/?game=${game}&screen=favorites&category=all`;
  $('#manage-nav').href=`/?game=${game}&screen=manage`;
  $('#favorites-nav').classList.toggle('active',state.screen==='favorites');$('#manage-nav').classList.toggle('active',state.screen==='manage');
  $('#favorite-count').textContent=loadedGames.has(game)?entries.filter(e=>e.game===game&&favorites.has(e.id)).length:favoriteCounts.find(r=>r.game===game)?.count??0;$('#local-count').textContent=`${countFor(game).toLocaleString('zh-CN')} 个条目 · 本地保存`;
  search.placeholder=state.searchScope==='all'?'搜索全部游戏…':'搜索'+GAMES[game].short+'…';
  for(const button of document.querySelectorAll('[data-search-scope]'))button.setAttribute('aria-pressed',String(button.dataset.searchScope===state.searchScope));
  const title=state.screen==='search'?'搜索':state.screen==='assessment'?'养成与评估':state.screen==='versions'?'版本档案':state.screen==='artwork'?'角色立绘展示':state.screen==='home'?'百科首页':state.screen==='banner-stats'?'卡池统计':state.screen==='manage'?'资料与备份':state.screen==='favorites'?'我的收藏':state.screen==='detail'?(entries.find(e=>e.id===state.entryId)?.name??'条目详情'):GAMES[game]?.name??'百科总览';
  $('#breadcrumb').innerHTML=`资料库 <span>/&nbsp; ${escape(title)}</span>`;document.title=`${title} · Wiki`;
}
function displayValue(key,value){if(key==='bannerPhase')return BANNER_PHASES[value]??value;if(['releaseMajor','releaseVersion'].includes(key))return versionLabel(value)+(key==='releaseMajor'&&value!=='unknown'?' 系列':'');if(key==='game')return GAMES[value]?.short??value;if(key==='category')return categoryLabel(state.game,value);if(key==='rarity')return rarityLabel({game:state.game,rarity:Number(value)});return value;}
function entryImage(entry,detail=false){return imageHTML(entry,escape,{detail})||`<${detail?'b':'span'} class="monogram" aria-label="暂未收录图片">${escape(entry.name.slice(0,1))}</${detail?'b':'span'}>`;}
function elementBadge(entry){const src=elementIcon(entry);return src?`<span class="element-badge ${entry.game}" title="${escape(entry.element)}" aria-label="${escape(entry.element)}属性"><img src="${src}" alt="${escape(entry.element)}" decoding="async"></span>`:'';}
function travelerHTML(entry){const data=entry.details?.traveler,variant=travelerVariant(entry,state.travelerElement);if(!variant)return '';return section('traveler-elements','旅行者元素',`<div class="traveler-tabs" role="group" aria-label="旅行者元素">${TRAVELER_ELEMENTS.filter(element=>data.elements[element]).map(element=>`<button data-action="traveler-element" data-element="${element}" class="traveler-tab ${variant.element===element?'active':''}" aria-pressed="${variant.element===element}"><img src="${elementIcon({...entry,element})}" alt="">${element}元素</button>`).join('')}</div><p class="traveler-note">当前查看${variant.element}元素。七种元素共用角色等级与突破，技能与命之座分别介绍。</p>`);}
const entryHref=entry=>`/?game=${entry.game}&entry=${encodeURIComponent(entry.id)}`;
function applicabilityHTML(entry){const a=entry.applicability;if(!a)return '';return `<div class="material-usage">${a.purposes?.length?`<div>用途：${escape(a.purposes.join(' / '))}</div>`:''}${a.elements?.length?`<div>角色属性：${escape(a.elements.join(' / '))}</div>`:''}${a.paths?.length?`<div>命途：${escape(a.paths.join(' / '))}</div>`:''}${a.specialties?.length?`<div>特性：${escape(a.specialties.join(' / '))}</div>`:''}</div>`;}
function artworkHTML(entry){const figure=artworkFigure(entry,escape);return figure?`<div id="artwork" class="detail-artwork">${figure}<a class="detail-artwork-link" href="/?game=${entry.game}&screen=artwork">角色立绘展示 ↗</a></div>`:'';}
function weaponStats(entry){const secondaryName=entry.secondaryName??entry.secondary?.[0]??'副属性',labels={hp:'生命值',attack:'基础攻击力',defense:'基础防御力',speed:'速度',secondaryValue:secondaryName};return `<div class="weapon-stats">${Object.entries(labels).filter(([key])=>Number.isFinite(entry.stats?.[key])).map(([key,label])=>{const value=entry.stats[key];return `<span><small>${escape(label)}</small><b>${escape(key==='secondaryValue'?(secondaryName.includes('精通')?Math.round(value):Number((value*100).toFixed(1))+'%'):value)}</b></span>`;}).join('')}<small class="stats-level">Lv.${escape(entry.statsLevel??entry.stats?.level??'最高等级')}</small></div>`;}
function effectBody(effect){return `<h4>${escape(effect?.name??'')}</h4><p>${escape(effect?.description??'')}</p>`;}
function equipmentCard(entry){
  const effects=entry.listEffects??[],ranks=effects.filter(e=>e.rank);
  return `<article class="entry-card equipment-card ${rarityClass(entry)}" data-entry-id="${entry.id}" style="${tile(entry.game)}"><a class="equipment-main" href="${entryHref(entry)}" aria-label="查看${escape(entry.name)}详情"><div class="equipment-head"><span class="equipment-image">${entryImage(entry)}</span><div class="equipment-title"><strong>${escape(entry.name)}</strong><div class="entry-tags"><span>${escape(rarityLabel(entry))}</span><span>${escape(entry.type??entry.kind??'')}</span><span>${escape(entry.releaseVersion??'待确认')} 版本</span></div></div><span class="equipment-link">查看详情 ↗</span></div>${entry.category==='weapons'?weaponStats(entry):''}</a>${entry.category==='sets'?`<div class="set-effects">${effects.map(e=>`<div class="set-effect">${effectBody(e)}</div>`).join('')}</div>`:effects.length?`<details class="weapon-passive" ${listDisclosures.isOpen(entry.id)?'open':''}><summary>被动效果 <span>展开 / 收起</span></summary><div class="passive-body">${ranks.length?`<label class="list-rank-label">${entry.game==='genshin'?'精炼':entry.game==='starrail'?'叠影':'星级'} <select class="list-effect-rank" data-id="${entry.id}" aria-label="${escape(entry.name)}被动等级">${ranks.map((r,i)=>`<option value="${i}">${r.rank}</option>`).join('')}</select></label>`:''}<div class="list-selected-effect">${effectBody(ranks[0]??effects[0])}</div></div></details>`:''}${favorites.has(entry.id)?'<span class="saved-star" aria-label="已收藏">★</span>':''}</article>`;
}
function bannerGroups(entry){return (entry.banner?.groups??[]).map(group=>`<div class="banner-group"><span class="banner-group-label">${escape(group.name)}${group.role?`<small class="banner-role role-${group.role}">${escape({up:'概率 UP',selectable:'可选目标',pool:'普通内容'}[group.role]??'未标注')}</small>`:''}</span><div class="banner-items">${group.items.map(item=>{const target=entries.find(e=>e.id===item.id&&e.game===entry.game);return `<${target?'a':'span'} ${target?`href="${entryHref(target)}"`:''} class="banner-item">${target?.image?`<img src="${escape(target.image)}" alt="" loading="lazy">`:''}<span>${escape(target?.name??item.name)}</span></${target?'a':'span'}>`;}).join('')}</div></div>`).join('');}
function pairedBannerHTML(entry){const peer=entries.find(e=>e.id===entry.banner?.pairedBannerId&&e.game===entry.game);return peer?`<div class="paired-banner"><span>对应${escape(peer.type)}</span><a href="${entryHref(peer)}">${escape(peer.name)} ↗</a></div>`:'';}
function bannerCard(entry){const b=entry.banner,now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),current=b.start.slice(0,10)<=now&&(b.end?b.end.slice(0,10)>=now:b.mode!=='standard');return `<article class="entry-card banner-card" data-entry-id="${entry.id}"><div class="banner-card-head"><a href="${entryHref(entry)}"><strong>${escape(entry.name)}</strong></a><span class="tag ${current?'current-banner':''}">${current?'进行中':b.end?'历史记录':'常驻'}</span></div><div class="banner-period">${b.schedule?`<span class="banner-schedule" title="${escape(b.schedule.basis)}">${escape(b.schedule.label)}</span> · `:''}${escape(entry.type)} · ${escape(entry.releaseVersion)} 版本 · ${escape(b.start)}${b.end?' ～ '+escape(b.end):'起 · 持续开放'} <small>${escape(b.timeZone)}</small></div>${bannerGroups(entry)}${pairedBannerHTML(entry)}<a class="banner-source-link" href="${entryHref(entry)}">卡池详情与来源 ↗</a></article>`;}
function card(entry){if(['weapons','sets'].includes(entry.category))return equipmentCard(entry);if(entry.category==='banners'&&entry.banner)return bannerCard(entry);return `<a class="entry-card ${rarityClass(entry)}" href="/?game=${entry.game}&entry=${encodeURIComponent(entry.id)}" style="${tile(entry.game)}" title="${escape(entry.name)}">
  <div class="entry-visual">${entryImage(entry)}${entry.category==='characters'?elementBadge(entry):`<span class="type">${escape(entry.type||entry.kind||categoryLabel(entry.game,entry.category))}</span>`}${entry.category==='characters'?'':`<span class="entry-star ${entry.game==='zenless'?'zzz':''}">${entry.game==='zenless'?escape(rarityLabel(entry).replace(' 级','')):'★'.repeat(entry.rarity??0)}</span>`}</div>
  <div class="entry-info"><strong>${escape(entry.name)}</strong><div class="entry-tags"><span>${escape(entry.category==='characters'?[entry.element,entry.type||categoryLabel(entry.game,entry.category)].filter(Boolean).join(' · '):entry.secondary?.[0]||entry.kind||entry.type||categoryLabel(entry.game,entry.category))}</span>${entry.category!=='characters'&&entry.rarity?`<span class="tag">${escape(rarityLabel(entry))}</span>`:''}</div>${entry.category==='materials'&&!entry.releaseVersion?'':`<div class="entry-release"><span>${entry.releaseVersion?escape(entry.releaseVersion)+' 版本':'版本待确认'}</span></div>`}${entry.category==='materials'?applicabilityHTML(entry):''}</div>${favorites.has(entry.id)?'<span class="saved-star" aria-label="已收藏">★</span>':''}</a>`;}
function renderHome(){content.innerHTML=homeHTML();disposeHome=mountHome(content);
  const label=$('#wiki-content-version');api('content-status').then(status=>{if(content.contains(label))updateHomeStatus(label,status);}).catch(()=>{if(content.contains(label))label.textContent='资料版本暂时无法读取';});
}
function query(){return {...state,favoriteIds:state.screen==='favorites'?favorites:undefined};}
function facetsHTML(){const allFacets=buildFacets(entries,query()),ordinary=allFacets.filter(f=>!['releaseMajor','releaseVersion'].includes(f.key)),fold=state.game==='all'&&state.category==='characters',advanced=expandedFacets.has('all-facets');const facets=fold&&!advanced?ordinary.filter(f=>['game','rarity'].includes(f.key)||state.filters[f.key]?.length):ordinary;return `<div class="filters">${facets.map(f=>{
  const showAllRegions=state.game==='genshin'&&state.category==='characters'&&f.key==='region',selected=state.filters[f.key]??[],shown=showAllRegions||expandedFacets.has(f.key)?f.values:f.values.filter((v,i)=>i<8||selected.includes(v.value));
  return `<div class="facet-row"><div class="facet-label">${escape(f.label)}</div><div class="facet-options"><button class="chip ${selected.length?'':'active'}" data-action="facet-clear" data-key="${f.key}" aria-pressed="${!selected.length}">全部</button>${shown.map(({value,count})=>`<button class="chip ${selected.includes(value)?'active':''}" data-action="facet" data-key="${f.key}" data-value="${escape(value)}" aria-pressed="${selected.includes(value)}" ${!count&&!selected.includes(value)?'disabled':''}>${escape(displayValue(f.key,value))}<span>${count}</span></button>`).join('')}${!showAllRegions&&f.values.length>8?`<button class="chip chip-more" data-action="facet-expand" data-key="${f.key}">${expandedFacets.has(f.key)?'收起':'更多'+' ('+f.values.length+')'}</button>`:''}</div></div>`;
}).join('')}${versionFiltersHTML(allFacets,state.filters,{escape,expanded:expandedFacets.has('releaseVersion')})}${fold?`<button class="chip chip-more" data-action="facet-expand" data-key="all-facets">${advanced?'收起详细筛选':'更多筛选：属性、类型、阵营'}</button>`:''}${Object.values(state.filters).some(v=>v.length)?`<div class="active-filters"><span>已选择</span>${Object.entries(state.filters).flatMap(([key,values])=>values.map(value=>`<button class="active-filter" data-action="facet" data-key="${key}" data-value="${escape(value)}">${key==='effect2'||key==='effect4'?escape(facetLabel(key,state.game,state.category))+': ':''}${escape(displayValue(key,value))}<span>×</span></button>`)).join('')}<button class="chip chip-reset" data-action="reset-filters">清空筛选</button></div>`:''}<div class="filter-hint">同一条件可多选，不同条件同时生效。</div></div>`;}
function renderList(){
  content.querySelectorAll('.equipment-card .weapon-passive').forEach(detail=>listDisclosures.remember(detail.closest('[data-entry-id]').dataset.entryId,detail.open));
  listDisclosures.selectScope(`${state.game}:${state.category}:${state.screen}`);
  const q=query(),sorts=availableSorts(entries,q);if(!sorts.includes(state.sort))state.sort='release';
  const result=selectEntries(entries,query()),groupedBanners=state.category==='banners',displayItems=groupedBanners?groupBannerPeriods(result):result;
  const pageSize=state.pageSize==='all'?Math.max(1,displayItems.length):state.pageSize,pages=Math.max(1,Math.ceil(displayItems.length/pageSize));state.page=Math.min(state.page,pages);
  const items=displayItems.slice((state.page-1)*pageSize,state.page*pageSize),title=state.screen==='favorites'?GAMES[state.game].short+' · 我的收藏':GAMES[state.game].name;
  const bannerUnits=groupedBanners?new Map(entries.map(entry=>[`${entry.game}:${entry.id}`,entry])):null,bannerAsOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
  const newest=selectEntries(entries,{game:state.game,category:'characters',sort:'release',direction:'desc'}).slice(0,4);
  const featured=entries.find(e=>e.id===state.featured&&e.game===state.game);
  const bannerLayout=groupedBanners?bannerHistoryLayout(result):null;
  const automatic=true,base=groupedBanners?bannerLayout.base:state.category==='characters'||state.category==='materials'?5:state.category==='weapons'?(state.game==='starrail'?3:4):state.category==='sets'?4:2;
  const layoutKey=`wiki-layout-v3:${state.game}:${groupedBanners?bannerLayout.scope:state.category}`,setting=automatic?layoutSetting(layoutKey):'';
  const columns=automatic?(Number(setting)||base):Number(preference(`wiki-columns:${state.game}:${state.category}`,2));
  const supportsView=!['weapons','sets','banners'].includes(state.category),compact=supportsView&&view==='compact';
  content.innerHTML=`<div class="catalog-bar"><div class="catalog-title"><strong>${state.screen==='favorites'?'我的收藏':state.search?'搜索结果':state.category==='all'?'全部资料':escape(categoryLabel(state.game,state.category))}</strong>${state.category==='banners'?`<div class="view-control history-view"><button class="active">卡池记录</button><a href="/?game=${state.game}&category=banners&screen=banner-stats">UP 统计</a></div>`:''}</div><div class="catalog-actions">${supportsView?`<div class="view-control"><button data-action="view" data-view="cards" class="${view==='cards'?'active':''}">卡片</button><button data-action="view" data-view="compact" class="${view==='compact'?'active':''}">列表</button></div>`: ''}${button('new',icon('plus')+'新增条目')}</div></div><div class="workspace single-column catalog-workspace"><section><div class="panel ${compact?'compact':''}">
  ${facetsHTML()}
  <div class="result-meta"><span>共 <b>${result.length.toLocaleString('zh-CN')}</b> ${groupedBanners?'个卡池 · '+displayItems.length+' 组安排':'个条目'}${state.search?' · '+escape(state.search):''}</span><div class="sort-controls"><label for="columns">每行</label><select id="columns" class="sort-select" aria-label="${groupedBanners?'每行安排组数':'每行条目数'}" ${automatic?`data-layout-key="${layoutKey}"`:''}>${automatic?columnOptions(setting,groupedBanners?2:6):[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n===columns?'selected':''}>${n} 个</option>`).join('')}</select><label for="page-size">每页</label><select id="page-size" class="sort-select" aria-label="${groupedBanners?'每页安排组数':'每页条目数'}">${PAGE_SIZES.map(size=>`<option value="${size}" ${size===state.pageSize?'selected':''}>${size==='all'?'所有':size+(groupedBanners?' 组':' 个')}</option>`).join('')}</select><label for="sort">排序</label><select id="sort" class="sort-select" aria-label="排序依据">${sorts.map(key=>`<option value="${key}" ${state.sort===key?'selected':''}>${SORTS[key]}${['attack','hp','defense','speed'].includes(key)?'（最高等级）':''}</option>`).join('')}</select><button class="direction-button" data-action="direction" aria-label="切换排序方向">${state.direction==='desc'?(state.sort==='release'?'最新在前 ↓':'降序 ↓'):(state.sort==='release'?'最早在前 ↑':'升序 ↑')}</button></div></div>
  ${featured?`<div class="active-filters banner-featured-filter">包含：${escape(featured.name)} ${button('clear-featured','取消限定')}</div>`:''}
  ${['attack','hp','defense','speed'].includes(state.sort)?'<div class="date-note">按各条目最高等级的基础数值比较，详情页可查看等级与计算口径。</div>':''}
  <div class="${groupedBanners?'banner-history-grid':'characters'} configurable-grid" style="--columns:${columns}" data-columns="${columns}" ${automatic?gridLayout(layoutKey,base,{max:groupedBanners?2:6,minCell:groupedBanners?600:['weapons','sets'].includes(state.category)?260:190}):''}>${items.length?items.map(item=>groupedBanners?bannerPeriodHTML(item,{entries:bannerUnits,escape,href:entryHref,asOf:bannerAsOf}):card(item)).join(''):`<div class="empty"><strong>${state.screen==='favorites'&&!favorites.size?'还没有收藏':'没有匹配的条目'}</strong><p>${state.screen==='favorites'&&!favorites.size?'进入详情页，点击“收藏条目”。':'试试调整筛选条件或搜索词。'}</p>${button('reset-search','清空搜索与筛选')}</div>`}</div>
  <div class="pagination"><span>${displayItems.length?((state.page-1)*pageSize+1)+'–'+Math.min(state.page*pageSize,displayItems.length):'0'} / ${displayItems.length}${groupedBanners?' 组安排':''}</span><div class="pagination-buttons"><button class="page-button" data-action="page" data-page="${state.page-1}" ${state.page<=1?'disabled':''}>上一页</button><span>第 ${state.page} / ${pages} 页</span><button class="page-button" data-action="page" data-page="${state.page+1}" ${state.page>=pages?'disabled':''}>下一页</button></div></div></div></section>
  </div>${footer()}`;
}
function footer(){return `<footer class="page-footer"><span>Wiki · 本地资料库</span><a href="/?game=${state.game}&screen=manage">来源、收录范围与备份</a></footer>`;}
function section(id,title,body){return `<section id="${id}"><h2>${title}</h2>${body}</section>`;}
function skillTable(level){return level?.specs?.length?`<div class="data-table-wrap skill-stats"><table class="data-table"><tbody>${level.specs.map(row=>`<tr><th>${escape(row.name)}</th><td>${escape(row.value)}</td></tr>`).join('')}</tbody></table></div>`:'';}
function statsHTML(entry){const rows=entry.statsTable?.length?entry.statsTable:entry.stats&&Object.keys(entry.stats).length?[{level:entry.statsLevel??'—',...entry.stats}]:[];if(!rows.length)return '';
  const keys=['hp','attack','defense','speed','secondaryValue'].filter(k=>rows.some(r=>Number.isFinite(r[k]))),secondaryName=entry.details.facts?.副属性??entry.details.facts?.突破属性??'附加属性',labels={hp:'生命值',attack:'攻击力',defense:'防御力',speed:'速度',secondaryValue:secondaryName};
  const displayStat=(key,value)=>value===undefined?'—':key==='secondaryValue'?(secondaryName.includes('精通')?Math.round(value):`${Number((value*100).toFixed(1))}%`):value;
  return section('stats','基础属性',`<details class="stats-fold"><summary>展开基础属性与等级表</summary><div class="data-table-wrap"><table class="data-table"><thead><tr><th>等级</th>${keys.map(k=>`<th>${escape(labels[k])}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${escape(r.level)}</td>${keys.map(k=>`<td>${escape(displayStat(k,r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="table-note">${entry.category==='characters'?'不含装备、队伍或战斗增益；突破属性列仅显示突破增加的部分。':''}${entry.game==='zenless'&&entry.category==='characters'?'不含核心技强化。':''}升级属性根据公开成长数据计算，整数化供查阅；中间突破等级列突破前数值。</p></details>`);
}
function skillValues(skill,selected){return skillTable(skill.levels?.[selected])||`<p class="table-note">${escape(skill.levels?.[selected]?.description??'该天赋没有等级数值。')}</p>`;}
function coreStatsHTML(entry){
  const core=entry.details?.coreStats;if(entry.game!=='zenless'||entry.category!=='characters'||!core?.rows?.length)return '';
  const last=core.rows.at(-1),value=(n,p)=>escape(formatCoreValue(n,p.unit));
  return section('core-stats','核心技强化属性',`<details class="stats-fold core-stats-fold"><summary>展开 A–F 各级属性增益 <span class="core-stats-summary">F 级累计：${core.properties.map(p=>escape(p.name)+' '+value(last.values[p.id],p)).join(' · ')}</span></summary><div class="data-table-wrap"><table class="data-table core-stats-table"><thead><tr><th>核心技阶段</th><th>解锁等级</th>${core.properties.map(p=>`<th>${escape(p.name)}</th>`).join('')}</tr></thead><tbody>${core.rows.map(r=>`<tr><td>${escape(r.stage)}</td><td>Lv.${escape(r.requiredLevel)}</td>${core.properties.map(p=>`<td><b>${value(r.values[p.id],p)}</b>${r.level?`<small>本级 ${value(r.gains[p.id],p)}</small>`:''}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="table-note">各列为强化到该阶段后的累计属性增益；“本级”为相比上一阶段增加的数值。上方等级属性表未计入这些增益。基础能量自动回复以每秒为单位；属性增益与核心被动的技能效果分别展示。</p></details>`);
}
const detailLayoutKey=id=>`wiki-layout-v3:${currentEntry.game}:${id==='basic'&&currentEntry.category==='characters'?'character-basic':currentEntry.category+'-'+id}`;
const detailBase=id=>id==='basic'&&currentEntry.category==='characters'?4:2;
const detailColumns=id=>Number(layoutSetting(detailLayoutKey(id)))||detailBase(id);
function detailLayoutControl(id,title,{folds=false}={}){
  const columns=detailColumns(id);
  return `<div class="detail-layout-control"><label>每行 <select class="detail-columns" data-section="${id}" aria-label="${title}每行数量" data-layout-key="${detailLayoutKey(id)}">${columnOptions(layoutSetting(detailLayoutKey(id)),4)}</select></label>${folds?foldButtons(id,title):''}</div>`;
}
function basicHTML(facts){return section('basic','基础资料',detailLayoutControl('basic','基础资料')+`<div class="basic-table" style="--basic-columns:${detailColumns('basic')}" ${gridLayout(detailLayoutKey('basic'),detailBase('basic'),{max:4,reference:'basic',variable:'basic-columns',minCell:180})}>${facts.map(([label,value])=>`<div class="basic-field"><label>${escape(label)}</label><span>${escape(value)}</span></div>`).join('')}</div>`);}
function skillsHTML(skills,id,title,context=skills){
  if(!skills?.length)return '';
  return section(id,title,detailLayoutControl(id,title,{folds:true})+`<div class="skill-grid" style="--skill-columns:${detailColumns(id)}" ${gridLayout(detailLayoutKey(id),2,{max:4,minCell:260,reference:'basic',variable:'skill-columns'})}>${skills.map((s,i)=>{
    const defaultIndex=s.levels?.findIndex(l=>l.level===(s.type==='普攻'?6:10)),selected=defaultIndex>=0?defaultIndex:(s.levels?.length??0)-1;
    return `<details class="skill-card"><summary><span>${escape(s.name)}</span><span class="skill-type">${escape(s.type??'')}</span></summary><div class="skill-body"><div class="description-text">${skillDescriptionHTML(s.levels?.[selected]?.description??s.description,skillExplanations(context,s,s.levels?.[selected]?.level),escape)}</div><div class="skill-explanations">${skillTermsHTML(context,s,selected)}</div>${s.levels?.length?`<details class="skill-values"><summary>详细数值</summary><div class="skill-level-row"><label>等级 <select class="skill-level-select" data-skill="${i}" data-section="${id}" aria-label="${escape(s.name)}等级">${s.levels.map((l,j)=>`<option value="${j}" ${j===selected?'selected':''}>${escape(l.level)}</option>`).join('')}</select></label></div><div class="skill-value-output">${skillValues(s,selected)}</div></details>`:''}</div></details>`;
  }).join('')}</div>`);
}
function skillTermsHTML(skills,skill,selected){
  const terms=skillExplanations(skills,skill,skill.levels?.[selected]?.level);
  return terms.length?`<details class="skill-terms"><summary>名词解释 <small>${terms.length} 项</small></summary><div class="skill-term-list">${terms.map(term=>`<details class="skill-term" data-term-name="${escape(term.name)}"><summary>${escape(term.name)}</summary><p class="description-text">${skillDescriptionHTML(term.description,terms.filter(t=>t.name!==term.name),escape)}</p>${term.skill!==skill.name?`<small class="term-origin">参照：${escape(term.skill)}</small>`:''}</details>`).join('')}</div></details>`:'';
}
function effectsHTML(entry){const effects=entry.details?.effects;if(!effects?.length)return '';const ranks=effects.filter(e=>e.rank);return section('effects',entry.category==='sets'?'套装效果':'装备效果',ranks.length?`<div class="skill-level-row"><label>${entry.game==='starrail'?'叠影':entry.game==='zenless'?'星级':'精炼'} <select id="effect-rank" aria-label="装备效果等级">${ranks.map((r,i)=>`<option value="${i}">${r.rank}</option>`).join('')}</select></label></div><div id="selected-effect" class="effect-box"><h3>${escape(ranks[0].name)}</h3><p>${escape(ranks[0].description)}</p></div>`:effects.map(e=>`<div class="effect-box"><h3>${escape(e.name)}</h3><p>${escape(e.description)}</p></div>`).join(''));}
function materialsHTML(entry){const groups=entry.details?.materials;if(!groups?.length)return '';return section('materials',entry.category==='characters'?'突破 / 晋阶材料':'升级材料',groups.map(g=>`<div class="materials-stage"><h3>${escape(g.name)}</h3><div class="materials-grid">${g.items.map(item=>{const e=entries.find(e=>e.id===item.id);return `<${e?'a':'span'} class="material-pill" ${e?`href="/?game=${e.game}&entry=${e.id}"`:''}>${e?.image?`<img src="${escape(e.image)}" alt="" loading="lazy">`:''}<span>${escape(item.name)}</span><b>×${escape(item.count)}</b></${e?'a':'span'}>`;}).join('')}</div></div>`).join(''));}
function signatureHTML(entry){if(entry.category!=='weapons')return '';const characters=(entry.signatureIds??[]).map(id=>entries.find(e=>e.id===id&&e.category==='characters'&&e.game===entry.game)).filter(Boolean);if(!characters.length)return '';return section('signature','专武对应角色',`<div class="signature-grid">${characters.map(e=>`<a class="signature-card" href="/?game=${e.game}&entry=${e.id}">${e.image?`<img src="${escape(e.image)}" alt="">`:''}<span>${escape(e.name)}</span></a>`).join('')}</div>${entry.signatureNote?`<p class="table-note">${escape(entry.signatureNote)}</p>`:''}`);}
function sourceName(source){if(source.name)return source.name;try{return new URL(source.url).hostname;}catch{return '资料来源';}}
function sourceEntriesHTML(items){return items.map(entry=>`<details class="entry-source-card"><summary>${escape(entry.name)}<small>${escape(categoryLabel(entry.game,entry.category))}</small></summary><ul class="source-list">${(entry.sources??[]).filter(s=>/^https?:\/\//i.test(s.url)).map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer" title="${escape(s.url)}">${escape(sourceName(s))} ↗</a>${s.note?`<small>${escape(s.note)}</small>`:''}</li>`).join('')}</ul><p class="source-results-note">收录 ${escape(entry.fetchedAt?.slice(0,10)??'未标注')}</p></details>`).join('');}
function renderSourceResults(term=''){
  const matches=entries.filter(entry=>entry.game===state.game&&entry.sources?.length&&(!term||entry.name.includes(term)||entry.aliases?.some(a=>a.includes(term))));
  $('#entry-source-results').innerHTML=sourceEntriesHTML(matches.slice(0,12))||'<p class="source-results-note">没有匹配的条目来源。</p>';
  $('#entry-source-count').textContent=`共 ${matches.length} 个条目，最多显示12个；输入名称缩小范围。`;
}
function historyHTML(entry){if(!['characters','weapons'].includes(entry.category))return '';const stats=buildBannerStatistics(entries,entry.game).rows.find(r=>r.entry.id===entry.id);return stats?.history.length?section('banner-history','卡池记录',`<div class="entry-up-counts"><span>UP <b>${stats.upCount}</b> 期 / ${stats.upPoolCount} 个池</span><span>可选目标 ${stats.selectableCount} 期</span></div><p><a href="/?game=${entry.game}&category=banners&screen=banner-stats&unit=${entry.id}">查看次数、间隔、版本与池子明细 ↗</a></p><p><a href="/?game=${entry.game}&category=banners&featured=${entry.id}">查看包含 ${escape(entry.name)} 的 ${stats.history.length} 条卡池记录 ↗</a></p>`):'';}
function bannerHTML(entry){if(!entry.banner)return '';const b=entry.banner;return section('banner-period','卡池时间',`${b.schedule?`<p><span class="banner-schedule" title="${escape(b.schedule.basis)}">${escape(b.schedule.label)}</span></p>`:''}<p>${escape(b.start)}${b.end?' ～ '+escape(b.end):'起，持续开放'}（${escape(b.timeZone)}）</p><p class="table-note">${escape(b.note??'记录当期提升概率或可选择的角色与装备；普通卡池内容以当期游戏公告为准。')}</p>`)+section('banner-pool','卡池内容',bannerGroups(entry)+pairedBannerHTML(entry));}
function materialUsageDetail(entry,usage){return section('material-usage','材料用途反查',applicabilityHTML(entry)+materialUsageHTML(entry,usage,escape));}
async function renderDetail(){
  const generation=++detailGeneration;content.innerHTML='<div class="loading"><span class="loading-mark">✦</span><p>正在读取条目…</p></div>';
  try{
    const stored=await supplementCharacter(await api(`entries/${encodeURIComponent(state.entryId)}`));if(generation!==detailGeneration||state.screen!=='detail')return;currentEntry=stored;updateSummary(stored);const scheduled={...stored,banner:stored.banner?{...stored.banner,schedule:entries.find(e=>e.id===stored.id)?.banner?.schedule}:undefined};const entry=detailEntry(scheduled,state.travelerElement);
    const usage=entry.category==='materials'?await api(`material-usage/${encodeURIComponent(entry.id)}`).catch(error=>({error:error.message})):null;
    const materialInfo=entry.category==='characters'?await api(`character-materials/${encodeURIComponent(entry.id)}?element=${encodeURIComponent(state.travelerElement)}`).catch(error=>({groups:characterMaterialGroups(entry,{},state.travelerElement,id=>entries.find(item=>item.id===id)),error:error.message})):null;
    if(generation!==detailGeneration||state.screen!=='detail')return;
    const details=entry.details??{},isBanner=entry.category==='banners';const facts=[['所属游戏',GAMES[entry.game].name],['资料类别',categoryLabel(entry.game,entry.category)],['稀有度',rarityLabel(entry)],...(entry.element?[['属性',entry.element]]:[]),...(entry.type?[[facetLabel('type',entry.game,entry.category),entry.type]]:[]),...(entry.region?[[facetLabel('region',entry.game,entry.category),entry.region]]:[]),...(entry.kind?[['分类',entry.kind]]:[]),...Object.entries(details.facts??{}).filter(([,v])=>v!==null&&v!==undefined&&v!=='')];
    const context=[...(details.skills??[]),...(details.upgrades??[])];
    const artwork=artworkHTML(entry);
    const acquisition=entry.category==='materials'?section('acquisition','获取途径',materialAcquisitionHTML(entry,usage?.acquisition,escape)):details.acquisition?.length?section('acquisition','获取途径',details.acquisition.map(t=>`<p>${escape(t)}</p>`).join('')):'';
    const body=travelerHTML(entry)+(isBanner?section('basic','卡池类型',`<p>${escape(entry.type||details.facts?.['卡池类型'])}</p>`):basicHTML(facts))+bannerHTML(entry)+statsHTML(entry)+coreStatsHTML(entry)+skillsHTML(details.skills,'skills','技能资料',context)+skillsHTML(details.upgrades,'upgrades',entry.game==='genshin'?'命之座':entry.game==='starrail'?'星魂':'影画',context)+effectsHTML(entry)+(entry.category==='weapons'?materialsHTML(entry):'')+(entry.game==='genshin'&&entry.category==='characters'?section('training','养成与评估',`<a class="training-link" href="/?game=genshin&screen=assessment&character=${encodeURIComponent(entry.id)}">在养成与评估中查看角色方案 ↗</a>`):'')+(details.parts?.length?section('parts','套装部件',setPartsHTML(details.parts,escape)):'')+(materialInfo?section('materials','养成材料',characterMaterialsHTML(materialInfo.groups,escape)+(materialInfo.error?'<p class="table-note">完整养成材料暂时无法读取，请重新启动 Wiki 后刷新。</p>':'')):'')+acquisition+(entry.category==='materials'?materialUsageDetail(entry,usage):'')+signatureHTML(entry)+historyHTML(entry);
    const saveLabel=()=>icon('pin')+(favorites.has(entry.id)?'已收藏':'收藏条目');
    content.innerHTML=`<button class="detail-back" data-action="back">${icon('back')}返回资料列表</button><div class="detail-layout"><article class="panel article"><div class="article-head ${artwork?'article-head-with-artwork':''}">${isBanner?'':`<div class="detail-visual ${rarityClass(entry)}" style="${tile(entry.game)}">${entryImage(entry,true)}${elementBadge(entry)}</div>`}<div class="article-title"><h1>${escape(entry.name)}</h1>${details.title?`<div class="detail-subtitle">${escape(details.title)}</div>`:''}${isBanner?'':`<div class="meta"><span>${escape(categoryLabel(entry.game,entry.category))}</span><span>${escape(rarityLabel(entry))}</span>${entry.element?`<span>${escape(entry.element)}</span>`:''}</div>`}</div>${artwork}</div>${entry.category==='materials'?((entry.releaseVersion||entry.releaseDate)?`<div class="release-strip">${entry.releaseVersion?`<span><b>实装版本</b> ${escape(entry.releaseVersion)}</span>`:''}${entry.releaseDate?`<span><b>实装日期</b> ${escape(entry.releaseDate)}</span>`:''}</div>`:''):`<div class="release-strip"><span><b>实装版本</b> ${escape(entry.releaseVersion??'待确认')}</span><span><b>实装日期</b> ${escape(entry.releaseDate??'待确认')}</span></div>`}${details.summary?`<p class="detail-summary">${escape(details.summary)}</p>`:''}${body}</article><aside class="detail-aside"><div class="panel aside-panel toc"><h3>页面目录</h3>${[...body.matchAll(/<section id="([^"]+)"><h2>([^<]+)<\/h2>/g)].map(([,id,title])=>`<a href="#${id}">${title}</a>`).join('')}<hr class="aside-divider">${button('favorite',saveLabel(),`data-id="${entry.id}" aria-pressed="${favorites.has(entry.id)}"`)}${button('edit','编辑条目',`data-id="${entry.id}"`)}</div></aside></div>${footer()}`;
    if(entry.releaseDateBasis){const note=document.createElement('div');note.className='date-basis';note.textContent=entry.releaseDateBasis;content.querySelector('.release-strip').after(note);}
    updateChrome();
  }catch(error){if(generation!==detailGeneration)return;content.innerHTML=`<div class="panel empty"><strong>无法打开条目</strong><p>${escape(error.message)}</p>${button('back','返回资料列表')}</div>`;}
}
function renderManage(){
  const coreCount=counts.filter(e=>['characters','weapons','sets'].includes(e.category)).reduce((n,e)=>n+e.count,0),known=counts.filter(e=>['characters','weapons','sets'].includes(e.category)).reduce((n,e)=>n+e.dated,0);
  content.innerHTML=`<div class="heading"><div><div class="eyebrow">LOCAL LIBRARY</div><h1>资料与备份</h1><p>本机保存、手动维护，后续按需要扩展。</p></div></div><div class="manage-grid"><div class="panel manage-card"><h2>备份资料</h2><p>包含条目内容、实装信息、收藏和养成计划。图片与原始来源资料保留在工作区。</p><div class="heading-actions">${button('backup','保存备份到工作区')}${button('export','导出 JSON')}</div><small id="backup-result">备份目录：${backupFolder}</small></div><div class="panel manage-card"><h2>导入资料</h2><p>先预览导入内容，再添加新条目。已有编号会跳过，不会覆盖本地修改。</p><div class="heading-actions">${button('import','选择备份文件')}${button('new',icon('plus')+'新增条目')}</div><small>支持 .json 和 .json.gz 备份，也可导入符合条目结构的数据。</small></div></div><div id="import-preview"></div>
  <section class="panel manage-section"><h2>本地资料范围</h2><div class="data-table-wrap"><table class="data-table"><thead><tr><th>游戏</th>${Object.values(CATEGORIES).map(v=>`<th>${escape(v)}</th>`).join('')}<th>合计</th></tr></thead><tbody>${Object.entries(GAMES).map(([g,info])=>`<tr><td>${info.name}</td>${Object.keys(CATEGORIES).map(c=>`<td>${countFor(g,c)}</td>`).join('')}<td>${countFor(g)}</td></tr>`).join('')}</tbody></table></div><p class="source-warning">角色与装备共 ${coreCount} 条，其中 ${known} 条有已收录的实装日期。版本与日期按条目已录入的内容展示，空缺可在资料核查中查看。历史卡池记录与获取渠道保留独立来源快照。材料资料保留获取途径与用途关联，角色详情按用途展示养成材料种类。</p><p>版本档案覆盖历史版本目录，记录剧情、地图、玩法、活动与系统变化，按档案显示来源范围和待补齐项。</p><p>内容包括基础属性、技能、命之座 / 星魂 / 影画、装备与套装效果、角色养成材料、获取渠道和历史卡池。</p></section>
  <section class="panel manage-section"><h2>资料与图片分类保存</h2><div class="storage-grid">${[['data/library','SQLite 条目、收藏与养成计划'],['data/catalog','首次初始化用分类目录'],['data/versions','版本档案、日期依据与关联索引'],['data/sources','来源快照与采集记录'],['assets','按游戏、分类保存的图片'],['data/backups','带时间戳的 JSON 备份'],['public / shared / lib','界面、筛选规则与本地服务']].map(([p,t])=>`<div class="storage-box"><code>${p}</code><span>${t}</span></div>`).join('')}</div><p>工作区：${workspacePath}。只需启动本地服务即可查阅，已保存的资料与图片支持离线使用。</p></section>
  <section class="panel manage-section"><h2>参考与资料来源</h2><ul class="source-list source-compact">${Object.values(GAMES).map(info=>`<li><a href="${info.official}" target="_blank" rel="noopener noreferrer">${info.name} · 官方百科入口 ↗</a></li>`).join('')}<li><a href="https://wiki.biligame.com/ys/武器图鉴" target="_blank" rel="noopener noreferrer">BWIKI · 原神武器图鉴 ↗</a></li><li><a href="https://wiki.biligame.com/sr/光锥图鉴" target="_blank" rel="noopener noreferrer">BWIKI · 星穹铁道光锥图鉴 ↗</a></li><li><a href="https://wiki.biligame.com/zzz/角色筛选" target="_blank" rel="noopener noreferrer">BWIKI · 绝区零角色筛选 ↗</a></li>${Object.entries(sourceManifest?.repositories??{}).map(([name,repo])=>`<li><a href="${escape(repo.url)}" target="_blank" rel="noopener noreferrer">${escape(name.split('/').at(-1))} ↗</a><small>固定快照 ${escape(repo.date?.slice(0,10))} · ${escape(repo.commit?.slice(0,8))}</small></li>`).join('')}<li><a href="https://static.nanoka.cc/manifest.json" target="_blank" rel="noopener noreferrer">Nanoka · 正式版目录 ↗</a><small>只使用 live 资料；原始采集记录位于 data/sources。</small></li></ul><p class="source-warning">官方入口用于参考资料结构，BWIKI 提供社区整理的实装记录，公开资源快照提供名称、成长属性和技能数据。各条目保留对应来源，游戏内容权利归原权利方。</p><details class="entry-source-browser"><summary>查看当前游戏条目来源</summary><label class="entry-source-search">搜索条目 <input id="entry-source-search" type="search" placeholder="输入角色、装备或材料名称" aria-label="搜索条目来源"></label><div id="entry-source-results" class="entry-source-results"></div><p id="entry-source-count" class="source-results-note"></p></details></section><section class="panel manage-section" id="version-sources"><h2>版本档案来源</h2><details class="entry-source-browser"><summary>查看当前游戏版本资料与快照</summary><div id="version-source-results"></div></details></section>${footer()}`;
  mountVersionSources($('#version-source-results'),state.game);
  renderSourceResults();
  void import('./manage-tools.mjs').then(m=>{if(state.screen==='manage')m.mountManageTools({host:content,api,toast,onRestored:async()=>{await refreshCatalog();render();}});}).catch(error=>toast(error.message));
  if(pendingImport)showImportPreview(pendingImport.preview);
}
async function render({position}={}){
  const targetPosition=pageMemory.begin(location.href,{game:state.game,position}),generation=++renderGeneration;
  contentMinimum??=content.style.minHeight;content.style.minHeight=content.getBoundingClientRect().height+'px';
  disposeAssessment();disposeHome();disposeHome=()=>{};updateChrome();
  try{
    if(state.screen!=='home'){if(!loadedGames.has(state.game))content.innerHTML='<div class="panel loading">正在加载游戏资料…</div>';await loadGame(state.game);}
    if(generation!==renderGeneration)return;updateChrome();
    if(state.screen==='detail')return await renderDetail();
    detailGeneration++;currentEntry=null;
    if(state.screen==='home')renderHome();
    else if(state.screen==='search')await mountUnifiedSearch({host:content,game:state.game,gameName:GAMES[state.game].name,entries,query:state.search,type:state.searchType,scope:state.searchScope,sort:state.searchSort,direction:state.searchDirection,loadCatalog:loadSearchCatalog,loadVersions:loadVersionArchive,loadArtwork:loadArtworkIndex,renderEntry:card,renderVersion:versionCardHTML,renderArtwork:galleryCards,switchArtwork:switchGalleryCard,renderBanner:searchBannerHTML,rememberCards:rememberSearchCards,onChange:updateSearchState,footer:footer()});
    else if(state.screen==='versions')await mountVersionArchives({host:content,game:state.game,gameName:GAMES[state.game].name,entries,state:{...state},navigate,footer:footer()});
    else if(state.screen==='artwork')await mountArtworkGallery({host:content,game:state.game,gameName:GAMES[state.game].name,entries,search:state.search,filters:state.filters,escape,footer:footer(),artworkId:new URLSearchParams(location.search).get('artwork'),variantKey:new URLSearchParams(location.search).get('variant')});
    else if(state.screen==='manage')renderManage();
    else if(state.screen==='banner-stats')await mountBannerStats({host:content,game:state.game,entries,escape,search:state.search});
    else if(state.screen==='assessment')await mountAssessment({host:content,api,toast,wikiEntries:entries,characterId:new URLSearchParams(location.search).get('character'),isActive:()=>state.screen==='assessment'&&state.game==='genshin'});
    else renderList();
  }catch(error){if(generation===renderGeneration)content.innerHTML=`<div class="panel empty"><strong>资料暂时无法加载</strong><p>${escape(error.message)}</p>${button('retry-load','重试加载')}</div>`;}
  finally{if(generation===renderGeneration){content.style.minHeight=contentMinimum??'';contentMinimum=null;await pageMemory.restore(targetPosition,()=>generation===renderGeneration);}}
}

function field(label,name,value='',type='text',full=false){return `<label class="form-field ${full?'full':''}"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${name==='name'?'required maxlength="120"':''}></label>`;}
function selectField(label,name,options,value){return `<label class="form-field"><span>${label}</span><select name="${name}">${options.map(([key,text])=>`<option value="${escape(key)}" ${String(value)===String(key)?'selected':''}>${escape(text)}</option>`).join('')}</select></label>`;}
async function openEditor(id){
  const request=++editorGeneration,pageGeneration=renderGeneration;
  try{const entry=id?await api(`entries/${id}`):null;if(request!==editorGeneration||pageGeneration!==renderGeneration)return;editorEntry=entry;const e=editorEntry??{game:state.game==='all'?'genshin':state.game,category:state.category==='all'?'characters':state.category,details:{}};
    dialog.innerHTML=`<form id="editor-form"><div class="dialog-header"><h2 id="editor-title">${id?'编辑条目':'新增条目'}</h2><button type="button" data-action="close-editor" aria-label="关闭编辑">×</button></div><div class="dialog-body"><div class="editor-grid">${field('名称','name',e.name)}${selectField('游戏','game',Object.entries(GAMES).map(([k,v])=>[k,v.name]),e.game)}${selectField('资料类别','category',Object.entries(CATEGORIES),e.category)}${selectField('稀有度 / 等级','rarity',[['','未标注'],['5','5 星 / S 级'],['4','4 星 / A 级'],['3','3 星 / B 级'],['2','2 星'],['1','1 星']],e.rarity??'')}${field('元素 / 属性','element',e.element)}${field('武器类型 / 命途 / 特性','type',e.type)}${field('地区 / 阵营','region',e.region)}${field('分类','kind',e.kind)}${field('实装版本','releaseVersion',e.releaseVersion)}${field('实装日期','releaseDate',e.releaseDate,'date')}${field('副属性（用逗号分隔）','secondary',e.secondary?.join('，'))}${field('别名（用逗号分隔）','aliases',e.aliases?.join('，'))}<label class="form-field full"><span>简介</span><textarea name="summary" rows="3">${escape(e.details?.summary??'')}</textarea></label><label class="form-field full"><span>获取渠道（每行一项）</span><textarea name="acquisition" rows="3">${escape((e.details?.acquisition??[]).join('\n'))}</textarea></label><label class="form-field full"><span>资料来源（每行：来源名称 | 链接）</span><textarea name="sources" rows="3">${escape((e.sources??[]).map(s=>`${s.name??'资料来源'} | ${s.url}`).join('\n'))}</textarea></label></div><p class="form-help">未知的版本与日期可以留空。保存后立即写入本地数据库。</p><details class="editor-advanced"><summary>详细资料与专武关系</summary><label class="form-field full"><span>详情 JSON（技能、套装效果、突破材料等）</span><textarea class="json-field" name="details" rows="10" spellcheck="false">${escape(JSON.stringify(e.details??{},null,2))}</textarea></label><label class="form-field full"><span>专武对应角色编号（用逗号分隔；仅武器类生效）</span><input name="signatureIds" value="${escape(e.signatureIds?.join(',')??'')}"></label><p class="form-help">不填则不显示专武对应角色模块。角色编号可在条目页面地址中找到。</p><label class="form-field full banner-editor" ${e.category!=='banners'?'hidden':''}><span>卡池记录 JSON（起止时间与当期条目）</span><textarea class="json-field" name="banner" rows="8">${escape(JSON.stringify(e.banner??{start:e.releaseDate?e.releaseDate+' 10:00:00':'',end:null,timeZone:'服务器时间',groups:[]},null,2))}</textarea></label></details><p class="form-error" id="editor-error" role="alert"></p></div><div class="dialog-footer"><button type="button" class="button-secondary" data-action="close-editor">取消</button><button class="button-primary" type="submit">保存条目</button></div></form>`;
    dialog.showModal();editorInitial=JSON.stringify([...new FormData($('#editor-form'))]);focusNameInput(dialog.querySelector('[name=name]'));
  }catch(error){if(request===editorGeneration&&pageGeneration===renderGeneration)toast(error.message);}
}
function closeEditor(){const form=$('#editor-form');if(form&&JSON.stringify([...new FormData(form)])!==editorInitial&&!confirm('尚有未保存的修改，确定关闭编辑吗？'))return;++editorGeneration;dialog.close();}
dialog.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
dialog.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,save=form.querySelector('[type=submit]');save.disabled=true;$('#editor-error').textContent='';
  try{const f=Object.fromEntries(new FormData(form)),details=JSON.parse(f.details||'{}');if(!details||typeof details!=='object'||Array.isArray(details))throw new Error('详情 JSON 须为对象。');
    const initial=editorEntry?.details??{},summaryChanged=f.summary!==(initial.summary??'');if(summaryChanged||!editorEntry)details.summary=f.summary.trim();
    if(f.acquisition!==(initial.acquisition??[]).join('\n')||!editorEntry)details.acquisition=f.acquisition.split('\n').map(v=>v.trim()).filter(Boolean);
    const split=value=>value.split(/[，,]/).map(v=>v.trim()).filter(Boolean);
    const sources=f.sources.split('\n').filter(v=>v.trim()).map(line=>{const index=line.indexOf('|'),url=(index<0?line:line.slice(index+1)).trim(),name=index<0?'资料来源':line.slice(0,index).trim();return{...(editorEntry?.sources??[]).find(source=>source.url===url),name,url};});
    const signatureIds=f.category==='weapons'?split(f.signatureIds):[];for(const id of signatureIds){const char=entries.find(e=>e.id===id&&e.category==='characters'&&e.game===f.game);if(!char)throw new Error(`专武角色编号不存在或游戏不匹配：${id}`);}
    const payload={...(editorEntry??{}),game:f.game,category:f.category,name:f.name.trim(),rarity:f.rarity?Number(f.rarity):null,element:f.element.trim()||null,type:f.type.trim()||null,region:f.region.trim()||null,kind:f.kind.trim()||null,releaseVersion:f.releaseVersion.trim()||null,releaseDate:f.releaseDate||null,secondary:split(f.secondary),aliases:split(f.aliases),sources,details,signatureIds,origin:editorEntry?'edited':'local'};
    if(f.category==='banners'){payload.banner=JSON.parse(f.banner);for(const g of payload.banner.groups??[])for(const item of g.items??[])if(item.id&&!entries.some(e=>e.id===item.id&&e.game===f.game))throw new Error('卡池关联条目不存在或游戏不匹配：'+item.id);}else delete payload.banner;
    if(editorEntry&&(f.game!==editorEntry.game||f.category!==editorEntry.category)){delete payload.image;delete payload.imageRemote;delete payload.stats;delete payload.statsTable;delete payload.statsLevel;}
    const result=editorEntry?await api(`entries/${editorEntry.id}`,{method:'PATCH',body:{entry:payload,revision:editorEntry.revision}}):await api('entries',{method:'POST',body:payload});
    updateSummary(result);const boot=await api('bootstrap');counts=boot.counts??counts;dialog.close();toast('条目已保存到本地');navigate({game:result.game,screen:'detail',entryId:result.id});
  }catch(error){$('#editor-error').textContent=error.message;}finally{save.disabled=false;}
});
function showImportPreview(preview){const host=$('#import-preview');if(!host)return;host.innerHTML=`<section class="panel manage-section"><h2>导入预览</h2><div class="import-summary"><span>新增 <b>${preview.additions.length}</b></span><span>已有编号 <b>${preview.conflicts.length}</b>（跳过）</span><span>无效 <b>${preview.errors.length}</b></span>${preview.excluded?.length?`<span>不收录 <b>${preview.excluded.length}</b>（邦布，跳过）</span>`:''}</div>${preview.errors.length?`<ul class="import-items">${preview.errors.slice(0,8).map(e=>`<li>第 ${e.index+1} 条：${escape(e.message)}</li>`).join('')}</ul>`:''}${preview.additions.length?`<ul class="import-items">${preview.additions.slice(0,8).map(e=>`<li>${escape(e.name)} · ${GAMES[e.game].short}</li>`).join('')}${preview.additions.length>8?'<li>…</li>':''}</ul>`:''}<div class="heading-actions">${button('confirm-import','确认添加新条目',preview.errors.length?'disabled':'')}${button('cancel-import','取消')}</div></section>`;}
$('#import-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const payload=await parseBackupFile(file);const preview=await api('import/preview',{method:'POST',body:payload});pendingImport={payload,preview};if(state.screen!=='manage')navigate({screen:'manage',entryId:null});else showImportPreview(preview);}catch(error){toast(error.message);}finally{event.target.value='';}});
async function loadSearchCatalog(game){await loadGame(game);return entries.filter(entry=>entry.game===game);}
function rememberSearchCards(){content.querySelectorAll('.equipment-card .weapon-passive').forEach(detail=>listDisclosures.remember(detail.closest('[data-entry-id]').dataset.entryId,detail.open));listDisclosures.selectScope('search:'+(state.searchScope==='all'?'all':state.game));}
function searchBannerHTML(period,gameEntries){return bannerPeriodHTML(period,{entries:new Map(gameEntries.map(entry=>[entry.game+':'+entry.id,entry])),escape,href:entryHref,asOf:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})});}
function updateSearchState(patch){Object.assign(state,patch);history.replaceState(history.state,'',urlFor());pageMemory.retarget(location.href);}
function submitSearch(value){navigate({screen:'search',search:value,entryId:null,searchType:state.screen==='search'?state.searchType:'all'},{replace:state.screen==='search',scroll:false});}
searchInput=bindSearchInput(search,submitSearch);
for(const button of document.querySelectorAll('[data-search-scope]'))button.addEventListener('click',()=>{
 if(button.disabled)return;searchInput.cancel();
 if(state.searchScope===button.dataset.searchScope)return;
 navigate({searchScope:button.dataset.searchScope,screen:'search',searchType:'all',entryId:null,search:search.value},{replace:state.screen==='search',scroll:false});search.focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();search.select();}});
document.addEventListener('change',event=>{
  if(event.target.name==='category'&&event.target.closest('#editor-form'))dialog.querySelector('.banner-editor').hidden=event.target.value!=='banners';
  if(event.target.id==='columns'&&!event.target.dataset.layoutKey){savePreference(`wiki-columns:${state.game}:${state.category}`,event.target.value);renderList();}
  if(event.target.matches('.detail-columns')&&currentEntry&&!event.target.dataset.layoutKey){const id=event.target.dataset.section;savePreference(`wiki-detail-columns-v2:${currentEntry.game}:${id}`,event.target.value);const grid=event.target.closest('section').querySelector(id==='basic'?'.basic-table':'.skill-grid');grid.style.setProperty(id==='basic'?'--basic-columns':'--skill-columns',event.target.value);}
  if(event.target.id==='page-size'){const size=normalizePageSize(event.target.value);savePreference(`wiki-page-size-v2:${state.game}:${state.category}`,size);navigate({pageSize:size,page:1},{scroll:false});}
  if(event.target.matches('.list-effect-rank')){const entry=entries.find(e=>e.id===event.target.dataset.id);const effect=entry?.listEffects?.filter(e=>e.rank)[Number(event.target.value)];event.target.closest('.passive-body').querySelector('.list-selected-effect').innerHTML=effectBody(effect);}
  if(event.target.id==='sort')navigate({sort:event.target.value,direction:event.target.value==='name'?'asc':'desc',page:1},{scroll:false});
  if(event.target.id==='effect-rank'&&currentEntry){const effect=currentEntry.details.effects.filter(e=>e.rank)[Number(event.target.value)];$('#selected-effect').innerHTML=`<h3>${escape(effect.name)}</h3><p>${escape(effect.description)}</p>`;}
  if(event.target.matches('.skill-level-select')&&currentEntry){const group=event.target.dataset.section==='skills'?'skills':'upgrades',details=detailEntry(currentEntry,state.travelerElement).details,context=[...(details.skills??[]),...(details.upgrades??[])];const skill=details[group][Number(event.target.dataset.skill)],level=skill.levels[Number(event.target.value)],body=event.target.closest('.skill-body');body.querySelector('.description-text').innerHTML=skillDescriptionHTML(level.description,skillExplanations(context,skill,level.level),escape);body.querySelector('.skill-explanations').innerHTML=skillTermsHTML(context,skill,Number(event.target.value));body.querySelector('.skill-value-output').innerHTML=skillValues(skill,Number(event.target.value));}
});
document.addEventListener('click',async event=>{
  const reference=event.target.closest('[data-skill-term]');
  if(reference){const body=reference.closest('.skill-body'),term=[...body.querySelectorAll('.skill-term')].find(t=>t.dataset.termName===reference.dataset.skillTerm);if(term){body.querySelector('.skill-terms').open=true;term.open=true;term.scrollIntoView({block:'nearest'});}return;}
  const link=event.target.closest('a');
  if(link?.closest('.toc')&&link.hash&&!link.closest('.version-archive-root')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){const section=document.getElementById(link.hash.slice(1));if(section){event.preventDefault();history.replaceState(history.state,'',link.href);section.scrollIntoView({block:'start'});return;}}
  if(link&&link.origin===location.origin&&link.pathname==='/'&&!link.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();const next=new URL(link.href);const listUrl=next.searchParams.has('entry')?(state.screen==='detail'?history.state?.listUrl:location.pathname+location.search):null;openPage(link.href,{resume:!!link.closest('#sidebar'),historyData:listUrl?{listUrl}:{}});return;}
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const a=target.dataset.action;
  try{
    if(a==='game')navigate({game:target.dataset.game,searchScope:'current',category:state.category==='all'?'characters':state.category,screen:['favorites','manage','banner-stats','artwork','versions','search'].includes(state.screen)?state.screen:'list',entryId:null,filters:{},search:state.screen==='search'?state.search:'',featured:null,page:1,archiveVersion:null,archiveMajor:'',archiveSection:'',since:'',until:''},{resume:true});
    else if(a==='traveler-element'){navigate({travelerElement:target.dataset.element},{scroll:false});}
    else if(a==='facet'){const key=target.dataset.key,value=target.dataset.value;navigate({filters:toggleFacet(state.filters,key,value),page:1},{scroll:false});}
    else if(a==='facet-clear')navigate({filters:toggleFacet(state.filters,target.dataset.key,null,true),page:1},{scroll:false});
    else if(a==='facet-expand'){expandedFacets.has(target.dataset.key)?expandedFacets.delete(target.dataset.key):expandedFacets.add(target.dataset.key);renderList();}
    else if(a==='reset-filters')navigate({filters:{},page:1},{scroll:false});
    else if(a==='reset-search')navigate({filters:{},search:'',page:1},{scroll:false});
    else if(a==='clear-featured')navigate({featured:null,page:1},{scroll:false});
    else if(a==='category')navigate({category:target.dataset.category,filters:{},featured:null,page:1},{resume:true});
    else if(a==='direction')navigate({direction:state.direction==='desc'?'asc':'desc',page:1},{scroll:false});
    else if(a==='page')navigate({page:Number(target.dataset.page)});
    else if(a==='view'){view=target.dataset.view;try{localStorage.setItem('wiki-view',view);}catch{}renderList();}
    else if(a==='retry-load')render();
    else if(a==='new')await openEditor();
    else if(a==='edit')await openEditor(target.dataset.id);
    else if(a==='close-editor')closeEditor();
    else if(a==='back'){if(history.state?.listUrl)openPage(history.state.listUrl);else navigate({screen:'list',game:currentEntry?.game??state.game,entryId:null,category:currentEntry?.category??'characters',filters:{},page:1},{resume:true});}
    else if(a==='favorite'){target.disabled=true;const wanted=!favorites.has(target.dataset.id);const result=await api(`favorites/${target.dataset.id}`,{method:'POST',body:{favorite:wanted}});favorites=new Set(result.favorites);updateChrome();document.querySelectorAll('[data-action=favorite]').forEach(b=>{b.innerHTML=icon('pin')+(favorites.has(b.dataset.id)?'已收藏':'收藏条目');b.setAttribute('aria-pressed',favorites.has(b.dataset.id));});toast(wanted?'已加入本地收藏':'已取消收藏');}
    else if(a==='backup'){target.disabled=true;const result=await api('backup',{method:'POST'});$('#backup-result').textContent=`已保存：${result.path}`;toast('备份已保存到工作区');}
    else if(a==='export'){const data=await api('export'),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`wiki-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出条目与收藏');}
    else if(a==='import')$('#import-file').click();
    else if(a==='cancel-import'){pendingImport=null;$('#import-preview').innerHTML='';}
    else if(a==='confirm-import'&&pendingImport){target.disabled=true;const result=await api('import',{method:'POST',body:pendingImport.payload});pendingImport=null;await refreshCatalog();render();toast(`已添加 ${result.added} 条，已有 ${result.skipped} 条保持原样${result.excluded?`，排除 ${result.excluded} 条邦布资料`:''}`);}
  }catch(error){toast(error.message);}finally{if(target.isConnected)target.disabled=false;}
});
$('#sidebar-toggle').addEventListener('click',()=>{if(state.screen==='home')homeSidebarOpen=!homeSidebarOpen;else sidebarMode=sidebarMode==='hidden'?sidebarWidth:'hidden';applySidebarMode();});
$('#sidebar-width-toggle').addEventListener('click',()=>{sidebarWidth=sidebarWidth==='wide'?'narrow':'wide';sidebarMode=sidebarWidth;applySidebarMode();});
$('#mobile-menu').addEventListener('click',()=>{const open=!$('#sidebar').classList.contains('mobile-open');$('#sidebar').classList.toggle('mobile-open',open);$('#sidebar-shade').hidden=!open;$('#mobile-menu').setAttribute('aria-expanded',String(open));$('#mobile-menu').setAttribute('aria-label',open?'关闭边栏':'打开边栏');});
$('#sidebar-shade').addEventListener('click',closeSidebar);
content.addEventListener('input',event=>{if(event.target.id==='entry-source-search')renderSourceResults(event.target.value.trim());});
installDisclosureControls(content,{onBulk:open=>{if(['list','favorites','search'].includes(state.screen))listDisclosures.setAll(open);}});
installDisclosureControls(dialog);
installResponsiveLayout(content);
window.addEventListener('popstate',()=>{parseLocation();render();});
try{const data=await api('bootstrap');token=data.token;const releaseLabel=document.getElementById('wiki-release');if(releaseLabel&&data.release?.version){releaseLabel.textContent=`Wiki ${data.release.version}`;releaseLabel.title=data.release.releaseId?`发布批次 ${data.release.releaseId}`:'本地开发版本';}trackPageLifetime(token);counts=data.counts??[];favoriteCounts=data.favoriteCounts??[];favorites=new Set(data.favorites);sourceManifest=data.sourceManifest;parseLocation();render();}catch(error){content.innerHTML=`<div class="panel empty"><strong>资料库暂时无法读取</strong><p>${escape(error.message)}</p><p>请确认本地服务仍在运行，然后刷新页面。</p></div>`;}
if(token)void import('./online-updates.mjs').then(module=>module.mountOnlineUpdates({api,toast})).catch(error=>{const trigger=document.getElementById('wiki-updates');if(trigger){trigger.disabled=true;trigger.title='更新入口暂不可用：'+error.message;}});
