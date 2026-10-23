// 采用 384×384 的 IconRoleCrop 原图；仅更新头像及其来源，保留完整立绘和个人资料。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {openLibrary} from '../lib/database.mjs';
import {loadRegisteredMedia} from '../lib/catalog-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath='data/sources/zenless/square-avatars-2026-10-22.json';
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const catalog=await read('data/catalog/zenless.json');
const index=JSON.parse(gunzipSync(await readFile(join(root,'data/sources/zenless/update-3.3-2026-10-22/character.json.gz')))).data;
const excluded=new Set(['1631','1641']);
const targets=catalog.entries.filter(e=>e.category==='characters'&&!excluded.has(e.sourceId));
assert.equal(targets.length,60);
function webpInfo(b){
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 let info={};
 for(let p=12;p+8<=b.length;){const kind=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),start=p+8;
  if(kind==='VP8X')info={width:b.readUIntLE(start+4,3)+1,height:b.readUIntLE(start+7,3)+1,alpha:Boolean(b[start]&16)};
  if(kind==='VP8L'&&!info.width){const bits=b.readUInt32LE(start+1);info={width:(bits&16383)+1,height:((bits>>>14)&16383)+1,alpha:Boolean(bits&(1<<28))};}
  p=start+size+(size%2);
 }
 assert.equal(info.width,384);assert.equal(info.height,384);return info;
}
if(process.argv.includes('--download')){
 const records=[];let cursor=0;
 const results=await Promise.allSettled(Array.from({length:5},async()=>{while(cursor<targets.length){const e=targets[cursor++];
  const image=`/assets/zenless/transparent-avatars/${e.sourceId}.webp`,path=join(root,image.slice(1));
  const url=`https://static.nanoka.cc/assets/zzz/${index[e.sourceId].icon.replace('IconRole','IconRoleCrop')}.webp`;
  let b;try{b=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;
   for(let attempt=0;attempt<2;attempt++)try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${e.name}`);b=Buffer.from(await r.arrayBuffer());break;}catch(error){if(attempt===1)throw error;}
   webpInfo(b);await mkdir(dirname(path),{recursive:true});await writeFile(path,b,{flag:'wx'});
  }
  records.push({id:e.id,name:e.name,avatar:{image,url,sourceName:'Nanoka · 游戏方形透明头像',...webpInfo(b),bytes:b.length},previousAvatar:{image:e.image,url:e.imageRemote}});
 }}));
 for(const r of results)if(r.status==='rejected')throw r.reason;
 records.sort((a,b)=>a.id.localeCompare(b.id));assert.equal(records.length,60);
 await writeFile(join(root,manifestPath),JSON.stringify({fetchedAt:new Date().toISOString(),family:'IconRoleCrop',records,excluded:[{id:'zenless-characters-1631',name:'赛维里安',reason:'本系列原图未提供'},{id:'zenless-characters-1641',name:'菲欧妮',reason:'本系列原图未提供'}]},null,2));
 console.log(JSON.stringify({downloaded:records.length,totalBytes:records.reduce((n,e)=>n+e.avatar.bytes,0),manifest:manifestPath}));
}else if(process.argv.includes('--apply')){
 const manifest=await read(manifestPath),inspection=await read('data/sources/zenless/square-avatars-inspection-2026-10-22.json');
 assert.equal(manifest.records.length,60);assert.equal(inspection.images.length,60);
 const registered=await loadRegisteredMedia(),images=new Map(manifest.records.map(r=>[r.id,registered.get(r.id)?.avatar??r.avatar]));
 for(const e of targets){const checked=inspection.images.find(i=>i.id===e.id);assert(checked&&checked.width===384&&checked.height===384&&checked.maxAlpha===255&&(checked.minAlpha===0||e.sourceId==='1411'&&checked.foregroundFillsFrame===true));}
 const patch=entry=>{const avatar=images.get(entry.id);if(!avatar)return entry;
  const sources=[...entry.sources];if(!sources.some(s=>s.url===avatar.url))sources.push({name:avatar.sourceName,url:avatar.url,note:'角色头像'});
  return{...entry,image:avatar.image,imageRemote:avatar.derived?null:avatar.url,sources};
 };
 const library=openLibrary(join(root,'data/library/wiki.sqlite'));
 try{
  const personal=()=>JSON.stringify({favorites:library.favorites(),metadata:library.db.prepare('SELECT * FROM metadata ORDER BY key').all()});
  const beforePersonal=personal();const before=targets.map(e=>library.get(e.id));assert(before.every(Boolean));
  const untouched=Object.fromEntries([...excluded].map(id=>{const key='zenless-characters-'+id;return[key,library.get(key)];}));
  const backup=join(root,'data/backups/zenless-avatars-before-2026-10-22.json.gz');await mkdir(dirname(backup),{recursive:true});
  try{await writeFile(backup,gzipSync(JSON.stringify({entries:before.map(e=>({id:e.id,image:e.image,imageRemote:e.imageRemote,sources:e.sources}))})),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
  library.db.exec('BEGIN IMMEDIATE');try{
   for(const e of before)library.update(e.id,patch(e),e.revision);
   assert.equal(personal(),beforePersonal);for(const [id,e]of Object.entries(untouched))assert.deepEqual(library.get(id),e);
   library.db.exec('COMMIT');
  }catch(error){library.db.exec('ROLLBACK');throw error;}
  const original=catalog.entries;catalog.entries=original.map(patch);
  for(let i=0;i<original.length;i++){const strip=e=>{const j={...e};delete j.image;delete j.imageRemote;delete j.sources;return j;};assert.deepEqual(strip(catalog.entries[i]),strip(original[i]));}
  await writeFile(join(root,'data/catalog/zenless.json'),JSON.stringify(catalog,null,2));
  console.log(JSON.stringify({updated:60,unchanged:manifest.excluded.map(e=>e.name),personalDataUnchanged:personal()===beforePersonal}));
 }finally{library.close();}
}else throw Error('指定 --download 或 --apply。');
