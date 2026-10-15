// 只补充绝区零核心强化属性及修正特殊卡池元数据，保留其余条目内容与用户计划。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {writeCompressedBackup} from '../lib/backup.mjs';
import {openLibrary} from '../lib/database.mjs';
import {buildCoreStats} from '../shared/core-stats.mjs';
import {signalSourceType,SIGNAL_TYPES,pairSignalBanners} from '../lib/signal-channels.mjs';
import {wikiText,template,parameters} from '../lib/wiki-facts.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalog=await read('data/catalog/zenless.json'),source=await read('data/sources/zenless/history-pages.json'),pages=source.pages??source.query?.pages??[],byTitle=new Map(pages.map(p=>[p.title,p]));
const library=openLibrary('data/library/wiki.sqlite');
try{
 const cores=new Map();for(const e of catalog.entries.filter(e=>e.category==='characters')){const raw=await read(`data/sources/zenless/characters/${e.sourceId}.json`),core=buildCoreStats(raw);if(core.rows.length!==7||!core.properties.length)throw Error('核心强化阶段缺失 '+e.name);cores.set(e.id,core);}
 const patch=e=>{
  if(cores.has(e.id)){const url=`https://static.nanoka.cc/zzz/3.2/zh/character/${e.sourceId}.json`;return {...e,details:{...e.details,coreStats:cores.get(e.id)},sources:[...e.sources??[],...e.sources?.some(s=>s.url===url)?[]:[{name:'Nanoka · 核心技强化属性',url,note:'正式版 extra_level：各阶段累计属性及解锁等级；百分比、每秒能量回复按原始字段单位换算。'}]]};}
  if(e.category!=='banners')return e;
  const page=e.aliases?.map(a=>byTitle.get(a)).find(Boolean);if(!page)return e;
  const inf=parameters(template(wikiText(page),'Signal Search Infobox')),sourceType=signalSourceType(page.title,inf.type),type=SIGNAL_TYPES[sourceType];if(!type)return e;
  return {...e,type,details:{...e.details,facts:{...e.details?.facts,卡池类型:type}},banner:{...e.banner,mode:'selection',sourceType,rawSourceType:inf.type,classificationBasis:'来源标题标明特殊自选频段；修正 Infobox type 误填，独家重映与同期音擎回响分别分类。',groups:e.banner.groups.map(g=>({...g,role:g.items.some(i=>i.rarity===5)?'selectable':g.sourceKey?.endsWith('_F')?'up':'pool'}))}};
 };
 const entries=library.all().map(e=>e.game==='zenless'?patch(e):e);pairSignalBanners(entries);
 const updates=entries.filter(e=>cores.has(e.id)||e.game==='zenless'&&e.category==='banners'&&Object.values(SIGNAL_TYPES).includes(e.type));
 await mkdir('data/backups',{recursive:true});const backup=`data/backups/wiki-before-core-signals-${new Date().toISOString().replaceAll(':','-')}.json.gz`;await writeCompressedBackup(backup,library.export());
 library.db.exec('BEGIN IMMEDIATE');try{for(const e of updates)library.update(e.id,e,e.revision);library.db.exec('COMMIT');}catch(error){library.db.exec('ROLLBACK');throw error;}
 catalog.entries=catalog.entries.map(patch);pairSignalBanners(catalog.entries);await writeFile('data/catalog/zenless.json',JSON.stringify(catalog,null,2));
 const report={updatedAt:new Date().toISOString(),backup,characters:cores.size,banners:updates.filter(e=>e.category==='banners').map(e=>({id:e.id,type:e.type,version:e.releaseVersion,start:e.banner.start,end:e.banner.end,rawSourceType:e.banner.rawSourceType,sourceType:e.banner.sourceType,pairedBannerId:e.banner.pairedBannerId}))};
 await writeFile('data/sources/core-signal-enrichment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{library.close();}
