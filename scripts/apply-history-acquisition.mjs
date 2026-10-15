// 在原资料库中合并本次请求的字段；不清空条目，不替换收藏或无关本地编辑。
import{readFile,writeFile}from'node:fs/promises';
import{openLibrary}from'../lib/database.mjs';
import{validateEntry}from'../shared/catalog.mjs';
const plan=JSON.parse(await readFile('.codex_tmp/history-acquisition-plan.json','utf8'));
if(plan.audit.missing.length)throw new Error('仍有缺少依据的资料，未应用');
const merge=(entry,patch)=>{
  const next={...entry,details:{...entry.details,acquisition:[...new Set([...(entry.details?.acquisition??[]),...patch.details.acquisition])]},sources:[...(entry.sources??[])]};
  for(const src of patch.sources)if(!next.sources.some(old=>old.url===src.url))next.sources.push(src);
  for(const key of ['releaseVersion','releaseDate','releaseDateBasis'])if(patch[key]&&!next[key])next[key]=patch[key];
  if(patch.stats&&entry.origin==='snapshot'){
    for(const key of ['stats','statsTable','statsLevel'])next[key]=patch[key];
    next.details.facts={...next.details.facts,...patch.details.facts};for(const key of patch.removeFacts??[])delete next.details.facts[key];
  }
  return validateEntry(next);
};
const library=openLibrary('data/library/wiki.sqlite');let changed=0,added=0;
try{
  const favorites=library.favorites(),oldCount=library.all().length;
  const prepared=plan.updates.map(p=>{const entry=library.get(p.id);if(!entry)throw new Error('原条目不存在：'+p.id);return{old:entry,next:merge(entry,p)};});for(const e of plan.banners)validateEntry(e);
  library.db.exec('BEGIN IMMEDIATE');
  try{
    for(const {old,next}of prepared)if(JSON.stringify(old)!==JSON.stringify(next)){library.update(old.id,next,old.revision);changed++;}
    for(const entry of plan.banners){const old=library.get(entry.id);if(!old){library.create(entry);added++;}else if(old.origin==='snapshot'){const next={...old,...entry,fetchedAt:old.fetchedAt};if(JSON.stringify(old)!==JSON.stringify(next)){library.update(old.id,next,old.revision);changed++;}}}
    if(JSON.stringify(favorites)!==JSON.stringify(library.favorites()))throw new Error('收藏发生了意外变化');
    if(library.all().length!==oldCount+added)throw new Error('条目数量不一致');
    library.db.exec('COMMIT');
  }catch(error){library.db.exec('ROLLBACK');throw error;}
  for(const game of ['genshin','starrail','zenless']){
    const path=`data/catalog/${game}.json`,catalog=JSON.parse(await readFile(path,'utf8'));
    catalog.entries=catalog.entries.map(e=>{const p=plan.updates.find(p=>p.id===e.id),b=plan.banners.find(p=>p.id===e.id);return p?merge(e,p):b&&e.origin==='snapshot'?{...e,...b,fetchedAt:e.fetchedAt}:e;});
    const ids=new Set(catalog.entries.map(e=>e.id));catalog.entries.push(...plan.banners.filter(e=>e.game===game&&!ids.has(e.id)));
    await writeFile(path,JSON.stringify(catalog,null,2));
  }
  const report={appliedAt:new Date().toISOString(),changed,added,total:library.all().length,favoritesPreserved:true,coverage:plan.audit};
  await writeFile('data/sources/history-acquisition-update.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{library.close();}
