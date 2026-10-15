import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {plain} from '../lib/normalize.mjs';
import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const registeredMedia=await loadRegisteredMedia();
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalogs=Object.fromEntries(await Promise.all(['genshin','starrail','zenless'].map(async g=>[g,await read(`data/catalog/${g}.json`)])));
const gi=Object.fromEntries(await Promise.all(['characters','weapons','talents','materials'].map(async n=>[n,await read(`data/sources/genshin/${n}.json`)])));
const sr=Object.fromEntries(await Promise.all(['characters','character_promotions','character_skill_trees','character_skills','light_cone_promotions','items'].map(async n=>[n,await read(`data/sources/starrail/${n}.json`)])));
const zzItems=await read('data/sources/zenless/nanoka-items.json');
const manifest=await read('data/sources/manifest.json');
const itemMaps={genshin:Object.fromEntries(Object.values(gi.materials.data.ChineseSimplified.materials).map(i=>[i.id,i])),starrail:sr.items,zenless:zzItems};
const srNames=await read('data/sources/starrail/growth-items.json');
const nanokaVersion={genshin:'7.1',starrail:'4.6',zenless:'3.2'};
const extraMaterialNames={};
function cost(game,raw,currency){const items=Array.isArray(raw)?raw:Object.entries(raw??{}).map(([id,count])=>({id,count}));return items.map(i=>{const sourceId=String(i.id??i.item_id);if(i.name)extraMaterialNames[`${game}-${sourceId}`]=i.name;return{id:`${game}-materials-${sourceId}`,count:Number(i.count??i.num??i.item_num)};}).concat(currency?[{id:`${game}-materials-${game==='genshin'?'202':game==='starrail'?'2':'10'}`,count:currency}]:[]);}
function wikiText(game,title,file='growth-exp-wiki'){const cached=wikiPages[`${game}:${file}`];return cached?.find(p=>p.title===title)?.revisions?.[0]?.slots.main.content??'';}
const wikiPages={};for(const g of ['genshin','starrail','zenless'])wikiPages[`${g}:growth-exp-wiki`]=(await read(`data/sources/${g}/growth-exp-wiki.json`)).query.pages;
function xpRows(text,max){const rows=Array(max-1).fill(null);for(const match of text.replaceAll("'",'').matchAll(/^\|\s*(\d+)\s*\|\|\s*([\d,]+)\s*\|\|/gm)){const level=Number(match[1]);if(level<max)rows[level-1]=Number(match[2].replaceAll(',',''));}if(rows.some(v=>v===null))throw Error('Missing EXP table rows: '+rows.map((v,i)=>v===null?i+1:null).filter(Boolean));return rows;}
const srCharXp=xpRows(wikiText('starrail','Character EXP'),80),srConeText=wikiText('starrail','Light Cone EXP');
const srConeXp=Object.fromEntries([3,4,5].map(r=>[r,xpRows(srConeText.split(`===${r}-Star Rarity===`)[1].split(/===\d-Star Rarity===/)[0],80)]));
const giCharXp=(await read('data/sources/genshin/growth-character-sample.json')).level_exp.slice(0,89);
const giWeaponXp={};for(const r of [1,2,3,4,5]){const w=await read(`data/sources/genshin/${r===5?'growth-weapon-sample':'growth-weapon-rarity-'+r}.json`);giWeaponXp[r]=Object.entries(w.xp_requirements).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,v])=>v);}
const output={};
for(const game of ['genshin','starrail','zenless']){
 const profiles={};
 for(const entry of catalogs[game].entries.filter(e=>['characters','weapons'].includes(e.category))){
  const character=entry.category==='characters';
  const base={id:entry.id,entryId:entry.id,name:entry.name,category:entry.category,element:entry.element,type:entry.type,rarity:entry.rarity,minLevel:1,maxLevel:game==='genshin'?90:game==='starrail'?80:60,caps:game==='genshin'?[20,40,50,60,70,80,90]:game==='starrail'?[20,30,40,50,60,70,80]:[10,20,30,40,50,60],currencyId:`${game}-materials-${game==='genshin'?202:game==='starrail'?2:10}`,currencyPerExp:game==='genshin'?(character?0.2:0.1):game==='starrail'?(character?0.1:0.5):0,expItem:{id:`${game}-materials-${game==='genshin'?(character?104003:104013):game==='starrail'?(character?213:223):(character?300003:301003)}`,value:game==='genshin'?(character?20000:10000):game==='starrail'?(character?20000:6000):3000},ascensions:[],tracks:[],sources:[{name:'Nanoka · 正式版养成数据',url:`https://static.nanoka.cc/${game==='genshin'?'gi':game==='starrail'?'hsr':'zzz'}/${nanokaVersion[game]}/${game==='starrail'?'character':game==='genshin'?'character':'character'}.json`}]};
  if(game==='genshin'){
   if(character){
    const traveler=['10000005','10000007'].includes(entry.sourceId);
    const variants=traveler?await Promise.all([2,3,4,5,6,7,8].map(async n=>({key:n,raw:await read(`data/sources/genshin/growth/characters/10000005-${n}.json`)}))):[{key:null,raw:await read(`data/sources/genshin/growth/characters/${entry.sourceId}.json`)}];
    const elements={Pyro:'火',Hydro:'水',Cryo:'冰',Electro:'雷',Anemo:'风',Geo:'岩',Dendro:'草'};
    for(const {key,raw}of variants){const p=structuredClone(base);p.element=elements[raw.element]??entry.element;p.name=traveler?`${entry.name}（${p.element}）`:entry.name;p.id=traveler?`${entry.id}-${p.element}`:entry.id;p.xp=giCharXp;p.ascensions=raw.materials.ascensions.map(a=>cost(game,a.mats,a.cost));p.sources=[{name:'Nanoka · 正式版角色养成数据',url:`https://static.nanoka.cc/gi/7.1/zh/character/${traveler?'10000005-'+key:entry.sourceId}.json`}];p.tracks=(raw.materials.talents??[]).map((steps,i)=>({id:`talent-${i}`,name:plain(raw.skills?.[i]?.name??['普通攻击','元素战技','元素爆发'][i]),group:'天赋',min:1,max:steps.length+1,steps:steps.map(a=>cost(game,a.mats,a.cost))}));if(traveler)p.note='旅行者各元素共用角色等级；只在一个元素项目中计入等级与突破，其他元素可关闭“等级与突破”。';profiles[p.id]=p;}
    continue;
   }
   base.caps=entry.rarity<3?[20,40,50,60,70]:base.caps;base.maxLevel=base.caps.at(-1);base.xp=giWeaponXp[entry.rarity].slice(0,base.maxLevel-1);base.ascensions=entry.details.materials.map(a=>cost(game,a.items.map(i=>({...i,id:i.id.split('-materials-')[1]}))));base.sources=[{name:'genshin-db · 武器突破与经验数据',url:manifest.repositories['theBowja/genshin-db-dist'].url},{name:'Nanoka · 武器经验',url:`https://static.nanoka.cc/gi/7.1/zh/weapon/${entry.sourceId}.json`}];
  }else if(game==='starrail'){
   base.xp=character?srCharXp:srConeXp[entry.rarity];base.ascensions=(character?sr.character_promotions:sr.light_cone_promotions)[entry.sourceId].materials.filter(a=>a.length).map(a=>cost(game,a));
   base.sources=[{name:'StarRailRes · 突破与行迹材料',url:manifest.repositories['Mar-7th/StarRailRes'].url},{name:'HSR Wiki · 等级经验',url:`https://honkai-star-rail.fandom.com/wiki/${character?'Character':'Light_Cone'}_EXP`}];
   if(character){const char=sr.characters[entry.sourceId];for(const id of char.skill_trees??[]){const node=sr.character_skill_trees[id];if(!node)continue;const skill=sr.character_skills[node.level_up_skills?.[0]?.id],free=node.levels?.[0]?.materials?.length===0,min=free?1:0,max=node.max_level;const steps=(node.levels??[]).slice(free?1:0);if(!steps.some(l=>l.materials.length))continue;base.tracks.push({id:node.id,name:plain(node.name||skill?.name||'行迹'),group:max>1?'技能':skill?.type_text==='秘技'?'秘技':node.name&&/强化/.test(node.name)?'属性行迹':'额外能力',min,max,steps:steps.map(l=>cost(game,l.materials)),requirements:steps.map(l=>({phase:l.promotion??0,level:l.level??0})),prerequisites:node.pre_points??[]});}}
  }else{
   const raw=await read(`data/sources/zenless/${character?'characters':'weapons'}/${entry.sourceId}.json`);
   if(character){base.xp=raw.level_exp.slice(0,59);base.ascensions=Object.values(raw.level).filter(l=>Object.keys(l.materials).length).map(l=>cost(game,l.materials));const labels={basic:'普通攻击',dodge:'闪避',special:'特殊技',chain:'连携技 / 终结技',assist:'支援技'};
    for(const [key,value]of Object.entries(raw.skill)){const levels=Object.keys(value.material??{}).filter(k=>Object.keys(value.material[k]).length).sort((a,b)=>a-b);if(levels.length)base.tracks.push({id:key,name:labels[key]??key,group:'技能',min:1,max:Math.max(...levels.map(Number))+1,steps:levels.map(k=>cost(game,value.material[k]))});}
    base.tracks.push({id:'core',name:'核心技',group:'核心技',min:0,max:6,labels:['未强化','A','B','C','D','E','F'],steps:Object.entries(raw.passive.materials??{}).sort((a,b)=>a[0]-b[0]).map(([,v])=>cost(game,v))});
   }else{base.minLevel=0;base.xp=Array.from({length:60},(_,i)=>Number(raw.level[i].exp));base.ascensions=raw.materials.split('|').filter(Boolean).map(t=>cost(game,Object.fromEntries(t.split(',').map(v=>v.split(':')))));}
   base.sources=[{name:'Nanoka · 正式版养成数据',url:`https://static.nanoka.cc/zzz/3.2/zh/${character?'character':'weapon'}/${entry.sourceId}.json`}];
  }
  profiles[base.id]=base;
 }
 const materials={},usage={};
 for(const p of Object.values(profiles)){
  const groups=[['等级经验',[{id:p.expItem.id,count:1},...(p.currencyPerExp>0?[{id:p.currencyId,count:1}]:[])]]],entry=catalogs[game].entries.find(e=>e.id===p.entryId);
  groups.push([p.category==='characters'?'角色突破':'装备突破',p.ascensions.flat()]);for(const t of p.tracks)groups.push([t.group==='核心技'?'核心技强化':game==='starrail'?'行迹升级':'天赋 / 技能升级',t.steps.flat()]);
  for(const [purpose,items]of groups)for(const {id}of items){const a=usage[id]??={characters:new Set(),weapons:new Set(),elements:new Set(),paths:new Set(),specialties:new Set(),purposes:new Set()};a[p.category].add(p.entryId);a.purposes.add(purpose);if(p.category==='characters'&&p.element)a.elements.add(p.element);if(game==='starrail'&&p.type)a.paths.add(p.type);if(game==='zenless'&&p.type)a.specialties.add(p.type);}
 }
 const additions=[],patches=[];
 for(const [id,rawUsage]of Object.entries(usage)){
  const sourceId=id.split('-materials-')[1],existing=catalogs[game].entries.find(e=>e.id===id),raw=itemMaps[game][sourceId],fallback=extraMaterialNames[`${game}-${sourceId}`]??srNames[sourceId]?.item_name;
  if(!raw&&!existing&&!fallback)throw Error('Unknown material: '+id);
  const applicability=Object.fromEntries(Object.entries(rawUsage).map(([k,v])=>[k,[...v].sort()]));
  const desc=game==='genshin'?plain(raw?.description??''):'';
  let acquisition=game==='genshin'?(raw?.sources??existing?.details.acquisition??[]).map(plain).filter(t=>!t.includes('占位')&&!t.includes('{0}')):game==='starrail'?(raw?.come_from??[]).map(plain):[];
  if(raw?.dropDomainName)acquisition.unshift(`${raw.dropDomainName}${raw.daysOfWeek?.length?'（'+raw.daysOfWeek.join(' / ')+'）':''}`);
  const purposes=applicability.purposes.join('、'),group=applicability.paths.length?`适用于${applicability.paths.join('、')}命途的相关养成项目。`:game==='zenless'&&applicability.specialties.length?`适用于${applicability.specialties.join('、')}特性的相关养成项目。`:'';
  const details={summary:desc||`用于${purposes}。${group}`,acquisition,facts:{用途:purposes,...(raw?.dropDomainName?{获取秘境:raw.dropDomainName}:{}),...(raw?.daysOfWeek?.length?{开放日期:raw.daysOfWeek.join(' / ')}:{}),...(applicability.paths.length?{适用命途:applicability.paths.join(' / ')}:{}),...(game==='zenless'&&applicability.specialties.length?{适用特性:applicability.specialties.join(' / ')}:{}),...(applicability.elements.length?{适用角色属性:applicability.elements.join(' / ')}:{})}};
  const imageKey=game==='genshin'?Object.entries(gi.materials.data.ChineseSimplified.materials).find(([,v])=>String(v.id)===sourceId)?.[0]:null;
  const imageRemote=game==='genshin'?gi.materials.image.materials[imageKey]?.filename_icon?`https://static.nanoka.cc/assets/gi/${gi.materials.image.materials[imageKey].filename_icon}.webp`:null:game==='starrail'?raw?.icon?`https://raw.githubusercontent.com/Mar-7th/StarRailRes/${manifest.repositories['Mar-7th/StarRailRes'].commit}/${raw.icon}`:null:raw?.icon?`https://static.nanoka.cc/assets/zzz/${raw.icon.split('/').at(-1).replace(/\.(png|webp)$/,'')}.webp`:null;
  const sources=[{name:game==='genshin'?'genshin-db · 材料资料':game==='starrail'?'StarRailRes · 材料来源':'Nanoka · 正式版材料与消耗关系',url:game==='genshin'?manifest.repositories['theBowja/genshin-db-dist'].url:game==='starrail'?manifest.repositories['Mar-7th/StarRailRes'].url:'https://static.nanoka.cc/zzz/3.2/zh/item.json',note:'用途关联来自实际角色、装备及技能消耗数据；仅表示已收录条目的使用范围。'}];
  const updated={...(existing??{id,sourceId,game,category:'materials',name:raw?.name??fallback,rarity:game==='zenless'?Math.min(5,raw.rank+1):raw?.rarity??null,kind:raw?.typeText??(game==='starrail'?'养成材料':'养成材料'),aliases:[],secondary:[],tags:[],releaseVersion:null,releaseDate:null,fetchedAt:new Date().toISOString(),origin:'snapshot'}),applicability,details,sources,imageRemote};
  applyRegisteredMedia(updated,registeredMedia);
  if(existing)patches.push(updated);else additions.push(updated);
  materials[id]={id,name:updated.name,rarity:updated.rarity,image:updated.image??null,...(updated.imageFrame?{imageFrame:updated.imageFrame}:{}),purposes:applicability.purposes};
 }
 output[game]={schemaVersion:1,game,version:nanokaVersion[game],fetchedAt:new Date().toISOString(),profiles,materials,notes:['经验材料按最高档折算并向上取整，货币按所需经验折算；实际混用低档经验材料可减少溢出。','突破、技能和行迹逐阶段求和。技能等级使用未受命之座、星魂或影画加成的基础等级。','原神常规等级范围为 1–90；90 级后的特殊提升暂不计入。','绝区零音擎从 0 级开始；消耗经验材料不额外计入丁尼。'],references:[{name:'HoYoLAB · 养成计算器',url:'https://www.hoyolab.com/article/1664243'},{name:'SEELIE · 养成计划',url:game==='genshin'?'https://seelie.me/planner':game==='starrail'?'https://hsr.seelie.me/planner':'https://zzz.seelie.me/planner'}]};
 await mkdir('data/growth',{recursive:true});await writeFile(`data/growth/${game}.json`,JSON.stringify(output[game],null,2));
 await mkdir('.codex_tmp/growth-plan',{recursive:true});await writeFile(`.codex_tmp/growth-plan/${game}.json`,JSON.stringify({additions,patches},null,2));
 console.log(game,{profiles:Object.keys(profiles).length,materials:Object.keys(materials).length,additions:additions.length,patches:patches.length});
}
