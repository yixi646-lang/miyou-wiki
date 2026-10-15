import { selectEntries, buildFacets } from './catalog.mjs';
export function plannerPicker(profiles,entryMap,game,category,search='',filters={}) {
 const entries=Object.values(profiles).map(p=>({...entryMap.get(p.entryId),...p,id:p.id,game}));
 const query={game,category,search,filters,sort:'release',direction:'desc'};
 const keys=category==='characters'?['rarity','element','type']:['rarity','type','secondary'];
 return {items:selectEntries(entries,query),facets:buildFacets(entries,query).filter(f=>keys.includes(f.key))};
}
export function plannerLayout(width, columns, groupCounts) {
 const cardWidth=420,cardGap=12,gap=22,materialWidth=360,padding=40;
 const stacked=width<cardWidth+gap+materialWidth+padding;
 const room=stacked?width:width-gap-materialWidth-padding;
 const count=Math.min(columns,Math.max(1,...groupCounts),Math.max(1,Math.floor((room+cardGap)/(cardWidth+cardGap))));
 const planWidth=Math.min(width,count*cardWidth+(count-1)*cardGap);
 const totalWidth=stacked?width:width-planWidth-gap;
 const inner=Math.max(1,totalWidth-padding);
 return {stacked,columns:count,planWidth,cardWidth:Math.min(cardWidth,width),materialWidth:Math.min(materialWidth,inner),materialColumns:Math.max(1,Math.floor((inner+16)/(materialWidth+16)))};
}
export function groupMaterialCosts(costs,materials,profiles) {
 const currency=new Set(Object.values(profiles).map(p=>p.currencyId));
 const labels=['通用货币','等级经验','角色突破','装备突破','天赋 / 技能升级','行迹升级','核心技强化','通用养成材料','其他材料'];
 const groups=new Map();
 for(const cost of costs){const purposes=[...new Set(materials[cost.id]?.purposes??[])];
  const label=currency.has(cost.id)?'通用货币':purposes.length>1?'通用养成材料':purposes[0]??'其他材料';
  if(!groups.has(label))groups.set(label,[]);groups.get(label).push(cost);
 }
 return [...groups].sort((a,b)=>labels.indexOf(a[0])-labels.indexOf(b[0])).map(([label,items])=>({label,items}));
}
