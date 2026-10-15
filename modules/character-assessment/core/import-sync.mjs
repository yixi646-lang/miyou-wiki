import {validateGOOD,validateState,blankState} from './model.mjs';

const kinds=['characters','weapons','artifacts'];
const signature=(kind,item)=>JSON.stringify(kind==='weapons'
  ?[item.key,item.level,item.ascension,item.refinement]
  :[item.setKey,item.slotKey,item.rarity,item.mainStatKey,item.level,
    item.substats.filter(s=>s.key).map(s=>[s.key,s.value]).sort(([a],[b])=>a.localeCompare(b))]);
const same=(kind,a,b)=>signature(kind,a)===signature(kind,b)&&(a.location??'')===(b.location??'')&&!!a.lock===!!b.lock;
const ownerSlot=(kind,item)=>item.location?item.location+(kind==='artifacts'?':'+item.slotKey:''):'';

// 扫描器的 id 通常只是本次扫描顺序，不能跨扫描作为装备身份。
// 按内容与出现次数匹配，既不重复添加，也不吞掉确实存在的相同装备。
export function scanPreview(state,input,data,{mode='merge'}={}){
  if(!['merge','sync'].includes(mode))throw Error('扫描更新方式不正确。');
  const checked=validateGOOD(input,data);if(checked.errors.length)throw Error(checked.errors.slice(0,10).join('；'));
  const next=structuredClone(state),changes=Object.fromEntries(kinds.map(k=>[k,{added:0,updated:0,unchanged:0,removed:0}]));
  const warnings=[...checked.warnings];
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
    const buckets=new Map(),used=new Set(),included=new Set(),activeOwners=new Map();
    let nextId=Math.max(-1,...originals.map(x=>Number.isSafeInteger(x.id)?x.id:-1))+1;
    originals.forEach((item,i)=>{const key=signature(kind,item);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);});
    for(const raw of incoming){
      const matches=(buckets.get(signature(kind,raw))??[]).filter(i=>!used.has(i));
      const i=matches.find(i=>originals[i].location===raw.location&&!!originals[i].lock===!!raw.lock)??matches.find(i=>originals[i].location===raw.location)??matches[0];
      let index;
      if(i!==undefined){
        used.add(i);index=i;
        if(same(kind,originals[i],raw)){changes[kind].unchanged++;}
        else{const {id,...fields}=structuredClone(raw);items[i]={...items[i],...fields};changes[kind].updated++;}
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
      changes[kind].removed=originals.length-used.size;
      next.good[kind]=items.filter((_,i)=>included.has(i));
    }else next.good[kind]=items;
  }
  next.good.version=Math.max(state.good.version??1,input.version);
  if(!next.selected)next.selected=next.good.characters[0]?.key??'';
  if(mode==='merge'&&(changes.weapons.added||changes.artifacts.added))warnings.push('装备按名称、等级及词条和出现次数识别；强化或精炼后无法可靠对应原件时按新增保留，旧件不会自动删除。完整扫描可选“按扫描替换装备库存”。');
  if(mode==='sync')warnings.push('仅替换文件实际包含的武器、圣遗物类别；文件未包含的类别、未扫描角色与评价配置继续保留。请使用完整库存扫描。');
  const changed=JSON.stringify(next.good)!==JSON.stringify(state.good);
  return {state:validateState(next,data),changes,warnings,changed,mode,
    counts:Object.fromEntries(kinds.map(k=>[k,input[k]?.length??0]))};
}

export function scanState(input,data){
  const next=blankState();next.good=structuredClone(input);
  for(const kind of kinds)next.good[kind]??=[];
  next.selected=next.good.characters[0]?.key??'';
  return validateState(next,data);
}
