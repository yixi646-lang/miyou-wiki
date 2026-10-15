import {optimizeInventory,optimizerCandidates,optimizerEligibleCandidates,createOptimizerWorkspace,optimizerCompactGOOD,optimizerResultDetails,optimizerMetricValues,optimizerBuildMetrics,optimizerBoundSets,optimizerPanelFailures,optimizerSearchSlots,OPTIMIZER_METRICS} from './optimizer.mjs';
import {SLOTS,SLOT_NAMES,equipmentLocation} from './model.mjs';
import {teamKeys,calculateTeam,memberScenario,idlePanel} from './combat.mjs';
import {solveGOArtifacts,GO_SEARCH_COMMIT} from './calculator.mjs';
import {assignedGOOD,equipmentAssignment,validateOptimizerRules} from './optimizer.mjs';
import {comboDamage} from './combat.mjs';
import {prepareArtifactScenario,ARTIFACT_TRIGGER_VERSION} from './artifact-triggers.mjs';

function patterns(rule){
  if(rule.searchTwo)return SLOTS.flatMap((_,a)=>SLOTS.flatMap((_,b)=>a<b?[SLOTS.map((_,i)=>i===a||i===b?rule.searchTwo:'')]:[]));
  if(rule.setMode==='four')return SLOTS.map((_,off)=>SLOTS.map((_,i)=>i===off?'':rule.set1));
  if(rule.setMode==='two-two')return SLOTS.flatMap((_,off)=>{const rest=[0,1,2,3,4].filter(i=>i!==off);return rest.flatMap((a,i)=>rest.slice(i+1).map(b=>SLOTS.map((_,j)=>j===off?'':j===a||j===b?rule.set1:rule.set2)));});
  return [Array(5).fill('')];
}
function roles(input,members){return Object.fromEntries(members.map(k=>[k,{...(k===input.key?input.rules:{...input.rules,searchSlots:SLOTS,setMode:'none',mainStats:{},minimums:{},maximums:{},idleMinimums:{},idleMaximums:{}}),...input.memberRules?.[k],borrow:input.rules?.borrow,includeCustom:input.rules?.includeCustom,excludeLocked:input.rules?.excludeLocked}]));}
export function supplementalSearchBranches(input,workspace){
  const members=input.scope==='team'?teamKeys(input.good,input.key,input.scenario):[input.key],rules=roles(input,members);
  const modes=members.map(key=>{
    const rule=rules[key];if(rule.setMode&&rule.setMode!=='none')return [rule];
    const eligible=SLOTS.map(slot=>optimizerEligibleCandidates(input.good,key,slot,{...input,workspace,rules:rule,objective:key===(input.targetKey??input.key)?input.objective:''})),sets=[...new Set(eligible.flat().map(i=>input.good.artifacts[i].setKey))],slotSets=eligible.map(indices=>new Set(indices.map(i=>input.good.artifacts[i].setKey)));
    const feasible=r=>patterns(r).some(pattern=>pattern.every((set,i)=>set?slotSets[i].has(set):eligible[i].length>0));
    const fours=sets.map(set1=>({...rule,setMode:'four',set1})).filter(feasible),twos=sets.map(searchTwo=>({...rule,setMode:'none',searchTwo})).filter(feasible);
    const pairs=sets.flatMap((set1,i)=>sets.slice(i+1).map(set2=>({...rule,setMode:'two-two',set1,set2}))).filter(feasible);
    return [rule,...fours,...twos,...pairs];
  });
  const seen=new Set(),branches=[];
  const add=indices=>{const id=indices.join(',');if(seen.has(id))return;seen.add(id);branches.push(Object.fromEntries(members.map((key,i)=>[key,modes[i][indices[i]]])));};
  // 独立分支确保低单件评分的四件套/2+2不在全局候选筛选时整套消失。
  add(members.map(()=>0));
  const length=Math.max(...modes.map(a=>a.length));
  for(let i=1;i<length;i++){
    // 先保留同时换套的全队候选，再轮流覆盖每名成员；最终仍执行唯一分配校验。
    if(members.length>1)add(modes.map(a=>a.length>1?1+(i-1)%(a.length-1):0));
    for(let m=0;m<members.length;m++)if(i<modes[m].length)add(members.map((_,j)=>j===m?i:0));
  }
  // 相互依赖的队友增益需联合换套；在有限预算内补充不同配对，非穷举承诺。
  const cap=Math.min(30000,Math.max(30,Number(input.budget)||1200));
  for(let depth=2;branches.length<cap&&depth<modes.reduce((n,a)=>n+a.length,0);depth++)for(let a=0;a<members.length;a++)for(let b=a+1;b<members.length;b++)for(let i=1;i<modes[a].length;i++){const j=depth-i;if(j>0&&j<modes[b].length)add(members.map((_,m)=>m===a?i:m===b?j:0));if(branches.length>=cap)break;}
  return {branches,members,modes:modes.map((a,i)=>({member:members[i],feasible:a.length}))};
}


// 搜索五件组合由固定提交 GO 的剪枝、分支限界与 ComputeWorker 求解；Wiki 负责全队协调。
export async function optimizeArtifactInventory(input,options={}){
 input={...input,goals:input.goals??{}};const budget=Math.max(30,Math.min(30000,Number(input.budget)||1200)),cancelled=options.cancelled??(()=>false),progress=options.progress??(()=>{}),workspace=createOptimizerWorkspace(input);
 const members=teamKeys(input.good,input.key,input.scenario),searched=input.scope==='team'?members:[input.key],roleRules=roles(input,searched),target=input.objective==='combo'?input.key:input.targetKey??input.key;
 if(!members.includes(target)||!searched.length)throw Error('请选择有效队伍与目标角色。');
 for(const r of Object.values(roleRules))validateOptimizerRules(r);
 const initial=equipmentAssignment(input.good,members),metricValues=optimizerMetricValues(input.good,input.data,input.goals[target]?.weights??{},target,workspace),best=new Map(),availability=[],diagnostics=[];
 const fixedOwners=new Map(searched.flatMap(role=>SLOTS.filter(slot=>!optimizerSearchSlots(roleRules[role]).includes(slot)).map(slot=>[initial[role].artifacts[slot],role])).filter(([index])=>index>=0));
 const eligible=Object.fromEntries(searched.map(role=>[role,SLOTS.map(slot=>{const fixed=!optimizerSearchSlots(roleRules[role]).includes(slot),indices=optimizerEligibleCandidates(input.good,role,slot,{...input,workspace,rules:roleRules[role],objective:role===target?input.objective:''}).filter(index=>!fixedOwners.has(index)||fixedOwners.get(index)===role);availability.push({member:role,slot,eligible:indices.length,selected:indices.length,fixed});return indices;})]));
 const prepared=good=>{const p=prepareArtifactScenario(good,input.key,input.scenario,input);return {...(options.calculate??calculateTeam)(good,input.key,p.scenario),scenario:p.scenario,artifactAudit:p.audit,artifactTriggerVersion:p.version};};
 const score=(team,assignment,good)=>OPTIMIZER_METRICS[input.objective]?optimizerBuildMetrics(metricValues,assignment[target])[input.objective]:input.objective==='combo'?comboDamage(good,input.key,team.scenario,team).value:input.objective?.startsWith('idlePanel:')?(options.calculateIdle??idlePanel)(good,target)[input.objective.slice(10)]:input.objective?.startsWith('panel:')?team.members.find(m=>m.key===target)?.panel[input.objective.slice(6)]:team.members.find(m=>m.key===target)?.rows.find(r=>r.path===input.objective)?.average;
 const before=prepared(input.good),baseline=score(before,initial,input.good);if(!Number.isFinite(baseline))throw Error('计算目标无效，请重新选择。');
 let tested=0,invalid=0,skipped=0,completed=0,allComplete=true;
 const keep=(assignment,allowPartial=false)=>{try{
   for(const role of searched){const b=assignment[role],r=roleRules[role],counts={};for(const slot of SLOTS){if(!eligible[role][SLOTS.indexOf(slot)].includes(b.artifacts[slot]))return null;const set=input.good.artifacts[b.artifacts[slot]].setKey;counts[set]=(counts[set]??0)+1;}
   if(r.setMode==='four'&&(counts[r.set1]??0)<4||r.setMode==='two-two'&&((counts[r.set1]??0)<2||(counts[r.set2]??0)<2))return null;}
   const good=optimizerCompactGOOD(input.good,assignment),team=prepared(good);
   const violations=searched.reduce((n,role)=>n+optimizerPanelFailures({battle:team.members.find(m=>m.key===role)?.panel,idle:(options.calculateIdle??idlePanel)(good,role)},roleRules[role]).length,0);if(violations&&!allowPartial)return null;
   const value=score(team,assignment,good);if(!Number.isFinite(value))return null;const candidate={assignment:structuredClone(assignment),score:value,violations};if(!violations)best.set(JSON.stringify(assignment),candidate);
   for(const [id]of [...best].sort((a,b)=>b[1].score-a[1].score).slice(50))best.delete(id);return candidate;
 }catch(e){invalid++;if(diagnostics.length<5)diagnostics.push(e.message);return null;}};
 keep(initial);
 const engine=options.solve??solveGOArtifacts, plan=input.scope==='team'?supplementalSearchBranches(input,workspace):{branches:[roleRules],modes:[]},branches=plan.branches.slice(0,Math.min(120,Math.max(1,Math.floor(budget/30))));
 const report=()=>progress({phase:'GO 固定版搜索',tested,skipped,invalid,budget,found:best.size,best:best.size?Math.max(...[...best.values()].map(r=>r.score)):null});
 const seedFor=rules=>{const result=structuredClone(initial),used=new Set((searched.length===1&&input.rules.borrow?[]:members.filter(k=>!searched.includes(k))).flatMap(k=>Object.values(result[k].artifacts)).filter(i=>i>=0));
  for(const role of searched){let picked;
   for(const pattern of patterns(rules[role])){const local=new Set(used),chosen={};for(let i=0;i<5;i++){const n=eligible[role][i].find(n=>!local.has(n)&&(!pattern[i]||input.good.artifacts[n].setKey===pattern[i]));if(n===undefined)break;chosen[SLOTS[i]]=n;local.add(n);}if(Object.keys(chosen).length===5){picked=chosen;for(const n of local)used.add(n);break;}}
   if(!picked)return null;result[role].artifacts=picked;
  }if(searched.length===1&&input.rules.borrow){const used=new Set(Object.values(result[searched[0]].artifacts));for(const owner of members)if(owner!==searched[0])for(const slot of SLOTS)if(used.has(result[owner].artifacts[slot]))result[owner].artifacts[slot]=-1;}return result;
 };
 if(availability.some(a=>!a.eligible))for(const a of availability.filter(a=>!a.eligible))diagnostics.push((input.catalog.characters[a.member]?.name??a.member)+'：'+SLOT_NAMES[a.slot]+(a.fixed?'未参与计算且当前未装备，请先装备或将此部位纳入计算。':'没有满足满级、主词条或库存条件的候选。'));
 else for(const branch of branches){
  if(cancelled()||tested>=budget){allComplete=false;break;}
  const seed=seedFor(branch);if(!seed)continue;keep(seed);let beam=[seed];
  // 多个起点和两轮协调允许借用、换套与增益相互影响；仍是有限全队搜索。
  for(let round=0;round<(searched.length>1?2:1);round++)for(const role of searched){
   const next=[];
   for(const assignment of beam){
    if(cancelled()||tested>=budget){allComplete=false;break;}
    const reserved=new Set((searched.length===1&&input.rules.borrow?[]:members.filter(k=>k!==role)).flatMap(k=>Object.values(assignment[k].artifacts)).filter(i=>i>=0));
    const indices=eligible[role].flat().filter(i=>!reserved.has(i));if(SLOTS.some(s=>!indices.some(i=>input.good.artifacts[i].slotKey===s)))continue;
    const good=optimizerCompactGOOD(input.good,assignment),sets=[...new Set(indices.map(i=>input.good.artifacts[i].setKey))];
    // 预先准备所有可能套装；GO 的动态件数决定效果是否生效。实际结果重新准备、复算。
    const preparationGOOD={...good,artifacts:[...good.artifacts.filter(a=>a.location!==equipmentLocation(role)),...sets.flatMap(setKey=>SLOTS.slice(0,4).map(slotKey=>({setKey,slotKey,location:equipmentLocation(role)})))]};
    const preparation=prepareArtifactScenario(preparationGOOD,input.key,input.scenario,input);
    // 动态输入使用原库存编号；装备副本只改变 location，其他角色保留此起点配装。
    const dynamicGOOD=assignedGOOD(input.good,assignment),share=searched.length===1?budget-tested:Math.max(1,Math.min(budget-tested,Math.floor(budget/Math.max(1,branches.length*searched.length*2))));
    const metricMap=Object.fromEntries(indices.map(i=>[i,role===target?metricValues[i]:{weightedRolls:0,effectiveRolls:0,cv:0}]));
    const run=await engine({good:dynamicGOOD,key:input.key,scenario:preparation.scenario,role,sets,objective:input.objective,targetKey:target,indices,metrics:metricMap,roleRules:searched.length>1?{[role]:roleRules[role]}:roleRules,patterns:patterns(branch[role]),budget:share,topN:Math.max(10,Number(input.pool)||30)},{cancelled,progress:p=>progress({phase:'GO 固定版搜索',tested:tested+p.tested,skipped:skipped+p.skipped,invalid,budget,found:best.size,best:best.size?Math.max(...[...best.values()].map(r=>r.score)):null})});
    tested+=run.tested;skipped+=run.skipped??0;invalid+=run.failed??0;allComplete&&=run.complete;
    for(const build of run.builds){const candidate=structuredClone(assignment);candidate[role].artifacts=Object.fromEntries(build.artifactIds.map(id=>{const i=Number(id);return[input.good.artifacts[i].slotKey,i];}));if(Object.keys(candidate[role].artifacts).length!==5)continue;if(searched.length===1&&input.rules.borrow){const used=new Set(Object.values(candidate[role].artifacts));for(const owner of members)if(owner!==role)for(const slot of SLOTS)if(used.has(candidate[owner].artifacts[slot]))candidate[owner].artifacts[slot]=-1;}const kept=keep(candidate,searched.length>1);if(kept)next.push(kept);}
    const unchanged=keep(assignment,searched.length>1);if(unchanged)next.push(unchanged);
   }
   beam=[...new Map(next.sort((a,b)=>a.violations-b.violations||b.score-a.score).map(r=>[JSON.stringify(r.assignment),r.assignment])).values()].slice(0,4);if(!beam.length)beam=[seed];
  }
  completed++;report();
 }
 const results=[];for(const candidate of [...best.values()].sort((a,b)=>b.score-a.score).slice(0,10)){const good=optimizerCompactGOOD(input.good,candidate.assignment),team=prepared(good);results.push(optimizerResultDetails(input.good,candidate,team,target,baseline,optimizerBuildMetrics(metricValues,candidate.assignment[target])));}
 report();return {results,targetKey:input.objective==='combo'?'team':target,baseline,baselineMetrics:optimizerBuildMetrics(metricValues,initial[target]),before:before.members.map(m=>({key:m.key,panel:m.panel,rows:m.rows.filter(r=>r.unit!=='%').map(r=>({...r,name:r.label}))})),tested,invalid,cancelled:cancelled(),exhaustive:false,candidateExhausted:allComplete&&searched.length===1,availability,diagnostics:results.length?[]:[...new Set([...diagnostics,'尚未找到满足全部规则的完整配装，可增加搜索数量或放宽条件。'])],scope:searched.length===1?(allComplete?'GO 求解器已完成本次五件组合搜索':'GO 求解器有限搜索'):'GO 求解器＋Wiki 全队协调（有限搜索）',artifactTriggerVersion:ARTIFACT_TRIGGER_VERSION,searchCoverage:{engine:'GO',commit:GO_SEARCH_COMMIT,completedBranches:completed,scheduledBranches:branches.length,feasibleBranches:plan.branches.length,skipped,roles:plan.modes},beforeScenario:before.scenario,beforeArtifactAudit:before.artifactAudit};
}
