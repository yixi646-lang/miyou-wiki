import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Worker as Thread} from 'node:worker_threads';
import {SLOTS,blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {optimizeInventory,assignedGOOD,optimizerCandidates,optimizerEligibleCandidates,validateOptimizerRules,OPTIMIZER_METRICS} from '../modules/character-assessment/core/optimizer.mjs';
import {optimizeArtifactInventory,supplementalSearchBranches} from '../modules/character-assessment/core/optimizer-search.mjs';
import {calculateTeam} from '../modules/character-assessment/core/combat.mjs';
import {rollValues} from '../modules/character-assessment/core/evaluate.mjs';
import {createOptimizer} from '../modules/character-assessment/optimizer-ui.mjs';
test('配装入口直接选择队伍，单人角色浮层支持搜索和星级元素组合筛选',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main class="assessment-root"><div data-host></div></main></body></html>');
 const prior={document:globalThis.document,Worker:globalThis.Worker};let active=null,optimizer,terminated=false;
 Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');},configurable:true});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))String(o.value)===String(v)?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
 globalThis.document=document;globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 const state=blankState();state.good=fixture();state.good.characters.push({...structuredClone(character),key:'Fischl'});state.selected='Furina';state.goals.Furina=defaultGoal('hp','hydro');state.goals.Fischl=defaultGoal('attack','electro');
 state.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,independentTeams:true,scenarios:{},teams:[{id:'furina-team',name:'芙宁娜队',members:['Furina','Fischl'],scenario:{...scenario,active:'Furina'}},{id:'fischl-team',name:'菲谢尔队',members:['Fischl'],scenario}],plans:{},teamPlans:[]});
 const oldTarget=input(state.good).objective;state.engineStorage['wiki.loadout-recommendation.v1']=JSON.stringify({character:'Furina',team:'furina-team',objective:oldTarget});const original=structuredClone(state.good),messages=[];
 try{
  const host=document.querySelector('[data-host]'),q=s=>document.querySelector(s),click=s=>{const node=q(s);assert(node,s);assert(!node.disabled,s);node.focus();node.dispatchEvent(new window.Event('click',{bubbles:true}));},choices=()=>[...q('dialog').querySelectorAll('[data-catalog-choice]')].map(b=>b.dataset.catalogChoice);
  optimizer=createOptimizer({readState:()=>state,readSelected:()=>state.selected,readGoal:k=>state.goals[k],readAccount:()=>({locked:true}),catalog,data,changed:()=>{},replaceState:()=>{throw Error('不能修改装备');},toast:m=>messages.push(m),onTrial:()=>{}});optimizer.render(host);
  assert.equal(q('[data-opt=choose-character]'),null);assert.equal(q('[data-opt=set-target]'),null);assert.equal(q('[data-opt-field=character]').value,'Furina');
  assert(q('[data-opt-field=team] option[value=fischl-team]'));assert.match(q('[data-opt-team-hint]').textContent,/伤害.*战斗面板.*完整队伍.*非战斗面板.*单人队/);assert.equal(q('.ae-opt-targets').parentElement,q('.ae-opt-context'));assert.equal(q('[data-opt-team-hint]').previousElementSibling,q('.ae-opt-context'));assert(q('[data-opt=set-scope][data-value=team]'));
  click('[data-opt=set-scope][data-value=Fischl]');assert.equal(q('[data-opt-field=team]').value,'furina-team');assert.equal(q('[data-opt-field=searchKey]').value,'Fischl');assert.match(q('.ae-opt-member-title').textContent,/菲谢尔/);assert.match(q('[data-opt-objective-label]').textContent,/芙宁娜/);
  click('[data-opt=set-scope][data-value=team]');const teamInput=q('[data-opt-field=team]');teamInput.value='fischl-team';teamInput.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(q('[data-opt-field=character]').value,'Fischl');assert.equal(q('[data-opt-field=team]').value,'fischl-team');assert.equal(q('[data-opt=set-scope][data-value=team]'),null);assert.equal(q('[data-opt-field=scope]').value,'single');assert.equal(q('[data-opt=set-scope][data-value=Fischl]').getAttribute('aria-pressed'),'true');
  click('[data-opt=choose-solo]');assert.equal(q('dialog').open,true);assert.deepEqual(choices().sort(),['Fischl','Furina']);assert.equal(q('[data-catalog-choice=Neuvillette]'),null);
  click('[data-catalog-filter=rarity][data-value="4"]');assert.deepEqual(choices(),['Fischl']);click('[data-catalog-filter=element][data-value=hydro]');assert.equal(choices().length,0);click('[data-catalog-filter=element][data-value=electro]');assert.deepEqual(choices(),['Fischl']);
  click('[data-catalog-clear]');const search=q('[data-catalog-search]');search.value='芙宁娜';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.deepEqual(choices(),['Furina']);assert.equal(q('[data-catalog-search]'),search);
  search.value='菲谢尔';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.deepEqual(choices(),['Fischl']);click('[data-catalog-choice=Fischl]');
  assert.equal(q('dialog'),null);assert.equal(q('[data-opt-field=character]').value,'Fischl');assert.equal(q('[data-opt-field=searchKey]').value,'Fischl');assert.equal(document.activeElement,q('[data-opt=choose-solo]'));assert.equal(document.body.style.overflow??'','');
  assert.equal(q('[data-opt-field=team]').value,'solo:Fischl');assert.match(q('[data-opt-field=team] option[selected]').textContent,/菲谢尔.*单人队/);assert.equal(q('[data-opt=set-scope][data-value=team]'),null);assert.notEqual(q('[data-opt-field=objective]').value,oldTarget);
  const prefs=JSON.parse(state.engineStorage['wiki.loadout-recommendation.v1']);assert.equal(prefs.character,'Fischl');assert.equal(prefs.team,'');
  click('[data-opt=choose-solo]');click('dialog [data-analysis-close]');assert.equal(q('[data-opt-field=team]').value,'solo:Fischl');
  click('[data-opt=start]');assert.equal(q('[data-opt=choose-solo]').disabled,true);assert.deepEqual(state.good,original);assert.deepEqual(messages,[]);
 }finally{optimizer?.dispose();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
 assert(terminated);
});
test('推荐界面支持属性范围、套装浮层、结果面板和只读圣遗物分析',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
 const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main class="assessment-root"><div data-host></div></main></body></html>');
 const prior={document:globalThis.document,Worker:globalThis.Worker};let active=null,optimizer,workers=[];
 Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
 Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
 Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');},configurable:true});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))String(o.value)===String(v)?o.setAttribute('selected',''):o.removeAttribute('selected');},configurable:true});
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
 globalThis.document=document;globalThis.Worker=class{
  constructor(url,options){assert.equal(url,'/assessment/optimizer-worker.mjs');assert.equal(options.type,'module');workers.push(this);}
  postMessage(message){if(message.type==='cancel'){this.stop=true;return;}this.done=optimizeInventory(message.input,{progress:value=>this.onmessage?.({data:{type:'progress',value}}),cancelled:()=>this.stop}).then(value=>this.onmessage?.({data:{type:'done',value}}),error=>this.onmessage?.({data:{type:'error',message:error.message}}));}
  terminate(){this.stop=true;}
 };
 const state=blankState();state.good=fixture();state.selected='Furina';state.goals.Furina=defaultGoal('hp','hydro');const original=structuredClone(state.good),messages=[],account={locked:true};let saves=0,replaced=0;
 try{
  const host=document.querySelector('[data-host]'),q=s=>document.querySelector(s),change=(node,value)=>{node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));},click=s=>{const node=q(s);assert(node,s);assert(!node.disabled,s);node.focus();node.dispatchEvent(new window.Event('click',{bubbles:true}));};
  optimizer=createOptimizer({readState:()=>state,readSelected:()=>state.selected,readGoal:()=>state.goals.Furina,readAccount:()=>account,catalog,data,changed:()=>saves++,replaceState:()=>replaced++,toast:m=>messages.push(m),onTrial:()=>{}});optimizer.render(host);
  assert.equal(q('.ae-opt-filters').tagName,'SECTION');assert.equal(q('.ae-opt-filters summary'),null);
  change(q('[data-opt-rule=setMode]'),'four');assert.equal(q('[data-opt-set-wrap=set2]').hidden,true);
  click('[data-opt=choose-set][data-field=set1]');assert.equal(q('dialog').open,true);assert.equal(document.body.style.overflow,'hidden');assert(q('[data-catalog-search]'));
  click('[data-catalog-choice=GoldenTroupe]');assert.equal(q('dialog'),null);assert.equal(q('[data-opt-rule=set1]').value,'GoldenTroupe');assert.equal(document.activeElement,q('[data-opt=choose-set][data-field=set1]'));
click('[data-opt=add-range]');const row=[...host.querySelectorAll('.ae-opt-range')].find(r=>r.querySelector('[data-opt-stat]').value==='critRate_'),min=row.querySelector('[data-opt-bound=min]');min.focus();change(min,'10');assert.equal(document.activeElement,min);assert.equal(row.querySelector('[data-opt-bound=min]'),min);const max=row.querySelector('[data-opt-bound=max]');change(max,'90');
  change(q('[data-opt-field=objective]'),'effectiveRolls');assert.match(q('[data-opt-objective-label]').textContent,/有效副词条/);assert.equal(q('[data-opt-objective-description]'),null);assert.equal(q('[data-opt-metric-help]'),null);
  change(q('[data-opt-field=objective]'),'weightedRolls');assert.match(q('[data-opt-objective-label]').textContent,/加权评分/);click('[data-opt=start]');assert(q('[data-opt=cancel]').disabled===false);await workers.at(-1).done;
  assert(q('[data-opt=view]'));assert(q('[data-opt=apply]').disabled);assert.match(q('[data-opt-status]').textContent,/计算完成/);
  click('[data-opt=view]');assert.match(q('dialog').textContent,/伤害与治疗/);assert.match(q('dialog').textContent,/非暴击/);assert.match(q('dialog').textContent,/暴击伤害/);click('dialog [data-analysis-close]');assert.equal(q('dialog'),null);assert.equal(document.activeElement,q('[data-opt=view]'));
  click('[data-opt=artifacts]');assert(q('dialog [data-opt-artifact-comparisons]'));assert(q('dialog [data-opt-full-analysis]'));assert.equal(q('dialog').querySelectorAll('[data-analysis-part]').length,5);assert.match(q('dialog').textContent,/本方案未更换圣遗物，无需对比/);assert.match(q('dialog').textContent,/当前装备：芙宁娜/);click('dialog [data-analysis-close]');assert.equal(q('dialog'),null);assert.equal(document.activeElement,q('[data-opt=artifacts]'));
  assert.deepEqual(state.good,original);assert.equal(replaced,0);assert.equal(messages.length,0);assert(saves>0);
  // Guard the action itself, even when another caller bypasses the disabled button.
  q('[data-opt=apply]').disabled=false;click('[data-opt=apply]');assert.match(messages.pop(),/解锁账号/);assert.equal(replaced,0);assert.deepEqual(state.good,original);
  change(max,'');assert.equal(JSON.parse(state.engineStorage['wiki.loadout-recommendation.v1']).rules.maximums.critRate_,undefined);
 }finally{optimizer?.dispose();for(const w of workers)w.terminate();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const scenario={enemyLevel:100,resistance:10,conditional:{},characters:{},members:[]};
const character={key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:6,skill:10,burst:10}};
const weapon={key:'FavoniusSword',level:90,ascension:6,refinement:5,location:'Furina',lock:true};
const artifact=(slot,setKey='GoldenTroupe',location='Furina')=>({slotKey:slot,setKey,location,rarity:5,level:20,mainStatKey:{flower:'hp',plume:'atk',sands:'hp_',goblet:'hydro_dmg_',circlet:'critRate_'}[slot],substats:[{key:'critDMG_',value:7.8},{key:'enerRech_',value:5.2}],lock:false});
const fixture=()=>({format:'GOOD',version:3,characters:[structuredClone(character)],weapons:[structuredClone(weapon)],artifacts:SLOTS.map(s=>artifact(s))});
const input=good=>({good,key:'Furina',scenario,catalog,data,goals:{Furina:defaultGoal('hp','hydro')},objective:calculateTeam(good,'Furina',scenario).rows.find(r=>r.group==='skill'&&r.average>0&&r.variant!=='heal').path,rules:{borrow:true,includeCustom:true},pool:6,budget:120});
test('配装搜索仅用五星20级和最高四星套装的四星16级，覆盖单人全队与补充搜索',async()=>{
 const good=fixture();good.artifacts.forEach(a=>{a.level=19;a.lock=true;});
 good.characters.push({...structuredClone(character),key:'Jean'});good.weapons.push({...weapon,location:'Jean'});
 for(const slot of SLOTS)good.artifacts.push(
  artifact(slot,'GoldenTroupe',''),
  {...artifact(slot,'Instructor','Jean'),rarity:4,level:16,lock:true},
  {...artifact(slot,'GoldenTroupe',''),rarity:4,level:16},
  {...artifact(slot,'Instructor',''),rarity:4,level:15},
  {...artifact(slot,'Instructor',''),rarity:3,level:12},
  {...artifact(slot,'Adventurer',''),rarity:3,level:12,substats:[]},
  {...artifact(slot,'Adventurer',''),rarity:2,level:4,substats:[]},
  {...artifact(slot,'Adventurer',''),rarity:1,level:4,substats:[]},
  {...artifact(slot,'GoldenTroupe',''),level:19,wikiCustom:true},
  {...artifact(slot,'Instructor',''),rarity:4,level:16,wikiCustom:true}
 );
 const original=structuredClone(good),options={catalog,data,rules:{borrow:true,includeCustom:true},pool:20};
 assert.deepEqual(optimizerEligibleCandidates(good,'Furina','flower',options),[5,6,14]);
 assert.deepEqual(optimizerCandidates(good,'Furina','artifacts','flower',options),[5,6,14]);
 assert.deepEqual(optimizerEligibleCandidates(good,'Furina','flower',{...options,rules:{borrow:true,includeCustom:false,excludeLocked:true}}),[5]);
 const request={...input(good),scenario:{...scenario,members:['Jean']},objective:'cv',rules:{borrow:false,includeCustom:false}};
 const plan=supplementalSearchBranches(request);assert.equal(plan.branches.length,3);assert(plan.branches.every(branch=>!branch.Furina.set1||branch.Furina.set1==='GoldenTroupe'));assert(plan.branches.every(branch=>!branch.Furina.searchTwo||branch.Furina.searchTwo==='GoldenTroupe'));
 for(const scope of ['single','team']){
  const result=await optimizeArtifactInventory({...request,scope});assert(result.results.length,result.diagnostics.join('；'));
  for(const candidate of result.results)for(const key of scope==='team'?['Furina','Jean']:['Furina'])for(const index of Object.values(candidate.assignment[key].artifacts)){
   const a=good.artifacts[index],max=Math.max(...data.art.data[a.setKey].rarities);assert(a.rarity===5&&a.level===20||max===4&&a.rarity===4&&a.level===16);
  }
  if(scope==='team')assert(result.results.every(candidate=>Object.values(candidate.assignment.Jean.artifacts).every(index=>good.artifacts[index].setKey==='Instructor')));
 }
 const low=fixture();low.artifacts.forEach(a=>{a.level=19;});const none=await optimizeInventory({...input(low),objective:'cv'});assert.equal(none.results.length,0);assert.equal(none.tested,0);assert.match(none.diagnostics.join(''),/满级要求.*五星 \+20.*四星 \+16/);
 assert.deepEqual(good,original);
});

test('单角色和全队仅搜索圣遗物，固定当前武器并保留武器库存与装备关系',async()=>{
 const good=fixture();good.characters.push({...structuredClone(character),key:'Jean'});
 good.weapons=[{...weapon,key:'SplendorOfTranquilWaters',location:'',lock:false},{...weapon,key:'DullBlade',level:1,ascension:0,refinement:1,wikiCustom:true},{...weapon,level:70,ascension:4,refinement:2,location:'Jean'}];
 for(const slot of SLOTS)good.artifacts.push({...artifact(slot,'GoldenTroupe','Jean'),...(slot==='circlet'?{mainStatKey:'hp_'}:{}),substats:[{key:'critRate_',value:11.7},{key:'critDMG_',value:15.6}]});
 const original=structuredClone(good),request={...input(good),scenario:{...scenario,members:['Jean']},rules:{borrow:true,includeCustom:false,excludeLocked:true},budget:30,pool:2};
 const stronger=structuredClone(good);stronger.weapons[1].location='';stronger.weapons[0].location='Furina';
 assert(calculateTeam(stronger,'Furina',request.scenario).rows.find(r=>r.path===request.objective).average>calculateTeam(good,'Furina',request.scenario).rows.find(r=>r.path===request.objective).average);
 assert.deepEqual(optimizerCandidates(good,'Furina','weapons','',{catalog,data,rules:request.rules}),[1]);
 for(const scope of ['single','team']){
  const result=await optimizeInventory({...request,scope});assert(result.results.length,result.diagnostics.join('；'));
  assert.equal(result.availability.length,scope==='single'?5:10);assert(result.availability.every(a=>SLOTS.includes(a.slot)));
  for(const candidate of result.results){
   assert.equal(candidate.assignment.Furina.weapon,1);assert.equal(candidate.assignment.Jean.weapon,2);
   assert(candidate.borrowed.every(a=>a.kind==='artifacts'));
   const assigned=assignedGOOD(good,candidate.assignment);assert.deepEqual(assigned.weapons,original.weapons);
   const actual=calculateTeam(assigned,'Furina',request.scenario),row=actual.rows.find(r=>r.path===request.objective);
   assert(Math.abs(candidate.score-row.average)<1e-8);assert.deepEqual(candidate.panel,actual.panel);
  }
 }
 assert.deepEqual(good,original);
});

test('角色未装备武器时不自动选择库存武器，也不把武器列为缺少候选',async()=>{
 const good=fixture();good.weapons[0].location='';const original=structuredClone(good),before=calculateTeam(good,'Furina',scenario);
 const result=await optimizeInventory({...input(good),objective:'panel:enerRech_'});assert(result.results.length,result.diagnostics.join('；'));
 assert.equal(result.tested,1);assert.equal(result.availability.length,5);
 for(const candidate of result.results){assert.equal(candidate.assignment.Furina.weapon,-1);assert.deepEqual(assignedGOOD(good,candidate.assignment).weapons,original.weapons);assert.deepEqual(candidate.panel,before.panel);}
 assert.deepEqual(good,original);
});

test('完整配装优先，四件套可用任意部位的散件；手动主词条覆盖评价范围',async()=>{
 const good=fixture();for(const slot of SLOTS)if(slot!=='goblet')good.artifacts.push({...artifact(slot,'ScarletProof',''),lock:true});good.artifacts.push({...artifact('goblet','WanderersTroupe',''),mainStatKey:'atk_'});
 const original=structuredClone(good),request={...input(good),rules:{borrow:true,setMode:'four',set1:'ScarletProof',mainStats:{goblet:'atk_'},useGoal:true}};
 const r=await optimizeInventory(request);assert(r.results.length);for(const result of r.results){const a=result.assignment.Furina.artifacts;assert.equal(SLOTS.filter(s=>good.artifacts[a[s]].setKey==='ScarletProof').length,4);assert.equal(good.artifacts[a.goblet].mainStatKey,'atk_');assert.equal(good.artifacts[a.goblet].setKey,'WanderersTroupe');}
 assert.deepEqual(good,original);
 const excluded=await optimizeInventory({...request,rules:{...request.rules,excludeLocked:true}});assert.equal(excluded.results.length,0);assert.match(excluded.diagnostics.join(''),/凑齐/);
 assert(optimizerCandidates(good,'Furina','artifacts','goblet',{catalog,goals:request.goals,rules:{useGoal:true,mainStats:{goblet:'any'}}}).includes(good.artifacts.length-1));
});
test('全部候选可遍历时，结果与穷举现有计算核心一致',async()=>{
 const good=fixture();for(const slot of ['flower','plume'])good.artifacts.push({...artifact(slot,'GoldenTroupe',''),substats:[{key:'critRate_',value:11.7},{key:'critDMG_',value:15.6}]});
 const request={...input(good),rules:{setMode:'four',set1:'GoldenTroupe'},budget:300},r=await optimizeInventory(request);assert.equal(r.candidateExhausted,true);const scores=[];for(const f of [0,5])for(const p of [1,6]){const assignment={Furina:{weapon:0,artifacts:{flower:f,plume:p,sands:2,goblet:3,circlet:4}}};scores.push(calculateTeam(assignedGOOD(good,assignment),'Furina',scenario).rows.find(row=>row.path===request.objective).average);}assert.equal(r.tested,4);assert(Math.abs(r.results[0].score-Math.max(...scores))<1e-8);
});
test('2+2保留自由第五件且所有结果满足两组套装',async()=>{
 const good=fixture();good.artifacts.push(artifact('flower','WanderersTroupe',''),artifact('plume','WanderersTroupe',''));const r=await optimizeInventory({...input(good),rules:{setMode:'two-two',set1:'GoldenTroupe',set2:'WanderersTroupe'}});assert(r.results.length);for(const result of r.results){const counts={};for(const i of Object.values(result.assignment.Furina.artifacts)){const s=good.artifacts[i].setKey;counts[s]=(counts[s]??0)+1;}assert(counts.GoldenTroupe>=2&&counts.WanderersTroupe>=2);}
});
test('属性下限上限按显示单位检查，并准确报告无解条件',async()=>{
 const good=fixture(),request=input(good),panel=calculateTeam(good,'Furina',scenario).panel;
 const r=await optimizeInventory({...request,objective:'panel:hp',rules:{minimums:{enerRech_:panel.enerRech_-1,critRate_:0},maximums:{critRate_:panel.critRate_+1}}});assert(r.results.length);assert.equal(r.results[0].score,r.results[0].panel.hp);
 const none=await optimizeInventory({...request,rules:{minimums:{enerRech_:9999}}});assert.equal(none.results.length,0);assert.match(none.diagnostics.join(''),/元素充能效率.*下限/);
 const max=await optimizeInventory({...request,rules:{maximums:{critRate_:0}}});assert.equal(max.results.length,0);assert.match(max.diagnostics.join(''),/暴击率.*上限/);
 assert.throws(()=>validateOptimizerRules({minimums:{critRate_:50},maximums:{critRate_:20}}),/下限不能大于上限/);assert.throws(()=>validateOptimizerRules({minimums:{invented:1}}),/有效属性/);
});
test('有效词条、加权等效与双暴目标复用既有评价口径，结果仍有完整伤害面板',async()=>{
 const good=fixture();good.artifacts.push({...artifact('flower','GoldenTroupe',''),substats:[{key:'hp_',value:15.2},{key:'critDMG_',value:15.6}]});const request=input(good);
 for(const objective of Object.keys(OPTIMIZER_METRICS)){const r=await optimizeInventory({...request,objective});assert(r.results.length);for(const result of r.results){const values=Object.values(result.assignment.Furina.artifacts).map(i=>rollValues(good.artifacts[i],data,request.goals.Furina.weights)),expected=values.reduce((n,v)=>n+(objective==='cv'?v.cv:objective==='weightedRolls'?v.effective:v.details.reduce((n,s)=>n+(s.weight>0?s.rolls:0),0)),0);assert(Math.abs(result.score-expected)<1e-8);assert(result.members[0].rows.length);assert(result.panel.hp>0);}}
});
test('全队搜索不会重复分配同件装备，借用队友装备会计入其面板变化',async()=>{
 const good=fixture();good.characters.push({...structuredClone(character),key:'Fischl'});good.weapons.push({...weapon,key:'FavoniusWarbow',location:'Fischl'});for(const slot of SLOTS)good.artifacts.push({...artifact(slot,'GoldenTroupe','Fischl'),...(slot==='circlet'?{mainStatKey:'hp_'}:{}),substats:[{key:'critRate_',value:11.7},{key:'critDMG_',value:15.6}]});const request={...input(good),scenario:{...scenario,members:['Fischl']},scope:'team',budget:30,pool:2};
 const r=await optimizeInventory(request);assert(r.results.length);for(const result of r.results){const indices=Object.values(result.assignment).flatMap(b=>Object.values(b.artifacts));assert.equal(indices.length,10);assert.equal(new Set(indices).size,10);assert.equal(new Set(Object.values(result.assignment).map(b=>b.weapon)).size,2);assert.equal(result.members.length,2);}
 const single=await optimizeInventory({...request,scope:'single',objective:'cv'});assert(single.results.length);assert(single.results.some(r=>r.members.find(m=>m.key==='Fischl').panel.critRate_<calculateTeam(good,'Furina',request.scenario).members.find(m=>m.key==='Fischl').panel.critRate_));
});
test('取消返回已经找到的合法结果，候选计算失败显示实际原因',async()=>{
 const request=input(fixture());request.good.artifacts.push({...artifact('flower','GoldenTroupe',''),substats:[{key:'critRate_',value:15.6}]});let stop=false;const cancelled=await optimizeInventory(request,{progress:p=>{if(p.tested)stop=true;},cancelled:()=>stop});assert(cancelled.cancelled||cancelled.candidateExhausted);assert(cancelled.results.length);
 let calls=0;const bad=await optimizeInventory(request,{calculate:(good,key,s)=>{if(calls++>0)throw Error('测试计算错误');return calculateTeam(good,key,s);}});assert.equal(bad.results.length,0);assert(bad.invalid>0);assert.match(bad.diagnostics.join(''),/测试计算错误/);
});
test('模块 Worker 能计算并接收取消，避免界面线程承担搜索',{timeout:15000},async()=>{
 const worker=new Thread(`const {parentPort}=await import('node:worker_threads');globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(new URL('../modules/character-assessment/optimizer-worker.mjs',import.meta.url).href)});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
 try{const request=input(fixture());for(let i=0;i<5;i++)for(const slot of SLOTS)request.good.artifacts.push({...artifact(slot,'GoldenTroupe',''),...(slot==='circlet'?{mainStatKey:'hp_'}:{}),substats:[{key:'critRate_',value:3.9*(i+1)}]});request.budget=1200;const done=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='progress'&&m.value.tested>0)worker.postMessage({type:'cancel'});else if(m.type==='done')resolve(m.value);else if(m.type==='error')reject(Error(m.message));});worker.postMessage({type:'start',input:request});});assert.equal(done.cancelled,true);assert(done.results.length);assert(done.tested<request.budget);}finally{await worker.terminate();}
});
