import {readFileSync,writeFileSync} from 'node:fs';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {openLibrary} from '../lib/database.mjs';
import {writeCompressedBackup} from '../lib/backup.mjs';
import {applyRegisteredMedia} from '../lib/catalog-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath=join(root,'data/sources/visual-assets-2026-10-04.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
assert.equal(manifest.failures.length,0,'先完成失败的资源下载');
assert.equal(manifest.records.length,185,'本轮只涉及60个绝区零角色、63套圣遗物和62套遗器/饰品');
const index=new Map(manifest.records.map(r=>[r.id,r]));
for(const r of index.values())for(const media of [r,r.avatar,...r.parts??[]].filter(Boolean))assert.ok((await stat(join(root,media.image.slice(1)))).isFile(),media.image);
function nonMedia(entry){
 const copy=structuredClone(entry);delete copy.image;delete copy.imageRemote;delete copy.revision;delete copy.updatedAt;delete copy.sources;
 if(copy.details){delete copy.details.artwork;if(copy.details.parts)copy.details.parts=copy.details.parts.map(p=>{delete p.image;delete p.source;return p;});}
 return copy;
}
const library=openLibrary(join(root,'data/library/wiki.sqlite'));
const stamp=new Date().toISOString().replaceAll(':','-');
const backup=join(root,'data/backups',`wiki-before-visual-assets-${stamp}.json.gz`);
const catalogBackup=join(root,'data/backups',`catalog-before-visual-assets-${stamp}.json.gz`);
let changed=0;
try{
 library.db.exec('BEGIN IMMEDIATE');
 try{
  const before=library.export();await writeCompressedBackup(backup,before);
  for(const id of index.keys()){
   const old=library.get(id);assert.ok(old,id);
   const next=applyRegisteredMedia(structuredClone(old),index);
   assert.deepEqual(nonMedia(next),nonMedia(old),`${id} 非图片字段被修改`);
   assert.deepEqual(next.sources.slice(0,old.sources?.length??0),old.sources??[]);
   if(JSON.stringify(next)===JSON.stringify(old))continue;
   delete next.revision;delete next.updatedAt;library.update(id,next,old.revision);changed++;
  }
  const after=library.export();assert.deepEqual(after.favorites,before.favorites);assert.deepEqual(after.growthPlans,before.growthPlans);
  library.db.exec('COMMIT');
 }catch(error){library.db.exec('ROLLBACK');throw error;}
 const catalogs=Object.fromEntries(['genshin','starrail','zenless'].map(g=>[g,JSON.parse(readFileSync(join(root,`data/catalog/${g}.json`),'utf8'))]));
 await writeCompressedBackup(catalogBackup,catalogs);
 for(const game of Object.keys(catalogs)){
  // 同步地重新读取当前版本并局部合并；不使用下载前的旧资料覆盖并行编辑。
  const file=join(root,`data/catalog/${game}.json`),live=JSON.parse(readFileSync(file,'utf8'));
  for(const entry of live.entries)if(index.has(entry.id)){const before=nonMedia(entry);applyRegisteredMedia(entry,index);assert.deepEqual(nonMedia(entry),before);}
  writeFileSync(file,JSON.stringify(live,null,2));
 }
 const result={appliedAt:new Date().toISOString(),changedEntries:changed,avatars:60,sets:125,parts:491,backup,catalogBackup,nonMediaFieldsPreserved:true,favoritesPreserved:true,plansPreserved:true};
 manifest.application=result;await writeFile(manifestPath,JSON.stringify(manifest,null,2));
 console.log(JSON.stringify(result));
}finally{library.close();}
