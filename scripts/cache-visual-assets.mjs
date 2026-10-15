import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const manifestPath=join(root,'data/sources/visual-assets-2026-10-04.json');
const [gi,sr,zz,sources]=await Promise.all(['data/sources/genshin/artifacts.json','data/sources/starrail/relics.json','data/sources/zenless/avatars.json','data/sources/manifest.json'].map(read));
const previous=await readFile(manifestPath,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {records:[]};throw e;});
const cached=new Map(previous.records.map(r=>[r.id,r]));
const wikiAvatars=(await read('data/sources/zenless/official-wiki-avatars-2026-10-04.json')).data.list[0].list;
const normalizeName=s=>s.replace(/[·\s「」]/g,'');
const srBase=`https://raw.githubusercontent.com/Mar-7th/StarRailRes/${sources.repositories['Mar-7th/StarRailRes'].commit}/`;
function validate(bytes){
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if((!png&&!webp)||bytes.length<128||bytes.length>8*1024*1024)throw Error('图片格式或体积不符合预期');
 return {bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function image(base,candidates,old){
 if(old?.image&&candidates.some(s=>s.url===old.url)){
  try{return {...old,...validate(await readFile(join(root,old.image.slice(1))))};}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 const errors=[];
 for(const source of candidates){
  const extension=new URL(source.url).pathname.endsWith('.webp')?'webp':'png';
  const image=`${base}.${extension}`,path=join(root,image.slice(1));
  try{
   let bytes;
   try{bytes=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
   if(!bytes){const r=await fetch(source.url,{signal:AbortSignal.timeout(18000)});if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}`);}bytes=Buffer.from(await r.arrayBuffer());validate(bytes);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
   return {image,...source,...validate(bytes)};
  }catch(error){errors.push({url:source.url,error:error.message});}
 }
 throw Error(JSON.stringify(errors));
}
const queue=[];
for(const game of ['zenless','genshin','starrail']){
 const catalog=await read(`data/catalog/${game}.json`);
 for(const entry of catalog.entries){
  if(game==='zenless'&&entry.category==='characters')queue.push(async()=>{
   const avatar=wikiAvatars.find(w=>[w.title,w.alias_name].some(n=>normalizeName(n)===normalizeName(entry.name)));
   if(!avatar?.icon)throw Error(`缺少 ${entry.id} 官方Wiki头像来源`);
   const old=cached.get(entry.id);
   const icon=await image(`/assets/zenless/wiki-avatars/${entry.sourceId}`, [{url:avatar.icon,sourceName:'米游社 · 绳网情报站头像',sourceUrl:`https://baike.mihoyo.com/zzz/wiki/content/${avatar.content_id}/detail`}],old?.avatar);
   const artwork=entry.details?.artwork?.image??entry.image;
   const bytes=await readFile(join(root,artwork.slice(1)));
   return {id:entry.id,name:entry.name,game,image:artwork,url:entry.details?.artwork?.source?.url??entry.imageRemote,sourceName:'Nanoka · 游戏角色立绘',...validate(bytes),avatar:icon,status:'saved'};
  });
  if(game!=='zenless'&&entry.category==='sets')queue.push(async()=>{
   const old=cached.get(entry.id),parts=[];
   const raw=game==='genshin'?Object.entries(gi.data.ChineseSimplified.artifacts).find(([,r])=>String(r.id)===entry.sourceId):null;
   for(const part of entry.details?.parts??[]){
    const prior=old?.parts?.find(p=>p.name===part.name&&p.type===part.type);
    let slot,candidates;
    if(game==='genshin'){
     if(!raw)throw Error(`缺少 ${entry.id} 部件来源`);
     slot=['flower','plume','sands','goblet','circlet'].find(s=>raw[1][s]?.name===part.name);
     const picture=gi.image.artifacts[raw[0]];
     if(!slot||!picture?.['filename_'+slot])throw Error(`无法按名称核对 ${entry.id} / ${part.name}`);
     candidates=[{url:picture['mihoyo_'+slot]??picture[slot],sourceName:'米游社 · 圣遗物部件图'},{url:`https://static.nanoka.cc/assets/gi/${picture['filename_'+slot]}.webp`,sourceName:'Nanoka · 圣遗物部件图'}].filter(s=>s.url);
    }else{
     const relic=Object.values(sr).find(r=>r.set_id===entry.sourceId&&r.name===part.name&&r.type===part.type);
     if(!relic)throw Error(`无法按名称核对 ${entry.id} / ${part.name}`);
     slot=part.type.toLowerCase();candidates=[{url:srBase+relic.icon,sourceName:'StarRailRes · 固定版本部件图'}];
    }
    parts.push({...part,...await image(`/assets/${game}/set-parts/${entry.sourceId}-${slot}`,candidates,prior)});
   }
   return {id:entry.id,name:entry.name,game,image:entry.image,url:game==='genshin'?sources.repositories['theBowja/genshin-db-dist'].url:sources.repositories['Mar-7th/StarRailRes'].url,sourceName:game==='genshin'?'genshin-db · 圣遗物部件图':'StarRailRes · 遗器与位面饰品部件图',parts,status:'saved'};
  });
 }
}
let cursor=0,done=0;const records=[],failures=[];
await Promise.allSettled(Array.from({length:4},async()=>{while(cursor<queue.length){const i=cursor++;try{records.push(await queue[i]());}catch(error){failures.push({task:i,error:error.message});}done++;if(done%25===0)console.log(`美术资源 ${done}/${queue.length}`);}}));
records.sort((a,b)=>a.id.localeCompare(b.id));
await writeFile(manifestPath,JSON.stringify({fetchedAt:new Date().toISOString(),records,failures,notes:['绝区零原始全身图保持字节不变；列表使用独立头像。','套装部件按套装编号、名称和部位核对，不使用猜测或占位图。','未来生成、缓存和旧备份导入通过 registered media 保留本轮图片字段。']},null,2));
console.log(JSON.stringify({entries:records.length,avatars:records.filter(r=>r.avatar).length,parts:records.reduce((n,r)=>n+(r.parts?.length??0),0),failures}));
if(failures.length)process.exitCode=1;
