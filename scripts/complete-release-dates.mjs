// 仅采集事实字段：武器首次实装日期、版本上线日期与对应页面修订编号。
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{join}from'node:path';
import{fileURLToPath}from'node:url';
import{gunzipSync}from'node:zlib';
import{openLibrary}from'../lib/database.mjs';
import{normalizeDate}from'../lib/normalize.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const manifest=await read('data/sources/manifest.json');
const englishPath='data/sources/genshin/english-weapons.json';let english;
try{english=await read(englishPath);}catch(error){if(error.code!=='ENOENT')throw error;const commit=manifest.repositories['theBowja/genshin-db-dist'].commit;const url=`https://raw.githubusercontent.com/theBowja/genshin-db-dist/${commit}/data/gzips/english-weapons.min.json.gzip`;const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`英文名称下载失败：${response.status}`);english=JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())));await writeFile(join(root,englishPath),JSON.stringify(english,null,2),{flag:'wx'});}
const wikiCodes={genshin:'genshin-impact',starrail:'honkai-star-rail',zenless:'zenless-zone-zero'};
async function records(wiki,titles){
  const output=[];
  for(let i=0;i<titles.length;i+=40){
    const url=new URL(`https://${wiki}.fandom.com/api.php`);url.search=new URLSearchParams({action:'query',titles:titles.slice(i,i+40).join('|'),prop:'revisions',rvprop:'ids|timestamp|content',rvslots:'main',redirects:'1',format:'json',formatversion:'2'});
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`资料请求失败：${response.status}`);const data=await response.json();
    if(data.error)throw new Error(data.error.info);
    for(const page of data.query?.pages??[]){
      const revision=page.revisions?.[0],text=revision?.slots?.main?.content??'';
      const date=normalizeDate(text.match(/^\|\s*(?:releaseDate|release_date|date)\s*=\s*(\d{4}-\d{2}-\d{2})/mi)?.[1]);
      const id=text.match(/^\|\s*id\s*=\s*(\d+)/mi)?.[1]??null;
      const official=text.slice(0,2500).match(/https:\/\/(?:genshin|hsr|zenless)\.hoyoverse\.com\/[^\s\]<>]+/)?.[0]??null;
      output.push({title:page.title,pageId:page.pageid??null,revisionId:revision?.revid??null,revisionAt:revision?.timestamp??null,date,id,url:`https://${wiki}.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`,official});
    }
    console.log(wiki,Math.min(i+40,titles.length)+'/'+titles.length);
  }
  return output;
}
async function cached(name,build){const path=`data/sources/${name}.json`;try{return await read(path);}catch(error){if(error.code!=='ENOENT')throw error;const value=await build();await writeFile(join(root,path),JSON.stringify({fetchedAt:new Date().toISOString(),records:value},null,2),{flag:'wx'});return{records:value};}}
const names=Object.values(english.data.English.weapons).map(w=>w.name);
const weaponFacts=await cached('genshin/wiki-weapon-release-facts',()=>records(wikiCodes.genshin,names));
const catalogues={};for(const game of Object.keys(wikiCodes))catalogues[game]=await read(`data/catalog/${game}.json`);
const versionFacts={};
for(const game of Object.keys(wikiCodes)){
  const versions=[...new Set(catalogues[game].entries.filter(e=>e.category==='sets'&&e.releaseVersion&&!e.releaseDate).map(e=>e.releaseVersion))];
  versionFacts[game]=await cached(`${game}/wiki-version-release-facts`,()=>records(wikiCodes[game],versions.map(v=>`Version/${v}`)));
}
const library=openLibrary(join(root,'data/library/wiki.sqlite'));let updated=0,retained=0;
try{for(const [game,catalog]of Object.entries(catalogues)){
  const byId=new Map(weaponFacts.records.filter(r=>r.id&&r.date).map(r=>[r.id,r]));
  const byVersion=new Map(versionFacts[game].records.filter(r=>r.date).map(r=>[r.title.split('/').at(-1),r]));
  for(const entry of catalog.entries){const previous=JSON.stringify(entry);let fact;
    if(game==='genshin'&&entry.category==='weapons'&&!entry.releaseDate){fact=byId.get(entry.sourceId);if(fact?.date<='2026-10-03'){entry.releaseDate=fact.date;entry.releaseDateBasis='Wiki 武器首次实装记录';}}
    if(entry.category==='sets'&&!entry.releaseDate&&entry.releaseVersion){fact=byVersion.get(entry.releaseVersion);if(fact?.date<='2026-10-03'){entry.releaseDate=fact.date;entry.releaseDateBasis='据实装版本的上线日期记录';}}
    if(previous!==JSON.stringify(entry)){
      entry.sources.push({name:`${wikiCodes[game]} Wiki · ${fact.title}`,url:fact.url,note:entry.releaseDateBasis+`；页面修订 ${fact.revisionId}`});
      const current=library.get(entry.id);const{revision,updatedAt,...plain}=current??{};
      if(current?.origin==='snapshot'&&JSON.stringify(plain)===previous){library.update(entry.id,entry,revision);updated++;}else retained++;
    }
  }
  await writeFile(join(root,'data/catalog',`${game}.json`),JSON.stringify(catalog,null,2));
  console.log(game,'日期',catalog.entries.filter(e=>e.releaseDate&&e.category!=='materials').length,'/',catalog.entries.filter(e=>e.category!=='materials').length);
}console.log({updated,retained});}finally{library.close();}
