// Nanoka extra_level / Enka CoreEnhancementProps 均为每阶段累计值，不逐阶段相加。
export function buildCoreStats(raw) {
  const stages=Object.entries(raw.extra_level??{}).sort((a,b)=>Number(a[0])-Number(b[0]));
  const properties=new Map();for(const [,stage]of stages)for(const p of Object.values(stage.extra??{}))properties.set(String(p.prop),{id:String(p.prop),name:p.name,unit:p.format?.includes('%')?'%':String(p.prop)==='30501'?'/秒':'',scale:p.format?.includes('%')?100:String(p.prop)==='30501'?100:1});
  const cols=[...properties.values()],previous={};
  return {properties:cols.map(({scale,...p})=>p),rows:[{stage:'未强化',level:0,requiredLevel:1,values:Object.fromEntries(cols.map(p=>[p.id,0])),gains:Object.fromEntries(cols.map(p=>[p.id,0]))},...stages.map(([level,s])=>{const values={},gains={};for(const p of cols){values[p.id]=Number((Number(s.extra?.[p.id]?.value??0)/p.scale).toFixed(4));gains[p.id]=Number((values[p.id]-(previous[p.id]??0)).toFixed(4));previous[p.id]=values[p.id];}return{stage:String.fromCharCode(64+Number(level)),level:Number(level),requiredLevel:s.max_level,values,gains};})]};
}
export const formatCoreValue = (value, unit='') => `${value>0?'+':''}${Number(value.toFixed(4))}${unit}`;
