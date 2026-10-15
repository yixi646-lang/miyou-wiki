import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDate, plain, hsrStats } from '../lib/normalize.mjs';
import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const registeredMedia=await loadRegisteredMedia();
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
for(const game of ['genshin','starrail','zenless']){
  const catalog=await read(`data/catalog/${game}.json`),entries=catalog.entries;
  const semantic=new Map();
  const files=(await readdir(join(root,'data/sources',game))).filter(f=>f.startsWith('bwiki-'));
  for(const file of files){const raw=await read(`data/sources/${game}/${file}`);for(const item of Object.values(raw.query?.results??{})){if(item.namespace!==0||item.fulltext.includes('/'))continue;const old=semantic.get(item.fulltext)??{};semantic.set(item.fulltext,{...old,...item,printouts:{...old.printouts,...item.printouts}});}}
  const charPromo=game==='starrail'?await read('data/sources/starrail/character_promotions.json'):null;
  const conePromo=game==='starrail'?await read('data/sources/starrail/light_cone_promotions.json'):null;
  const zzItems=game==='zenless'?await read('data/sources/zenless/nanoka-items.json'):null;
  const materialIds=new Set(entries.filter(e=>e.category==='materials').map(e=>e.sourceId));
  for(const entry of entries){
    const match=[entry.name,...(entry.aliases??[])].map(n=>semantic.get(n)).find(Boolean);
    if(match){const p=match.printouts;entry.releaseVersion=String(p['实装版本']?.[0]??entry.releaseVersion??'')||null;entry.releaseDate=normalizeDate(p['实装日期']?.[0])??entry.releaseDate;entry.region=p['阵营']?.[0]??entry.region;if(!entry.sources.some(s=>s.url===match.fullurl))entry.sources.push({name:`BWIKI · ${match.fulltext}`,url:match.fullurl,note:'结构化版本、日期与阵营资料'});}
    if(entry.category==='weapons' && entry.signatureIds && !normalizeDate(match?.printouts['实装日期']?.[0])) {
      entry.releaseDate=null;
    }
    if(game==='genshin' && entry.signatureIds){entry.signatureNote='仅记录明确的专武对应关系；不列通用适配角色。';}
    if(game==='starrail' && ['characters','weapons'].includes(entry.category)){
      entry.statsTable=hsrStats((entry.category==='characters'?charPromo:conePromo)[entry.sourceId]);entry.stats=entry.statsTable.at(-1)??{};
      if(entry.category==='characters' && /^三月七$/.test(entry.name) && entry.type!=='存护')entry.name=`三月七（${entry.type}）`;
    }
    if(game==='zenless' && entry.category==='characters'){
      const raw=await read(`data/sources/zenless/characters/${entry.sourceId}.json`);
      const nameValue=value=>value&&typeof value==='object'?plain(value.name??Object.values(value)[0]):value?plain(value):'';
      entry.element=nameValue(raw.special_element_type)||nameValue(raw.element_type);
      entry.statsTable=entry.statsTable.map(r=>{const p=Object.values(raw.level).find(p=>r.level>p.level_min&&r.level<=p.level_max)??Object.values(raw.level).at(-1);const values=raw.stats;return {level:r.level,hp:Math.floor(values.hp_max+values.hp_growth/10000*(r.level-1)+(p?.hp_max??0)),attack:Math.floor(values.attack+values.attack_growth/10000*(r.level-1)+(p?.attack??0)),defense:Math.floor(values.defence+values.defence_growth/10000*(r.level-1)+(p?.defence??0))};});entry.stats=entry.statsTable.at(-1);
    }
    if(game==='zenless' && entry.category==='weapons'){
      const raw=await read(`data/sources/zenless/weapons/${entry.sourceId}.json`);
      entry.details.materials=String(raw.materials??'').split('|').filter(Boolean).map((s,i)=>({name:`改造 ${i+1}`,items:s.split(',').map(item=>{const[id,count]=item.split(':');materialIds.add(id);return{id:`zenless-materials-${id}`,name:zzItems[id]?.name??`材料 ${id}`,count:Number(count)};})}));
    }
    if(game==='zenless' && entry.category==='materials'){
      const raw=zzItems[entry.sourceId];entry.imageRemote=raw?.icon?`https://static.nanoka.cc/assets/zzz/${raw.icon.split('/').at(-1).replace(/\.png$/,'.webp')}`:null;
    }
    if(game==='starrail' && entry.category==='materials')entry.kind='养成材料';
  }
  if(game==='zenless')for(const id of materialIds){if(entries.some(e=>e.id===`zenless-materials-${id}`))continue;const raw=zzItems[id];if(!raw)continue;entries.push({id:`zenless-materials-${id}`,sourceId:id,game,category:'materials',name:raw.name,rarity:Math.min(5,Math.max(1,raw.rank+1)),kind:id==='10'?'通用货币':'养成材料',aliases:[],secondary:[],tags:[],releaseVersion:null,releaseDate:null,fetchedAt:catalog.fetchedAt,origin:'snapshot',sources:[{name:'Nanoka · 正式版资料',url:'https://static.nanoka.cc/manifest.json',note:'材料名称与图标'}],details:{},imageRemote:raw.icon?`https://static.nanoka.cc/assets/zzz/${raw.icon.split('/').at(-1).replace(/\.png$/,'.webp')}`:null});}
  for(const entry of entries)if(game==='zenless'&&!entry.sources.some(s=>s.name.startsWith('Nanoka')))entry.sources.push({name:'Nanoka · 正式版资料',url:'https://static.nanoka.cc/manifest.json',note:'名称、技能与装备效果；仅取 live 目录'});
  for(const entry of entries)applyRegisteredMedia(entry,registeredMedia);
  await writeFile(join(root,'data/catalog',`${game}.json`),JSON.stringify(catalog,null,2));
  console.log(game,entries.length,entries.filter(e=>e.releaseDate).length,'条有日期',entries.filter(e=>e.releaseVersion).length,'条有版本');
}
