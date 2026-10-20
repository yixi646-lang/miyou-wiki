import {validateGOOD,validateState,blankState} from './model.mjs';
import {equipmentSignature,matchEquipmentBatch} from './equipment-matching.mjs';
import {refreshEquipmentReferences} from './managed-inventory.mjs';

const kinds=['characters','weapons','artifacts'];
const signature=equipmentSignature;
const same=(kind,a,b)=>signature(kind,a)===signature(kind,b)&&(a.location??'')===(b.location??'')&&!!a.lock===!!b.lock;
const ownerSlot=(kind,item)=>item.location?item.location+(kind==='artifacts'?':'+item.slotKey:''):'';

// 扫描器的 id 通常只是本次扫描顺序，不能跨扫描作为装备身份。
// 按内容与出现次数匹配，既不重复添加，也不吞掉确实存在的相同装备。
export function scanPreview(state,input,data,{mode='merge',decisions=[]}={}){
  if(!['merge','sync'].includes(mode))throw Error('扫描更新方式不正确。');
  if(!Array.isArray(decisions)||decisions.length>60000||decisions.some(d=>!d||!['weapons','artifacts'].includes(d.kind)||!Number.isSafeInteger(d.incomingIndex)))throw Error('装备匹配选择格式不正确。');
  if(decisions.some(d=>!input[d.kind]))throw Error('装备匹配选择与导入范围不一致。');
  const checked=validateGOOD(input,data);if(checked.errors.length)throw Error(checked.errors.slice(0,10).join('；'));
  const next=structuredClone(state),changes=Object.fromEntries(kinds.map(k=>[k,{added:0,updated:0,unchanged:0,removed:0}]));
  const warnings=[...checked.warnings],matches=[],identities={};let skipped=0;
  for(const kind of kinds){
    if(input[kind]===undefined)continue;
    const originals=state.good[kind]??[],items=next.good[kind]??=[],incoming=input[kind];
    if(kind==='characters'){
      const byKey=new Map(items.map((c,i)=>[c.key,i]));
      for(const item of incoming){
        const i=byKey.get(item.key);
        if(i===undefined){byKey.set(item.key,items.length);items.push(structuredClone(item));changes[kind].added++;}
        else{const old=items[i],equal=old.level===item.level&&old.ascension===item.ascension&&old.constellation===item.constellation&&['auto','skill','burst'].every(k=>old.talent[k]===item.talent[k]);
          if(equal)changes[kind].unchanged++;else{items[i]={...old,...structuredClone(item)};changes[kind].updated++;}}
      }
      // 旅行者的等级与突破共用；其他元素的天赋、命座保持原值。
      for(const c of incoming.filter(c=>/^Traveler.*[MF]$/.test(c.key)))for(const old of items)if(old.key.startsWith('Traveler')&&old.key.at(-1)===c.key.at(-1)){old.level=c.level;old.ascension=c.ascension;}
      next.good[kind]=items;continue;
    }
    const plan=matchEquipmentBatch(originals,incoming,kind,data,{decisions:decisions.filter(d=>d.kind===kind)}),byIndex=new Map(plan.matches.map(m=>[m.incomingIndex,m]));
    identities[kind]=new Map();
    matches.push(...plan.matches);
    const used=new Set(),included=new Set(),preserved=new Set(),activeOwners=new Map();
    let nextId=Math.max(-1,...originals.map(x=>Number.isSafeInteger(x.id)?x.id:-1))+1;
    for(const [incomingIndex,raw] of incoming.entries()){
      const match=byIndex.get(incomingIndex),decision=match?.decision;
      if(match&&(!decision||decision.action==='skip')){for(const c of match.candidates)preserved.add(c.targetIndex);if(decision)skipped++;continue;}
      const i=plan.exact.get(incomingIndex)??(decision?.action==='update'?decision.targetIndex:undefined);
      let index;
      if(i!==undefined){
        used.add(i);index=i;
        if(same(kind,originals[i],raw)){changes[kind].unchanged++;}
        else{const {id,...fields}=structuredClone(raw);items[i]={...items[i],...fields};if(items[i].id===undefined)items[i].id=nextId++;changes[kind].updated++;}
      }else{
        const {id,...fields}=structuredClone(raw);index=items.length;items.push({...fields,id:nextId++});changes[kind].added++;
      }
      included.add(index);const owner=ownerSlot(kind,raw);if(owner)activeOwners.set(owner,index);
    }
    // 本次扫描的装备关系优先；旧库存保留，但不能一人同部位装备两件。
    for(let i=0;i<items.length;i++){
      const owner=ownerSlot(kind,items[i]);
      if(owner&&activeOwners.has(owner)&&activeOwners.get(owner)!==i){items[i].location='';if(i<originals.length&&!used.has(i))changes[kind].updated++;}
    }
    if(mode==='sync'){
      for(const i of preserved)included.add(i);
      changes[kind].removed=originals.filter((_,i)=>!included.has(i)).length;
      next.good[kind]=items.filter((_,i)=>included.has(i));
    }else next.good[kind]=items;
    originals.forEach((_,i)=>{const index=next.good[kind].indexOf(items[i]);if(index>=0)identities[kind].set(i,index);});
  }
  next.good.version=Math.max(state.good.version??1,input.version);
  if(!next.selected)next.selected=next.good.characters[0]?.key??'';
  const unresolved=matches.filter(m=>!m.decision).length;
  if(unresolved)warnings.push(`还有 ${unresolved} 件疑似装备需要确认。`);
  if(skipped&&mode==='sync')warnings.push('跳过项及其可能对应的旧装备不参与替换移除。');
  if(mode==='sync')warnings.push('仅替换文件实际包含的武器、圣遗物类别；文件未包含的类别、未扫描角色与评价配置继续保留。请使用完整库存扫描。');
  refreshEquipmentReferences(next,state.good,identities);
  const changed=JSON.stringify(next.good)!==JSON.stringify(state.good);
  return {state:validateState(next,data),changes,warnings,changed,mode,matches,unresolved,skipped,
    counts:Object.fromEntries(kinds.map(k=>[k,input[k]?.length??0]))};
}

export function scanState(input,data){
  const next=blankState();next.good=structuredClone(input);
  for(const kind of kinds)next.good[kind]??=[];
  next.selected=next.good.characters[0]?.key??'';
  return validateState(next,data);
}
