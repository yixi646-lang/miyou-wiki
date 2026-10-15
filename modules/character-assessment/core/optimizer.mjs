import {equipmentLocation,SLOTS,SLOT_NAMES,STAT_NAMES,MAIN_STATS,validateGOOD} from './model.mjs';
import {calculateTeam,memberScenario,comboDamage,isDamageRow,idlePanel} from './combat.mjs';
import {calculateBuild} from './calculator.mjs';
import {rollValues} from './evaluate.mjs';

export const OPTIMIZER_PANEL_STATS=['hp','atk','def','eleMas','enerRech_','critRate_','critDMG_','heal_','shield_',...Object.keys(STAT_NAMES).filter(k=>k.endsWith('_dmg_'))];
export const OPTIMIZER_METRICS={weightedRolls:'有效副词条加权评分',effectiveRolls:'有效副词条总量',cv:'圣遗物双暴值'};
export const OPTIMIZER_ARTIFACT_SCOPE='仅计算五星 +20 圣遗物；套装最高四星时仅计算四星 +16。1–3 星不参与计算。';
export const WEIGHTED_ROLLS_EDIT_HINT='可在「养成评价」中选择该角色，展开「评价目标与词条权重」，自行调整「有效副词条权重」。';
export const OPTIMIZER_METRIC_HELP={
 weightedRolls:{summary:'按角色的属性重要程度计分，重要属性加分更多。'+WEIGHTED_ROLLS_EDIT_HINT,detail:'按当前角色的评价权重计分：副词条数值先换算为五星的一次平均数值，再乘对应权重相加。包含初始副词条，结果可以是小数；评分不等于实际伤害。'+WEIGHTED_ROLLS_EDIT_HINT},
 effectiveRolls:{summary:'看这个角色用得上的副词条堆了多少。',detail:'当前角色评价权重大于 0 的副词条才计入，数值按圣遗物自身星级的一次平均数值换算后相加，不区分属性的重要程度。包含初始副词条，结果可以是小数，并非实际强化次数。'},
 cv:{summary:'综合比较圣遗物提供的暴击率和暴击伤害。',detail:'五件圣遗物副词条的暴击率 × 2 ＋ 暴击伤害，不计主词条、武器或角色自带的双暴。'}
};
export const optimizerStatName=k=>STAT_NAMES[k]??({shield_:'护盾强效'}[k]??k);
export const optimizerPanelStat=objective=>objective?.startsWith('panel:')?objective.slice(6):objective?.startsWith('idlePanel:')?objective.slice(10):null;
export const optimizerSearchSlots=(rules={})=>rules.searchSlots??SLOTS;
export function optimizerBoundSets(rules={}){return [
 {mode:'battle',enabled:rules.battleEnabled!==false,minimums:rules.minimums??{},maximums:rules.maximums??{}},
 {mode:'idle',enabled:rules.idleEnabled===true,minimums:rules.idleMinimums??{},maximums:rules.idleMaximums??{}}
].filter(r=>r.enabled&&Object.keys(r.minimums).length+Object.keys(r.maximums).length);}
export function optimizerPanelFailures(panels,rules={}){
 const failed=optimizerBoundSets(rules).map(r=>{const p=panels[r.mode]??{};return [
  ...Object.entries(r.minimums).filter(([k,n])=>!Number.isFinite(p[k])||p[k]+1e-8<n).map(([key,min])=>({mode:r.mode,key,min,value:p[key]})),
  ...Object.entries(r.maximums).filter(([k,n])=>!Number.isFinite(p[k])||p[k]-1e-8>n).map(([key,max])=>({mode:r.mode,key,max,value:p[key]}))
 ];});
 if(rules.boundMatch==='any')return failed.some(f=>!f.length)?[]:failed.toSorted((a,b)=>a.length-b.length)[0]??[];
 return failed.flat();
}
export function equipmentAssignment(good,members){return Object.fromEntries(members.map(key=>{const loc=equipmentLocation(key);return[key,{weapon:good.weapons.findIndex(a=>a.location===loc),artifacts:Object.fromEntries(SLOTS.map(slot=>[slot,good.artifacts.findIndex(a=>a.location===loc&&a.slotKey===slot)]))}];}));}
export function optimizerArtifactChanges(good,assignment,key){
 const before=equipmentAssignment(good,[key])[key],after=assignment[key];if(!after)return [];
 return SLOTS.flatMap(slot=>{const beforeIndex=before.artifacts[slot]??-1,afterIndex=after.artifacts?.[slot]??-1;return beforeIndex===afterIndex?[]:[{slot,beforeIndex,afterIndex,before:good.artifacts[beforeIndex]??null,after:good.artifacts[afterIndex]??null}];});
}
export function sortOptimizerResults(results,good,{mode='score',tolerance=1,keys}={}){
 const scores=results.map(r=>r.score).filter(Number.isFinite),best=scores.length?Math.max(...scores):0;
 const allowed=Math.max(0,Math.min(100,Number(tolerance)||0)),threshold=best-Math.abs(best)*allowed/100;
 const rows=results.map((candidate,index)=>{
  const members=keys??Object.keys(candidate.assignment),changes=members.flatMap(key=>optimizerArtifactChanges(good,candidate.assignment,key).map(change=>({...change,key})));
  const borrowed=changes.filter(change=>change.after?.location&&change.after.location!==equipmentLocation(change.key)).length;
  return {candidate,index,changed:changes.length,borrowed,withinTolerance:Number.isFinite(candidate.score)&&candidate.score>=threshold-1e-9};
 });
 return rows.sort((a,b)=>{
  if(mode==='changes'){
   if(a.withinTolerance!==b.withinTolerance)return a.withinTolerance?-1:1;
   if(a.withinTolerance){const swaps=a.changed-b.changed||a.borrowed-b.borrowed;if(swaps)return swaps;}
  }
  return b.candidate.score-a.candidate.score||a.index-b.index;
 });
}
export function assignedGOOD(source,assignment){
 const good=structuredClone(source),locations=new Set(Object.keys(assignment).map(equipmentLocation)),used={weapons:new Set(),artifacts:new Set()};
 for(const kind of ['weapons','artifacts'])for(const item of good[kind])if(locations.has(item.location))item.location='';
 for(const [key,build]of Object.entries(assignment))for(const [kind,index,slot]of [['weapons',build.weapon,''],...SLOTS.map(slot=>['artifacts',build.artifacts[slot],slot])]){if(index<0||index==null)continue;if(!Number.isInteger(index)||!good[kind][index]||used[kind].has(index)||kind==='artifacts'&&good[kind][index].slotKey!==slot)throw Error('推荐装备已失效或重复分配。');used[kind].add(index);good[kind][index].location=equipmentLocation(key);}
 return good;
}
export function validateOptimizerRules(rules={}){
 if(rules.searchSlots!==undefined&&(!Array.isArray(rules.searchSlots)||!rules.searchSlots.length||new Set(rules.searchSlots).size!==rules.searchSlots.length||rules.searchSlots.some(slot=>!SLOTS.includes(slot))))throw Error('请选择至少一个有效的计算部位。');
 if(!['none','four','two-two'].includes(rules.setMode??'none'))throw Error('套装限制不正确。');
 if(rules.setMode==='four'&&!rules.set1||rules.setMode==='two-two'&&(!rules.set1||!rules.set2||rules.set1===rules.set2))throw Error('请选择有效的四件套或两种不同的二件套。');
 if(!['all','any'].includes(rules.boundMatch??'all'))throw Error('请选择面板范围的满足方式。');
 for(const bounds of [rules.minimums??{},rules.maximums??{},rules.idleMinimums??{},rules.idleMaximums??{}])for(const [stat,value]of Object.entries(bounds))if(!OPTIMIZER_PANEL_STATS.includes(stat)||!Number.isFinite(value)||value<0)throw Error('面板范围须使用有效属性及非负数。');
 for(const [minKey,maxKey]of [['minimums','maximums'],['idleMinimums','idleMaximums']])for(const [stat,min]of Object.entries(rules[minKey]??{}))if(rules[maxKey]?.[stat]!==undefined&&min>rules[maxKey][stat])throw Error(optimizerStatName(stat)+'的下限不能大于上限。');
 for(const [slot,stat]of Object.entries(rules.mainStats??{}))if(!MAIN_STATS[slot]||stat!=='any'&&!MAIN_STATS[slot].includes(stat))throw Error('主词条筛选与部位不匹配。');
}
export const optimizerPanelMet=(panel,rules)=>Object.entries(rules.minimums??{}).every(([k,min])=>Number.isFinite(panel[k])&&panel[k]+1e-8>=min)&&Object.entries(rules.maximums??{}).every(([k,max])=>Number.isFinite(panel[k])&&panel[k]-1e-8<=max);
// 仅在一次搜索内复用，账号、库存、权重改变或重新计算时创建新工作区。
export function createOptimizerWorkspace({good,data,goals={}}){return {good,data,goals,ranked:new Map(),metrics:new Map(),idle:new Map()};}
function rankedCandidates(good,key,kind,slot,{catalog,goals={},rules={},data,objective,workspace}){
 const cache=workspace?.good===good&&workspace.data===data&&workspace.goals===goals?workspace.ranked:null;
 const cacheKey=JSON.stringify([key,kind,slot,optimizerSearchSlots(rules).includes(slot),!!rules.includeCustom,!!rules.borrow,!!rules.excludeLocked,!!rules.useGoal,rules.mainStats?.[slot],OPTIMIZER_METRICS[objective]?objective:'']);
 if(cache?.has(cacheKey))return cache.get(cacheKey);
 const goal=goals[key]??{},loc=equipmentLocation(key),weights=goal.weights??{},explicit=rules.mainStats?.[slot];
 // 未选部位固定当前装备，主词条、等级和库存筛选仅作用于参与搜索的部位。
 if(kind==='artifacts'&&!optimizerSearchSlots(rules).includes(slot)){const index=good.artifacts.findIndex(a=>a.location===loc&&a.slotKey===slot);return index<0?[]:[{a:good.artifacts[index],index}];}
 if(kind==='weapons'){const index=good.weapons.findIndex(a=>a.location===loc);return index<0?[]:[{a:good.weapons[index],index}];}
 const items=good[kind].map((a,index)=>({a,index})).filter(({a})=>(a.rarity===5&&a.level===20||a.rarity===4&&a.level===16&&Math.max(...(data?.art.data[a.setKey]?.rarities??[]))===4)&&!a.wikiTrialOnly&&(rules.includeCustom||!a.wikiCustom)&&(rules.borrow||!a.location||a.location===loc)&&(!rules.excludeLocked||!a.lock||a.location===loc)&&a.slotKey===slot&&(explicit?explicit==='any'||a.mainStatKey===explicit:!rules.useGoal||!goal.mainStats?.[slot]?.length||goal.mainStats[slot].includes(a.mainStatKey)));
 const rank=a=>{
  if(data&&OPTIMIZER_METRICS[objective]){const r=rollValues(a,data,weights);return objective==='cv'?r.cv:objective==='weightedRolls'?r.effective:r.details.reduce((n,s)=>n+(s.weight>0?s.rolls:0),0);}
  return a.substats.reduce((n,s)=>n+(weights[s.key]??0)*s.value/(s.key==='eleMas'?20:s.key.endsWith('_')?5:20),0);
 };
 const scores=new Map(items.map(v=>[v.index,rank(v.a)]));
 items.sort((x,y)=>scores.get(y.index)-scores.get(x.index)||y.a.level-x.a.level||x.index-y.index);cache?.set(cacheKey,items);return items;
}
export const optimizerEligibleCandidates=(good,key,slot,options)=>rankedCandidates(good,key,'artifacts',slot,options).map(v=>v.index);
export function optimizerCandidates(good,key,kind,slot,options){
 const {rules={},pool=6,data}=options,items=rankedCandidates(good,key,kind,slot,options),selected=new Set();
 const groups=kind==='artifacts'&&rules.setMode!=='none'?[rules.set1,...(rules.setMode==='two-two'?[rules.set2]:[])].filter(Boolean):[];
 for(const set of groups)for(const {index}of items.filter(v=>v.a.setKey===set).slice(0,Math.max(1,Math.floor(pool/(groups.length+1)))))selected.add(index);
 // Preserve alternatives that can help a panel threshold instead of pruning every high-ER/HP piece.
 if(kind==='artifacts')for(const bounds of optimizerBoundSets(rules))for(const stat of new Set([...Object.keys(bounds.minimums),...Object.keys(bounds.maximums)])){const value=a=>(a.mainStatKey===stat?(data?.art.main[a.rarity]?.[stat]?.[a.level]??0)*(stat.endsWith('_')?100:1):0)+(a.substats.find(s=>s.key===stat)?.value??0);const ordered=items.toSorted((x,y)=>value(y.a)-value(x.a));for(const item of [bounds.minimums[stat]!==undefined?ordered.find(v=>value(v.a)>0):null,bounds.maximums[stat]!==undefined?ordered.at(-1):null])if(item&&selected.size<pool)selected.add(item.index);}
 for(const {index}of items)if(selected.size<pool)selected.add(index);
 const current=items.find(v=>v.a.location===equipmentLocation(key));if(current)selected.add(current.index);
 return items.filter(v=>selected.has(v.index)).map(v=>v.index);
}
// Each pattern fixes the required set slots and leaves one slot open to an off-piece.
function setPatterns(rules){
 if(!rules.setMode||rules.setMode==='none')return [Array(5).fill('')];
 if(rules.setMode==='four')return SLOTS.map((_,off)=>SLOTS.map((_,i)=>i===off?'':rules.set1));
 const result=[];for(let off=0;off<5;off++){const rest=[0,1,2,3,4].filter(i=>i!==off);for(let a=0;a<rest.length;a++)for(let b=a+1;b<rest.length;b++)result.push(SLOTS.map((_,i)=>i===off?'':[rest[a],rest[b]].includes(i)?rules.set1:rules.set2));}return result;
}
class Queue{
 values=[];
 push(v){let i=this.values.length;this.values.push(v);while(i){const p=(i-1)>>1;if(this.values[p].cost<=v.cost)break;this.values[i]=this.values[p];i=p;}this.values[i]=v;}
 pop(){const root=this.values[0],tail=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let c=i*2+1;if(c+1<this.values.length&&this.values[c+1].cost<this.values[c].cost)c++;if(this.values[c].cost>=tail.cost)break;this.values[i]=this.values[c];i=c;}this.values[i]=tail;}return root;}
 get length(){return this.values.length;}
}
export function optimizerCompactGOOD(good,assignment){const used={weapons:new Map(),artifacts:new Map()};for(const [owner,b]of Object.entries(assignment))for(const [kind,index]of [['weapons',b.weapon],...SLOTS.map(s=>['artifacts',b.artifacts[s]])])if(index>=0){if(used[kind].has(index))throw Error('装备不能重复分配。');used[kind].set(index,owner);}return {...good,weapons:[...used.weapons].map(([i,k])=>({...good.weapons[i],location:equipmentLocation(k)})),artifacts:[...used.artifacts].map(([i,k])=>({...good.artifacts[i],location:equipmentLocation(k)}))};}
export function optimizerMetricValues(good,data,weights,target,workspace){
 if(workspace?.metrics.has(target))return workspace.metrics.get(target);
 const values=good.artifacts.map(a=>{const r=rollValues(a,data,weights);return {weightedRolls:r.effective,effectiveRolls:r.details.reduce((n,s)=>n+(s.weight>0?s.rolls:0),0),cv:r.cv};});workspace?.metrics.set(target,values);return values;
}
export const optimizerBuildMetrics=(values,build)=>Object.fromEntries(Object.keys(OPTIMIZER_METRICS).map(k=>[k,SLOTS.reduce((n,s)=>n+(values[build.artifacts[s]]?.[k]??0),0)]));
export function optimizerResultDetails(good,candidate,team,target,baseline,metrics){
 if(team.members.some(m=>m.error))throw Error(team.members.find(m=>m.error).error);
 const locations=new Set(Object.keys(candidate.assignment).map(equipmentLocation)),owners=new Map(Object.entries(candidate.assignment).flatMap(([owner,b])=>SLOTS.map(s=>[b.artifacts[s],equipmentLocation(owner)])));
 return {...candidate,delta:candidate.score-baseline,panel:team.members.find(m=>m.key===target).panel,metrics,members:summary(team),...(team.artifactTriggerVersion?{scenario:team.scenario,artifactAudit:team.artifactAudit,artifactTriggerVersion:team.artifactTriggerVersion}:{}),borrowed:good.artifacts.flatMap((item,index)=>{const to=owners.get(index)??(locations.has(item.location)?'':item.location);return item.location&&item.location!==to?[{kind:'artifacts',index,from:item.location,to}]:[];})};
}
export async function optimizeInventory({good,key,targetKey=key,scenario,catalog,goals={},rules={},memberRules={},scope='single',objective,data,budget=1200,pool=6},{progress=()=>{},cancelled=()=>false,calculate=calculateTeam,calculateIdle=idlePanel,candidateProvider=optimizerCandidates,patternProvider=setPatterns,minimumBudget=30,workspace,evaluateCandidate,deferResults=false,yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(workspace&&(workspace.good!==good||workspace.data!==data||workspace.goals!==goals))throw Error('搜索工作区与本次库存或评价设置不匹配。');
 if(!good.characters.some(c=>c.key===key))throw Error('请先选择库存中的角色。');if(!['single','team'].includes(scope))throw Error('推荐范围不正确。');
 const checked=workspace?.checked??validateGOOD(good,data);if(checked.errors.length)throw Error(checked.errors[0]);if(workspace)workspace.checked=checked;
 const before=calculate(good,key,scenario);if(before.members.some(m=>m.error))throw Error('队伍计算失败：'+before.members.filter(m=>m.error).map(m=>m.error).join('；'));
 const allMembers=before.members.map(m=>m.key),members=scope==='team'?allMembers:[key],initial=equipmentAssignment(good,allMembers);
 const target=objective==='combo'?key:targetKey;if(!allMembers.includes(target))throw Error('目标角色不在所选队伍中，请重新选择。');
 const roleRules=Object.fromEntries(members.map(member=>[member,{...(member===key?rules:{...rules,searchSlots:SLOTS,setMode:'none',mainStats:{},minimums:{},maximums:{},idleMinimums:{},idleMaximums:{}}),...memberRules[member],borrow:rules.borrow,includeCustom:rules.includeCustom,excludeLocked:rules.excludeLocked}]));
 for(const member of members)try{validateOptimizerRules(roleRules[member]);}catch(error){throw Error((catalog.characters[member]?.name??member)+'：'+error.message);}
 budget=Math.max(minimumBudget,Math.min(30000,Number(budget)||1200));pool=Math.max(2,Math.min(20,Number(pool)||6));
 const artifactMetrics=optimizerMetricValues(good,data,goals[target]?.weights??{},target,workspace);
 const metrics=b=>optimizerBuildMetrics(artifactMetrics,b);
 const idleCache=workspace?.idle??new Map(),idleObjective=objective?.startsWith('idlePanel:');
 function idleFor(assignment,member){const id=member+'|'+JSON.stringify(assignment[member]);if(!idleCache.has(id)){if(idleCache.size>=2048)idleCache.clear();idleCache.set(id,calculateIdle(compactGOOD(assignment),member));}return idleCache.get(id);}
 const score=(team,assignment)=>{
  if(OPTIMIZER_METRICS[objective])return metrics(assignment[target])[objective];
  if(objective?.startsWith('panel:'))return team.members.find(m=>m.key===target)?.panel[objective.slice(6)];
  if(idleObjective)return idleFor(assignment,target)[objective.slice(10)];
  if(objective==='combo'){if(!scenario.combo?.length)throw Error('所选队伍未设置固定动作组合。');return comboDamage(compactGOOD(assignment),key,team.scenario??scenario,team).value;}
  const row=team.members.find(m=>m.key===target)?.rows.find(r=>r.path===objective);if(!row||row.unit==='%')throw Error('所选伤害或治疗项目在这组装备条件下不可计算。');return row.average;
 };
 const baseline=score(before,initial);if(!Number.isFinite(baseline))throw Error('计算目标无效，请重新选择。');
 let tested=0,invalid=0,inspected=0,panelRejected=0,stopped=false,pendingInitial=null;
 const errors=new Map(),best=[],closest=[],queue=new Queue(),availability=[];
 // Weapons stay fixed to each member's equipped item; search only the five artifact slots.
 const stages=members.flatMap(member=>SLOTS.map(slot=>({member,kind:'artifacts',slot})));
 const fixedOwners=new Map(stages.filter(s=>!optimizerSearchSlots(roleRules[s.member]).includes(s.slot)).map(s=>[initial[s.member].artifacts[s.slot],s.member]).filter(([index])=>index>=0));
 const pools=stages.map(stage=>{const fixed=!optimizerSearchSlots(roleRules[stage.member]).includes(stage.slot),options={catalog,goals,rules:roleRules[stage.member],pool,data,workspace,objective:stage.member===target?objective:''},allowed=index=>!fixedOwners.has(index)||fixedOwners.get(index)===stage.member,eligible=rankedCandidates(good,stage.member,stage.kind,stage.slot,options).filter(v=>allowed(v.index)),selected=(fixed?eligible.map(v=>v.index):candidateProvider(good,stage.member,stage.kind,stage.slot,options)).filter(allowed);availability.push({member:stage.member,slot:stage.slot,eligible:eligible.length,selected:selected.length,fixed});return selected;});
 const missing=availability.filter(a=>!a.eligible);if(missing.length)return finish(false,missing.map(a=>(catalog.characters[a.member]?.name??a.member)+'：'+SLOT_NAMES[a.slot]+(a.fixed?'未参与计算且当前未装备，请先装备或将此部位纳入计算。':'没有符合满级要求（五星 +20，最高四星套装的四星 +16）、主词条、借用及库存范围的候选。')));
 const ranks=pools.map(p=>new Map(p.map((index,rank)=>[index,rank])));
 const patterns=members.map((member,m)=>{const unique=new Map();for(const pattern of patternProvider(roleRules[member])){const lists=SLOTS.map((_,slot)=>pools[m*5+slot].filter(index=>!pattern[slot]||good.artifacts[index].setKey===pattern[slot]));if(lists.every(l=>l.length))unique.set(JSON.stringify(lists),lists);}return [...unique.values()].sort((a,b)=>a.reduce((n,l,i)=>n+ranks[m*5+i].get(l[0]),0)-b.reduce((n,l,i)=>n+ranks[m*5+i].get(l[0]),0));});
 const missingSets=members.flatMap((member,m)=>{if(patterns[m].length)return [];const r=roleRules[member];return [(catalog.characters[member]?.name??member)+'：当前满级圣遗物、主词条及候选范围下，无法凑齐'+(r.setMode==='four'?(catalog.sets[r.set1]?.name??r.set1)+'四件套':'指定的两组二件套')+'；请更换套装、主词条、借用范围或增加候选数量。'];});
 if(missingSets.length)return finish(false,missingSets);
 const seenNodes=new Set(),seenBuilds=new Set();
 const candidateList=(choices,i)=>patterns[Math.floor(i/5)][choices[Math.floor(i/5)]][i%5];
 function enqueue(choices,positions){const id=choices.join(',')+'|'+positions.join(',');if(seenNodes.has(id))return;seenNodes.add(id);queue.push({choices,positions,cost:positions.reduce((n,p,i)=>n+ranks[i].get(candidateList(choices,i)[p]),0)});}
 // Expand the Cartesian product lazily: four 2+2 rules can otherwise create 30^4 roots.
 enqueue(Array(members.length).fill(0),Array(stages.length).fill(0));
 // Keep the current build only when it obeys all equipment constraints.
 pendingInitial=patterns.every((variants,m)=>variants.some(lists=>SLOTS.every((slot,i)=>lists[i].includes(initial[members[m]].artifacts[slot]))))?initial:null;
 const boundedMembers=members.filter(member=>optimizerBoundSets(roleRules[member]).length),hasBounds=boundedMembers.length>0,metricOnly=!!OPTIMIZER_METRICS[objective]&&!hasBounds,needsTeam=objective==='combo'||boundedMembers.some(member=>member!==target);
 function panelFailures(team,assignment){return boundedMembers.flatMap(member=>{const r=roleRules[member],panels={battle:team?.members.find(m=>m.key===member)?.panel};if(optimizerBoundSets(r).some(b=>b.mode==='idle'))panels.idle=idleFor(assignment,member);return optimizerPanelFailures(panels,r).map(f=>({...f,member}));});}
 function compactGOOD(assignment){return optimizerCompactGOOD(good,assignment);}
 function assignmentOf(node){const assignment=structuredClone(initial),used=new Set();for(const [i,s]of stages.entries()){const index=candidateList(node.choices,i)[node.positions[i]];if(used.has(index))return null;used.add(index);assignment[s.member].artifacts[s.slot]=index;}
  for(const owner of allMembers.filter(m=>!members.includes(m))){const b=assignment[owner];for(const slot of SLOTS)if(used.has(b.artifacts[slot]))b.artifacts[slot]=-1;}return assignment;
 }
 function report(){progress({stage:tested,stages:budget,member:key,slot:'完整配装',tested,budget,best:best[0]?.score??null,invalid,found:best.length,inspected,candidates:best});}
 report();await yieldControl();
 while((pendingInitial||queue.length)&&tested<budget&&inspected<Math.max(5000,budget*80)&&queue.length<60000){
  if(cancelled()){stopped=true;break;}let assignment;
  if(pendingInitial){assignment=pendingInitial;pendingInitial=null;}else{const node=queue.pop();for(let m=0;m<members.length;m++)if(node.choices[m]+1<patterns[m].length){const choices=[...node.choices],positions=[...node.positions];choices[m]++;positions.fill(0,m*5,m*5+5);enqueue(choices,positions);}for(let i=0;i<stages.length;i++)if(node.positions[i]+1<candidateList(node.choices,i).length){const positions=[...node.positions];positions[i]++;enqueue(node.choices,positions);}assignment=assignmentOf(node);}
  inspected++;if(inspected%64===0){report();await yieldControl();}if(!assignment)continue;
  const id=JSON.stringify(assignment);if(seenBuilds.has(id))continue;seenBuilds.add(id);tested++;
  try{
   const next=compactGOOD(assignment),team=metricOnly?null:evaluateCandidate?evaluateCandidate(next,key,scenario,{target,needsTeam,boundedMembers,roleRules,assignment,id}):calculate===calculateTeam&&!needsTeam?{members:[{key:target,...calculateBuild(next,target,memberScenario(next,key,scenario,target))}]}:calculate(next,key,scenario);
   if(team?.members.some(m=>m.error))throw Error(team.members.find(m=>m.error).error);
   if(hasBounds){const failed=panelFailures(team,assignment);if(failed.length){panelRejected++;closest.push({failed,cost:failed.reduce((n,f)=>n+(Number.isFinite(f.value)?Math.abs(f.value-(f.min??f.max))/Math.max(1,f.min??f.max):Infinity),0)});closest.sort((a,b)=>a.cost-b.cost);closest.length=Math.min(closest.length,1);continue;}}
   const value=score(team,assignment);if(!Number.isFinite(value))throw Error('计算结果不是有效数值。');best.push({assignment,score:value});best.sort((a,b)=>b.score-a.score);best.length=Math.min(best.length,5);
  }catch(error){invalid++;errors.set(error.message,(errors.get(error.message)??0)+1);}
  if(tested%4===0){report();await yieldControl();}
 }
 return finish(stopped);
 function finish(wasCancelled,reasons=[]){
  const results=[];for(const candidate of best){try{if(deferResults){results.push(candidate);continue;}const next=compactGOOD(candidate.assignment),team=calculate(next,key,scenario);if(panelFailures(team,candidate.assignment).length)continue;results.push(optimizerResultDetails(good,candidate,team,target,baseline,metrics(candidate.assignment[target])));}catch(error){reasons.push(error.message);}}
  const exhausted=inspected>0&&!queue.length&&!pendingInitial;
  if(!results.length&&!reasons.length){if(wasCancelled)reasons.push('计算已取消，尚未找到满足条件的完整配装。');else if(panelRejected)reasons.push('已试算完整配装，但未满足面板范围。'+(closest[0]?.failed.map(f=>(catalog.characters[f.member]?.name??f.member)+'：'+(f.mode==='idle'?'非战斗':'队伍战斗')+'面板 '+optimizerStatName(f.key)+' '+(Number.isFinite(f.value)?f.value.toFixed(1):'不可计算')+(f.min!==undefined?' < 下限 '+f.min:' > 上限 '+f.max)).join('；')??''));else reasons.push(exhausted?'当前候选范围内没有可计算的配装。':'已达到搜索上限；可增加候选或试算数量继续搜索。');}
  for(const [message,n]of errors)reasons.push(message+'（'+n+' 组）');
  if(queue.length>=60000)reasons.push('已达到组合队列上限，保留已找到的结果；可缩小队伍或候选范围。');
  return{results,targetKey:objective==='combo'?'team':target,baseline,baselineMetrics:metrics(initial[target]),tested,invalid,cancelled:wasCancelled,exhaustive:false,candidateExhausted:exhausted,availability,diagnostics:[...new Set(reasons)],scope:exhausted?'已遍历当前候选组合':'候选筛选与完整配装搜索',before:summary(before),...(before.artifactTriggerVersion?{beforeScenario:before.scenario,beforeArtifactAudit:before.artifactAudit,artifactTriggerVersion:before.artifactTriggerVersion}: {})};
 }
}
function summary(team){return team.members.map(m=>({key:m.key,panel:m.panel,rows:m.rows.filter(r=>r.unit!=='%'&&(isDamageRow(r)||r.variant==='heal')).map(r=>({path:r.path,name:r.label,average:r.average,hit:r.hit,crit:r.crit,group:r.group,variant:r.variant}))}));}
