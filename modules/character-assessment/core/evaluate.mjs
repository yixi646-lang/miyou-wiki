import {equipment,percent,SLOTS,SLOT_NAMES,STAT_NAMES} from './model.mjs';
import {pendingSubstats} from './artifacts.mjs';
const sum=(values)=>values.reduce((a,b)=>a+b,0);
const clamp=x=>Math.max(0,Math.min(1,x));
function resolveCharacter(data,key){return data.char.data[key]??(key.startsWith('Traveler')?data.char.data.Traveler:undefined);}
function levelStats(item,group,level,ascension){
  const stats={...item.baseStats};
  for(const c of item.lvlCurves??[])stats[c.key]=(stats[c.key]??0)+c.base*group.expCurve[c.curve][level];
  for(const [k,v]of Object.entries(item.ascensionBonus??{}))stats[k]=(stats[k]??0)+(v[ascension]??0);
  return stats;
}
// 这里仅计算静态基础面板；武器/套装被动、天赋转化及队伍条件交给 GO。
export function basePanel(character,weapon,artifacts,data){
  const source=resolveCharacter(data,character.key);if(!source)return null;
  const base=levelStats(source,data.char,character.level,character.ascension),weaponSource=weapon&&data.weapon.data[weapon.key];
  const w=weaponSource?levelStats(weaponSource,data.weapon,weapon.level,weapon.ascension):{};
  const additions={critRate_:5,critDMG_:50,enerRech_:100};
  const add=(k,n,isGOOD=false)=>{additions[k]=(additions[k]??0)+n*(percent(k)&&!isGOOD?100:1);};
  for(const [k,n]of Object.entries(base))if(!['hp','atk','def'].includes(k))add(k,n);
  for(const [k,n]of Object.entries(w))if(k!=='atk')add(k,n);
  for(const a of artifacts){const main=data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level];if(main!==undefined)add(a.mainStatKey,main);for(const s of a.substats)if(s.key)add(s.key,s.value,true);}
  return{...additions,hp:(base.hp??0)*(1+(additions.hp_??0)/100)+(additions.hp??0),atk:((base.atk??0)+(w.atk??0))*(1+(additions.atk_??0)/100)+(additions.atk??0),def:(base.def??0)*(1+(additions.def_??0)/100)+(additions.def??0),baseHP:base.hp??0,baseATK:base.atk??0,weaponATK:w.atk??0,baseDEF:base.def??0};
}
export function rollValues(artifact,data,weights){
  let total=0,effective=0;const details=[];const invalid=[];
  for(const s of artifact.substats){
    if(!s.key||!s.value)continue;
    const tiers=data.art.sub[artifact.rarity]?.[s.key];if(!tiers){invalid.push(s.key);continue;}
    const average=sum(tiers)/tiers.length*(percent(s.key)?100:1),rolls=s.value/average,weight=weights[s.key]??0;
    const key=percent(s.key)?s.value.toFixed(1):s.value.toFixed(0);
    const corrected=data.art.subRollCorrection[artifact.rarity]?.[s.key]?.[key]??key;
    const possible=data.art.subRoll[artifact.rarity]?.[s.key]?.[corrected];
    if(!possible?.length)invalid.push(`${STAT_NAMES[s.key]} ${s.value}`);
    const counts=possible?.map(p=>p.length)??[];
    const fiveStar=data.art.sub[5]?.[s.key],reference=fiveStar?sum(fiveStar)/fiveStar.length*(percent(s.key)?100:1):average,weighted=s.value/reference*weight;
    total+=rolls;effective+=weighted;details.push({...s,average,rolls,weight,effective:weighted,minCount:counts.length?Math.min(...counts):null,maxCount:counts.length?Math.max(...counts):null});
  }
  if(!pendingSubstats(artifact).length&&details.length){
    const maximum={1:0,2:1,3:2,4:3,5:4}[artifact.rarity]+Math.floor(artifact.level/4);
    const counts=details.map(s=>s.minCount).filter(n=>n!==null);
    if(counts.length===details.length&&sum(counts)>maximum)invalid.push('副词条总强化次数超过此星级与等级的上限');
    const minimum={1:0,2:0,3:1,4:2,5:3}[artifact.rarity]+Math.floor(artifact.level/4);
    if(details.every(s=>s.maxCount!==null)&&sum(details.map(s=>s.maxCount))<minimum)invalid.push('副词条总次数不足，请补齐全部副词条或核对强化等级');
  }
  return{total,effective,details,invalid,cv:sum(artifact.substats.map(s=>s.key==='critRate_'?s.value*2:s.key==='critDMG_'?s.value:0))};
}
export function evaluate(character,good,goal,data){
  const{weapon,artifacts}=equipment(good,character.key),panel=basePanel(character,weapon,artifacts,data),metrics=[],advice=[];
  const metric=(label,value,target,detail='')=>{const ratio=value===undefined?0:target?clamp(value/target):1;metrics.push({label,value,target,ratio,detail});if(ratio<1)advice.push({label,detail:detail||`${label}：${value??'未填写'} → ${target}`,priority:ratio});};
  metric('角色等级',character.level,goal.level);metric('角色突破',character.ascension,goal.ascension);
  for(const [k,label]of Object.entries({auto:'普通攻击',skill:'元素战技',burst:'元素爆发'}))if(goal.talent[k]>1)metric(`${label}基础等级`,character.talent[k],goal.talent[k]);
  if(!weapon)advice.push({label:'武器',detail:'先为角色填写已装备武器及实际等级。',priority:0});
  metric('武器等级',weapon?.level,goal.weaponLevel);
  const pieces=SLOTS.map(slot=>{
    const a=artifacts.find(a=>a.slotKey===slot);if(!a){advice.push({label:SLOT_NAMES[slot],detail:`补齐${SLOT_NAMES[slot]}。`,priority:0});return{slot,missing:true};}
    const rolls=rollValues(a,data,goal.weights),accepted=goal.mainStats[slot]??[],matches=!accepted.length||accepted.includes(a.mainStatKey);
    if(!matches)advice.push({label:SLOT_NAMES[slot],detail:`${SLOT_NAMES[slot]}主词条未符合你的目标，优先调整。`,priority:.05});
    if(a.level<(a.rarity<3?4:a.rarity*4))advice.push({label:SLOT_NAMES[slot],detail:`${SLOT_NAMES[slot]}目前 +${a.level}；是否升级请结合有效副词条判断。`,priority:.4});
    return{slot,artifact:a,rolls,matches,mainValue:data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level]};
  });
  const totalRolls=sum(pieces.filter(p=>p.rolls).map(p=>p.rolls.total)),effectiveRolls=sum(pieces.filter(p=>p.rolls).map(p=>p.rolls.effective));
  const totalCV=sum(pieces.filter(p=>p.rolls).map(p=>p.rolls.cv+(p.artifact.mainStatKey==='critRate_'?(p.mainValue??0)*200:p.artifact.mainStatKey==='critDMG_'?(p.mainValue??0)*100:0)));
  metric('圣遗物部位完整',artifacts.length,5,'先补齐五件圣遗物，再比较有效词条与套装。');
  const specified=pieces.filter(p=>(goal.mainStats[p.slot]??[]).length);if(specified.length)metric('目标主词条符合',specified.filter(p=>!p.missing&&p.matches).length,specified.length,'优先补齐目标主词条，之后再提升副词条。');
  metric('圣遗物强化进度',sum(artifacts.map(a=>a.level)),sum(pieces.map(p=>p.artifact?(p.artifact.rarity<3?4:p.artifact.rarity*4):20)),'结合词条价值，把合适的圣遗物强化到对应星级上限。');
  if(goal.effectiveRolls>0)metric('加权有效词条',effectiveRolls,goal.effectiveRolls,`加权有效词条 ${effectiveRolls.toFixed(1)} / ${goal.effectiveRolls}；优先替换主词条不符及有效词条较少的部位。`);
  const sets={};for(const a of artifacts)sets[a.setKey]=(sets[a.setKey]??0)+1;
  if(goal.sets.length){const match=goal.sets.length===1?(sets[goal.sets[0]]??0)>=4:goal.sets.every(k=>(sets[k]??0)>=2);metric('套装目标',match?1:0,1,'按你设定的四件套或二加二目标检查。');}
  const panelTargets=Object.entries(goal.panel).filter(([,v])=>v>0).map(([k,target])=>({key:k,target,value:panel?.[k],ratio:panel?clamp((panel[k]??0)/target):null}));
  // 面板门槛不计总完成度：基础面板没有完整的战斗条件，不能充当最终属性。
  const progress=metrics.length?sum(metrics.map(m=>m.ratio))/metrics.length:0;
  const wrongMain=pieces.some(p=>p.missing||!p.matches),unknown=!panel||pieces.some(p=>p.rolls?.invalid.length);
  return{weapon,artifacts,panel,pieces,sets,totalRolls,effectiveRolls,totalCV,metrics,panelTargets,progress,grade:unknown?'数据待核对':progress>=.999&&!wrongMain?'已达自定目标':progress>=.8&&!wrongMain?'接近自定目标':'尚有目标未满足',advice:advice.sort((a,b)=>a.priority-b.priority),unknown};
}

export const ROSTER_SORTS={original:'原有顺序',custom:'自定义顺序',totalRolls:'副词条总等效数',effectiveRolls:'加权有效词条',totalCV:'圣遗物总双暴值'};
export function sortAssessmentRoster(characters,good,goalFor,data,{sort='original',order=[],ascending=false}={}){
  const original=new Map(characters.map((c,i)=>[c.key,i]));
  if(sort==='custom'){const ranks=new Map(order.map((k,i)=>[k,i]));return characters.toSorted((a,b)=>(ranks.get(a.key)??order.length+original.get(a.key))-(ranks.get(b.key)??order.length+original.get(b.key)));}
  if(!['totalRolls','effectiveRolls','totalCV'].includes(sort))return [...characters];
  const values=new Map(characters.map(c=>[c.key,evaluate(c,good,goalFor(c.key),data)[sort]]));
  return characters.toSorted((a,b)=>(ascending?1:-1)*(values.get(a.key)-values.get(b.key))||original.get(a.key)-original.get(b.key));
}
export function moveAssessmentRoster(characters,order,key,neighbor){
  const keys=sortAssessmentRoster(characters,null,null,null,{sort:'custom',order}).map(c=>c.key),i=keys.indexOf(key),j=keys.indexOf(neighbor);
  if(i>=0&&j>=0)[keys[i],keys[j]]=[keys[j],keys[i]];
  return keys;
}
