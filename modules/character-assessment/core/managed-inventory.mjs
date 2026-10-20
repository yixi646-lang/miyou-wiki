import {equipmentLocation,SLOTS,validateState} from './model.mjs';

// 实际 GOOD 与自定义库存分开持久化；计算和界面使用合并后的副本。
const contexts=new WeakMap(),kinds=['characters','weapons','artifacts'];
const clean=item=>{const {wikiBaseIndex,wikiOriginalLocation,wikiOverridden,wikiAssignedTo,wikiCustom,...raw}=structuredClone(item);return raw;};
const position=(item,kind)=>kind==='weapons'?item.location:item.location+':'+item.slotKey;
export function snapshotItem(item){const {wikiBaseIndex,wikiOriginalLocation,wikiOverridden,wikiAssignedTo,...raw}=structuredClone(item);return raw;}
export const isCustom=item=>Boolean(item?.wikiCustom);
export const managedInventory=state=>contexts.has(state);
export const customMarkers=state=>state.customInventory?.showMarkers!==false;
export const originMatches=(item,origin)=>!origin||(origin==='custom')===isCustom(item);
export const isCustomCharacter=(state,key)=>isCustom(state.good.characters.find(c=>c.key===key));
export function customConversionCounts(state){
  const actual=contexts.get(state)?.actual??state.good,custom=state.customInventory;
  return Object.fromEntries(kinds.map(kind=>[kind,(custom?.[kind]??[]).filter(item=>kind!=='characters'||!actual.characters.some(c=>c.key===item.key)).length]));
}
export function convertCustomToDefault(input,data){
  const next=structuredClone(input),counts=customConversionCounts(next);
  if(!Object.values(counts).some(Boolean))return {state:next,counts,changed:false};
  const view=createManagedState(next);
  // 将当前可见配装作为新的默认配装，解除覆盖及引用，物品编号和数值保持不变。
  next.good={...view.good,...Object.fromEntries(kinds.map(kind=>[kind,view.good[kind].map(clean)]))};
  next.customInventory={...view.customInventory,characters:(next.customInventory?.characters??[]).filter(c=>input.good.characters.some(a=>a.key===c.key)),weapons:[],artifacts:[]};
  // 被后续扫描覆盖的旧自定义角色只作历史资料保留，不能覆盖原有角色。
  delete next.customInventory.equipmentAssignments;delete next.customInventory.unequippedSlots;
  return {state:validateState(next,data),counts,changed:true};
}
const signature=(kind,item)=>JSON.stringify(kind==='weapons'?[item.key,item.level,item.ascension,item.refinement]:[item.setKey,item.slotKey,item.rarity,item.mainStatKey,item.level,item.substats.filter(s=>s.key).map(s=>[s.key,s.value]).sort(([a],[b])=>a.localeCompare(b))]);
function reference(kind,item,items){const sig=signature(kind,item),matches=items.filter(a=>signature(kind,a)===sig);return{...(item.id!==undefined?{id:item.id}:{}),signature:sig,occurrence:matches.indexOf(item)};}
function referenceIndex(kind,ref,items){
  const matches=items.map((a,i)=>({a,i})).filter(({a})=>signature(kind,a)===ref.signature);
  if(ref.id!==undefined)return matches.find(({a})=>a.id===ref.id)?.i??-1;
  return matches[ref.occurrence]?.i??-1;
}
export function refreshEquipmentReferences(state,previousGood,identities){
  if(!state.customInventory?.equipmentAssignments)return;
  state.customInventory.equipmentAssignments=state.customInventory.equipmentAssignments.flatMap(assignment=>{
    if(!identities[assignment.kind])return [assignment];
    const oldIndex=referenceIndex(assignment.kind,assignment.reference,previousGood[assignment.kind]??[]),index=identities[assignment.kind]?.get(oldIndex);
    return index===undefined?[]:[{...assignment,reference:reference(assignment.kind,state.good[assignment.kind][index],state.good[assignment.kind])}];
  });
}
export function createManagedState(input,account={}){
  const state={...input},actual=structuredClone(input.good);
  if(input.customInventory)state.customInventory=structuredClone(input.customInventory);
  state.customInventory??={version:1,characters:[],weapons:[],artifacts:[],showMarkers:true};
  contexts.set(state,{actual,kind:account.kind??(account.hasOriginal?'imported':'local')});
  rebuild(state);return state;
}
function rebuild(state){
  const {actual}=contexts.get(state),custom=state.customInventory;
  state.good={...structuredClone(actual)};
  for(const kind of kinds){
    const additions=custom[kind]??[];
    state.good[kind]=(actual[kind]??[]).map((item,index)=>{
      const next={...structuredClone(item),wikiBaseIndex:index};
      if(kind!=='characters'&&item.location&&additions.some(a=>a.location&&position(a,kind)===position(item,kind))){next.wikiOriginalLocation=item.location;next.wikiOverridden=true;next.location='';}
      return next;
    });
    state.good[kind].push(...additions.filter(item=>kind!=='characters'||!actual.characters.some(c=>c.key===item.key)).map(item=>({...structuredClone(item),wikiCustom:true})));
  }
  for(const assignment of custom.equipmentAssignments??[]){
    if(!isCustomCharacter(state,assignment.character))continue;
    const index=referenceIndex(assignment.kind,assignment.reference,actual[assignment.kind]),item=state.good[assignment.kind][index];
    if(!item)continue;
    const location=equipmentLocation(assignment.character),overridden=state.good[assignment.kind].some(a=>isCustom(a)&&a.location===location&&(assignment.kind==='weapons'||a.slotKey===assignment.slot));
    item.wikiOriginalLocation=actual[assignment.kind][index].location;item.wikiAssignedTo=location;item.location=overridden?'':location;
  }
  for(const removal of custom.unequippedSlots??[]){
    const location=equipmentLocation(removal.character);
    for(const item of state.good[removal.kind])if(item.location===location&&(removal.kind==='weapons'||item.slotKey===removal.slot)){
      if(!isCustom(item)){item.wikiOriginalLocation??=actual[removal.kind][item.wikiBaseIndex].location;item.wikiOverridden=true;}
      item.location='';
    }
  }
}
export function syncManagedState(state){
  const context=contexts.get(state);if(!context)return;
  const custom={...state.customInventory},actual={...context.actual};
  for(const kind of kinds){
    const originals=[],additions=[],oldIndexes=[];
    for(const item of state.good[kind]??[]){
      const raw=clean(item);
      if(item.wikiTrialOnly)throw Error('请先将试算装备存入自定义库存。');
      if(isCustom(item)||item.wikiBaseIndex===undefined){if(kind!=='characters')raw.id??='custom-'+crypto.randomUUID();additions.push(raw);}
      else{if(item.wikiAssignedTo||item.wikiOverridden&&item.location==='')raw.location=item.wikiOriginalLocation;originals.push(raw);oldIndexes.push(item.wikiBaseIndex);}
    }
    // 新扫描已拥有的角色优先使用实际资料，旧自定义培养数据仍随备份保留。
    if(kind==='characters')for(const c of custom.characters??[])if(actual.characters.some(a=>a.key===c.key)&&!additions.some(a=>a.key===c.key))additions.push(c);
    if(kind!=='characters'&&custom.equipmentAssignments)custom.equipmentAssignments=custom.equipmentAssignments.map(a=>{
      if(a.kind!==kind)return a;const oldIndex=referenceIndex(kind,a.reference,context.actual[kind]),index=oldIndexes.indexOf(oldIndex);
      return index>=0?{...a,reference:reference(kind,originals[index],originals)}:a;
    });
    actual[kind]=originals;custom[kind]=additions;
  }
  if(custom.equipmentAssignments)custom.equipmentAssignments=custom.equipmentAssignments.filter(a=>custom.characters.some(c=>equipmentLocation(c.key)===equipmentLocation(a.character)));
  if(custom.unequippedSlots)custom.unequippedSlots=custom.unequippedSlots.filter(a=>state.good.characters.some(c=>equipmentLocation(c.key)===equipmentLocation(a.character)));
  state.customInventory=custom;context.actual=actual;rebuild(state);
}
export function serializeManagedState(state){
  syncManagedState(state);const result=structuredClone(state),context=contexts.get(state);
  if(context)result.good=structuredClone(context.actual);return result;
}
export function storeCustomEquipment(state,kind,item){
  const raw=clean(item);delete raw.wikiTrialOnly;raw.id='custom-'+crypto.randomUUID();raw.location='';raw.lock=false;
  state.good[kind].push({...raw,wikiCustom:true});syncManagedState(state);return raw.id;
}
export function equipManagedEquipment(state,member,kind,index,slot,{locked=false}={}){
  if(!['weapons','artifacts'].includes(kind)||kind==='artifacts'&&!SLOTS.includes(slot))throw Error('装备部位不正确。');
  const location=equipmentLocation(member),items=state.good[kind],picked=index===''?null:items[Number(index)];
  if(index!==''&&!picked)throw Error('装备已被移除，请重新选择。');
  const customMember=isCustomCharacter(state,member);
  if(locked&&picked&&!isCustom(picked)&&!customMember)throw Error('账号已锁定，原有角色只能替换自定义装备或恢复原有装备。');
  if(picked&&kind==='artifacts'&&picked.slotKey!==slot)throw Error('圣遗物部位不匹配。');
  const sameTarget=a=>equipmentLocation(a.character)===location&&a.kind===kind&&(kind==='weapons'||a.slot===slot);
  if(index===''){
    if(locked)throw Error('账号已锁定，不能移除当前装备；可以恢复原有装备。');
    for(const a of items)if(isCustom(a)&&a.location===location&&(kind==='weapons'||a.slotKey===slot))a.location='';
    if(state.customInventory.equipmentAssignments)state.customInventory.equipmentAssignments=state.customInventory.equipmentAssignments.filter(a=>!sameTarget(a));
    state.customInventory.unequippedSlots=(state.customInventory.unequippedSlots??[]).filter(a=>!sameTarget(a));
    state.customInventory.unequippedSlots.push({character:member,kind,slot:kind==='weapons'?'':slot});
    syncManagedState(state);return;
  }
  if(state.customInventory.unequippedSlots)state.customInventory.unequippedSlots=state.customInventory.unequippedSlots.filter(a=>!sameTarget(a));
  if(customMember){
    // 引用库存原件，不复制物品，也不改写实际 GOOD 的装备关系。
    if(picked&&!isCustom(picked)){
      const context=contexts.get(state),source=context.actual[kind][picked.wikiBaseIndex];
      if(!source)throw Error('原有装备已不可用，请重新选择。');
      const ref=reference(kind,source,context.actual[kind]);
      state.customInventory.equipmentAssignments=(state.customInventory.equipmentAssignments??[]).filter(a=>!sameTarget(a)&&!(a.kind===kind&&referenceIndex(kind,a.reference,context.actual[kind])===picked.wikiBaseIndex));
      state.customInventory.equipmentAssignments.push({character:member,kind,slot:kind==='weapons'?'':slot,reference:ref});
    }else if(state.customInventory.equipmentAssignments)state.customInventory.equipmentAssignments=state.customInventory.equipmentAssignments.filter(a=>!sameTarget(a));
    for(const a of items)if(isCustom(a)&&a.location===location&&(kind==='weapons'||a.slotKey===slot))a.location='';
    if(isCustom(picked))picked.location=location;
    syncManagedState(state);return;
  }
  // 自定义覆盖仅改变自定义层；原有装备的拥有者和装备位置保持原样。
  if(isCustom(picked)){
    for(const a of items)if(isCustom(a)&&a.location===location&&(kind==='weapons'||a.slotKey===slot))a.location='';
    if(picked)picked.location=location;
  }else{
    if(locked)throw Error('账号已锁定，原有装备不能移除。');
    for(const a of items)if(a.location===location&&(kind==='weapons'||a.slotKey===slot))a.location='';
    if(picked)picked.location=location;
    if(picked?.wikiAssignedTo){state.customInventory.equipmentAssignments=state.customInventory.equipmentAssignments.filter(a=>!(a.kind===kind&&referenceIndex(kind,a.reference,contexts.get(state).actual[kind])===picked.wikiBaseIndex));delete picked.wikiAssignedTo;delete picked.wikiOriginalLocation;delete picked.wikiOverridden;}
    // 明确选择原有库存时，允许修改该账号的实际配装。
    for(const a of items)if(a.wikiOverridden&&(kind==='weapons'||a.slotKey===slot)&&a.wikiOriginalLocation===location){delete a.wikiOverridden;delete a.wikiOriginalLocation;}
  }
  syncManagedState(state);
}
export function restoreManagedEquipment(state,member,{kind,slot}={}){
  if(kind!==undefined&&!['weapons','artifacts'].includes(kind)||slot!==undefined&&(kind!=='artifacts'||!SLOTS.includes(slot)))throw Error('恢复装备的部位不正确。');
  const location=equipmentLocation(member),matches=a=>equipmentLocation(a.character)===location&&(!kind||a.kind===kind)&&(!slot||a.slot===slot);let changed=0;
  for(const type of kind?[kind]:['weapons','artifacts'])for(const item of state.good[type])if(isCustom(item)&&item.location===location&&(!slot||item.slotKey===slot)){item.location='';changed++;}
  for(const field of ['equipmentAssignments','unequippedSlots'])if(state.customInventory[field])state.customInventory[field]=state.customInventory[field].filter(a=>{if(!matches(a))return true;changed++;return false;});
  syncManagedState(state);return changed;
}
