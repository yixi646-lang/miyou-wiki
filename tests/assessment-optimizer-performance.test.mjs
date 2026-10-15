import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateBuild,calculateOptimizationBuild} from '../modules/character-assessment/core/calculator.mjs';
import {memberScenario,idlePanel,calculateTeam} from '../modules/character-assessment/core/combat.mjs';
import {prepareArtifactScenario,calculatePreparedTeam} from '../modules/character-assessment/core/artifact-triggers.mjs';
import {optimizeArtifactInventory} from '../modules/character-assessment/core/optimizer-search.mjs';
import {assignedGOOD,optimizerCompactGOOD} from '../modules/character-assessment/core/optimizer.mjs';
import {rollValues} from '../modules/character-assessment/core/evaluate.mjs';
import {damageFixture} from './fixtures/assessment-damage.mjs';
import {optimizerPerformanceFixture} from './fixtures/assessment-optimizer-performance.mjs';

const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url))),data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));

test('搜索精简求值保留原GO全队依赖，面板、伤害、治疗及反应节点与完整求值一致',()=>{
 for(const key of ['Skirk','Neuvillette']){
  const {good,scenario}=damageFixture(key),prepared=prepareArtifactScenario(good,key,scenario,{objective:key==='Skirk'?'skill.0':'charged.judgmentDmg'});
  for(const member of [key,...scenario.members]){
   const settings=memberScenario(good,key,prepared.scenario,member),full=calculateBuild(good,member,settings),fast=calculateOptimizationBuild(good,member,settings,full.rows.map(r=>r.path));
   assert.deepEqual(fast.panel,full.panel);
   assert.deepEqual(fast.rows.map(({path,average,unit,variant,group})=>({path,average,unit,variant,group})),full.rows.map(({path,average,unit,variant,group})=>({path,average,unit,variant,group})));
  }
 }
});

test('补充搜索进度累计去重、候选数量和最好值不倒退，完整详情只计算最终方案',async()=>{
 const input={...optimizerPerformanceFixture({budget:30,scope:'single',objective:'weightedRolls',inventory:60}),catalog,data},snapshot=structuredClone(input),updates=[];let calls=0;
 const result=await optimizeArtifactInventory(input,{calculate:(...args)=>{calls++;return calculateTeam(...args)},progress:p=>updates.push(structuredClone(p))});
 assert(result.results.length);assert(result.searchCoverage.completedBranches>1);assert(calls<=1+result.results.length,'词条目标不应为每个分支重复生成全队详情');
 for(let i=1;i<updates.length;i++){
  assert(updates[i].tested>=updates[i-1].tested);assert(updates[i].found>=updates[i-1].found);assert(updates[i].found<=5);
  if(updates[i-1].best!==null)assert(updates[i].best>=updates[i-1].best);
 }
 assert(updates.some(p=>p.phase==='套装补充搜索'));assert.equal(updates.at(-1).tested,result.tested);assert.equal(updates.at(-1).found,result.results.length);assert.equal(updates.at(-1).best,result.results[0].score);assert(!('candidates' in updates[0]));
 for(const r of result.results){const full=assignedGOOD(input.good,r.assignment),compact=optimizerCompactGOOD(input.good,r.assignment);assert.deepEqual(calculatePreparedTeam(compact,input.key,input.scenario,input).members,calculatePreparedTeam(full,input.key,input.scenario,input).members);}
 assert.deepEqual(input,snapshot);
});

test('单人目标仍计入队友换套增益，独立目标角色、战斗/非战斗筛选和新一轮缓存互不混用',async()=>{
 const input={...optimizerPerformanceFixture({budget:30,scope:'single',inventory:30}),catalog,data,targetKey:'Furina',objective:'panel:hp',memberRules:{Neuvillette:{minimums:{enerRech_:100},idleEnabled:true,idleMinimums:{enerRech_:100},boundMatch:'all'}}};
 const result=await optimizeArtifactInventory(input);assert(result.results.length);
 for(const r of result.results){const good=assignedGOOD(input.good,r.assignment),team=calculatePreparedTeam(good,input.key,input.scenario,input);assert.equal(r.score,team.members.find(m=>m.key==='Furina').panel.hp);assert(team.members.find(m=>m.key===input.key).panel.enerRech_>=100);assert(idlePanel(good,input.key).enerRech_>=100);}
 const next=structuredClone(input);next.objective='charged.judgmentDmg';next.targetKey=next.key;next.scenario.conditional.Neuvillette.a1Stacks='';
 const changed=await optimizeArtifactInventory(next);assert(changed.results.length);const baseline=calculatePreparedTeam(next.good,next.key,next.scenario,next).members.find(m=>m.key===next.key).rows.find(r=>r.path===next.objective).average;
 assert.equal(changed.baseline,baseline);for(const r of changed.results){const team=calculatePreparedTeam(assignedGOOD(next.good,r.assignment),next.key,next.scenario,next);assert.equal(r.score,team.members.find(m=>m.key===next.key).rows.find(row=>row.path===next.objective).average);}
 const weighted=structuredClone(next);weighted.objective='weightedRolls';weighted.goals[weighted.key].weights={enerRech_:1};weighted.good.artifacts[0].substats.push({key:'critDMG_',value:5.4});
 const rescored=await optimizeArtifactInventory(weighted);assert(rescored.results.length);for(const r of rescored.results)assert.equal(r.score,Object.values(r.assignment[weighted.key].artifacts).reduce((n,i)=>n+rollValues(weighted.good.artifacts[i],data,weighted.goals[weighted.key].weights).effective,0));
});
