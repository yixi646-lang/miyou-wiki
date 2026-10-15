import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {runInNewContext} from 'node:vm';
import {pathToFileURL} from 'node:url';
import {mountUnifiedSearch,bindSearchInput} from '../public/unified-search.mjs';
import {GAMES,CATEGORIES,categoryLabel,rarityLabel} from '../shared/catalog.mjs';
import {rarityClass,elementIcon} from '../shared/appearance.mjs';
import {imageHTML} from '../shared/asset-image.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('养成与评估顶栏可输入搜索、切换范围并使用 Ctrl K',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
 const {document,window}=parseHTML(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8'),state={screen:'assessment',game:'genshin',category:'characters',search:'',searchScope:'current',searchType:'all'},routes=[];
 const search=document.querySelector('#search'),prior=globalThis.document,wait=()=>new Promise(resolve=>setTimeout(resolve,15));let focused=false,selected=false,context;
 search.focus=()=>{focused=true;};search.select=()=>{selected=true;};
 context={document,search,state,GAMES,CATEGORIES,categoryLabel,escape,$:selector=>document.querySelector(selector),entries:[],loadedGames:new Set(['genshin']),favorites:new Set(),favoriteCounts:[],countFor:()=>0,applySidebarMode(){},icon:()=>'',bindSearchInput:(input,submit)=>bindSearchInput(input,submit,{delay:5}),navigate(patch){routes.push(patch);Object.assign(state,patch);context.updateChrome();}};
 try{
  globalThis.document=document;
  const chrome=source.slice(source.indexOf('function updateChrome(){'),source.indexOf('\nfunction displayValue'));
  const bindings=source.slice(source.indexOf('function submitSearch(value)'),source.indexOf("\ndocument.addEventListener('change'"));
  runInNewContext(chrome+'\nupdateChrome();\n'+bindings,context);
  assert(!search.disabled);assert.equal(search.placeholder,'搜索原神…');
  for(const button of document.querySelectorAll('[data-search-scope]'))assert(!button.disabled);
  search.dispatchEvent(new window.Event('compositionstart'));search.value='芙';search.dispatchEvent(new window.Event('input'));await wait();assert.equal(routes.length,0);
  search.value='芙宁娜';search.dispatchEvent(new window.Event('compositionend'));await wait();assert.equal(state.screen,'search');assert.equal(state.search,'芙宁娜');assert.equal(routes.length,1);
  await mountUnifiedSearch({host:document.querySelector('#content'),game:'genshin',gameName:'原神',query:state.search,entries:[{id:'furina',name:'芙宁娜',game:'genshin',category:'characters'}],loadVersions:async()=>({versions:[]}),loadArtwork:async()=>({}),renderEntry:entry=>`<a class="entry-card">${escape(entry.name)}</a>`});
  assert.match(document.querySelector('#content').textContent,/芙宁娜/);assert.equal(document.querySelectorAll('#content .entry-card').length,1);
  Object.assign(state,{screen:'assessment',searchScope:'current'});context.updateChrome();
  document.querySelector('[data-search-scope="all"]').dispatchEvent(new window.Event('click'));assert.equal(state.screen,'search');assert.equal(state.searchScope,'all');assert.equal(search.placeholder,'搜索全部游戏…');
  Object.assign(state,{screen:'assessment',searchScope:'current'});context.updateChrome();
  document.dispatchEvent(Object.assign(new window.Event('keydown',{cancelable:true}),{key:'k',ctrlKey:true}));assert(focused&&selected);
 }finally{context.searchInput?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('搜索复用原页面卡片，跨游戏分类、排序和立绘切换正确，保留展开及中文输入',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
 const {document,window}=parseHTML('<html><body><input id="query"><main></main></body></html>');
 const prior=globalThis.document;globalThis.document=document;let binding;
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))String(o.value)===String(v)?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 const hooks=registerHooks({resolve(specifier,context,next){return next(specifier.startsWith('/shared/')?new URL('../shared/'+specifier.slice(8),import.meta.url).href:specifier,context);}});
 const host=document.querySelector('main'),entries=[
  {id:'furina',name:'芙宁娜',game:'genshin',category:'characters',aliases:['水神'],rarity:5,element:'水',image:'/assets/furina-face.png',releaseVersion:'4.2'},
  {id:'sr-character',name:'水神同名',game:'starrail',category:'characters',rarity:4,image:'/assets/sr-face.png'},
  {id:'zzz-character',name:'水神测试角色',game:'zenless',category:'characters',rarity:5,image:'/assets/zzz-face.png'},
  {id:'weapon-a',name:'水神甲剑',game:'genshin',category:'weapons',rarity:4,type:'单手剑',image:'/assets/sword-a.png',stats:{attack:400},listEffects:[{name:'测试效果',description:'测试说明',rank:1},{name:'测试效果',description:'第二级说明',rank:2}]},
  {id:'weapon-b',name:'水神乙剑',game:'genshin',category:'weapons',rarity:5,type:'单手剑',image:'/assets/sword-b.png',stats:{attack:500}},
  {id:'banner',name:'水神祈愿',game:'genshin',category:'banners',type:'角色活动祈愿',releaseVersion:'4.2',banner:{start:'2023-11-08 10:00:00',end:'2023-11-28 17:59:59',timeZone:'UTC+8',groups:[{name:'五星',role:'up',items:[{id:'furina',name:'芙宁娜',category:'characters',rarity:5}]}]}},
  ...Array.from({length:22},(_,i)=>({id:'material-'+i,name:'水神关联材料'+i,game:'genshin',category:'materials',image:'/assets/material.png'}))
 ];
 const artwork={images:{furina:'/assets/furina.png'},variants:{furina:[{key:'main',label:'主立绘',image:'/assets/furina.png'},{key:'skin',label:'水神礼服',type:'skin',image:'/assets/furina-skin.png'}]}};
 const changes=[],calls=[],openState=new Map();
 try{
  const [{galleryCards,switchGalleryCard},{versionCardHTML},{bannerPeriodHTML}]=await Promise.all([import('../public/artwork-gallery.mjs'),import('../public/version-archives.mjs'),import('../public/banner-history.mjs')]);
  const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
  const card=runInNewContext(source.slice(source.indexOf('function entryImage('),source.indexOf('function gameCards('))+'\n({card})',{entries,favorites:new Set(),listDisclosures:{isOpen:id=>openState.get(id)??false},escape,tile:()=>'',rarityClass,rarityLabel,categoryLabel,elementIcon,imageHTML}).card;
  const options={host,game:'genshin',gameName:'原神',entries,query:'水神',scope:'all',loadCatalog:async game=>{calls.push(['catalog',game]);return entries.filter(e=>e.game===game);},loadVersions:async game=>{calls.push(['versions',game]);return {versions:[{version:'4.2',title:'水神登场',coverage:'official-notes',sections:[]}]};},loadArtwork:async()=>artwork,renderEntry:card,renderVersion:versionCardHTML,renderArtwork:galleryCards,switchArtwork:switchGalleryCard,renderBanner:(period,all)=>bannerPeriodHTML(period,{entries:new Map(all.map(e=>[e.game+':'+e.id,e])),escape,href:e=>'/?'+new URLSearchParams({game:e.game,entry:e.id}),asOf:'2026-10-13'}),rememberCards:()=>{for(const detail of host.querySelectorAll('.weapon-passive'))openState.set(detail.closest('[data-entry-id]').dataset.entryId,detail.open||detail.hasAttribute('open'));},onChange:patch=>changes.push(patch)};
  await mountUnifiedSearch(options);assert.equal(host.querySelector('h1').textContent,'搜索');assert(!host.textContent.includes('全库'));assert.equal(host.querySelectorAll('[data-search-type]').length,8);
  assert.deepEqual(calls.filter(c=>c[0]==='catalog').map(c=>c[1]),['genshin','starrail','zenless']);
  assert.equal(host.querySelectorAll('[data-search-category="characters"] .entry-card').length,3);assert(host.querySelector('[data-search-category="versions"] .version-card'));assert(host.querySelector('[data-search-category="banners"] .banner-period-card'));
  assert.equal(host.querySelectorAll('[data-search-category="artwork"] .artwork-gallery-card').length,1);assert.equal(host.querySelectorAll('[data-search-category="materials"] .entry-card').length,20);assert([...host.querySelectorAll('.artwork-gallery-image img,.equipment-image img,.entry-visual > img')].every(img=>img.getAttribute('loading')==='lazy'));
  host.querySelector('[data-search-more="genshin:materials"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(host.querySelectorAll('[data-search-category="materials"] .entry-card').length,22);
  const detail=host.querySelector('.weapon-passive');detail.setAttribute('open','');assert(detail.querySelector('.list-effect-rank'));
  host.querySelector('[data-search-type="weapons"]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(host.querySelectorAll('.search-card-group').length,1);assert.equal(host.querySelector('.weapon-passive').hasAttribute('open'),true);assert.deepEqual(changes.at(-1),{searchType:'weapons'});
  const select=host.querySelector('#search-result-sort');select.value='rarity';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(host.querySelector('.equipment-card').dataset.entryId,'weapon-b');assert.equal(host.querySelector('#search-result-sort'),select);assert.equal(host.querySelector('.weapon-passive').hasAttribute('open'),true);
  host.querySelector('[data-search-direction]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(host.querySelector('.equipment-card').dataset.entryId,'weapon-a');assert.equal(calls.length,6);
  host.querySelector('[data-search-type="artwork"]').dispatchEvent(new window.Event('click',{bubbles:true}));const choice=host.querySelector('[data-artwork-choice="skin"]');choice.dispatchEvent(new window.Event('click',{bubbles:true}));const picture=host.querySelector('.artwork-gallery-trigger');assert.equal(picture.tagName,'A');assert.equal(new URL(picture.getAttribute('href'),'http://localhost').searchParams.get('variant'),'skin');assert.equal(picture.querySelector('img').getAttribute('src'),'/assets/furina-skin.png');
  await mountUnifiedSearch({...options,scope:'current'});assert.equal(host.querySelectorAll('[data-search-category="characters"] .entry-card').length,1);assert(!host.querySelector('[data-game="starrail"]'));
  let resolve;const old=mountUnifiedSearch({...options,scope:'current',loadVersions:()=>new Promise(r=>{resolve=r;})});await mountUnifiedSearch({...options,query:'不存在'});resolve({versions:[]});await old;assert.match(host.textContent,/「不存在」/);assert.match(host.textContent,/没有匹配/);
  const input=document.querySelector('#query'),submissions=[];binding=bindSearchInput(input,value=>submissions.push(value),{delay:5});
  input.value='旧';input.dispatchEvent(new window.Event('input'));input.dispatchEvent(new window.Event('compositionstart'));input.value='芙';input.dispatchEvent(new window.Event('input'));await new Promise(r=>setTimeout(r,12));assert.deepEqual(submissions,[]);
  input.value='芙宁娜';input.dispatchEvent(new window.Event('compositionend'));input.dispatchEvent(new window.Event('input'));await new Promise(r=>setTimeout(r,12));assert.deepEqual(submissions,['芙宁娜']);
  input.value='新';input.dispatchEvent(new window.Event('input'));binding.cancel();await new Promise(r=>setTimeout(r,12));assert.equal(submissions.length,1);
 }finally{binding?.dispose();hooks.deregister();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
