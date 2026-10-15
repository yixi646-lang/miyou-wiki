import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {createWorkbench,createCompositionInputHandler} from '../modules/character-assessment/workbench.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const hasData=dataset=>name=>Object.hasOwn(dataset,name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()));

test('养成评价数字与说明输入保留原节点、光标及勾选，并更新结果与保存值',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let active=null,saved,posts=0;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(value){if(value)this.setAttribute('checked','');else this.removeAttribute('checked');},configurable:true});
  globalThis.document=document;globalThis.CSS={escape:s=>s};globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?data:url.includes('catalog')?catalog:{version:'test',deployedAt:'2026-10-08'}});
  const state=blankState();state.selected='Furina';state.good.characters=[{key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:1,skill:8,burst:8}}];state.good.artifacts=[{id:'flower',setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8}],location:'Furina',lock:false}];
  const account={id:'input-test',name:'隔离输入',locked:false},messages=[],tick=()=>new Promise(setImmediate),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    const host=document.querySelector('main');await mountAssessment({host,toast:m=>messages.push(m),api:async(path,request)=>{
      if(path==='assessment/accounts')return{accounts:[account]};if(path==='assessment/recommendations')return{version:2,revision:0,records:{}};
      if(request?.method==='POST'){saved=structuredClone(request.body.state);return{account,revision:++posts+1};}return{state,account,revision:1};
    }});
    const q=s=>host.querySelector(s),inputs=[...host.querySelectorAll('[data-evaluation-editor] input[type=number],textarea[data-goal-notes]')],checkboxes=[...host.querySelectorAll('[data-goal-main]')].map(n=>[n,n.checked]),sub=q('[data-slot="flower"] [data-sub-value="0"]');
    sub.focus();sub.value='7.80';sub.selectionStart=2;sub.selectionEnd=3;sub.dispatchEvent(new window.Event('input',{bubbles:true}));await wait(480);
    assert.equal(q('[data-slot="flower"] [data-sub-value="0"]'),sub);assert.equal(document.activeElement,sub);assert.equal(sub.value,'7.80');assert.deepEqual([sub.selectionStart,sub.selectionEnd],[2,3]);
    for(const [selector,value] of [['[data-art="level"]','16'],['[data-goal="effectiveRolls"]','22.5'],['[data-goal-talent="skill"]','9'],['[data-weight="critRate_"]','1.25'],['[data-goal-panel="hp"]','42000']]){
      const node=q(selector);node.focus();node.value=value;node.selectionStart=1;node.selectionEnd=2;node.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(q(selector),node);assert.equal(document.activeElement,node);assert.deepEqual([node.selectionStart,node.selectionEnd],[1,2]);
    }
    const notes=q('[data-goal-notes]');notes.focus();notes.value='循环与队伍说明';notes.selectionStart=2;notes.selectionEnd=5;notes.dispatchEvent(new window.Event('input',{bubbles:true}));await wait(480);
    assert.equal(q('[data-goal-notes]'),notes);assert.deepEqual([notes.selectionStart,notes.selectionEnd],[2,5]);assert(inputs.every(n=>n.isConnected));for(const [node,checked] of checkboxes)assert.equal(node.checked,checked);
    const effective=q('[data-goal="effectiveRolls"]');effective.focus();effective.value='';effective.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(q('[data-goal="effectiveRolls"]'),effective);assert.equal(effective.value,'');
    await wait(650);assert(saved);assert.equal(saved.goals.Furina.effectiveRolls,22.5);assert.equal(saved.goals.Furina.weights.critRate_,1.25);assert.equal(saved.goals.Furina.panel.hp,42000);assert.equal(saved.goals.Furina.notes,notes.value);assert.equal(saved.good.artifacts[0].substats[0].value,7.8);assert.equal(saved.good.artifacts[0].level,16);assert.match(q('[data-evaluation-output="overview"]').textContent,/22\.5/);assert.deepEqual(messages,[]);
  }finally{disposeAssessment();for(const [key,value] of Object.entries(prior))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('圣遗物数字筛选连续输入与清空保留原节点和焦点，库存及队伍选择仅刷新结果', {skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
  const {document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let active=null;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
  globalThis.document=document;globalThis.CSS={escape:s=>s};
  globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?data:url.includes('catalog')?catalog:{version:'test',deployedAt:'2026-10-08'}});
  const state=blankState();state.selected='Furina';state.good.characters=[{key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:1,skill:1,burst:1}}];
  state.good.artifacts=[1,4].map((n,id)=>({id,setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9*n},{key:'critDMG_',value:7.8*n}],location:'',lock:false}));
  writeWorkspace(state,{...readWorkspace(state),teamDraft:{character:'Furina',members:['Furina'],scenario:defaultScenario()}});
  const original=structuredClone(state.good),account={id:'test',name:'隔离账号',locked:true},messages=[];let posts=0;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),tick=()=>new Promise(setImmediate);
  try{
    const host=document.querySelector('main');await mountAssessment({host,toast:m=>messages.push(m),api:async(path,request)=>{
      if(path==='assessment/accounts')return{accounts:[account]};
      if(path==='assessment/recommendations')return{version:2,revision:0,records:{}};
      if(request?.method==='POST'){posts++;return{account,revision:posts+1};}
      return{state,account,revision:1};
    }});
    const q=s=>host.querySelector(s),click=async s=>{const b=q(s);assert.ok(b,s);assert.equal(b.disabled,false);b.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();assert.deepEqual(messages,[]);};
    await click('[data-tab="engine"]');await click('[data-native-page="artifacts"]');await wait(650);const beforePosts=posts;
    const selector='[data-artifact-filter="minCV"]',input=q(selector),filters=q('[data-native-disclosure="artifact-filters"]');filters.open=true;
    for(const [value,count] of [['2',2],['20',1],['',2],['0',2],['0.5',2]]){
      input.focus();input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));await wait(480);
      assert.equal(q(selector),input);assert.equal(document.activeElement,input);assert.equal(input.value,value);assert.equal(filters.open,true);
      assert.equal(host.querySelectorAll('[data-artifact-inventory-results] .ae-artifact-card').length,count);
    }
    for(const key of ['minLevel','maxLevel','minEffective','minTotal']){
      const selector='[data-artifact-filter="'+key+'"]',node=q(selector);node.focus();node.value='1';node.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(q(selector),node);assert.equal(document.activeElement,node);
      node.value='';node.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(q(selector),node);
    }
    const checkbox=q('[data-artifact-sub="critRate_"]');checkbox.checked=true;checkbox.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
    const subSelector='[data-artifact-sub-min="critRate_"]',sub=q(subSelector);
    for(const [value,count] of [['4',1],['',2]]){sub.focus();sub.value=value;sub.dispatchEvent(new window.Event('input',{bubbles:true}));await wait(480);assert.equal(q(subSelector),sub);assert.equal(document.activeElement,sub);assert.equal(host.querySelectorAll('[data-artifact-inventory-results] .ae-artifact-card').length,count);}
    assert.equal(posts,beforePosts);assert.deepEqual(state.good,original);assert.deepEqual(messages,[]);
    await click('[data-native-page="teams"]');await click('[data-native="open-team-equipment"][data-member="Furina"][data-kind="artifacts"][data-slot="flower"]');
    const pickerSelector='[data-team-picker-filter="minCV"]',picker=q(pickerSelector);
    for(const [value,count] of [['20',1],['',2]]){picker.focus();picker.value=value;picker.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();assert.equal(q(pickerSelector),picker);assert.equal(document.activeElement,picker);assert.equal(host.querySelectorAll('[data-team-picker-results] [data-team-picker-action="choose"]').length,count);}
    assert.deepEqual(messages,[]);assert.deepEqual(state.good,original);
  }finally{disposeAssessment();for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('装备搜索连续输入和中间编辑在重绘后保留光标、选区及筛选结果',async()=>{
  const priorDoc=globalThis.document,priorCSS=globalThis.CSS;globalThis.document={activeElement:null};globalThis.CSS={escape:s=>s};let bench;
  try{
    const state=blankState();state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'',lock:false}];state.good.artifacts=[];
    const makeInput=value=>({value,type:'search',dataset:{nativeSearch:''},attributes:[{name:'data-native-search',value:''}],selectionStart:0,selectionEnd:0,selectionDirection:'none',scrollLeft:0,hasAttribute:hasData({nativeSearch:''}),closest:()=>null,focus(){document.activeElement=this;},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}});
    let search=makeInput('');const pane={html:'',get innerHTML(){return this.html;},set innerHTML(value){this.html=value;search=makeInput(value.match(/data-native-search value="([^"]*)"/)?.[1]??'');},contains:node=>node===search,querySelectorAll:()=>[],querySelector:selector=>selector==='[data-native-search=""]'?search:null};
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>'',catalog,data,selectionHTML:()=>'',changed:()=>{},toast:()=>{},isReadOnly:()=>true});
    await bench.click({dataset:{nativePage:'weapons'}});
    for(const value of ['f','fa','fav']){search.value=value;search.selectionStart=search.selectionEnd=value.length;search.focus();await bench.change(search);assert.equal(search.value,value);assert.equal(search.selectionStart,value.length);assert.equal(search.selectionEnd,value.length);assert.equal(document.activeElement,search);assert.match(pane.innerHTML,/显示 1 \/ 1 把/);}
    search.value='favonius';search.selectionStart=2;search.selectionEnd=5;search.selectionDirection='backward';search.scrollLeft=16;search.focus();await bench.change(search);
    assert.deepEqual([search.selectionStart,search.selectionEnd,search.selectionDirection,search.scrollLeft],[2,5,'backward',16]);
  }finally{bench?.dispose();if(priorDoc===undefined)delete globalThis.document;else globalThis.document=priorDoc;if(priorCSS===undefined)delete globalThis.CSS;else globalThis.CSS=priorCSS;}
});

test('中文输入法组合期间不调用重绘，提交后使用完整文字',()=>{
  const values=[],handler=createCompositionInputHandler(event=>values.push(event.target.value)),input={value:'j'};
  handler.start({target:input});handler.input({target:input,isComposing:true});input.value='ju';handler.input({target:input,isComposing:false});assert.deepEqual(values,[]);
  input.value='绝缘';handler.end({target:input});assert.deepEqual(values,['绝缘']);assert.equal(handler.isComposing(input),false);
  input.value='绝缘之旗印';handler.input({target:input,isComposing:false});assert.deepEqual(values,['绝缘','绝缘之旗印']);
});

test('锁定账号的角色搜索重绘后，新角色移除按钮仍显示禁用',async()=>{
  const priorDoc=globalThis.document,priorFetch=globalThis.fetch;
  const list={html:'',buttons:[],get innerHTML(){return this.html;},set innerHTML(value){this.html=value;this.buttons=[...value.matchAll(/<button\b[^>]*data-ae="remove-character"[^>]*>/g)].map(m=>({tagName:'BUTTON',dataset:{ae:'remove-character'},disabled:/\bdisabled\b/.test(m[0]),hasAttribute:()=>false}));}};
  const pane=()=>({html:'',hidden:false,get innerHTML(){return this.html;},set innerHTML(value){this.html=value;const found=value.match(/<div class="ae-character-list">([\s\S]*?)<div class="ae-add">/);if(found)list.innerHTML=found[1];},querySelectorAll:()=>[],querySelector:selector=>selector==='.ae-character-list'?list:null});
  const evaluation=pane(),engine=pane(),importPane=pane(),accountBar=pane(),handlers={},status={textContent:''};
  const root={dataset:{},querySelector:selector=>({'[data-pane="evaluation"]':evaluation,'[data-pane="engine"]':engine,'[data-pane="import"]':importPane,'[data-account-bar]':accountBar,'[data-save-status]':status})[selector]??null,querySelectorAll:selector=>selector==='button,input,select,textarea'?list.buttons:[],addEventListener:(name,fn)=>{handlers[name]=fn;}};
  globalThis.document={activeElement:null,visibilityState:'visible',querySelector:()=>({}),createElement:()=>pane(),addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?data:url.includes('catalog')?catalog:{version:'test',deployedAt:'2026-10-07'}});
  try{
    const state=blankState();state.selected='HuTao';state.good.characters=['HuTao','Qiqi'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));
    const account={id:'test',name:'隔离账号',locked:true};await mountAssessment({host:{innerHTML:'',querySelector:()=>root},api:async path=>path==='assessment/state'?{state,account,revision:1}:{accounts:[account]},toast:message=>assert.fail(message)});
    assert.equal(list.buttons.length,2);assert.ok(list.buttons.every(button=>button.disabled));
    const search={value:'胡',hasAttribute:hasData({characterSearch:''})};handlers.input({target:search,isComposing:false});
    assert.equal(list.buttons.length,1);assert.equal(list.buttons[0].disabled,true);assert.equal(list.buttons[0].dataset.accountDisabled,'1');assert.match(list.innerHTML,/胡桃/);
  }finally{disposeAssessment();if(priorDoc===undefined)delete globalThis.document;else globalThis.document=priorDoc;if(priorFetch===undefined)delete globalThis.fetch;else globalThis.fetch=priorFetch;}
});
