import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SLOTS,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {prepareArtifactScenario,calculatePreparedTeam} from '../modules/character-assessment/core/artifact-triggers.mjs';
import {calculateTeam,idlePanel} from '../modules/character-assessment/core/combat.mjs';
import {assignedGOOD,optimizeInventory} from '../modules/character-assessment/core/optimizer.mjs';
import {optimizeArtifactInventory,supplementalSearchBranches} from '../modules/character-assessment/core/optimizer-search.mjs';
import {damageFixture} from './fixtures/assessment-damage.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url))),catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const character=key=>({key,level:90,ascension:6,constellation:0,talent:{auto:6,skill:10,burst:10}});
const artifact=(slotKey,setKey,location='',value=7.8)=>({slotKey,setKey,location,rarity:5,level:20,mainStatKey:{flower:'hp',plume:'atk',sands:'atk_',goblet:'pyro_dmg_',circlet:'critRate_'}[slotKey],substats:[{key:'critDMG_',value}],lock:false});
const fixture=(key,set)=>({format:'GOOD',version:3,characters:[key,'Furina','Jean'].filter((k,i,a)=>a.indexOf(k)===i).map(character),weapons:[{key:'FavoniusSword',location:key,level:90,ascension:6,refinement:1,lock:false}],artifacts:SLOTS.map(slot=>artifact(slot,set,key))});
const scenario=key=>({active:key,members:['Furina','Jean'].filter(k=>k!==key),conditional:{},characters:{Furina:{conditional:{Furina:{skillHpConsumeStacks:'4'}}}}});

test('迪希雅不默认Q；辰砂独立判定本人Q、在场及掉血来源，不给花海算生命消耗',()=>{
 for(const set of ['VermillionHereafter','NoblesseOblige']){const good=fixture('Dehya',set),saved=scenario('Dehya'),snapshot=structuredClone(saved);const p=prepareArtifactScenario(good,'Dehya',saved,{objective:'skill.dmg'});assert(!p.scenario.conditional[set]);assert.deepEqual(saved,snapshot);}
 const good=fixture('Bennett','VermillionHereafter'),saved=scenario('Bennett'),prepared=prepareArtifactScenario(good,'Bennett',saved,{objective:'normal.0'});
 assert.deepEqual(prepared.scenario.conditional.VermillionHereafter,{afterBurst:'on',stacks:'4'});assert.match(prepared.audit[0].notes.join(''),/芙宁娜/);
 assert(!prepareArtifactScenario(good,'Bennett',{...saved,active:'Furina'},{objective:'normal.0'}).scenario.conditional.VermillionHereafter);
 const noDrain=structuredClone(saved);noDrain.characters.Furina.conditional.Furina.skillHpConsumeStacks='';assert.deepEqual(prepareArtifactScenario(good,'Bennett',noDrain,{objective:'normal.0'}).scenario.conditional.VermillionHereafter,{afterBurst:'on'});
 const noQ=fixture('Dehya','VermillionHereafter');assert.equal(prepareArtifactScenario(noQ,'Dehya',scenario('Dehya'),{objective:'burst.dmg'}).scenario.conditional.VermillionHereafter.stacks,'4');
 const glow=fixture('Dehya','VourukashasGlow');assert(!prepareArtifactScenario(glow,'Dehya',scenario('Dehya'),{objective:'skill.dmg'}).scenario.conditional.VourukashasGlow);
 const intake=scenario('Dehya');intake.conditional.VourukashasGlow={set4:'5'};assert.equal(prepareArtifactScenario(glow,'Dehya',intake,{objective:'skill.dmg'}).scenario.conditional.VourukashasGlow.set4,'5');
});

test('按实际0至5件门控条件，2+2不误开四件，互斥丝柯克阶段不同时开启',()=>{
 for(let count=0;count<=5;count++){const good=fixture('Bennett','NoblesseOblige');good.artifacts.forEach((a,i)=>{if(i>=count)a.setKey='GladiatorsFinale';});const p=prepareArtifactScenario(good,'Bennett',scenario('Bennett'),{objective:'skill.dmg'});assert.equal(!!p.scenario.conditional.NoblesseOblige,count>=4);}
 const {good,key,scenario:s}=damageFixture('Skirk'),snapshot=structuredClone({good,s});
 for(const a of good.artifacts)if(a.location==='Skirk')a.setKey='FinaleOfTheDeepGalleries';
 assert.deepEqual(prepareArtifactScenario(good,key,s,{objective:'skill.0'}).scenario.conditional.FinaleOfTheDeepGalleries,{'0EnergyNoBurst':'on'});
 assert.deepEqual(prepareArtifactScenario(good,key,s,{objective:'burst.dmg'}).scenario.conditional.FinaleOfTheDeepGalleries,{'0EnergyNoNormal':'on'});
 assert.deepEqual(s,snapshot.s);
 const xiao=fixture('Xiao','MarechausseeHunter'),xs=scenario('Xiao');xs.active='Jean';xs.conditional.Xiao={inBurst:'inBurst'};xs.characters.Furina.conditional.Furina.skillHpConsumeStacks='';assert(!prepareArtifactScenario(xiao,'Xiao',xs,{objective:'plunging.dmg'}).scenario.conditional.MarechausseeHunter);
 const barbara=fixture('Barbara','NymphsDream');assert.equal(prepareArtifactScenario(barbara,'Barbara',scenario('Barbara'),{objective:'burst.heal'}).scenario.conditional.NymphsDream.set4,'1');
 const noelle=fixture('Noelle','HuskOfOpulentDreams');assert(!prepareArtifactScenario(noelle,'Noelle',scenario('Noelle'),{objective:'skill.dmg'}).scenario.conditional.HuskOfOpulentDreams);
});

test('全队各自重判，风套/绘卷只启用已确认元素；候选和基准调用原公式，手动与非战斗结果不变',()=>{
 for(const key of ['Skirk','Neuvillette']){const {good,scenario:s}=damageFixture(key),snapshot=structuredClone({good,s}),raw=calculateTeam(good,key,s),idle=idlePanel(good,key),prepared=calculatePreparedTeam(good,key,s,{objective:key==='Skirk'?'skill.0':'charged.judgmentDmg'});
   assert.deepEqual(prepared.members,calculateTeam(good,key,prepared.scenario).members);assert.deepEqual(calculateTeam(good,key,s),raw);assert.deepEqual(idlePanel(good,key),idle);assert.deepEqual({good,s},snapshot);
   for(const [namespace,values]of Object.entries(s.conditional??{}))if(!catalog.sets[namespace])assert.deepEqual(prepared.scenario.conditional[namespace],values);
   const kazuha=prepared.artifactAudit.find(a=>a.member==='KaedeharaKazuha'&&a.set==='ViridescentVenerer');if(kazuha)assert.deepEqual(Object.keys(kazuha.conditions),['swirlhydro']);
 }
 const good=fixture('Furina','NoblesseOblige');good.artifacts.push(...SLOTS.map(slot=>artifact(slot,'NoblesseOblige','Jean')));const s={members:['Jean'],active:'Furina',conditional:{},characters:{}};
 const double=calculatePreparedTeam(good,'Furina',s,{objective:'skill.dmg'});const single=structuredClone(good);for(const a of single.artifacts)if(a.location==='Jean')a.setKey='GladiatorsFinale';
 assert.equal(double.panel.atk,calculatePreparedTeam(single,'Furina',s,{objective:'skill.dmg'}).panel.atk);
});

test('补充搜索找回原候选截断的强四件套，保留原最优、同条件求值、固定武器和预算',async()=>{
 const good=fixture('Bennett','GladiatorsFinale');good.characters=[good.characters[0]];good.artifacts.push(...SLOTS.map(slot=>artifact(slot,'GladiatorsFinale','',15.5)),...SLOTS.map(slot=>artifact(slot,'DeepwoodMemories','',3.9)));
 const s={members:[],active:'Bennett',conditional:{},characters:{}},input={good,key:'Bennett',scenario:s,catalog,data,goals:{Bennett:defaultGoal('attack','pyro')},rules:{setMode:'none',borrow:true},objective:'skill.dmg',pool:2,budget:30};
 const mock=(g,k,settings)=>{const pieces=g.artifacts.filter(a=>a.location===k),counts={};for(const a of pieces)counts[a.setKey]=(counts[a.setKey]??0)+1;const value=pieces.reduce((n,a)=>n+a.substats[0].value,0)+(counts.DeepwoodMemories>=4&&settings.conditional.DeepwoodMemories?.set4==='on'?1000:0);const member={key:k,panel:{atk:value},rows:[{path:'skill.dmg',label:'技能伤害',group:'skill',variant:'pyro',average:value,hit:value,crit:value,unit:''}]};return {...member,members:[member]};};
 const snapshot=structuredClone(input),calculate=(g,k,s)=>mock(g,k,prepareArtifactScenario(g,k,s,input).scenario),old=await optimizeInventory(input,{calculate});assert(old.results[0].score<1000);
 const result=await optimizeArtifactInventory(input,{calculate:mock});assert(result.results[0].score>1000);assert(result.results[0].score>=old.results[0].score);assert(result.tested<=input.budget*2);assert(result.searchCoverage.supplemental>0);
 assert(supplementalSearchBranches(input).branches.some(b=>b.Bennett.setMode==='two-two'));assert(supplementalSearchBranches(input).branches.some(b=>b.Bennett.searchTwo));
 for(const r of result.results){const next=assignedGOOD(good,r.assignment);assert.deepEqual(next.weapons,good.weapons);assert.equal(r.score,mock(next,input.key,r.scenario).panel.atk);assert.equal(r.delta,r.score-result.baseline);assert.equal(new Set(Object.values(r.assignment.Bennett.artifacts)).size,5);}
 assert.deepEqual(input,snapshot);
 let stopped=false;const partial=await optimizeArtifactInventory(input,{calculate:mock,cancelled:()=>stopped,progress:p=>{if(p.phase==='套装补充搜索')stopped=true;}});assert(partial.cancelled);assert(partial.results.length);assert.deepEqual(input,snapshot);
});

test('全队补充候选仍执行唯一件分配，各成员限制及两类面板筛选',async()=>{
 const good=fixture('Bennett','NoblesseOblige');good.characters=[character('Bennett'),character('Jean')];good.artifacts.push(...SLOTS.map(slot=>artifact(slot,'ViridescentVenerer','Jean')));good.weapons.push({...good.weapons[0],location:'Jean'});
 const input={good,key:'Bennett',scope:'team',targetKey:'Bennett',scenario:{members:['Jean'],active:'Bennett',conditional:{},characters:{}},catalog,data,goals:{Bennett:defaultGoal('attack','pyro'),Jean:defaultGoal('healer','anemo')},rules:{borrow:true},memberRules:{Bennett:{setMode:'four',set1:'NoblesseOblige',idleEnabled:true,idleMinimums:{enerRech_:100}},Jean:{setMode:'four',set1:'ViridescentVenerer',maximums:{critRate_:100}}},objective:'weightedRolls',budget:30,pool:4};
 const result=await optimizeArtifactInventory(input);assert(result.results.length,result.diagnostics.join('；'));
 for(const r of result.results){assert.equal(new Set(Object.values(r.assignment).flatMap(b=>Object.values(b.artifacts))).size,10);for(const [key,b]of Object.entries(r.assignment))assert(Object.values(b.artifacts).filter(i=>good.artifacts[i].setKey===input.memberRules[key].set1).length>=4);assert.equal(r.score-r.delta,result.baseline);}
});
