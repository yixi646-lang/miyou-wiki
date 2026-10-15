import {MAIN_STATS,SUBSTATS,STAT_NAMES} from './model.mjs';

const sum=a=>a.reduce((n,v)=>n+v,0);
const initialCounts={1:[0],2:[0,1],3:[1,2],4:[2,3],5:[3,4]};
export const artifactMaxLevel=rarity=>rarity<3?4:rarity*4;
export const artifactInitialCounts=rarity=>initialCounts[rarity]??[];
export const substatTiers=(data,rarity,key)=>(data.art.sub[rarity]?.[key]??[]).map(v=>v*(key.endsWith('_')?100:1));
export const displaySubstat=(key,value)=>Math.round(value*(key.endsWith('_')?10:1))/(key.endsWith('_')?10:1);
export const pendingSubstats=a=>(a.unactivatedSubstats??[]).filter(s=>s?.key);
export const countRange=(min,max)=>min===null||min===undefined?'待核对':min===max?String(min):`${min}–${max}`;

// 同时约束四条副属性的次数，避免把彼此不可能共存的取整解组合起来。
function feasibleCounts(lines,rarity,level,initial=null){
  const steps=Math.floor(level/4),results=[];
  for(const start of initialCounts[rarity]??[]){
    if(initial!==null&&start!==initial)continue;
    const total=start+steps,lineCount=Math.min(4,total),cap=1+Math.max(0,steps-(4-start));
    if(lines.length!==lineCount)continue;
    const visit=(i,counts,n)=>{if(n>total)return;if(i===lines.length){if(n===total)results.push({initial:start,counts,total});return;}for(const c of [...new Set(lines[i])])if(c>=1&&c<=cap)visit(i+1,[...counts,c],n+c);};
    visit(0,[],0);
  }
  return results;
}

export function analyzeArtifact(a,data,weights={}){
  const details=a.substats.filter(s=>s.key&&s.value>0).map(s=>{
    const tiers=substatTiers(data,a.rarity,s.key),display=s.value.toFixed(s.key.endsWith('_')?1:0),corrected=data.art.subRollCorrection[a.rarity]?.[s.key]?.[display]??display;
    const raw=data.art.subRoll[a.rarity]?.[s.key]?.[corrected]??[];
    const variants=raw.map(indices=>{const counts=tiers.map((_,i)=>indices.filter(j=>j===i).length),value=sum(indices.map(i=>tiers[i]));return{counts,count:indices.length,value,quality:100*value/(Math.max(...tiers)*indices.length)};});
    return{...s,tiers,variants,weight:weights[s.key]??0};
  });
  const special=pendingSubstats(a).length>0,solutions=feasibleCounts(details.map(s=>s.variants.map(v=>v.count)),a.rarity,a.level);
  const invalid=[];
  for(const s of details)if(!s.variants.length)invalid.push(`${STAT_NAMES[s.key]} ${s.value} 无法匹配该星级的档位`);
  if(a.substats.some(s=>s.key&&!(s.value>0)))invalid.push('已选副词条尚未填写数值');
  if(!special&&!solutions.length)invalid.push('副词条种类、总次数或单条次数与星级、强化等级不符');
  for(let i=0;i<details.length;i++){
    const d=details[i];if(!special&&solutions.length)d.variants=d.variants.filter(v=>solutions.some(s=>s.counts[i]===v.count));
    const counts=d.variants.map(v=>v.count),qualities=d.variants.map(v=>v.quality);
    d.minCount=counts.length?Math.min(...counts):null;d.maxCount=counts.length?Math.max(...counts):null;
    d.minQuality=qualities.length?Math.min(...qualities):null;d.maxQuality=qualities.length?Math.max(...qualities):null;
  }
  const totals=solutions.map(s=>s.total),effective=solutions.map(s=>sum(s.counts.map((n,i)=>n*details[i].weight))),starts=[...new Set(solutions.map(s=>s.initial))];
  return{details,solutions,invalid,special,valid:!invalid.length&&!special,minCount:totals.length?Math.min(...totals):null,maxCount:totals.length?Math.max(...totals):null,minEffective:effective.length?Math.min(...effective):null,maxEffective:effective.length?Math.max(...effective):null,initial:starts,enhancements:Math.floor(a.level/4)};
}

export function draftFromArtifact(a,data,preferredInitial=null){
  const analysis=analyzeArtifact(a,data),solution=analysis.solutions.find(s=>s.initial===preferredInitial)??analysis.solutions[0];
  return{setKey:a.setKey,slotKey:a.slotKey,rarity:a.rarity,level:a.level,mainStatKey:a.mainStatKey,initialCount:solution?.initial??initialCounts[a.rarity].at(-1),lines:Array.from({length:4},(_,i)=>{
    const sub=a.substats[i],j=analysis.details.findIndex(d=>d.key===sub?.key),d=analysis.details[j],variant=d?.variants.find(v=>v.count===solution?.counts[j])??d?.variants[0];
    return{key:sub?.key??'',counts:variant?.counts??substatTiers(data,a.rarity,sub?.key||'atk_').map(()=>0)};
  })};
}

export function createArtifactEditor(a,data,options={}){
  return{...options,mode:'rolls',draft:options.draft?structuredClone(options.draft):draftFromArtifact(a,data),values:structuredClone(a),countsChanged:false,valuesChanged:false,changedLines:[]};
}
export function switchArtifactMode(editor,mode,data){
  if(!['rolls','values'].includes(mode))throw Error('圣遗物编辑方式不正确。');
  if(editor.mode===mode)return;
  if(mode==='values'&&editor.countsChanged){
    const generated=artifactFromDraft(editor.draft,data);
    // 保留已选择但暂未分配次数的属性，方便继续填写；未知原始数值在未改次数时原样保留。
    generated.substats=editor.draft.lines.map((l,i)=>({l,i})).filter(({l})=>l.key).map(({l,i})=>generated.substats.find(s=>s.key===l.key)??(!(editor.changedLines??[]).includes(i)?editor.values.substats.find(s=>s.key===l.key):null)??{key:l.key,value:0});
    editor.values={...editor.values,...generated};
  }else if(mode==='rolls'&&editor.valuesChanged)editor.draft=draftFromArtifact(editor.values,data,editor.draft.initialCount);
  editor.mode=mode;editor.countsChanged=false;editor.valuesChanged=false;editor.changedLines=[];
}
export function artifactEditorSnapshot(editor,data){
  const copy=structuredClone(editor);if(copy.mode==='rolls')switchArtifactMode(copy,'values',data);else switchArtifactMode(copy,'rolls',data);
  return{draft:copy.draft,values:copy.values};
}

export function artifactFromDraft(draft,data){
  const substats=draft.lines.filter(s=>s.key&&sum(s.counts)>0).map(s=>({key:s.key,value:displaySubstat(s.key,sum(substatTiers(data,draft.rarity,s.key).map((v,i)=>v*s.counts[i])))}));
  return{setKey:draft.setKey,slotKey:draft.slotKey,rarity:draft.rarity,level:draft.level,mainStatKey:draft.mainStatKey,substats,location:'',lock:false};
}

export function inspectDraft(d,data){
  const errors=[],set=data.art.data[d.setKey];
  if(!set?.slots.includes(d.slotKey)||!set?.rarities.includes(d.rarity)||!MAIN_STATS[d.slotKey]?.includes(d.mainStatKey))errors.push('套装、部位、星级或主词条不匹配');
  if(!Number.isInteger(d.level)||d.level<0||d.level>artifactMaxLevel(d.rarity))errors.push('强化等级超出该星级范围');
  const used=new Set(),lines=d.lines.filter(s=>s.key),total=sum(lines.map(s=>sum(s.counts)));
  for(const s of lines){if(!SUBSTATS.includes(s.key)||s.key===d.mainStatKey||used.has(s.key))errors.push('副词条重复或与主词条相同');used.add(s.key);if(s.counts.length!==substatTiers(data,d.rarity,s.key).length||s.counts.some(n=>!Number.isInteger(n)||n<0||n>50))errors.push('每档次数须为 0–50 的整数');if(!sum(s.counts))errors.push(`${STAT_NAMES[s.key]}尚未分配次数`);}
  if(!feasibleCounts(lines.map(s=>[sum(s.counts)]),d.rarity,d.level,d.initialCount).length)errors.push('当前次数分配超出所选初始词条数与强化等级的正常范围');
  const artifact=artifactFromDraft(d,data);
  return{artifact,total,enhancements:Math.floor(d.level/4),expected:d.initialCount+Math.floor(d.level/4),errors:[...new Set(errors)],realistic:!errors.length};
}
