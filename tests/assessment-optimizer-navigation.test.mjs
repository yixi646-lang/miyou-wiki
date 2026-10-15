import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {SLOTS,blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {assignedGOOD} from '../modules/character-assessment/core/optimizer.mjs';
import {optimizeArtifactInventory as optimizeInventory} from '../modules/character-assessment/core/optimizer-search.mjs';
import {calculatePreparedTeam} from '../modules/character-assessment/core/artifact-triggers.mjs';
import {calculateTeam} from '../modules/character-assessment/core/combat.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';

const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const settingsKey='wiki.loadout-recommendation.v1';

test('单人与全队按范围计算和展示，分别缓存，跨栏目及实例保留结果，载入后直接对比基准伤害',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
 const {document,window}=parseHTML('<html><body><main class="assessment-root"><div data-pane></div></main></body></html>');
 const prior={document:globalThis.document,Worker:globalThis.Worker,CSS:globalThis.CSS};let active=null,bench;const workers=[];
 Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
 Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');},configurable:true});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))String(o.value)===String(v)?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
 globalThis.document=document;
 globalThis.CSS={escape:v=>String(v).replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c)};
 globalThis.Worker=class{
  constructor(){workers.push(this);}
  postMessage(message){if(message.type!=='start')return;this.input=message.input;this.done=optimizeInventory(message.input,{progress:value=>this.onmessage?.({data:{type:'progress',value}})}).then(value=>{this.value=value;this.onmessage?.({data:{type:'done',value}});});}
  terminate(){}
 };
 let state=blankState(),account={id:'optimizer-navigation-test',locked:true};const messages=[];
 state.selected='Furina';state.good.characters=['Jean','Furina'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:6,skill:10,burst:10}}));
 state.good.weapons=['Jean','Furina'].map(location=>({key:'FavoniusSword',location,level:90,ascension:6,refinement:5,lock:true}));
 const artifact=(slot,location,substats=[{key:'critDMG_',value:7.8},{key:'enerRech_',value:5.2}])=>({slotKey:slot,setKey:'GoldenTroupe',location,rarity:5,level:20,mainStatKey:{flower:'hp',plume:'atk',sands:'hp_',goblet:'hydro_dmg_',circlet:'critRate_'}[slot],substats,lock:false});
 state.good.artifacts=['Jean','Furina'].flatMap(key=>SLOTS.map(slot=>artifact(slot,key)));
 state.good.artifacts.push(artifact('flower','',[{key:'critDMG_',value:31.1},{key:'hp_',value:23.3}]));
 state.goals={Jean:defaultGoal('healer','anemo'),Furina:defaultGoal('hp','hydro')};
 const scenario={...defaultScenario(),members:['Furina'],active:'Furina',characters:{Furina:{bonusStats:{hp:100}}}};
 const initialTeam=calculateTeam(state.good,'Jean',scenario);scenario.combo=['Jean','Furina'].map(owner=>({owner,path:initialTeam.rows.find(r=>r.owner===owner&&r.group==='normal'&&r.average>0).path,count:1,reaction:''}));
 writeWorkspace(state,{...readWorkspace(state),activeTeamId:'team',teams:[{id:'team',name:'芙宁娜双人队',character:'Jean',members:['Jean','Furina'],scenario}]});
 state.engineStorage[settingsKey]=JSON.stringify({character:'Furina',team:'team',scope:'single',objective:'weightedRolls',pool:4,budget:20,rules:{borrow:false,useGoal:false}});
 const original=structuredClone(state.good),pane=document.querySelector('[data-pane]');
 const make=()=>createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,readAccount:()=>account,readGoal:(key=state.selected)=>state.goals[key],catalog,data,selectionHTML:()=>'',changed:()=>{},toast:m=>messages.push(m),isReadOnly:()=>account.locked});
 const q=s=>document.querySelector(s),click=s=>{const n=q(s);assert(n,s);assert(!n.disabled,s);n.focus();n.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const nav=async page=>{const n=q(`[data-native-page="${page}"]`);assert(n);await bench.click(n);};
 try{
  bench=make();bench.render();await nav('optimizer');assert.match(pane.textContent,/建议优先选择适配套装进行计算/);click('[data-opt=start]');await workers[0].done;assert.equal(workers.length,1);assert(workers[0].value.results.length);
  const resultsHTML=q('[data-opt-results]').innerHTML;
  const originalResults=structuredClone(workers[0].value.results),originalGood=structuredClone(state.good);
  click('[data-opt="sort-results"][data-mode="changes"]');assert.equal(q('[data-opt="sort-results"][data-mode="changes"]').getAttribute('aria-pressed'),'true');assert.match(q('.ae-opt-result').textContent,/换件 \d+ 件 · 借用 \d+ 件/);
  const tolerance=q('[data-opt-tolerance]');tolerance.focus();tolerance.value='2';tolerance.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(q('[data-opt-tolerance]'),tolerance);assert.equal(document.activeElement,tolerance);assert.equal(workers.length,1);assert.equal(q('[data-opt-result-note]').hidden,true);
  assert.deepEqual(workers[0].value.results,originalResults);assert.deepEqual(state.good,originalGood);assert(q('[data-opt=apply]').disabled);
  tolerance.value='1';tolerance.dispatchEvent(new window.Event('change',{bubbles:true}));click('[data-opt="sort-results"][data-mode="score"]');assert.equal(q('[data-opt-results]').innerHTML,resultsHTML);
  assert.deepEqual([...q('.ae-opt-result').querySelectorAll('.ae-optimizer-builds strong')].map(n=>n.textContent),['芙宁娜']);
  assert.equal(workers[0].input.scope,'single');assert.equal(workers[0].value.availability.length,5);
  click('[data-opt=view]');assert.equal(q('dialog').querySelectorAll('.ae-opt-result-member').length,1);assert.equal(q('dialog .ae-opt-result-member h3').textContent,'芙宁娜');assert.match(q('dialog').textContent,/单人伤害/);assert.match(q('dialog').textContent,/当前角色固定动作组合总期望/);click('dialog [data-analysis-close]');
  click('[data-opt=artifacts]');assert.equal(q('dialog').querySelectorAll('[data-analysis-part]').length,5);assert(!q('dialog [data-opt-full-member="Jean"]'));click('dialog [data-analysis-close]');
  const scope=value=>{const n=q('[data-opt-field=scope]');n.value=value;n.dispatchEvent(new window.Event('change',{bubbles:true}));};
  scope('team');assert(!q('[data-opt=view]'));click('[data-opt=start]');await workers[1].done;assert.equal(workers[1].input.scope,'team');assert.equal(workers[1].value.availability.length,10);
  const teamResultsHTML=q('[data-opt-results]').innerHTML;assert.deepEqual([...q('.ae-opt-result').querySelectorAll('.ae-optimizer-builds strong')].map(n=>n.textContent),['芙宁娜','琴']);assert.equal(q('.ae-opt-result').querySelectorAll('[data-opt-panel-member]').length,2);
  click('[data-opt=view]');assert.equal(q('dialog').querySelectorAll('.ae-opt-result-member').length,2);assert.match(q('dialog').textContent,/全队伤害/);assert.match(q('dialog').textContent,/全队固定动作组合总期望/);click('dialog [data-analysis-close]');
  click('[data-opt=artifacts]');assert.equal(q('dialog').querySelectorAll('[data-analysis-part]').length,10);assert(q('dialog [data-opt-full-member="Jean"]'));click('dialog [data-analysis-close]');
  scope('single');assert.equal(q('[data-opt-results]').innerHTML,resultsHTML);scope('team');assert.equal(q('[data-opt-results]').innerHTML,teamResultsHTML);assert.equal(workers.length,2);scope('single');
  click('[data-opt=save]');assert.match(messages.pop(),/当前账号.*队伍与伤害 → 队伍配装方案与对比.*芙宁娜双人队.*芙宁娜圣遗物方案/);assert.equal(readWorkspace(state).teamPlans.at(-1).teamId,'team');
  await nav('teams');await nav('optimizer');assert.equal(q('[data-opt-results]').innerHTML,resultsHTML);assert.equal(workers.length,2);
  bench.render();assert.equal(q('[data-opt-results]').innerHTML,resultsHTML);
  bench.dispose();state=structuredClone(state);bench=make();bench.render();await nav('optimizer');assert.equal(q('[data-opt-results]').innerHTML,resultsHTML);assert.equal(workers.length,2);
  account={...account,id:'other-optimizer-account'};bench.reset();bench.render();assert(!q('[data-opt=view]'));account={...account,id:'optimizer-navigation-test'};bench.reset();bench.render();assert(q('[data-opt=view]'));
  const max=q('.ae-opt-range [data-opt-bound=max]');max.value='99999';max.dispatchEvent(new window.Event('change',{bubbles:true}));assert(q('[data-opt=view]'));assert.match(q('[data-opt-result-note]').textContent,/条件或词条权重已修改/);max.value='';max.dispatchEvent(new window.Event('change',{bubbles:true}));
  const oldScenario=structuredClone(readWorkspace(state).teams[0].scenario),updated=readWorkspace(state);updated.teams[0].scenario.characters.Furina.bonusStats.hp=900;writeWorkspace(state,updated);bench.render();
  assert.match(q('[data-opt-result-note]').textContent,/条件或词条权重已修改/);for(const action of ['trial','save']){const snapshot=structuredClone(readWorkspace(state));click(`[data-opt=${action}]`);assert.match(messages.pop(),/队伍条件.*重新计算/);assert.deepEqual(readWorkspace(state),snapshot);assert.equal(bench.getPage(),'optimizer');}
  const restored=readWorkspace(state);restored.teams[0].scenario=oldScenario;writeWorkspace(state,restored);bench.render();
  state.good.artifacts.push(artifact('flower',''));bench.render();assert(q('[data-opt=view]'));assert.match(q('[data-opt-result-note]').textContent,/实际角色或库存已变化/);click('[data-opt=trial]');assert.match(messages.pop(),/重新计算/);
  state.good=structuredClone(original);bench.render();assert.equal(q('[data-opt-result-note]').hidden,true);
  click('[data-opt=trial]');assert.equal(bench.getPage(),'teams');const comparison=q('[data-native-comparison]');assert(comparison);assert.match(comparison.textContent,/基准配装期望/);assert.match(comparison.textContent,/当前方案期望/);assert(!comparison.textContent.includes('切换装备后在这里显示'));
  assert.equal(comparison.closest('[data-team-panel]').hidden,false);
  assert.deepEqual(readWorkspace(state).teams[0].scenario,oldScenario);assert.match(q('[data-team-trial-status]').textContent,/正在展示.*推荐方案/);assert(q('.ae-damage-context [data-native=clear-plan-preview]'));
  assert.equal(q('[data-team-baseline-label]').textContent,'计算基准：当前账号装备');
  const next=assignedGOOD(original,workers[0].value.results[0].assignment),savedScenario=readWorkspace(state).teams[0].scenario,preparation={targetKey:workers[0].input.targetKey,objective:workers[0].input.objective},expected=calculatePreparedTeam(next,'Jean',savedScenario,preparation),before=calculatePreparedTeam(original,'Jean',savedScenario,preparation);
  assert.deepEqual(bench.getResult(),expected);const changedRow=expected.rows.find(r=>r.owner==='Furina'&&r.average>0&&r.variant!=='heal'&&r.average!==before.rows.find(b=>b.owner===r.owner&&b.path===r.path)?.average);assert(changedRow);
  const old=before.rows.find(r=>r.owner==='Furina'&&r.path===changedRow.path);assert(comparison.textContent.includes(old.average.toFixed(1)));assert(comparison.textContent.includes(changedRow.average.toFixed(1)));
  assert.deepEqual(state.good,original);await nav('optimizer');assert(q('[data-opt=view]'));assert.equal(workers.length,2);
 }finally{bench?.dispose();for(const worker of workers)worker.terminate();for(const[k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
