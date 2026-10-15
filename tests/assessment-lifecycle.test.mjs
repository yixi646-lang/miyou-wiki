import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {withResourceTimeout} from '../shared/resource-loading.mjs';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';

const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const tick=()=>new Promise(setImmediate),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const domTest={skip:!process.env.WIKI_TEST_DOM_PACKAGE};

async function environment({save,fetchResource,memory=new Map(),accountId='lifecycle-fixture',inventory=false}={}){
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
  const {document,window}=parseHTML('<html><head></head><body style="overflow:auto"><main></main></body></html>');
  const prior=Object.fromEntries(['document','fetch','CSS','setTimeout','window','sessionStorage'].map(key=>[key,globalThis[key]]));let active=null;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'scrollIntoView',{value(){},configurable:true});
  const scrollPositions=new WeakMap();
  Object.defineProperty(window.HTMLElement.prototype,'scrollTop',{get(){return this.closest('[hidden]')?0:scrollPositions.get(this)??0;},set(value){scrollPositions.set(this,this.closest('[hidden]')?0:Number(value));},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    get(){return [...this.querySelectorAll('option')].find(option=>option.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},
    set(value){for(const option of this.querySelectorAll('option'))String(option.value)===String(value)?option.setAttribute('selected',''):option.removeAttribute('selected');},configurable:true
  });
  const create=document.createElement.bind(document);
  document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){
    node.showModal=()=>{node.open=true;};
    node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};
  }return node;};
  globalThis.document=document;globalThis.CSS={escape:value=>String(value)};
  const viewport={scrollX:0,scrollY:0,scrollTo({left=0,top=0}){this.scrollX=left;this.scrollY=top;},addEventListener(){},removeEventListener(){}};
  globalThis.window=viewport;globalThis.sessionStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const state=blankState();state.selected='Furina';
  state.good.characters=[{key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}];
  state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:false}];
  if(inventory)state.good.artifacts=Array.from({length:65},(_,index)=>({id:String(index),setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8}],location:'',lock:false}));
  const account={id:accountId,name:'隔离测试账号',kind:'local',locked:false,hasOriginal:false};
  const posts=[],reads=[],notices=[],requests=[];let revision=0,stored=state;
  globalThis.fetch=async(url,options)=>{
    requests.push({url,signal:options?.signal});
    if(fetchResource){const response=await fetchResource(url,options);if(response)return response;}
    return {ok:true,json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-15'}};
  };
  const api=async(path,request)=>{
    if(path==='assessment/accounts')return {accounts:[account]};
    if(path==='assessment/recommendations')return {version:2,revision:0,records:{}};
    if(request?.method==='POST'){
      const payload=structuredClone(request.body);posts.push(payload);
      if(save)await save(payload,posts.length);
      assert.equal(payload.accountId,account.id);assert.equal(payload.revision,revision);
      stored=structuredClone(payload.state);return {account,revision:++revision,updatedAt:'2026-10-15'};
    }
    reads.push(revision);return {account,state:structuredClone(stored),revision};
  };
  const host=document.querySelector('main'),q=selector=>host.querySelector(selector);
  return {host,q,window,viewport,document,posts,reads,notices,requests,
    mount:(options={})=>mountAssessment({host,api,toast:message=>notices.push(message),...options}),
    async click(selector){const node=q(selector);assert(node,selector);assert(!node.disabled);node.focus();node.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();},
    async change(selector,value,type='change'){const node=q(selector);assert(node,selector);node.value=value;node.dispatchEvent(new window.Event(type,{bubbles:true}));await tick();},
    async cleanup(){await disposeAssessment();for(const [key,value] of Object.entries(prior))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  };
}

test('资料加载超时会中止请求，迟到的结果不能改变超时结论',async()=>{
  const held=deferred();let signal;
  const loading=withResourceTimeout(value=>{signal=value;return held.promise;},{timeout:15,message:'测试加载超时'});
  await assert.rejects(loading,/测试加载超时/);assert.equal(signal.aborted,true);
  held.resolve('迟到的资料');await tick();await assert.rejects(loading,/测试加载超时/);
});

test('资料加载失败会中止同组请求；成功、取消均及时结束',async()=>{
  let failedSignal;
  await assert.rejects(withResourceTimeout(signal=>{failedSignal=signal;throw Error('模块读取失败');}),/模块读取失败/);
  assert.equal(failedSignal.aborted,true);
  assert.equal(await withResourceTimeout(async()=>42),42);
  const controller=new AbortController();let canceledSignal;
  const canceled=withResourceTimeout(signal=>{canceledSignal=signal;return new Promise(()=>{});},{signal:controller.signal});
  await tick();controller.abort(new Error('离开页面'));
  await assert.rejects(canceled,/离开页面/);assert.equal(canceledSignal.aborted,true);
  await assert.rejects(withResourceTimeout(()=>assert.fail('取消后不得开始读取'),{signal:controller.signal}),/离开页面/);
});

test('离开时按顺序保存进行中的请求和最后的输入草稿，重进等待保存完成',domTest,async()=>{
  const first=deferred(),second=deferred();
  const env=await environment({save:(_,count)=>count===1?first.promise:second.promise});
  try{
    await env.mount();await env.change('[data-goal="effectiveRolls"]','21');await wait(600);
    assert.equal(env.posts.length,1);assert.equal(env.posts[0].state.goals.Furina.effectiveRolls,21);
    await env.change('[data-goal="effectiveRolls"]','22','input');
    const leaving=disposeAssessment();env.host.replaceChildren();const reopening=env.mount();await tick();
    assert.equal(env.reads.length,1,'重新进入不得提前读取旧数据');
    first.resolve();await tick();assert.equal(env.posts.length,2);
    assert.equal(env.posts[1].revision,1);assert.equal(env.posts[1].state.goals.Furina.effectiveRolls,22);
    assert.equal(env.reads.length,1,'最后一次保存仍未完成');
    second.resolve();await leaving;await reopening;
    assert.deepEqual(env.reads,[0,2]);assert.equal(env.q('[data-goal="effectiveRolls"]').value,'22');
    assert.deepEqual(env.notices,[]);
  }finally{first.resolve();second.resolve();await env.cleanup();}
});

test('离开时只有进行中的保存也会等待完成，不重复提交',domTest,async()=>{
  const first=deferred();const env=await environment({save:()=>first.promise});
  try{
    await env.mount();await env.change('[data-goal="effectiveRolls"]','23');await wait(600);
    const leaving=disposeAssessment();env.host.replaceChildren();let finished=false;leaving.then(()=>{finished=true;});
    await tick();assert.equal(finished,false);first.resolve();await leaving;
    assert.equal(env.posts.length,1);assert.deepEqual(env.notices,[]);
  }finally{first.resolve();await env.cleanup();}
});

test('离开时保存失败会明确报错并结束，不在后台无限重试',domTest,async()=>{
  const env=await environment({save:()=>{throw Error('测试保存失败');}});
  try{
    await env.mount();await env.change('[data-goal="effectiveRolls"]','24','input');
    await disposeAssessment();assert.equal(env.posts.length,1);assert.deepEqual(env.notices,['测试保存失败']);
    await tick();assert.equal(env.posts.length,1);
  }finally{await env.cleanup();}
});

test('设置抽屉上方的浮窗独占 Esc 和 Tab，关闭浮窗后抽屉仍可关闭',domTest,async()=>{
  const env=await environment();
  try{
    await env.mount();await env.click('[data-ae="evaluation-settings"]');await env.click('[data-ae="edit-goal-default"]');
    const drawer=env.q('[data-evaluation-settings]'),dialog=env.q('dialog'),control=dialog.querySelector('input');
    assert.equal(drawer.hidden,false);assert.equal(dialog.open,true);control.focus();
    for(const key of ['Tab','Escape']){
      const event=new env.window.Event('keydown',{bubbles:true,cancelable:true});event.key=key;control.dispatchEvent(event);
      assert.equal(event.defaultPrevented,false,`${key} 应交给顶层原生浮窗`);assert.equal(drawer.hidden,false);assert.equal(dialog.open,true);
    }
    dialog.dispatchEvent(new env.window.Event('cancel',{cancelable:true}));
    assert.equal(dialog.isConnected,false);assert.equal(drawer.hidden,false);assert.equal(env.document.body.style.overflow,'auto');
    assert.equal(env.document.activeElement,env.q('[data-ae="edit-goal-default"]'));
    const escape=new env.window.Event('keydown',{bubbles:true,cancelable:true});escape.key='Escape';env.document.activeElement.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented,true);assert.equal(drawer.hidden,true);assert.deepEqual(env.notices,[]);
  }finally{await env.cleanup();}
});

test('资料请求无响应会退出加载状态并中止请求，迟到结果不重建页面',domTest,async()=>{
  const held=deferred();const env=await environment({fetchResource:url=>url.includes('game-stats')?held.promise:null});
  const realTimeout=globalThis.setTimeout;globalThis.setTimeout=(callback,ms,...args)=>realTimeout(callback,ms===20000?25:ms,...args);
  try{
    await env.mount();assert.match(env.host.textContent,/暂时无法加载/);assert.match(env.host.textContent,/加载超时/);
    assert(env.requests.every(request=>request.signal?.aborted));assert.equal(env.notices.length,1);
    held.resolve({ok:true,json:async()=>structuredClone(data)});await tick();assert.equal(env.q('.assessment-root'),null);
  }finally{held.resolve({ok:true,json:async()=>structuredClone(data)});await env.cleanup();}
});

test('资料 HTTP 错误及时显示，离开加载页会取消且不覆盖其他页面',domTest,async()=>{
  const failed=await environment({fetchResource:url=>url.includes('catalog')?{ok:false,status:503}:null});
  try{await failed.mount();assert.match(failed.host.textContent,/HTTP 503/);assert.equal(failed.q('.ae-loading'),null);}
  finally{await failed.cleanup();}
  const held=deferred(),env=await environment({fetchResource:url=>url.includes('game-stats')?held.promise:null});
  try{
    const mounting=env.mount();await tick();disposeAssessment();env.host.textContent='其他页面';await mounting;
    assert.equal(env.host.textContent,'其他页面');assert(env.requests.every(request=>request.signal?.aborted));assert.deepEqual(env.notices,[]);
  }finally{held.resolve({ok:true,json:async()=>structuredClone(data)});await env.cleanup();}
});

test('养成五个子栏目沿用当前页面位置，角色列表独立保留滚动',domTest,async()=>{
  const env=await environment();
  try{
    await env.mount();await env.change('[data-character-search]','芙','input');
    env.q('.ae-character-list').scrollTop=120;env.viewport.scrollY=345;
    await env.click('[data-evaluation-tab="guide"]');assert.equal(env.viewport.scrollY,345);env.viewport.scrollY=560;
    for(const section of ['overview','artifacts','progress','growth','guide']){await env.click(`[data-evaluation-tab="${section}"]`);assert.equal(env.viewport.scrollY,560);assert.equal(env.q('.ae-character-list').scrollTop,120);}
    await env.change('[data-goal="effectiveRolls"]','25');assert.equal(env.viewport.scrollY,560);assert.equal(env.q('.ae-character-list').scrollTop,120);
    await disposeAssessment();env.host.replaceChildren();env.viewport.scrollY=80;await env.mount();
    assert.equal(env.q('[data-evaluation-tab="guide"]').getAttribute('aria-selected'),'true');
    assert.equal(env.q('[data-character-search]').value,'芙');assert.equal(env.q('.ae-character-list').scrollTop,120);assert.equal(env.viewport.scrollY,80);assert.deepEqual(env.notices,[]);
  }finally{await env.cleanup();}
});

test('圣遗物与武器各自记住筛选、分页和折叠，重新挂载后继续使用',domTest,async()=>{
  const env=await environment({inventory:true});
  try{
    await env.mount();await env.click('[data-tab="artifacts"]');
    await env.change('[data-native-search]',catalog.sets.GoldenTroupe.name,'input');await env.change('[data-artifact-filter="rarity"]','5');
    await env.change('[data-inventory-page-size]','24');await env.click('[data-native="inventory-page"][data-direction="1"]');
    env.q('[data-native-disclosure="artifact-filters"]').open=true;env.viewport.scrollY=900;
    await env.click('[data-tab="weapons"]');assert.equal(env.q('[data-native-search]').value,'');
    await env.change('[data-native-search]',catalog.weapons.FavoniusSword.name,'input');await env.change('[data-weapon-sort]','level-asc');env.viewport.scrollY=240;
    await env.click('[data-tab="artifacts"]');assert.equal(env.q('[data-native-search]').value,catalog.sets.GoldenTroupe.name);
    assert.equal(env.q('[data-artifact-filter="rarity"]').value,'5');assert.match(env.q('.ae-inventory-pages').textContent,/第 2 \/ 3 页/);
    assert.equal(env.q('[data-native-disclosure="artifact-filters"]').open,true);assert.equal(env.viewport.scrollY,240);
    await env.click('[data-native="open-potential"]');env.viewport.scrollY=450;await env.click('[data-native-artifact-page="inventory"]');assert.equal(env.viewport.scrollY,450);
    await disposeAssessment();env.host.replaceChildren();env.viewport.scrollY=95;await env.mount();
    assert.equal(env.q('[data-tab="artifacts"]').getAttribute('aria-selected'),'true');assert.match(env.q('.ae-inventory-pages').textContent,/第 2 \/ 3 页/);assert.equal(env.viewport.scrollY,95);
    await env.click('[data-tab="weapons"]');assert.equal(env.q('[data-native-search]').value,catalog.weapons.FavoniusSword.name);assert.equal(env.q('[data-weapon-sort]').value,'level-asc');assert.equal(env.viewport.scrollY,95);assert.deepEqual(env.notices,[]);
  }finally{await env.cleanup();}
});

test('不同账号视图互不影响；角色直达入口优先于记忆的库存栏目',domTest,async()=>{
  const memory=new Map(),first=await environment({memory,accountId:'first'});
  try{await first.mount();await first.click('[data-tab="weapons"]');first.viewport.scrollY=300;}
  finally{await first.cleanup();}
  const second=await environment({memory,accountId:'second'});
  try{await second.mount();assert.equal(second.q('[data-tab="evaluation"]').getAttribute('aria-selected'),'true');assert.equal(second.viewport.scrollY,0);}
  finally{await second.cleanup();}
  const resumed=await environment({memory,accountId:'first'});
  try{
    resumed.viewport.scrollY=75;await resumed.mount();assert.equal(resumed.q('[data-tab="weapons"]').getAttribute('aria-selected'),'true');assert.equal(resumed.viewport.scrollY,75);
    await disposeAssessment();await resumed.mount({characterId:catalog.characters.Furina.wikiId});assert.equal(resumed.q('[data-tab="evaluation"]').getAttribute('aria-selected'),'true');assert.deepEqual(resumed.notices,[]);
  }finally{await resumed.cleanup();}
});

test('角色列表隐藏时的零值不能覆盖位置，跨栏目和离开模块后仍恢复',domTest,async()=>{
  const memory=new Map();memory.set('wiki.assessment.views.v1',JSON.stringify([['lifecycle-fixture',{positions:{'evaluation:Furina:overview':{top:1700,left:0}}}]]));
  const env=await environment({memory});
  try{
    env.viewport.scrollY=260;await env.mount();assert.equal(env.viewport.scrollY,260,'忽略旧版每个栏目的历史滚动');
    env.q('.ae-character-list').scrollTop=740;
    for(const page of ['artifacts','weapons','import']){await env.click(`[data-tab="${page}"]`);assert.equal(env.q('[data-pane="evaluation"] .ae-character-list').scrollTop,0);}
    await disposeAssessment();env.host.replaceChildren();await env.mount();assert.equal(env.q('[data-tab="import"]').getAttribute('aria-selected'),'true');
    await env.click('[data-tab="evaluation"]');assert.equal(env.q('.ae-character-list').scrollTop,740);assert.equal(env.viewport.scrollY,260);
    const key=new env.window.Event('keydown',{bubbles:true,cancelable:true});key.key='ArrowRight';env.q('[data-evaluation-tab="overview"]').dispatchEvent(key);await tick();assert.equal(env.viewport.scrollY,260);assert.equal(env.q('.ae-character-list').scrollTop,740);
    assert.deepEqual(env.notices,[]);
  }finally{await env.cleanup();}
});
