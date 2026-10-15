
import {SLOTS,MAIN_STATS,SUBSTATS,equipment,equipmentLocation,validateGOOD} from './model.mjs';
import {analyzeArtifact,artifactFromDraft,inspectDraft,substatTiers,artifactMaxLevel,pendingSubstats,displaySubstat} from './artifacts.mjs';
import {calculateTeam,comboDamage,idlePanel,teamKeys,memberScenario} from './combat.mjs';
import {solveGOTheory,analyzeGOPotential,calculateObjectiveBuild} from './calculator.mjs';
import {OPTIMIZER_PANEL_STATS,OPTIMIZER_METRICS,optimizerPanelFailures,optimizerBoundSets} from './optimizer.mjs';
import {rollValues} from './evaluate.mjs';

export function researchObjective(good,key,scenario,objective,target=key,{data,goals={}}={}){
 if(OPTIMIZER_METRICS[objective]){if(!data)throw Error('词条评价需要圣遗物计算资料。');return equipment(good,target).artifacts.reduce((n,a)=>{const r=rollValues(a,data,goals[target]?.weights??{});return n+(objective==='cv'?r.cv:objective==='weightedRolls'?r.effective:r.details.reduce((v,s)=>v+(s.weight>0?s.rolls:0),0));},0);}
 if(objective.startsWith('idlePanel:'))return calculateObjectiveBuild(good,target,{members:[],active:target,conditional:{},characters:{},bonusStats:{},reaction:'',infusion:''},['panel:'+objective.slice(10)]).panel[objective.slice(10)];
 if(objective==='combo'){
  const paths=new Map();for(const a of scenario.combo??[]){const owner=a.owner??key;paths.set(owner,[...(paths.get(owner)??[]),a.path]);}
  const calculate=(g,k,settings)=>calculateObjectiveBuild(g,k,settings,paths.get(k)??[],true);
  const members=teamKeys(good,key,scenario).map(k=>({key:k,...(paths.has(k)?calculate(good,k,memberScenario(good,key,scenario,k)):{rows:[]})}));
  return comboDamage(good,key,scenario,{members},{calculate}).value;
 }
 if(!teamKeys(good,key,scenario).includes(target))return undefined;
 const member=calculateObjectiveBuild(good,target,memberScenario(good,key,scenario,target),[objective]);return objective.startsWith('panel:')?member.panel[objective.slice(6)]:member.rows.find(r=>r.path===objective)?.average;
}
export function withResearchArtifacts(good,role,artifacts){const next=structuredClone(good),loc=equipmentLocation(role),slots=new Set(artifacts.map(a=>a.slotKey));for(const a of next.artifacts)if(a.location===loc&&slots.has(a.slotKey))a.location='';next.artifacts.push(...artifacts.map(a=>({...structuredClone(a),location:loc})));return next;}
const potentialSignature=a=>JSON.stringify([a.setKey,a.slotKey,a.rarity,a.level,a.mainStatKey,a.location,a.substats.map(s=>[s.key,s.value])]);
export function potentialSourceIndex(good,artifact,index){
 const matches=a=>a&&potentialSignature(a)===potentialSignature(artifact);
 if(index!==undefined){if(!Number.isInteger(index)||index<0||!matches(good.artifacts[index]))throw Error('来源圣遗物已变化，请重新分析。');return index;}
 const direct=good.artifacts.indexOf(artifact);if(direct>=0)return direct;
 if(artifact.id!==undefined){const found=good.artifacts.findIndex(a=>a.id===artifact.id&&matches(a));if(found>=0)return found;}
 return artifact.location?good.artifacts.findIndex(matches):-1;
}
// 借用现有圣遗物只在试算副本移除原主人的该件，不把同一件同时计入两名队员。
export function potentialSimulationGOOD(good,role,index){const a=good.artifacts[index];if(!a?.location||a.location===equipmentLocation(role))return good;const next=structuredClone(good);next.artifacts[index].location='';return next;}
// 将 GO 的总次数解落实到五件：每件四类、主副不重、总次数和单条上限同时约束。
export function materializeRolls(parts,counts,{tier='mid',data,maxVisits=180000}={}){
 const wanted={...counts},keys=SUBSTATS.filter(k=>wanted[k]>0).sort((a,b)=>wanted[b]-wanted[a]),totals=parts.map(a=>a.totalRolls),remaining=[...totals],lines=parts.map(()=>({})),caps=totals.map((n,i)=>1+n-4),types=parts.map(()=>0);let visits=0;
 const walk=at=>{
  if(++visits>maxVisits)return false;if(at===keys.length)return remaining.every(n=>!n)&&types.every(n=>n===4);
  const key=keys[at],n=wanted[key],available=parts.map((p,i)=>p.mainStatKey!==key&&(!p.allowedSubs||p.allowedSubs.includes(key))&&types[i]<4?Math.min(caps[i],remaining[i]):0);if(available.reduce((a,b)=>a+b,0)<n)return false;
  const assign=(i,left)=>{
   if(i===5){if(left)return false;const future=keys.slice(at+1);
    if(parts.some((p,j)=>remaining[j]<4-types[j]||future.filter(k=>k!==p.mainStatKey&&(!p.allowedSubs||p.allowedSubs.includes(k))).length<4-types[j]||remaining[j]>(4-types[j])*caps[j]))return false;
    return walk(at+1);
   }
   const max=Math.min(left,available[i]),min=Math.max(0,left-available.slice(i+1).reduce((a,b)=>a+b,0));
   const options=Array.from({length:max-min+1},(_,j)=>min+j).sort((a,b)=>Math.abs(a-n/Math.max(1,available.filter(Boolean).length))-Math.abs(b-n/Math.max(1,available.filter(Boolean).length)));
   for(const value of options){if(value){lines[i][key]=value;types[i]++;remaining[i]-=value;}if(assign(i+1,left-value))return true;if(value){delete lines[i][key];types[i]--;remaining[i]+=value;}}
   return false;
  };return assign(0,n);
 };
 if(!walk(0))return null;
 return parts.map((p,i)=>{const draft={...p,initialCount:p.totalRolls-Math.floor(p.level/4),lines:Object.entries(lines[i]).map(([key,n])=>{const tiers=substatTiers(data,p.rarity,key),counts=tiers.map(()=>0);if(tier==='max')counts[tiers.length-1]=n;else{counts[1]=Math.ceil(n/2);counts[2]=Math.floor(n/2);}return {key,counts};})};const check=inspectDraft(draft,data);if(!check.realistic)throw Error(check.errors[0]);return {artifact:check.artifact,draft,rolls:lines[i]};});
}
export function optimizeTheory(request){
 const {good,key,role=key,scenario={},objective,targetKey=role,data,basis='zero',freeRolls=20,tier='mid',config,panelRules={}}=request;
 if(!['zero','current'].includes(basis)||!['mid','max'].includes(tier))throw Error('请选择有效的分配基础与词条档位。');
 if(!good.characters.some(c=>c.key===role))throw Error('请选择账号中已有的配装角色。');
 for(const [low,high]of [['minimums','maximums'],['idleMinimums','idleMaximums']]){
  for(const bounds of [panelRules[low]??{},panelRules[high]??{}])for(const [stat,value]of Object.entries(bounds))if(!OPTIMIZER_PANEL_STATS.includes(stat)||!Number.isFinite(value)||value<0)throw Error('面板要求须使用有效属性及非负数。');
  for(const [stat,value]of Object.entries(panelRules[low]??{}))if(panelRules[high]?.[stat]!==undefined&&value>panelRules[high][stat])throw Error('面板属性的下限不能大于上限。');
 }
 let parts;
 if(basis==='current'){
  const equipped=equipment(good,role).artifacts;parts=SLOTS.map(slot=>{const a=equipped.find(a=>a.slotKey===slot);if(!a||a.rarity!==5||a.level!==20)throw Error('当前配装重分配需要完整的五星 +20 五件。');const analysis=analyzeArtifact(a,data);if(!analysis.valid)throw Error('当前圣遗物次数无法确认，请先在词条分析中核对。');return {...a,totalRolls:analysis.solutions[0].total,allowedSubs:a.substats.filter(s=>s.key).map(s=>s.key)};});
 }else{
  const base=SUBSTATS.reduce((n,k)=>n+(request.fixedRolls?.[k]??2),0),count=base+freeRolls;
  if(!Number.isInteger(freeRolls)||freeRolls<0||count<40||count>45)throw Error('五星满级五件合计须为 40–45 次；KQM 基础 20 次时，待分配为 20–25 次。');
  parts=SLOTS.map((slot,i)=>({...config?.[slot],slotKey:slot,rarity:5,level:20,totalRolls:8+(i<count-40?1:0)}));
  for(const a of parts){if(!data.art.data[a.setKey]?.rarities.includes(5))throw Error('从零配置请选支持五星的套装。');if(!MAIN_STATS[a.slotKey].includes(a.mainStatKey))throw Error('主词条不属于所选部位。');}
 }
 const total=parts.reduce((n,a)=>n+a.totalRolls,0),fixed=Object.fromEntries(SUBSTATS.map(k=>[k,basis==='current'?parts.filter(a=>a.allowedSubs.includes(k)).length:request.fixedRolls?.[k]??2])),basicRolls=Object.values(fixed).reduce((n,v)=>n+v,0),budget=total-basicRolls;
 if(Object.values(fixed).some(n=>!Number.isInteger(n)||n<0)||basicRolls>total)throw Error('固定词条须为非负整数，合计不能超过五件总次数。');
 const ranges={},seed={},upper={};
 for(const k of SUBSTATS){const capacity=parts.filter(a=>a.mainStatKey!==k&&(!a.allowedSubs||a.allowedSubs.includes(k))).reduce((n,a)=>n+a.totalRolls-3,0),range=request.rollLimits?.[k]??{},enabled=range.enabled!==false,min=enabled?(range.min??0):0,max=enabled?(range.max??budget):0;
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min||max>budget)throw Error('新增词条次数须为预算以内的非负整数，最低次数不能大于最高次数。');
  if(fixed[k]+min>capacity)throw Error('固定词条或最低次数超过对应部位的合法容量。');
  ranges[k]={enabled,min,max:Math.min(max,capacity-fixed[k])};seed[k]=fixed[k]+min;upper[k]=fixed[k]+ranges[k].max;
 }
 if(Object.values(ranges).reduce((n,r)=>n+r.min,0)>budget||Object.values(ranges).reduce((n,r)=>n+r.max,0)<budget)throw Error('所选副词条的最低 / 最高次数无法容纳五件待分配预算。');
 const blank=parts.map(a=>({...a,substats:[],location:'',lock:false})),trial=withResearchArtifacts(good,role,blank),rollValue=k=>{const v=substatTiers(data,5,k);return tier==='max'?v.at(-1):v.reduce((a,b)=>a+b,0)/v.length;};
 const tc={artifact:{slots:Object.fromEntries(parts.map(a=>[a.slotKey,{setKey:a.setKey,statKey:a.mainStatKey,rarity:5,level:20}])),substats:{type:tier==='max'?'max':'mid',rarity:5,stats:Object.fromEntries(SUBSTATS.map(k=>[k,seed[k]*rollValue(k)]))}},optimization:{distributedSubstats:total-Object.values(seed).reduce((n,v)=>n+v,0),maxSubstats:upper}};
 const metricOptions={data,goals:request.goals},proposed=solveGOTheory({good:trial,key,role,scenario,objective,targetKey,tc,panelRules,goals:request.goals}),wanted=Object.fromEntries(SUBSTATS.map(k=>[k,seed[k]+(proposed.maxBufferRolls[k]??0)]));
 let missing=total-Object.values(wanted).reduce((n,v)=>n+v,0);for(const k of SUBSTATS)if(missing>0){const n=Math.min(missing,Math.max(0,upper[k]-wanted[k]));wanted[k]+=n;missing-=n;}
 if(missing||SUBSTATS.some(k=>wanted[k]<seed[k]||wanted[k]>upper[k]))throw Error('GO 返回的总次数超出词条分配范围，未生成或保存配装。');
 const constrained=['minimums','maximums','idleMinimums','idleMaximums'].some(k=>Object.keys(panelRules[k]??{}).length);
 const fits=pieces=>{if(!pieces)return false;if(!constrained)return true;const next=withResearchArtifacts(good,role,pieces.map(p=>p.artifact)),team=calculateTeam(next,key,scenario),panels={battle:team.members.find(m=>m.key===role)?.panel,idle:idlePanel(next,role)};return !optimizerPanelFailures(panels,panelRules).length;};
 let materialized=materializeRolls(parts,wanted,{data,tier}),adjusted=false;if(!fits(materialized))materialized=null;
 // GO 优化汇总数值，Wiki 还要落实到五件离散档位；修正不能越过用户的任何次数或面板要求。
 if(!materialized){adjusted=true;outer:for(const from of SUBSTATS)if(wanted[from]>seed[from])for(const to of SUBSTATS)if(from!==to)for(let n=1;n<=Math.min(4,wanted[from]-seed[from],upper[to]-wanted[to]);n++){const c={...wanted,[from]:wanted[from]-n,[to]:wanted[to]+n},candidate=materializeRolls(parts,c,{data,tier,maxVisits:12000});if(fits(candidate)){materialized=candidate;break outer;}}}
 if(!materialized)throw Error('暂未找到同时满足次数、五件合法性与面板要求的具体配装；请调整条件后重算。');
 const artifacts=materialized.map(r=>r.artifact),afterGOOD=withResearchArtifacts(good,role,artifacts),value=researchObjective(afterGOOD,key,scenario,objective,targetKey,metricOptions),before=researchObjective(good,key,scenario,objective,targetKey,metricOptions),rolls=Object.fromEntries(SUBSTATS.map(k=>[k,materialized.reduce((n,r)=>n+(r.rolls[k]??0),0)]));
 if(!Number.isFinite(value)||!Number.isFinite(before))throw Error('所选计算目标已不可用，请重新选择。');
 const panels=constrained?{battle:calculateTeam(afterGOOD,key,scenario).members.find(m=>m.key===role)?.panel,idle:idlePanel(afterGOOD,role)}:{},panelValues=optimizerBoundSets(panelRules).flatMap(r=>[...new Set([...Object.keys(r.minimums),...Object.keys(r.maximums)])].map(stat=>({mode:r.mode,stat,min:r.minimums[stat],max:r.maximums[stat],value:panels[r.mode]?.[stat]})));
 return {artifacts,pieces:materialized,rolls,fixedRolls:fixed,addedRolls:Object.fromEntries(SUBSTATS.map(k=>[k,rolls[k]-fixed[k]])),rollLimits:ranges,panelRules,panelValues,total,basicRolls,distributedRolls:budget,basis,tier,adjusted,before,value,delta:value-before,proposedRolls:proposed.maxBufferRolls,tested:proposed.tested,comparison:'固定角色、武器、主词条、套装与队伍条件的理论参考；已校验具体五件与面板要求，离散档位结果不代表精确配装上限。'};
}
const factorial=n=>{let v=1;for(let i=2;i<=n;i++)v*=i;return v;};
// GO 查表只保留同显示值的代表组合；历史概率必须枚举全部合法档位次数，避免丢失真实初始值。
const historyVariants=new Map();
function completeHistoryVariants(detail,rarity){
 const signature=JSON.stringify([rarity,detail.key,detail.value]),cached=historyVariants.get(signature);if(cached)return cached;
 const variants=[],cap=6,tiers=detail.tiers;
 const visit=(i,counts,count,value)=>{if(i===tiers.length){if(count>0&&displaySubstat(detail.key,value)===detail.value)variants.push({counts,count,value});return;}for(let n=0;n<=cap-count;n++)visit(i+1,[...counts,n],count+n,value+n*tiers[i]);};
 visit(0,[],0,0);historyVariants.set(signature,variants);return variants;
}
// 最终数值只约束可行历史，不能还原真实顺序。按等概率档位、随机强化的模型加权所有可行初始值。
export function inferReshapeInitials(artifact,data,{initialValues={},prob4=0.2}={}){
 const analysis=analyzeArtifact(artifact,data);if(!analysis.valid)throw Error(analysis.invalid[0]??'这件圣遗物的词条数据无法用于重塑。');
 for(const d of analysis.details)d.variants=completeHistoryVariants(d,artifact.rarity);
 const solutions=[];for(const initial of [3,4]){const total=initial+5,counts=analysis.details.map(d=>[...new Set(d.variants.map(v=>v.count))].filter(n=>n<=total-3));const visit=(i,values,sum)=>{if(sum>total)return;if(i===counts.length){if(sum===total)solutions.push({initial,total,counts:values});return;}for(const n of counts[i])visit(i+1,[...values,n],sum+n);};visit(0,[],0);}
 const known={},sourceKeys=[];
 for(const d of analysis.details){const value=initialValues[d.key]??artifact.substats.find(s=>s.key===d.key)?.initialValue;if(value===undefined||value===null||value==='')continue;
  const tier=d.tiers.find(v=>Math.abs(v-Number(value))<1e-6)??d.tiers.find(v=>displaySubstat(d.key,v)===Number(value));if(tier===undefined)throw Error('所填初始档位不属于该副词条的合法档位。');known[d.key]=tier;sourceKeys.push(d.key);
 }
 const cases=new Map();
 for(const solution of solutions){if(artifact.totalRolls!==undefined&&artifact.totalRolls!==solution.total)continue;
  const upgrades=solution.counts.map(n=>n-1),count=upgrades.reduce((n,v)=>n+v,0),prior=artifact.totalRolls!==undefined?1:solution.initial===4?prob4:1-prob4;
  const allocation=prior*factorial(count)/upgrades.reduce((n,v)=>n*factorial(v),1)/4**count;
  const weights=analysis.details.map((d,i)=>{const n=solution.counts[i],w=d.tiers.map(()=>0),seen=new Set();for(const v of d.variants){const signature=v.counts.join(',');if(v.count!==n||seen.has(signature))continue;seen.add(signature);const probability=factorial(n)/v.counts.reduce((p,c)=>p*factorial(c),1)/d.tiers.length**n;for(let t=0;t<w.length;t++)if(known[d.key]===undefined||known[d.key]===d.tiers[t])w[t]+=probability*v.counts[t]/n;}return w;});
  const visit=(i,values,weight)=>{if(i===weights.length){const signature=JSON.stringify([solution.total,values]),previous=cases.get(signature);if(previous)previous.weight+=weight;else cases.set(signature,{totalRolls:solution.total,initialValues:values,weight});return;}const d=analysis.details[i];for(let t=0;t<weights[i].length;t++)if(weights[i][t]>0)visit(i+1,{...values,[d.key]:d.tiers[t]},weight*weights[i][t]);};
  if(allocation>0)visit(0,{},allocation);
 }
 const initialCases=[...cases.values()],sum=initialCases.reduce((n,c)=>n+c.weight,0);if(!sum)throw Error('初始档位或总次数与这件圣遗物的最终数值不符，请恢复自动推导或核对记录。');for(const c of initialCases)c.weight/=sum;
 return {initialCases,initialAnalysis:{inferred:sourceKeys.length<4,caseCount:initialCases.length,totals:[...new Set(initialCases.map(c=>c.totalRolls))],recordedKeys:sourceKeys,prob4}};
}
export function artifactPotential(request){
 const {artifact,data,mode='upgrade',affixes=[],initialValues={}}=request;
 if(!['upgrade','reshape','define'].includes(mode)||!Number.isFinite(request.threshold??0)||(request.threshold??0)<0||!Number.isFinite(request.prob4??0.2)||(request.prob4??0.2)<0||(request.prob4??0.2)>1)throw Error('潜力模式、比较阈值或四初始概率不正确。');
 if(!artifact||![4,5].includes(artifact.rarity))throw Error('强化潜力支持四星与五星圣遗物。');
 const checked=validateGOOD({format:'GOOD',version:3,artifacts:[artifact]},data);if(checked.errors.length)throw Error(checked.errors[0]);
 const role=request.role??request.key,target=request.targetKey??role;
 if(!request.good.characters.some(c=>c.key===role)||typeof request.objective!=='string'||!request.objective)throw Error('请选择已有的队员和有效计算目标。');
 if(![request.key,...request.scenario?.members??[]].includes(role)||!['combo'].includes(request.objective)&&![request.key,...request.scenario?.members??[]].includes(target))throw Error('配装角色与目标角色须属于计算队伍。');
 const sourceIndex=mode==='define'?-1:potentialSourceIndex(request.good,artifact,request.sourceIndex),simulation=potentialSimulationGOOD(request.good,role,sourceIndex);
 if(mode!=='define'&&artifact.location&&sourceIndex<0)throw Error('来源圣遗物已不在库存中，请重新分析。');
 if(mode==='upgrade'&&artifact.level>=artifactMaxLevel(artifact.rarity))throw Error('这件已满级，可选择重塑或定轨生成。');
 if(mode!=='upgrade'){
  if(artifact.rarity!==5)throw Error('重塑与定轨生成需要五星圣遗物。');
  if((mode==='define'||affixes.length)&& (affixes.length!==2||new Set(affixes).size!==2||affixes.some(k=>!SUBSTATS.includes(k)||k===artifact.mainStatKey)))throw Error('请选择两个不同且不等于主词条的副属性。');
 }
 if(mode==='reshape'){
  if(artifact.level!==20||artifact.substats.filter(s=>s.key).length!==4)throw Error('重塑需要五星 +20 且有四条副属性。');
  if(affixes.some(k=>!artifact.substats.some(s=>s.key===k)))throw Error('重塑所选属性须在这件圣遗物中。');
 }
 const pending=pendingSubstats(artifact);
 const visible={...artifact,unactivatedSubstats:[]},currentAnalysis=mode!=='define'?analyzeArtifact(visible,data):null;
 if(currentAnalysis){const analysis=currentAnalysis;if(!analysis.valid)throw Error(analysis.invalid[0]??'圣遗物的当前词条数值无法匹配合法强化次数。');}
 if(pending.length){const visible={...artifact,unactivatedSubstats:[]},analysis=analyzeArtifact(visible,data),used=new Set(artifact.substats.filter(s=>s.key).map(s=>s.key));
  if(mode!=='upgrade'||artifact.level>=4||used.size+pending.length!==4||new Set(pending.map(s=>s.key)).size!==pending.length||!analysis.valid||pending.some(s=>!SUBSTATS.includes(s.key)||s.key===artifact.mainStatKey||used.has(s.key)||!substatTiers(data,artifact.rarity,s.key).some(v=>displaySubstat(s.key,v)===s.value||Math.abs(v-s.value)<1e-6)))throw Error('待激活副词条与当前等级或数值不符，请核对导入的第四条副词条。');
 }
 const inference=mode==='reshape'?inferReshapeInitials(artifact,data,{initialValues,prob4:request.prob4??0.2}):{};
 const metricOptions={data,goals:request.goals},before=researchObjective(request.good,request.key,request.scenario,request.objective,target,metricOptions),threshold=request.threshold??before;
 if(!Number.isFinite(before)||!Number.isFinite(threshold))throw Error('所选计算目标暂不可用，请重新选择。');
 const finalTotalRolls=mode==='upgrade'&&currentAnalysis.initial.length===1?currentAnalysis.initial[0]+Math.floor(artifactMaxLevel(artifact.rarity)/4):undefined;
 // 概率与示例只需要队伍当前装备；未装备库存保留在来源GOOD，不反复复制整库。
 const locations=new Set(teamKeys(simulation,request.key,request.scenario).map(equipmentLocation)),calculationGOOD={...simulation,weapons:simulation.weapons.filter(a=>locations.has(a.location)),artifacts:simulation.artifacts.filter(a=>locations.has(a.location))};
 const result=analyzeGOPotential({...request,good:calculationGOOD,threshold,affixes,initialValues,finalTotalRolls,...inference}),examples=[];
 if(!Number.isFinite(result.average)||!Number.isFinite(result.probability)||result.probability>0&&!Number.isFinite(result.conditionalAverage))throw Error('当前目标的潜力分布无法可靠计算，请选择其他目标。');
 for(const example of result.examples){const {objectiveValue,...detail}=example,a=example.artifact;const check=validateGOOD({format:'GOOD',version:3,artifacts:[a]},data);if(check.errors.length||!analyzeArtifact(a,data).valid)continue;
  const value=Number.isFinite(objectiveValue)?objectiveValue:researchObjective(withResearchArtifacts(calculationGOOD,role,[a]),request.key,request.scenario,request.objective,target,metricOptions);if(!Number.isFinite(value))continue;
  if(!examples.some(e=>JSON.stringify(e.artifact.substats)===JSON.stringify(a.substats)))examples.push({...detail,value});
 }
 const ranked=[...examples].sort((a,b)=>b.value-a.value),selected=[];
 const add=(e,label)=>{if(e&&!selected.includes(e)){selected.push(e);e.label=label;}};
 add(ranked[0],'较高目标示例');add([...ranked].sort((a,b)=>Math.abs(a.value-result.average)-Math.abs(b.value-result.average))[0],'接近均值示例');add(ranked.at(-1),'较低目标示例');
 for(const fraction of [0.25,0.75,0.125,0.875,0.375,0.625])add(ranked[Math.round(fraction*(ranked.length-1))],'不同分配示例');for(const e of ranked)if(selected.length<9)add(e,'不同分配示例');
 const source=request.good.artifacts[sourceIndex],sourceOwner=source?.location?request.good.characters.find(c=>equipmentLocation(c.key)===source.location)?.key??source.location:null;
 return {...result,probability:Math.max(0,Math.min(1,result.probability)),initialAnalysis:inference.initialAnalysis,examples:selected.slice(0,9),before,threshold,sourceIndex,sourceOwner,borrowed:Boolean(source?.location&&source.location!==equipmentLocation(role))};
}
