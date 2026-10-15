import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {openLibrary} from '../lib/database.mjs';
import {writeCompressedBackup} from '../lib/backup.mjs';
import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const index=await loadRegisteredMedia();
assert.equal(index.size,247,'本轮仅包含220个角色立绘和27个材料图标。');
for(const record of index.values())assert.ok((await stat(join(root,record.image.slice(1)))).isFile(),record.id);
const library=openLibrary(join(root,'data/library/wiki.sqlite'));
try{
 const before=library.export(),unchanged=before.entries.filter(e=>!index.has(e.id));
 const stamp=new Date().toISOString().replaceAll(':','-');
 const backup=join(root,'data/backups',`wiki-before-media-update-${stamp}.json.gz`);
 const backupBytes=await writeCompressedBackup(backup,before);
 const growth=await read('data/growth/zenless.json'),oldGrowth=structuredClone(growth);
 const growthBackup=join(root,'data/backups',`zenless-growth-before-media-update-${stamp}.json.gz`);
 await writeCompressedBackup(growthBackup,growth);
 const changed=[];
 library.db.exec('BEGIN IMMEDIATE');
 try{
  for(const id of index.keys()){
   const old=library.get(id);assert.ok(old,id);
   const updated=applyRegisteredMedia(structuredClone(old),index);
   delete updated.revision;delete updated.updatedAt;
   library.update(id,updated,old.revision);changed.push(id);
  }
  library.db.exec('COMMIT');
 }catch(error){library.db.exec('ROLLBACK');throw error;}
 for(const game of ['genshin','starrail','zenless']){
  const catalog=await read(`data/catalog/${game}.json`);
  for(const entry of catalog.entries)if(index.has(entry.id))applyRegisteredMedia(entry,index);
  await writeFile(join(root,'data/catalog',`${game}.json`),JSON.stringify(catalog,null,2));
 }
 for(const [id,record]of index)if(growth.materials[id]){
  growth.materials[id].image=record.image;
  if(record.imageFrame)growth.materials[id].imageFrame={...record.imageFrame};else delete growth.materials[id].imageFrame;
 }
 await writeFile(join(root,'data/growth/zenless.json'),JSON.stringify(growth,null,2));
 const after=library.export();
 assert.deepEqual(after.entries.filter(e=>!index.has(e.id)),unchanged);
 assert.deepEqual(after.favorites,before.favorites);assert.deepEqual(after.growthPlans,before.growthPlans);
 for(const key of Object.keys(oldGrowth).filter(key=>key!=='materials'))assert.deepEqual(growth[key],oldGrowth[key]);
 for(const [id,material]of Object.entries(oldGrowth.materials))if(!index.has(id))assert.deepEqual(growth.materials[id],material);
 const result={updatedAt:new Date().toISOString(),changed:changed.length,characters:220,coreMaterialIcons:27,unchangedEntries:unchanged.length,favoritesPreserved:true,plansPreserved:true,growthCostsPreserved:true,backup,backupBytes,growthBackup};
 await writeFile(join(root,'docs/立绘与材料图标执行记录-2026-10-03.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{library.close();}
