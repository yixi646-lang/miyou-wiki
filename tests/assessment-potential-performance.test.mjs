import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {damageFixture} from './fixtures/assessment-damage.mjs';
import {artifactFromDraft,analyzeArtifact} from '../modules/character-assessment/core/artifacts.mjs';
import {calculateObjectiveBuild} from '../modules/character-assessment/core/calculator.mjs';
import {calculateTeam,memberScenario,comboDamage,idlePanel} from '../modules/character-assessment/core/combat.mjs';
import {artifactPotential,researchObjective,withResearchArtifacts} from '../modules/character-assessment/core/artifact-research.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const near=(a,b)=>assert(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} / ${b}`);
function nicoleFixture(){const f=damageFixture('Neuvillette');f.good.characters.find(c=>c.key==='Furina').key='Nicole';for(const a of [...f.good.weapons,...f.good.artifacts])if(a.location==='Furina')a.location='Nicole';f.good.weapons.find(w=>w.location==='Nicole').key='ThrillingTalesOfDragonSlayers';f.scenario.members[0]='Nicole';f.scenario.characters.Nicole={conditional:{Nicole:{skillGraceActive:'on',a1GuidanceActive:'on',a4NicoleGuidance:'on'}}};return f;}
const draft=(initial,level)=>artifactFromDraft({setKey:'NoblesseOblige',rarity:5,level,slotKey:'flower',mainStatKey:'hp',initialCount:initial,lines:['atk_','atk','critRate_','enerRech_'].slice(0,level?4:initial).map(key=>({key,counts:level?[0,2,0,0]:[0,0,0,1]}))},data);

test('潜力精简读取覆盖伤害、治疗、反应、护盾、辅助效果与面板，保留全队依赖和命中模式',()=>{
 for(const fixture of [nicoleFixture(),damageFixture('Skirk')]){const {good,key,scenario}=fixture,snapshot=structuredClone(fixture),team=calculateTeam(good,key,scenario);
  for(const full of team.members){const settings=memberScenario(good,key,scenario,full.key),paths=[...full.rows.map(r=>r.path),...Object.keys(full.panel).map(k=>'panel:'+k)],fast=calculateObjectiveBuild(good,full.key,settings,paths,true);
   assert.deepEqual(fast.panel,full.panel);assert.deepEqual(fast.rows,full.rows.map(({path,group,average,unit,variant,hit,crit})=>({path,group,average,unit,variant,hit,crit})));
   for(const row of full.rows.filter(r=>['skill','reaction','burst'].includes(r.group)))near(researchObjective(good,key,scenario,row.path,full.key),row.average);
   for(const stat of ['hp','critRate_','enerRech_']){near(researchObjective(good,key,scenario,'panel:'+stat,full.key),full.panel[stat]);near(researchObjective(good,key,scenario,'idlePanel:'+stat,full.key),idlePanel(good,full.key)[stat]);}
  }
  assert.deepEqual(fixture,snapshot);
 }
});

test('潜力全队动作目标保留命中、反应、附魔与额外增益；不同配置间不复用旧值',()=>{
 const {good,key,scenario}=nicoleFixture();scenario.combo=[{owner:key,path:'charged.judgmentDmg',count:.5,hitMode:'critHit',reaction:'inherit'},{owner:'Nicole',path:'skill.skillDmg',count:2,hitMode:'hit',reaction:'vaporize',infusion:'pyro',bonusStats:{atk:200,pyro_dmg_:15}},{owner:key,path:'charged.judgmentDmg',count:1,hitMode:'avgHit',reaction:'',bonusStats:{hp:1000}}];
 near(researchObjective(good,key,scenario,'combo'),comboDamage(good,key,scenario).value);
 const before=researchObjective(good,key,scenario,'skill.skillGraceActive_atk','Nicole');scenario.characters.Nicole.conditional.Nicole.skillGraceActive='';assert.equal(researchObjective(good,key,scenario,'skill.skillGraceActive_atk','Nicole'),undefined);
 scenario.characters.Nicole.conditional.Nicole.skillGraceActive='on';scenario.characters.Nicole.bonusStats={atk:1000};const after=researchObjective(good,key,scenario,'skill.skillGraceActive_atk','Nicole');assert(after>before);near(after,calculateTeam(good,key,scenario).members.find(m=>m.key==='Nicole').rows.find(r=>r.path==='skill.skillGraceActive_atk').average);
 scenario.combo[1].owner='missing';assert.throws(()=>researchObjective(good,key,scenario,'combo'),/不在当前队伍/);
});

test('潜力三种模式保留优化前概率模型与示例数值，大库存只影响来源查找且不改原件',()=>{
 const {good,key,scenario}=nicoleFixture(),requests=[{mode:'upgrade',artifact:draft(4,0),expected:209.58247662330112},{mode:'upgrade',artifact:draft(3,0),expected:207.5811894839769},{mode:'reshape',artifact:draft(3,20),expected:207.29929649384368},{mode:'define',artifact:{...draft(3,0),substats:[]},affixes:['atk','atk_'],expected:208.045607885784}];
 for(const options of requests){const request={good,key,scenario,data,role:'Nicole',targetKey:'Nicole',objective:'skill.skillGraceActive_atk',...options},result=artifactPotential(request);near(result.average,options.expected);assert.equal(result.examples.length,9);assert(result.probability>=0&&result.probability<=1);for(const e of result.examples){assert(analyzeArtifact(e.artifact,data).valid);const full=calculateTeam(withResearchArtifacts(good,'Nicole',[e.artifact]),key,scenario);near(e.value,full.members.find(m=>m.key==='Nicole').rows.find(r=>r.path===request.objective).average);}}
 const request={good,key,scenario,data,artifact:draft(3,0),objective:'charged.judgmentDmg'},normal=artifactPotential(request),large=structuredClone(good);large.artifacts.push(...Array.from({length:3000},(_,i)=>({...draft(3,0),id:'extra-'+i,location:''})));const snapshot=structuredClone(large),expanded=artifactPotential({...request,good:large});assert.deepEqual(expanded,normal);assert.deepEqual(large,snapshot);
});

test('潜力真实 Worker 分批返回全部成功和失败项目，批大小受限且结束前刷新尾批',async t=>{
 const {good,key,scenario}=nicoleFixture(),items=[];for(let i=0;i<12;i++){const artifact=draft(4,0);if(i===3)artifact.substats[0].value=999999;good.artifacts.push(artifact);items.push({id:good.artifacts.length-1,artifact});}
 const workerUrl=new URL('../modules/character-assessment/artifact-research-worker.mjs',import.meta.url).href;
 const script=`import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:m=>parentPort.postMessage(m)}; await import(${JSON.stringify(workerUrl)}); parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(script)));t.after(()=>worker.terminate());const messages=[];
 await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='error'){reject(Error(m.message));return;}messages.push(m);if(m.type==='done')resolve();});worker.postMessage({kind:'potential-batch',request:{good,key,scenario,data,role:'Nicole',targetKey:'Nicole',objective:'cv',mode:'upgrade'},items});});
 const batches=messages.filter(m=>m.type==='items'),returned=batches.flatMap(m=>m.items);assert(batches.length);assert(batches.every(m=>m.items.length>0&&m.items.length<=8));assert.deepEqual(returned.map(m=>m.id),items.map(i=>i.id));assert.equal(returned.filter(m=>m.message).length,1);assert.equal(returned.filter(m=>m.value).length,11);assert.equal(messages.at(-1).type,'done');
});
