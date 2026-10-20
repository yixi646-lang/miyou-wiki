import {artifactInitialCounts,artifactMaxLevel,displaySubstat,substatTiers} from './artifacts.mjs';

const stats=item=>item.substats.filter(s=>s.key).map(s=>[s.key,s.value]).sort(([a],[b])=>a.localeCompare(b));
export const equipmentSignature=(kind,item)=>JSON.stringify(kind==='weapons'
  ?[item.key,item.level,item.ascension,item.refinement]
  :[item.setKey,item.slotKey,item.rarity,item.mainStatKey,item.level,stats(item),(item.unactivatedSubstats??[]).filter(s=>s.key).map(s=>[s.key,s.value]).sort(([a],[b])=>a.localeCompare(b))]);
export const equipmentFingerprint=(kind,item)=>JSON.stringify([item.id??null,equipmentSignature(kind,item)]);
const group=(kind,item)=>JSON.stringify(kind==='weapons'?[item.key]:[item.setKey,item.slotKey,item.rarity,item.mainStatKey]);

// 显示取整可能对应多种档位组合；匹配时保留全部组合，不用单一代表解推断身份。
function history(item,data,cache){
  const key=equipmentSignature('artifacts',item);
  if(cache.has(key))return cache.get(key);
  const lines=new Map(),cap=1+Math.floor(artifactMaxLevel(item.rarity)/4);
  for(const sub of item.substats.filter(s=>s.key)){
    const tiers=substatTiers(data,item.rarity,sub.key),variants=[];
    if(!tiers.length||sub.value<=0){cache.set(key,null);return null;}
    const visit=(i,counts,count,value)=>{
      if(i===tiers.length){if(count&&displaySubstat(sub.key,value)===sub.value)variants.push({counts,count});return;}
      for(let n=0;n<=cap-count;n++)visit(i+1,[...counts,n],count+n,value+n*tiers[i]);
    };
    visit(0,[],0,0);if(!variants.length){cache.set(key,null);return null;}lines.set(sub.key,variants);
  }
  const steps=Math.floor(item.level/4),starts=artifactInitialCounts(item.rarity).filter(start=>{
    const total=start+steps;if(lines.size!==Math.min(4,total))return false;
    let sums=new Set([0]);for(const variants of lines.values())sums=new Set([...sums].flatMap(n=>variants.map(v=>n+v.count)).filter(n=>n<=total));return sums.has(total);
  });
  const result=starts.length?{lines,starts}:null;cache.set(key,result);return result;
}
function canEnhance(before,after,a,b){
  if(after.level<before.level||[...a.lines.keys()].some(key=>!b.lines.has(key)))return false;
  for(const start of a.starts.filter(n=>b.starts.includes(n))){
    const oldTotal=start+Math.floor(before.level/4),newTotal=start+Math.floor(after.level/4);let sums=new Set(['0:0']);
    for(const [key,variants] of b.lines){
      const pairs=[];
      for(const next of variants)for(const old of a.lines.get(key)??[{count:0,counts:next.counts.map(()=>0)}])if(next.counts.every((n,i)=>n>=old.counts[i]))pairs.push([old.count,next.count]);
      const combined=new Set();for(const sum of sums){const [x,y]=sum.split(':').map(Number);for(const [old,next] of pairs)if(x+old<=oldTotal&&y+next<=newTotal)combined.add(`${x+old}:${y+next}`);}sums=combined;
      if(!sums.size)break;
    }
    if(sums.has(`${oldTotal}:${newTotal}`))return true;
  }
  return false;
}
function candidateReason(kind,before,after,data,cache){
  if(kind==='weapons')return after.level>=before.level&&after.ascension>=before.ascension&&after.refinement>=before.refinement?'同名武器，等级、突破或精炼提高':null;
  const a=history(before,data,cache),b=history(after,data,cache);if(!a||!b)return null;
  if((before.unactivatedSubstats??[]).some(s=>s.key)|| (after.unactivatedSubstats??[]).some(s=>s.key))return null;
  if(canEnhance(before,after,a,b))return '同套装、部位和主属性，数值符合普通强化路径';
  if(before.rarity===5&&before.level===20&&after.level===20&&a.lines.size===4&&b.lines.size===4&&[...a.lines.keys()].every(key=>b.lines.has(key))&&a.starts.some(n=>b.starts.includes(n)))return '满级且副属性种类相同，可能经过重塑，需核对';
  return null;
}

export function matchEquipmentBatch(originals,incoming,kind,data,{decisions=[]}={}){
  const buckets=new Map(),used=new Set(),exact=new Map(),groups=new Map(),cache=new Map();
  originals.forEach((item,index)=>{const key=equipmentSignature(kind,item);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(index);});
  // 先为整批数据分配精确匹配，避免前面的疑似项抢走后面已经存在的原件。
  incoming.forEach((item,index)=>{
    const matches=(buckets.get(equipmentSignature(kind,item))??[]).filter(i=>!used.has(i));
    const target=matches.find(i=>originals[i].location===item.location&&!!originals[i].lock===!!item.lock)??matches.find(i=>originals[i].location===item.location)??matches[0];
    if(target!==undefined){used.add(target);exact.set(index,target);}
  });
  originals.forEach((item,index)=>{if(!used.has(index)){const key=group(kind,item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(index);}});
  const matches=[];
  incoming.forEach((item,index)=>{
    if(exact.has(index))return;
    const candidates=(groups.get(group(kind,item))??[]).flatMap(targetIndex=>{
      const old=originals[targetIndex],reason=candidateReason(kind,old,item,data,cache);
      return reason?[{targetIndex,fingerprint:equipmentFingerprint(kind,old),item:old,reason}]:[];
    }).sort((a,b)=>Number(b.item.location===item.location&&!!item.location)-Number(a.item.location===item.location&&!!item.location)||Math.abs(a.item.level-item.level)-Math.abs(b.item.level-item.level)||a.targetIndex-b.targetIndex);
    if(candidates.length)matches.push({kind,incomingIndex:index,fingerprint:equipmentFingerprint(kind,item),item,candidates,decision:null});
  });
  const byIndex=new Map(matches.map(match=>[match.incomingIndex,match])),decided=new Set(),claimed=new Set();
  for(const decision of decisions){
    const match=byIndex.get(decision.incomingIndex);
    if(!match||decided.has(decision.incomingIndex)||decision.fingerprint!==match.fingerprint||!['update','new','skip'].includes(decision.action))throw Error('装备匹配选择已失效，请重新预览并确认。');
    if(decision.action==='update'){
      const candidate=match.candidates.find(c=>c.targetIndex===decision.targetIndex&&c.fingerprint===decision.targetFingerprint);
      if(!candidate||claimed.has(decision.targetIndex))throw Error('旧装备已被其他项目使用或不再符合候选条件，请重新选择。');
      claimed.add(decision.targetIndex);
    }
    decided.add(decision.incomingIndex);match.decision={...decision};
  }
  for(const match of matches)for(const candidate of match.candidates)candidate.claimed=claimed.has(candidate.targetIndex)&&!(match.decision?.action==='update'&&match.decision.targetIndex===candidate.targetIndex);
  return {exact,matches};
}
