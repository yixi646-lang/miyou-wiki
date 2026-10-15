import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
import {openAssessmentDialog} from '../modules/character-assessment/analysis-dialog.mjs';

test('锁定账号可隐藏各页与浮窗说明并记住选择；强化伤害和自动武器数值仍可见',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
 const prior=Object.fromEntries(['document','fetch','CSS','localStorage'].map(k=>[k,globalThis[k]])),prefs=new Map();let active=null,posts=0;
 Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
 Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
 Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
 Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===v;},configurable:true});
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
 globalThis.document=document;globalThis.CSS={escape:s=>s};globalThis.localStorage={getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)};
 const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url))),catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
 globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-14'}});
 const state=blankState(),character=key=>({key,level:90,ascension:6,constellation:6,talent:{auto:9,skill:9,burst:9}});state.selected='YaeMiko';state.good.characters=['Sandrone','YaeMiko','Odette','Nicole'].map(character);
 state.good.characters.find(c=>c.key==='YaeMiko').constellation=1;
 state.good.weapons=[{key:'WintersHeavyHeart',level:90,ascension:6,refinement:2,location:'YaeMiko',lock:false}];
 const w=readWorkspace(state);w.teamDraft={members:['Sandrone','YaeMiko','Odette','Nicole'],scenario:{...defaultScenario(),members:['YaeMiko','Odette','Nicole'],active:'Sandrone',conditional:{Sandrone:{a0StellarRadianceSc:'on'}},characters:{YaeMiko:{conditional:{YaeMiko:{lockRevelation:'on',lockStellarRadianceSc:'on'}}}}}};writeWorkspace(state,w);
 const original=structuredClone(state),account={id:'fixture',name:'隔离只读账号',locked:true,kind:'imported'},api=async(path,req)=>{if(req?.method==='POST'){posts++;assert.fail('隐藏提示不应保存账号');}return path==='assessment/accounts'?{accounts:[account]}:path==='assessment/recommendations'?{version:2,revision:0,records:{}}:{state:structuredClone(state),account,revision:0};};
 const host=document.querySelector('main'),tick=()=>new Promise(setImmediate),click=async selector=>{const n=host.querySelector(selector);assert(n,selector);assert(!n.disabled,selector);n.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();};
 try{
  const mount=()=>mountAssessment({host,api,toast:m=>assert.fail(m)});await mount();
  const root=host.querySelector('.assessment-root'),toggle=root.querySelector('[data-hide-assessment-hints]');assert(toggle&&!toggle.disabled);assert.equal(root.dataset.hideHints,'false');
  toggle.checked=true;toggle.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(root.dataset.hideHints,'true');
  for(const tab of ['evaluation','artifacts','weapons','import','engine']){await click(`[data-tab="${tab}"]`);assert.equal(root.dataset.hideHints,'true');assert(root.querySelectorAll('[data-ae-hint]').length>0);}
  const weapon=root.querySelector('[data-automatic-weapon="YaeMiko"]');assert(weapon);assert.match(weapon.textContent,/凝雪沉心/);assert.match(weapon.textContent,/75\.0/);assert.match(weapon.textContent,/22\.5%/);assert.equal(weapon.closest('[data-ae-hint]'),null);
  assert(![...root.querySelectorAll('.ae-condition-fields .ae-effect-values')].some(n=>n.textContent.includes('杀生樱伤害')));
  const damage=root.querySelector('[data-damage-owner="YaeMiko"]');assert(damage);assert.match(damage.textContent,/强化天赋/);assert.match(damage.textContent,/杀生樱伤害·壹阶/);assert.match(damage.textContent,/额外星超导伤害/);
  const popup=openAssessmentDialog({root,title:'代表浮窗',subtitle:'使用说明',subtitleHint:'浮窗介绍',html:'<p data-ae-hint="浮窗说明">说明</p><p class="ae-warning">错误信息</p><strong>123</strong>'});
  assert.equal(popup.dialog.closest('[data-hide-hints]'),root);assert.equal(popup.dialog.querySelector('.ae-warning').closest('[data-ae-hint]'),null);popup.close();
  disposeAssessment();await tick();await mount();assert.equal(host.querySelector('.assessment-root').dataset.hideHints,'true');assert.equal(host.querySelector('[data-hide-assessment-hints]').checked,true);
  const restored=host.querySelector('[data-hide-assessment-hints]');restored.checked=false;restored.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();assert.equal(host.querySelector('.assessment-root').dataset.hideHints,'false');
  assert.equal(posts,0);assert.deepEqual(state,original);
  const css=readFileSync(new URL('../modules/character-assessment/ui.css',import.meta.url),'utf8');assert.match(css,/data-hide-hints="true"\]\s+\[data-ae-hint\]\{display:none!important/);assert.match(css,/\.ae-hide-hints input\{width:14px;height:14px/);
 }finally{disposeAssessment();for(const [k,v]of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
