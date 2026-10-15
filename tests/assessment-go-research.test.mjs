import {calculatePreparedTeam} from '../modules/character-assessment/core/artifact-triggers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {damageFixture} from './fixtures/assessment-damage.mjs';
import {SLOTS,equipment,blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {calculateTeam,comboDamage,captureTeamPlan,goodWithPlan,idlePanel} from '../modules/character-assessment/core/combat.mjs';
import {solveGOArtifacts,solveGOTheory,GO_SEARCH_COMMIT} from '../modules/character-assessment/core/calculator.mjs';
import {optimizeArtifactInventory} from '../modules/character-assessment/core/optimizer-search.mjs';
import {optimizeTheory,artifactPotential,withResearchArtifacts,researchObjective,potentialSimulationGOOD,potentialSourceIndex,inferReshapeInitials} from '../modules/character-assessment/core/artifact-research.mjs';
import {analyzeArtifact,artifactFromDraft,substatTiers} from '../modules/character-assessment/core/artifacts.mjs';
import {normalizeActions,exportActions} from '../modules/character-assessment/core/multitarget.mjs';
import {createManagedState,serializeManagedState,storeCustomEquipment} from '../modules/character-assessment/core/managed-inventory.mjs';
import {readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const relative=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} / ${b}`);
const config=good=>Object.fromEntries(equipment(good,'Neuvillette').artifacts.map(a=>[a.slotKey,{setKey:a.setKey,mainStatKey:a.mainStatKey}]));

test('固定 GO 求解器与小库存逐件穷举一致，百分比目标与战斗 / 非战斗边界保持 Wiki 单位',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),snapshot=structuredClone(good),equipped=equipment(good,key).artifacts;
 good.artifacts.push({...equipped[0],id:'alternative-flower',location:'',substats:[{key:'critRate_',value:23.3},{key:'enerRech_',value:5.2}]});
 const indices=good.artifacts.flatMap((a,i)=>a.location===key||a.id==='alternative-flower'?[i]:[]),sets=[...new Set(indices.map(i=>good.artifacts[i].setKey))];
 const native=await solveGOArtifacts({good,key,scenario,role:key,sets,objective:'charged.judgmentDmg',targetKey:key,indices,budget:100,topN:10});
 assert.equal(native.builds.length,2);for(const b of native.builds){const artifacts=b.artifactIds.map(i=>good.artifacts[Number(i)]),trial=withResearchArtifacts(good,key,artifacts);relative(b.value,calculateTeam(trial,key,scenario).rows.find(r=>r.owner===key&&r.path==='charged.judgmentDmg').average);}
 const rate=await solveGOArtifacts({good,key,scenario,role:key,sets,objective:'panel:critRate_',targetKey:key,indices,budget:100,topN:10,roleRules:{[key]:{minimums:{critRate_:80}}}});assert(rate.builds.every(b=>b.value>=80));
 const result=await optimizeArtifactInventory({good,key,scenario,scope:'single',catalog,data,objective:'charged.judgmentDmg',rules:{borrow:false,setMode:'four',set1:'MarechausseeHunter'},budget:100,pool:4});
 assert.equal(result.searchCoverage.engine,'GO');assert.equal(result.searchCoverage.commit,GO_SEARCH_COMMIT);assert.equal(result.availability[0].selected,2);assert(result.results.length);assert.equal(new Set(Object.values(result.results[0].assignment[key].artifacts)).size,5);assert.deepEqual(good.artifacts.slice(0,snapshot.artifacts.length),snapshot.artifacts);
});

test('20 次分配落实为合法五星五件，最高档与当前配装重分配可复算且不改输入',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),before=structuredClone({good,scenario}),request={good,key,scenario,data,objective:'charged.judgmentDmg',config:config(good),freeRolls:20};
 const result=optimizeTheory(request);assert.equal(result.total,40);assert.equal(result.distributedRolls,20);assert.equal(result.artifacts.length,5);assert.equal(Object.values(result.rolls).reduce((a,b)=>a+b,0),40);
 for(const a of result.artifacts){const r=analyzeArtifact(a,data);assert(r.valid,r.invalid.join(';'));assert.equal(r.minCount,8);assert.equal(a.substats.length,4);assert(a.substats.every(s=>s.key!==a.mainStatKey));}
 const current=withResearchArtifacts(good,key,result.artifacts),redistributed=optimizeTheory({...request,good:current,basis:'current'});assert.equal(redistributed.total,40);for(const [i,a]of redistributed.artifacts.entries())assert.deepEqual(a.substats.map(s=>s.key).sort(),result.artifacts[i].substats.map(s=>s.key).sort());
 const max=optimizeTheory({...request,tier:'max',freeRolls:25});assert.equal(max.total,45);assert(max.artifacts.every(a=>analyzeArtifact(a,data).valid));
 assert.deepEqual({good,scenario},before);assert.throws(()=>optimizeTheory({...request,freeRolls:19}),/20–25/);
});

test('理论配装对照固定 GO：固定次数、分配上下限与双面板要求参与求解，合法五件复核且不放宽约束',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),snapshot=structuredClone({good,scenario}),request={good,key,scenario,data,objective:'charged.judgmentDmg',config:config(good),freeRolls:20,tier:'max'};
 const limits=Object.fromEntries(['hp','atk','def','hp_','atk_','def_','eleMas','enerRech_','critRate_','critDMG_'].map(k=>[k,{enabled:['hp_','critRate_','critDMG_'].includes(k),min:4,max:8}]));
 const bounded=optimizeTheory({...request,rollLimits:limits});
 for(const [stat,count]of Object.entries(bounded.addedRolls)){if(limits[stat].enabled)assert(count>=4&&count<=8,stat);else assert.equal(count,0,stat);}
 assert.equal(Object.values(bounded.addedRolls).reduce((n,v)=>n+v,0),20);assert(bounded.artifacts.every(a=>analyzeArtifact(a,data).valid));
 const fixed=Object.fromEntries(Object.keys(limits).map(k=>[k,2])),seed=Object.fromEntries(Object.keys(limits).map(k=>[k,2+(limits[k].enabled?4:0)])),blank=bounded.artifacts.map(a=>({...a,substats:[]}));
 const tc={artifact:{slots:Object.fromEntries(blank.map(a=>[a.slotKey,{setKey:a.setKey,statKey:a.mainStatKey,rarity:5,level:20}])),substats:{type:'max',rarity:5,stats:Object.fromEntries(Object.keys(limits).map(k=>[k,seed[k]*substatTiers(data,5,k).at(-1)]))}},optimization:{distributedSubstats:8,maxSubstats:Object.fromEntries(Object.keys(limits).map(k=>[k,fixed[k]+(limits[k].enabled?8:0)]))}};
 const native=solveGOTheory({...request,good:withResearchArtifacts(good,key,blank),tc});if(!bounded.adjusted)for(const k of Object.keys(limits))assert.equal(bounded.rolls[k],seed[k]+(native.maxBufferRolls[k]??0));
 const baseline=optimizeTheory(request),after=withResearchArtifacts(good,key,baseline.artifacts),panel=calculateTeam(after,key,scenario).members.find(m=>m.key===key).panel,idle=idlePanel(after,key);
 const requirements={battleEnabled:true,idleEnabled:true,minimums:{enerRech_:panel.enerRech_+5},maximums:{critRate_:100},idleMinimums:{hp:idle.hp-3000},idleMaximums:{critRate_:100}};
 const constrained=optimizeTheory({...request,panelRules:requirements}),actual=withResearchArtifacts(good,key,constrained.artifacts),combat=calculateTeam(actual,key,scenario).members.find(m=>m.key===key).panel,rest=idlePanel(actual,key);
 assert(combat.enerRech_>=requirements.minimums.enerRech_-1e-8);assert(combat.critRate_<=100+1e-8);assert(rest.hp>=requirements.idleMinimums.hp-1e-8);assert(rest.critRate_<=100+1e-8);assert(constrained.panelValues.length===4);assert(constrained.addedRolls.enerRech_>baseline.addedRolls.enerRech_);relative(constrained.value,calculateTeam(actual,key,scenario).rows.find(r=>r.owner===key&&r.path===request.objective).average);
 const custom=optimizeTheory({...request,fixedRolls:{...fixed,hp_:3},freeRolls:19});assert.equal(custom.basicRolls,21);assert.equal(custom.distributedRolls,19);assert.equal(custom.total,40);assert(custom.rolls.hp_>=3);
 const constant=optimizeTheory({...request,objective:'panel:atk',rollLimits:limits});assert(Object.entries(constant.addedRolls).every(([k,n])=>limits[k].enabled?n>=4&&n<=8:n===0));
 assert.throws(()=>optimizeTheory({...request,rollLimits:Object.fromEntries(Object.keys(limits).map(k=>[k,{enabled:false}]))}),/预算/);
 assert.throws(()=>optimizeTheory({...request,rollLimits:{hp_:{min:10,max:2}}}),/最低次数/);
 assert.throws(()=>optimizeTheory({...request,panelRules:{minimums:{hp:1e9}}}),/没有满足|暂未找到/);
 assert.throws(()=>optimizeTheory({...request,panelRules:{minimums:{enerRech_:180},maximums:{enerRech_:100}}}),/下限/);
 assert.deepEqual({good,scenario},snapshot);
});

function unfinished(){const keys=['hp_','critRate_','critDMG_','enerRech_'];return artifactFromDraft({setKey:'MarechausseeHunter',rarity:5,level:12,slotKey:'flower',mainStatKey:'hp',initialCount:4,lines:keys.map((key,i)=>({key,counts:[0,0,0,i===3?4:1]}))},data);}

test('强化潜力给出概率估计和合法具体装备；生成自定义层、理论方案与锁定实际 GOOD 分开',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),a=unfinished(),request={good,key,scenario,data,artifact:a,objective:'charged.judgmentDmg',mode:'upgrade',threshold:42000};const snapshot=structuredClone(good),result=artifactPotential(request);
 assert(Number.isFinite(result.average));assert(result.probability>=0&&result.probability<=1);assert(result.examples.length);for(const e of result.examples){assert(analyzeArtifact(e.artifact,data).valid);assert.equal(e.artifact.level,20);assert(Number.isFinite(e.value));}
 const raw=blankState();raw.good=good;const state=createManagedState(raw,{locked:true});storeCustomEquipment(state,'artifacts',result.examples[0].artifact);const saved=serializeManagedState(state);validateState(saved,data);assert.equal(saved.customInventory.artifacts.length,1);assert.deepEqual(saved.good,snapshot);
 const trial=withResearchArtifacts(good,key,[{...result.examples[0].artifact,wikiTrialOnly:true}]),plan=captureTeamPlan(trial,key,scenario,'潜力试算'),w=readWorkspace(state);w.teamPlans.push({...plan,id:'potential-plan',teamId:''});writeWorkspace(state,w);validateState(serializeManagedState(state),data);assert(goodWithPlan(good,key,plan).artifacts.some(a=>a.wikiTrialOnly&&a.location===key));
 const complete=result.examples[0].artifact,initialValues=Object.fromEntries(complete.substats.map(s=>[s.key,substatTiers(data,5,s.key).at(-1)]));
 const reshape=artifactPotential({...request,artifact:{...complete,totalRolls:9},mode:'reshape',affixes:['critRate_','critDMG_'],initialValues});assert(Number.isFinite(reshape.average));assert(reshape.examples.length);
 const define=artifactPotential({...request,artifact:{...complete,level:0},mode:'define',affixes:['critRate_','critDMG_'],prob4:0.2});assert(Number.isFinite(define.average));assert(define.examples.length);assert(define.examples.every(e=>e.artifact.substats.some(s=>s.key==='critRate_')&&e.artifact.substats.some(s=>s.key==='critDMG_')));
 const automatic=artifactPotential({...request,mode:'reshape',artifact:result.examples[0].artifact});assert(Number.isFinite(automatic.average));assert.equal(automatic.affixes.length,2);assert(automatic.initialAnalysis.caseCount>0);assert.deepEqual(good,snapshot);
});

test('高级动作的命中方式、反应、附魔、增益与权重参与计算；GO 搜索使用同一合计，导入保留配置',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),base=calculateTeam(good,key,scenario).members[0].rows.find(r=>r.path==='charged.judgmentDmg');
 scenario.combo=[{owner:key,path:base.path,count:0.5,reaction:'',hitMode:'critHit',infusion:'inherit',bonusStats:{hp:1000,hydro_dmg_:10}}];
 const actions=normalizeActions(JSON.parse(exportActions(scenario.combo)),{members:[key,...scenario.members],owner:key});assert.deepEqual(actions,scenario.combo);
 const result=comboDamage(good,key,scenario),changed=calculateTeam(good,key,{...scenario,bonusStats:{hp:1000,hydro_dmg_:10}}).members[0].rows.find(r=>r.path===base.path);relative(result.value,changed.crit*0.5);assert(result.value>base.crit*0.5);
 const indices=good.artifacts.flatMap((a,i)=>a.location===key?[i]:[]),native=await solveGOArtifacts({good,key,scenario,role:key,sets:[...new Set(indices.map(i=>good.artifacts[i].setKey))],indices,objective:'combo',targetKey:key,budget:20});relative(native.builds[0].value,result.value);
 assert.throws(()=>normalizeActions([{owner:key,path:base.path,count:1,bonusStats:{constructor:1}}]),/不允许/);
});

test('借用队友圣遗物按移交后的全队数值求解，不重复计入原主人的属性',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette');const furinaPath=calculateTeam(good,key,scenario).rows.find(r=>r.owner==='Furina'&&r.group==='skill'&&r.variant!=='heal').path;const indices=good.artifacts.flatMap((a,i)=>a.location===key||a.location==='Furina'&&a.slotKey==='flower'?[i]:[]),sets=[...new Set(indices.map(i=>good.artifacts[i].setKey))];
 const run=await solveGOArtifacts({good,key,scenario,role:key,sets,indices,objective:'combo',targetKey:key,budget:100,topN:10,...{scenario:{...scenario,combo:[{owner:'Furina',path:furinaPath,count:1,reaction:''},{owner:key,path:'charged.judgmentDmg',count:1,reaction:''}]}}});
 assert(run.builds.length);for(const build of run.builds){const selected=build.artifactIds.map(i=>Number(i)),next=structuredClone(good);for(const a of next.artifacts)if(a.location===key)a.location='';for(const i of selected)next.artifacts[i].location=key;relative(build.value,comboDamage(next,key,{...scenario,combo:[{owner:'Furina',path:furinaPath,count:1,reaction:''},{owner:key,path:'charged.judgmentDmg',count:1,reaction:''}]}).value);}
});

test('多个队员同时缺少面板属性时逐步满足约束，最终全队规则与唯一分配仍全部检查',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),members=[key,...scenario.members],before=calculatePreparedTeam(good,key,scenario,{objective:'panel:hp',targetKey:key});
 for(const role of [key,'Furina'])good.artifacts.push({...equipment(good,role).artifacts[0],id:'new-'+role,location:'',substats:[{key:'hp_',value:11.7},{key:'critRate_',value:7.8}]});
 const memberRules=Object.fromEntries(members.map(role=>[role,{setMode:'four',set1:equipment(good,role).artifacts[0].setKey,...([key,'Furina'].includes(role)?{minimums:{hp:before.members.find(m=>m.key===role).panel.hp+500}}:{})}]));
 const run=await optimizeArtifactInventory({good,key,scenario,catalog,data,memberRules,scope:'team',objective:'panel:hp',targetKey:key,rules:{borrow:false},budget:300,pool:10});assert(run.results.length);for(const result of run.results){assert.equal(new Set(Object.values(result.assignment).flatMap(a=>Object.values(a.artifacts))).size,20);for(const role of [key,'Furina'])assert(result.members.find(m=>m.key===role).panel.hp>=memberRules[role].minimums.hp);}
});
test('常量目标的大量等价配装遵守预算并响应取消，不一次遍历整个笛卡尔积',async()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),parts=equipment(good,key).artifacts;good.artifacts.push(...parts.flatMap(a=>Array.from({length:12},(_,i)=>({...a,id:a.slotKey+'-copy-'+i,location:''}))));
 const indices=good.artifacts.flatMap((a,i)=>a.location===key||a.location===''?[i]:[]),request={good,key,scenario,role:key,sets:[...new Set(indices.map(i=>good.artifacts[i].setKey))],indices,objective:'panel:hp',targetKey:'Furina',budget:9,topN:5};
 const run=await solveGOArtifacts(request);assert(run.tested<=9);assert.equal(run.complete,false);let stop=false;const cancelled=await solveGOArtifacts(request,{progress:()=>{stop=true;},cancelled:()=>stop});assert(cancelled.cancelled);assert(cancelled.tested<=9);
});


test('潜力对照固定 GO：线性目标的均值与条件均值、严格超过阈值、借用移交和合法历史记录',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),a=artifactFromDraft({setKey:'MarechausseeHunter',rarity:5,level:12,slotKey:'flower',mainStatKey:'hp',initialCount:4,lines:['eleMas','critRate_','critDMG_','enerRech_'].map((key,i)=>({key,counts:[0,0,0,i?1:4]}))},data),request={good,key,scenario,data,artifact:a,mode:'upgrade',objective:'idlePanel:eleMas'},snapshot=structuredClone(good);
 const tiers=[.7,.8,.9,1].map(n=>n*substatTiers(data,5,'eleMas').at(-1)),mean=tiers.reduce((n,v)=>n+v,0)/tiers.length,second=tiers.reduce((n,v)=>n+v*v,0)/tiers.length,base=researchObjective(withResearchArtifacts(good,key,[{...a,level:20}]),key,scenario,request.objective),expected=base+mean/2,variance=2*(second/4-(mean/4)**2);
 const result=artifactPotential({...request,threshold:expected});relative(result.average,expected);assert(Math.abs(result.probability-.5)<1e-6);relative(result.conditionalAverage,expected+Math.sqrt(variance)*Math.sqrt(2/Math.PI));assert.equal(result.threshold,expected);assert(result.examples.every(e=>e.artifact.totalRolls===9));
 const constant={...request,objective:'idlePanel:hydro_dmg_'},unchanged=researchObjective(withResearchArtifacts(good,key,[{...a,level:20}]),key,scenario,constant.objective);
 const equal=artifactPotential({...constant,threshold:unchanged});assert.equal(equal.probability,0);assert.equal(equal.conditionalAverage,null);const below=artifactPotential({...constant,threshold:0});assert.equal(below.probability,1);relative(below.conditionalAverage,below.average);
 const candidate={...a,location:'Furina',id:'potential-donor'};for(const art of good.artifacts)if(art.location==='Furina'&&art.slotKey==='flower')art.location='';good.artifacts.push(candidate);const index=good.artifacts.length-1,original=structuredClone(good),borrowedRequest={...request,objective:'idlePanel:hp',targetKey:'Furina',artifact:candidate,sourceIndex:index};
 const borrowed=artifactPotential(borrowedRequest),transferred=potentialSimulationGOOD(good,key,index);assert(borrowed.borrowed);assert.equal(borrowed.sourceOwner,'Furina');assert.equal(transferred.artifacts[index].location,'');assert.equal(potentialSourceIndex(good,structuredClone(candidate)),index);relative(borrowed.average,researchObjective(transferred,key,scenario,'idlePanel:hp','Furina'));assert(borrowed.average<borrowed.before);
 for(const e of borrowed.examples)relative(e.value,researchObjective(withResearchArtifacts(transferred,key,[e.artifact]),key,scenario,'idlePanel:hp','Furina'));assert.deepEqual(good,original);assert.throws(()=>artifactPotential({...borrowedRequest,sourceIndex:0}),/来源圣遗物/);
 assert.throws(()=>artifactPotential({...request,artifact:{...a,substats:[{key:'eleMas',value:100000}]}}),/无法匹配|不符|数值不正确/);assert.throws(()=>artifactPotential({...request,threshold:-1}),/阈值/);assert.throws(()=>artifactPotential({...request,objective:'missing.target'}),/不可用/);assert.throws(()=>artifactPotential({...request,role:'Skirk'}),/队员/);
});

test('潜力对照固定 GO：祝圣定义排除零概率分支，保留初始档位与总次数；四星与三词条继续强化',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),request={good,key,scenario,data,objective:'idlePanel:eleMas',mode:'define',artifact:{setKey:'MarechausseeHunter',slotKey:'flower',mainStatKey:'hp',rarity:5,level:0,location:'',substats:[],wikiBaseIndex:0,astralMark:true},affixes:['critRate_','critDMG_']},snapshot=structuredClone(good);
 for(const prob4 of [0,1]){const result=artifactPotential({...request,prob4});assert(result.examples.length>=3);for(const e of result.examples){assert.equal(e.artifact.totalRolls,prob4?9:8);assert.equal(e.artifact.wikiBaseIndex,undefined);assert.equal(e.artifact.astralMark,undefined);assert(e.artifact.substats.every(s=>s.initialValue!==undefined));const inference=inferReshapeInitials(e.artifact,data);assert.equal(inference.initialAnalysis.inferred,false);assert.equal(inference.initialCases.length,1);assert.deepEqual(inference.initialAnalysis.totals,[prob4?9:8]);assert(analyzeArtifact(e.artifact,data).valid);}}
 for(const rarity of [4,5]){const a=artifactFromDraft({setKey:rarity===4?'Instructor':'MarechausseeHunter',rarity,level:0,slotKey:'flower',mainStatKey:'hp',initialCount:rarity===4?2:3,lines:['def_','enerRech_','def'].slice(0,rarity===4?2:3).map(key=>({key,counts:[0,0,0,1]}))},data),result=artifactPotential({...request,artifact:a,mode:'upgrade'});assert(result.examples.length);for(const e of result.examples){assert.equal(e.artifact.level,rarity*4);assert.equal(e.artifact.totalRolls,(rarity===4?2:3)+rarity);assert(e.artifact.substats.every(s=>s.initialValue!==undefined));assert(analyzeArtifact(e.artifact,data).valid);}}
 const a=artifactFromDraft({setKey:'MarechausseeHunter',rarity:5,level:0,slotKey:'flower',mainStatKey:'hp',initialCount:3,lines:['def_','enerRech_','def'].map(key=>({key,counts:[0,0,0,1]}))},data);a.unactivatedSubstats=[{key:'eleMas',value:substatTiers(data,5,'eleMas').at(-1)}];const known=artifactPotential({...request,artifact:a,mode:'upgrade'});assert(known.examples.every(e=>e.artifact.substats.some(s=>s.key==='eleMas'&&Math.abs(s.initialValue-a.unactivatedSubstats[0].value)<1e-5)));assert.throws(()=>artifactPotential({...request,artifact:{...a,unactivatedSubstats:[{key:'def',value:19}]},mode:'upgrade'}),/待激活/);assert.deepEqual(good,snapshot);
});
