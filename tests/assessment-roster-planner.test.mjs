import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {evaluate,sortAssessmentRoster,moveAssessmentRoster} from '../modules/character-assessment/core/evaluate.mjs';
import {blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url))),catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
function stateFixture(){const state=blankState();state.selected='Jean';state.good.characters=['Jean','Bennett','Furina'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:6,skill:8,burst:8}}));state.goals=Object.fromEntries(state.good.characters.map(c=>[c.key,defaultGoal('attack',catalog.characters[c.key].element)]));state.good.artifacts=state.good.characters.map((c,i)=>({setKey:'GladiatorsFinale',slotKey:'circlet',rarity:5,level:20,mainStatKey:'critRate_',substats:[{key:'critDMG_',value:7.8*(i+1)},{key:'atk_',value:5.8*(3-i)}],location:c.key,lock:false}));state.goals.Jean.weights={atk_:2};state.goals.Bennett.weights={critDMG_:2};state.goals.Furina.weights={critDMG_:0};return state;}
test('三种角色排序与概览同口径，含头主词条；自定义保留隐藏角色且不改实际资料',()=>{
 const state=stateFixture(),snapshot=structuredClone(state),goal=k=>state.goals[k];
 for(const metric of ['totalRolls','effectiveRolls','totalCV'])for(const ascending of [false,true]){const actual=sortAssessmentRoster(state.good.characters,state.good,goal,data,{sort:metric,ascending});const numbers=actual.map(c=>evaluate(c,state.good,goal(c.key),data)[metric]);assert(numbers.every((v,i)=>!i||(ascending?v>=numbers[i-1]:v<=numbers[i-1])));}
 assert(evaluate(state.good.characters[0],state.good,goal('Jean'),data).totalCV>60);
 assert.deepEqual(sortAssessmentRoster(state.good.characters,state.good,goal,data,{sort:'effectiveRolls'}).map(c=>c.key),['Jean','Bennett','Furina']);
 const order=moveAssessmentRoster(state.good.characters,[],'Jean','Furina');assert.deepEqual(order,['Furina','Bennett','Jean']);assert.deepEqual(sortAssessmentRoster(state.good.characters,state.good,goal,data,{sort:'custom',order}).map(c=>c.key),order);assert.deepEqual(state,snapshot);
});

test('锁定账号可排序、调整及保存自定义顺序，重新进入恢复；实际GOOD未变化',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
 const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let saved=stateFixture(),posts=0;const original=structuredClone(saved.good),account={id:'roster-sort-test',name:'排序测试',locked:true},messages=[];
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.value===v?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 globalThis.document=document;globalThis.CSS={escape:s=>s};globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?data:url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-11'}});
 const host=document.querySelector('main'),api=async(path,request)=>{if(path==='assessment/accounts')return {accounts:[account]};if(path==='assessment/recommendations')return {version:2,revision:0,records:{}};if(request?.method==='POST'){saved=structuredClone(request.body.state);return {account,revision:++posts+1};}return {account,state:saved,revision:posts+1};},mount=()=>mountAssessment({host,api,toast:m=>messages.push(m)}),tick=()=>new Promise(setImmediate);
 const order=()=>[...host.querySelectorAll('[data-pane=evaluation] [data-select]')].map(n=>n.dataset.select);
 const select=async value=>{const node=host.querySelector('[data-roster-sort]');assert(node,host.textContent+' '+messages.join('；'));assert(!node.disabled);node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();};
 try{await mount();await select('totalCV');assert.deepEqual(order(),['Furina','Bennett','Jean']);await select('effectiveRolls');assert.deepEqual(order(),['Jean','Bennett','Furina']);await select('custom');const move=host.querySelector('[data-ae=roster-move][data-key=Jean][data-neighbor=Bennett]');assert(!move.disabled);move.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();assert.deepEqual(order(),['Bennett','Jean','Furina']);disposeAssessment();await tick();await mount();assert.deepEqual(order(),['Bennett','Jean','Furina']);assert.deepEqual(saved.good,original);assert.equal(JSON.parse(saved.engineStorage['wiki.assessment-roster.v1']).sort,'custom');assert.deepEqual(messages,[]);
 }finally{disposeAssessment();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});

