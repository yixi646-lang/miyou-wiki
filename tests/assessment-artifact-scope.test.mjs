import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {damageFixture} from './fixtures/assessment-damage.mjs';
import {SLOTS,equipment,blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {rollValues} from '../modules/character-assessment/core/evaluate.mjs';
import {optimizeArtifactInventory} from '../modules/character-assessment/core/optimizer-search.mjs';
import {validateOptimizerRules,optimizerEligibleCandidates} from '../modules/character-assessment/core/optimizer.mjs';
import {artifactFromDraft,analyzeArtifact,substatTiers} from '../modules/character-assessment/core/artifacts.mjs';
import {optimizeTheory,artifactPotential,researchObjective,withResearchArtifacts} from '../modules/character-assessment/core/artifact-research.mjs';
import {createOptimizer} from '../modules/character-assessment/optimizer-ui.mjs';
import {createArtifactResearch,createArtifactPotential} from '../modules/character-assessment/artifact-research-ui.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const metrics=['weightedRolls','effectiveRolls','cv'];
const manual=(good,key,objective,weights)=>equipment(good,key).artifacts.reduce((n,a)=>{const r=rollValues(a,data,weights);return n+(objective==='cv'?r.cv:objective==='weightedRolls'?r.effective:r.details.filter(s=>s.weight>0).reduce((v,s)=>v+s.rolls,0));},0);
const close=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} / ${b}`);
const goalsFor=key=>({[key]:{weights:{critRate_:0.2,critDMG_:0.2,enerRech_:2}}});
const unfinished=(rarity=5)=>artifactFromDraft({setKey:rarity===5?'MarechausseeHunter':'Instructor',rarity,level:rarity*4-4,slotKey:'flower',mainStatKey:'hp',initialCount:rarity===5?4:3,lines:['hp_','critRate_','critDMG_','enerRech_'].map((key,i)=>({key,counts:[0,0,0,i===3?rarity===5?5:3:1]}))},data);

test('指定部位搜索：单件与多件搜索保持其他装备，固定件不受满级、主词条和自定义筛选排除',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette');scenario.members=[];
 const fixed=good.artifacts.find(a=>a.location===key&&a.slotKey==='sands');fixed.level=0;fixed.wikiCustom=true;fixed.lock=true;
 const flower=good.artifacts.find(a=>a.location===key&&a.slotKey==='flower');good.artifacts.push({...flower,id:'better-flower',location:'',substats:[{key:'critRate_',value:15.6},{key:'critDMG_',value:15.5}]});
 const plume=good.artifacts.find(a=>a.location===key&&a.slotKey==='plume');good.artifacts.push({...plume,id:'better-plume',location:'',substats:[{key:'critRate_',value:15.6},{key:'critDMG_',value:15.5}]});
 const snapshot=structuredClone(good),request={good,key,scenario,catalog,data,objective:'cv',scope:'single',pool:10,budget:100,rules:{searchSlots:['flower'],borrow:false,includeCustom:false,excludeLocked:true,mainStats:{sands:'atk_'}}};
 const fixedIndex=good.artifacts.indexOf(fixed);assert.deepEqual(optimizerEligibleCandidates(good,key,'sands',request),[fixedIndex]);
 const one=await optimizeArtifactInventory(request);assert(one.results.length,one.diagnostics.join('；'));assert(one.availability.filter(a=>a.fixed).every(a=>a.eligible===1));
 for(const result of one.results){for(const slot of SLOTS.filter(s=>s!=='flower'))assert.equal(result.assignment[key].artifacts[slot],good.artifacts.findIndex(a=>a.location===key&&a.slotKey===slot));close(result.score,manual(result.good??withResearchArtifacts(good,key,Object.values(result.assignment[key].artifacts).map(i=>good.artifacts[i])),key,'cv',{}));}
 assert.equal(good.artifacts[one.results[0].assignment[key].artifacts.flower].id,'better-flower');
 const two=await optimizeArtifactInventory({...request,rules:{...request.rules,searchSlots:['flower','plume']}});assert(two.results.length);assert.equal(good.artifacts[two.results[0].assignment[key].artifacts.plume].id,'better-plume');assert(two.results[0].score>one.results[0].score);
 assert.deepEqual(good,snapshot);for(const slots of [[],['flower','flower'],['invalid']])assert.throws(()=>validateOptimizerRules({searchSlots:slots}),/计算部位/);
});

test('指定部位搜索：全队固定件不可借走，单人可以借用队友，缺少固定件与四件套冲突不放宽规则',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette');scenario.members=['Furina'];
 const frozen=good.artifacts.find(a=>a.location==='Furina'&&a.slotKey==='plume');frozen.substats=[{key:'critRate_',value:23.3}];
 const flower=good.artifacts.find(a=>a.location==='Furina'&&a.slotKey==='flower');flower.substats=[{key:'critRate_',value:23.3}];
 const rules={searchSlots:['flower'],borrow:true,includeCustom:true},request={good,key,scenario,catalog,data,objective:'cv',scope:'team',pool:10,budget:100,rules,memberRules:{[key]:rules,Furina:rules}};
 const team=await optimizeArtifactInventory(request);assert(team.results.length,team.diagnostics.join('；'));for(const r of team.results){assert.equal(new Set(Object.values(r.assignment).flatMap(b=>Object.values(b.artifacts))).size,10);for(const role of [key,'Furina'])for(const slot of SLOTS.filter(s=>s!=='flower'))assert.equal(r.assignment[role].artifacts[slot],good.artifacts.findIndex(a=>a.location===role&&a.slotKey===slot));}
 good.artifacts.find(a=>a.location===key&&a.slotKey==='flower').level=0;
 const borrowed=await optimizeArtifactInventory({...request,scope:'single'});assert(borrowed.results.length,borrowed.diagnostics.join('；'));assert.equal(borrowed.results[0].assignment[key].artifacts.flower,good.artifacts.indexOf(flower));assert.equal(borrowed.results[0].assignment.Furina.artifacts.flower,-1);
 const empty=structuredClone(good);empty.artifacts=empty.artifacts.filter(a=>!(a.location===key&&a.slotKey==='sands'));
 const missing=await optimizeArtifactInventory({...request,good:empty,scope:'single'});assert.equal(missing.results.length,0);assert(missing.diagnostics.some(s=>s.includes('时之沙')&&s.includes('当前未装备')));
 const conflict=await optimizeArtifactInventory({...request,scope:'single',rules:{...rules,setMode:'four',set1:'MarechausseeHunter'}});assert.equal(conflict.results.length,0);
});

test('研究词条目标：三个目标与现有评价一致，理论分配优化权重方向且只统计副词条',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),goals=goalsFor(key),snapshot=structuredClone(good),config=Object.fromEntries(equipment(good,key).artifacts.map(a=>[a.slotKey,{setKey:a.setKey,mainStatKey:a.mainStatKey}]));
 for(const objective of metrics){const result=optimizeTheory({good,key,scenario,data,goals,objective,config,freeRolls:20});close(result.before,manual(good,key,objective,goals[key].weights));const after=withResearchArtifacts(good,key,result.artifacts);close(result.value,manual(after,key,objective,goals[key].weights));assert(result.value>result.before);assert(result.artifacts.every(a=>analyzeArtifact(a,data).valid));if(objective==='weightedRolls')assert(result.addedRolls.enerRech_>result.addedRolls.critRate_);}
 const original=researchObjective(good,key,scenario,'cv',key,{data,goals});const changed=structuredClone(good);changed.artifacts.find(a=>a.location===key&&a.slotKey==='circlet').mainStatKey='critRate_';assert.equal(researchObjective(changed,key,scenario,'cv',key,{data,goals}),original);assert.deepEqual(good,snapshot);
});

test('研究词条目标：潜力均值按 GO 强化概率计算，四五星分母正确，强化重塑定义均可复算具体结果',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),goals=goalsFor(key),snapshot=structuredClone(good);
 for(const rarity of [4,5]){const artifact=unfinished(rarity);for(const objective of metrics){const weights=goals[key].weights,options={data,goals},base=withResearchArtifacts(good,key,[artifact]),before=manual(base,key,objective,weights);
   // 最后一次强化：四条副属性等概率；一次有效词条的均值为1，四星加权按五星参考折算。
   const coefficients=artifact.substats.map(s=>objective==='cv'?s.key==='critRate_'?2:s.key==='critDMG_'?1:0:objective==='effectiveRolls'?(weights[s.key]>0?1/substatTiers(data,rarity,s.key).reduce((n,v)=>n+v,0)*4:0):(weights[s.key]??0)/substatTiers(data,5,s.key).reduce((n,v)=>n+v,0)*4);
   const increment=artifact.substats.reduce((n,s,i)=>n+coefficients[i]*substatTiers(data,rarity,s.key).reduce((n,v)=>n+v,0)/4,0)/4;
   const run=artifactPotential({good,key,scenario,data,goals,artifact,mode:'upgrade',objective,threshold:before});assert(Math.abs(run.average-(before+increment))<0.2,`${objective} ${rarity}: ${run.average} / ${before+increment}`);assert(run.examples.length);for(const e of run.examples)close(e.value,manual(withResearchArtifacts(good,key,[e.artifact]),key,objective,weights));assert(run.probability>=0&&run.probability<=1);
  }}
 const artifact=unfinished();for(const mode of ['reshape','define'])for(const objective of metrics){const base=mode==='reshape'?artifactPotential({good,key,scenario,data,goals,artifact,mode:'upgrade',objective}).examples[0].artifact:{...artifact,level:0};const request={good,key,scenario,data,goals,artifact:base,mode,objective,affixes:['critRate_','critDMG_']};if(mode==='reshape')request.initialValues=Object.fromEntries(base.substats.map(s=>[s.key,s.initialValue??substatTiers(data,5,s.key).at(-1)]));const r=artifactPotential(request);assert(Number.isFinite(r.average));assert(r.examples.length);for(const e of r.examples){assert(analyzeArtifact(e.artifact,data).valid);close(e.value,manual(withResearchArtifacts(good,key,[e.artifact]),key,objective,goals[key].weights));}}
 assert.deepEqual(good,snapshot);
});

test('新增配装控件代表交互：部位保存、当前配装只读浮层、三个目标进入请求、分析进度与取消续算',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main class="assessment-root"><div data-optimizer></div><div data-potential></div></main></body></html>');
 const prior={document:globalThis.document,CSS:globalThis.CSS,Worker:globalThis.Worker},workers=[],notices=[];let active=null,optimizer,research,potential;
 Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');},configurable:true});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))String(o.value)===String(v)?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};globalThis.document=document;globalThis.CSS={escape:v=>v};globalThis.Worker=class{constructor(url){this.url=url;workers.push(this);}postMessage(message){this.message=message;}terminate(){this.stopped=true;}emit(data){this.onmessage?.({data});}};
 const {good,key,scenario}=damageFixture('Neuvillette');good.artifacts.push(unfinished(),{...unfinished(),id:'second-candidate'});const state=blankState();state.good=good;state.selected=key;state.goals=Object.fromEntries(good.characters.map(c=>[c.key,defaultGoal('hp','hydro')]));
 const snapshot=structuredClone(good),team={id:'new-controls',name:'新控件测试队',members:[key,...scenario.members],scenario};state.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,independentTeams:true,scenarios:{},teams:[team],activeTeamId:team.id,plans:{},teamPlans:[]});
 const root=document.querySelector('main'),q=s=>document.querySelector(s),click=s=>{const n=q(s);assert(n,s);assert(!n.disabled,s);n.focus();n.dispatchEvent(new window.Event('click',{bubbles:true}));},shared={root,catalog,data,readState:()=>state,readGoal:k=>state.goals[k],changed(){},recordUndo(){},toast:m=>notices.push(m),onTrial(){}};
 try{
  optimizer=createOptimizer({...shared,readSelected:()=>key,readAccount:()=>({locked:true}),replaceState(){throw Error('只读');}});optimizer.render(q('[data-optimizer]'));
  click('[data-opt="select-slots"][data-slot="flower"]');assert.equal(q('[data-opt-main="sands"]').disabled,true);click('[data-opt="select-slots"][data-slot="plume"]');let settings=JSON.parse(state.engineStorage['wiki.loadout-recommendation.v1']);assert.deepEqual(settings.rules.searchSlots,['flower','plume']);
  click('[data-opt="view-current-loadout"]');assert.equal(q('dialog [data-current-loadout]').dataset.currentLoadout,key);assert.equal(q('dialog .ae-current-artifacts').children.length,5);assert(q('.ae-current-weapon').textContent.includes(catalog.weapons[equipment(good,key).weapon.key].name));click('dialog [data-analysis-close]');assert.equal(document.activeElement,q('[data-opt="view-current-loadout"]'));
  click('[data-opt="start"]');assert.deepEqual(workers.at(-1).message.input.rules.searchSlots,['flower','plume']);optimizer.dispose();
  research=createArtifactResearch({...shared,readGOOD:()=>state.good,readContext:()=>({key,members:team.members,scenario,name:team.name}),onSavePlan(){}});research.openTheory();click('[data-research="choose-objective"]');for(const value of metrics)assert(q(`[data-opt-objective-choice][data-target="${key}"][data-value="${value}"]`));click(`[data-opt-objective-choice][data-target="${key}"][data-value="weightedRolls"]`);click('[data-research="calculate"]');assert.equal(workers.at(-1).message.request.objective,'weightedRolls');assert.deepEqual(workers.at(-1).message.request.goals,state.goals);research.close();
  potential=createArtifactPotential({...shared,readContext:()=>({role:key,activeTeam:team,teams:[team]})});potential.open();potential.mount(q('[data-potential]'));
  click('[data-potential="view-current-loadout"]');assert.equal(q('dialog [data-current-loadout]').dataset.currentLoadout,key);click('[data-analysis-close]');assert.equal(document.activeElement,q('[data-potential="view-current-loadout"]'));
  click('[data-potential="choose-objective"]');for(const value of metrics)assert(q(`[data-opt-objective-choice][data-target="${key}"][data-value="${value}"]`));click(`[data-opt-objective-choice][data-target="${key}"][data-value="cv"]`);click('[data-potential="calculate"]');const worker=workers.at(-1);assert.equal(worker.message.request.objective,'cv');assert.deepEqual(worker.message.request.goals,state.goals);assert.equal(q('[data-potential-progress]').hidden,false);assert.match(q('[data-potential-status]').textContent,/正在分析.*0 \/ 2/);assert.equal(q('[data-potential-progress] progress').getAttribute('value'),'0');
  const item=worker.message.items[0],value=artifactPotential({...worker.message.request,...item});worker.emit({type:'item',id:item.id,value});assert.match(q('[data-potential-status]').textContent,/1 \/ 2/);assert.equal(q('[data-potential-progress] progress').getAttribute('value'),'1');click('[data-potential="cancel"]');assert(worker.stopped);assert.match(q('[data-potential-status]').textContent,/已取消.*1 \/ 2/);
  click('[data-potential="calculate"]');const resumed=workers.at(-1);assert.equal(resumed.message.items.length,1);const last=resumed.message.items[0];resumed.emit({type:'item',id:last.id,value:artifactPotential({...resumed.message.request,...last})});resumed.emit({type:'done'});assert.match(q('[data-potential-status]').textContent,/分析完成.*2 \/ 2/);assert.equal(q('[data-potential-progress] b').textContent,'100%');assert.deepEqual(state.good,snapshot);assert.deepEqual(notices,[]);
 }finally{optimizer?.dispose();research?.dispose();potential?.dispose();for(const w of workers)w.terminate();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
