import {rollValues} from './evaluate.mjs';
import {artifactMajorVersion,compareArtifactSets} from './artifact-order.mjs';

export const ARTIFACT_SORTS={
  'original':'原始顺序','level-desc':'强化等级从高到低','level-asc':'强化等级从低到高',
  'rarity':'星级从高到低','set':'套装名称','cv':'双暴值从高到低',
  'effective':'有效等效词条从高到低','total':'总等效词条从高到低'
};
export const WEAPON_SORTS={'original':'原始顺序','level-desc':'等级从高到低','level-asc':'等级从低到高','rarity':'星级从高到低','name':'名称','refinement':'精炼从高到低','atk':'基础攻击力从高到低'};
export const artifactFilters=()=>({slot:'',set:'',rarity:'',main:'',status:'',lock:'',minLevel:'',maxLevel:'',subCount:'',subs:[],subMode:'all',subMin:{},minCV:'',minEffective:'',minTotal:'',sort:'level-desc'});
export function matchesEquipment(item,status,lock,location){
  return (!status||status==='free'&&!item.location||status==='equipped'&&!!item.location||status==='current'&&!!location&&item.location===location)
    &&(!lock||lock==='locked'&&!!item.lock||lock==='unlocked'&&!item.lock);
}
const minimum=(value,limit)=>limit===''||limit===undefined||value>=Number(limit);
export function filterArtifacts(items,catalog,data,filters,weights={},location=''){
  const f=filters,terms=(f.search??'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const selected=items.map((a,i)=>({a,i})).filter(({a})=>{
    const m=catalog.sets[a.setKey],text=[a.setKey,m?.name,...(m?.aliases??[])].join(' ').toLowerCase();
    return (!f.slot||a.slotKey===f.slot)&&(!f.set||a.setKey===f.set)&&(!f.rarity||a.rarity===Number(f.rarity))&&(!f.version||artifactMajorVersion(m)===f.version)
      &&(!f.main||a.mainStatKey===f.main)&&matchesEquipment(a,f.status,f.lock,location)
      &&minimum(a.level,f.minLevel)&&(f.maxLevel===''||f.maxLevel===undefined||a.level<=Number(f.maxLevel))
      &&minimum(a.substats.filter(s=>s.key&&s.value>0).length,f.subCount)&&terms.every(t=>text.includes(t))
      &&(!(f.subs?.length)||f.subs[f.subMode==='any'?'some':'every'](k=>a.substats.some(s=>s.key===k&&s.value>0&&minimum(s.value,f.subMin?.[k]))));
  }).map(item=>({...item,metrics:rollValues(item.a,data,weights)})).filter(({metrics:r})=>minimum(r.cv,f.minCV)&&minimum(r.effective,f.minEffective)&&minimum(r.total,f.minTotal));
  return selected.sort((x,y)=>{
    const a=x.a,b=y.a;
    let diff=0;
    if(f.sort==='release')diff=compareArtifactSets(catalog.sets[a.setKey],catalog.sets[b.setKey])||b.level-a.level;
    else if(f.sort==='level-desc')diff=b.level-a.level;
    else if(f.sort==='level-asc')diff=a.level-b.level;
    else if(f.sort==='rarity')diff=b.rarity-a.rarity||b.level-a.level;
    else if(f.sort==='set')diff=(catalog.sets[a.setKey]?.name??a.setKey).localeCompare(catalog.sets[b.setKey]?.name??b.setKey,'zh-CN');
    else if(['cv','effective','total'].includes(f.sort))diff=y.metrics[f.sort]-x.metrics[f.sort];
    else if(f.sort?.startsWith('sub:')){const k=f.sort.slice(4);diff=(b.substats.find(s=>s.key===k)?.value??0)-(a.substats.find(s=>s.key===k)?.value??0);}
    return diff||x.i-y.i;
  });
}
export function weaponBaseStats(weapon,data){
  const source=data.weapon.data[weapon.key];if(!source)return null;
  const stats={...source.baseStats};
  for(const curve of source.lvlCurves??[])stats[curve.key]=(stats[curve.key]??0)+curve.base*(data.weapon.expCurve[curve.curve]?.[weapon.level]??0);
  for(const [k,values]of Object.entries(source.ascensionBonus??{}))stats[k]=(stats[k]??0)+(values[weapon.ascension]??0);
  // 游戏百分比输入与界面统一使用 3.9 而非 0.039。
  for(const k of Object.keys(stats))if(k.endsWith('_'))stats[k]*=100;
  return stats;
}
export function sortWeapons(items,catalog,data,sort){
  return items.sort((x,y)=>{
    const a=x.item,b=y.item,ma=catalog.weapons[a.key],mb=catalog.weapons[b.key];
    const diff=sort==='level-desc'?b.level-a.level:sort==='level-asc'?a.level-b.level:
      sort==='rarity'?(mb?.rarity??0)-(ma?.rarity??0)||b.level-a.level:
      sort==='name'?(ma?.name??a.key).localeCompare(mb?.name??b.key,'zh-CN'):
      sort==='refinement'?b.refinement-a.refinement:
      sort==='atk'?(weaponBaseStats(b,data)?.atk??0)-(weaponBaseStats(a,data)?.atk??0):0;
    return diff||x.i-y.i;
  });
}
