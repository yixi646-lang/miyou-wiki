import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const registeredMedia=await loadRegisteredMedia();
const root = fileURLToPath(new URL('../', import.meta.url));
const catalogs = await Promise.all(['genshin','starrail','zenless'].map(async game => ({ game, path: join(root,'data','catalog',`${game}.json`), data: JSON.parse(await readFile(join(root,'data','catalog',`${game}.json`),'utf8')) })));
for(const catalog of catalogs)for(const entry of catalog.data.entries)applyRegisteredMedia(entry,registeredMedia);
const queue = catalogs.flatMap(c => c.data.entries).filter(entry => entry.imageRemote);
let cursor = 0, done = 0;
const records = [];
async function download(entry) {
  const managed=registeredMedia.get(entry.id);
  if(managed&&(entry.category==='materials'||managed.avatar)){
    const media=managed.avatar??managed;
    const path=join(root,media.image.slice(1));
    const available=await stat(path).then(s=>s.isFile()).catch(e=>{if(e.code==='ENOENT')return false;throw e;});
    records.push({id:entry.id,path:media.image,url:media.url,status:available?'cached':'unavailable',...(!available?{error:managed.avatar?'请使用 cache-visual-assets.mjs 恢复独立头像。':'请使用 cache-core-material-icons.mjs 恢复静态图标；不下载整张贴图替代独立图标。'}:{})});
    return;
  }
  const url = new URL(entry.imageRemote);
  if (!['upload-os-bbs.mihoyo.com','raw.githubusercontent.com','static.nanoka.cc','enka.network'].includes(url.hostname)) return;
  const extension = url.pathname.toLowerCase().endsWith('.webp') ? '.webp' : '.png';
  const relative = `${entry.game}/${entry.category}/${entry.sourceId}${extension}`;
  const path = join(root,'assets',relative);
  try {
    if (!(await stat(path)).isFile()) throw new Error('非图片文件');
    entry.image = `/assets/${relative}`;
    records.push({id:entry.id,path:entry.image,url:entry.imageRemote,status:'cached'});
    return;
  } catch (error) { if(error.code !== 'ENOENT') throw error; }
  let errorMessage;
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(18000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const webp = bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP';
      if ((!png && !webp) || bytes.length>6*1024*1024) throw new Error('图片格式或大小不符合要求');
      await mkdir(join(root,'assets',entry.game,entry.category),{recursive:true});
      await writeFile(path,bytes,{flag:'wx'});
      entry.image = `/assets/${relative}`;
      records.push({id:entry.id,path:entry.image,url:entry.imageRemote,bytes:bytes.length,status:'downloaded'});
      return;
    } catch(error) { errorMessage=error.message; if (/HTTP 40/.test(errorMessage)) break; }
  }
  records.push({id:entry.id,url:entry.imageRemote,status:'unavailable',error:errorMessage});
}
await Promise.all(Array.from({length:8},async()=>{
  while(cursor<queue.length){const entry=queue[cursor++];await download(entry);done++;if(done%100===0)console.log(`本地图片 ${done}/${queue.length}`);}
}));
for(const catalog of catalogs) await writeFile(catalog.path,JSON.stringify(catalog.data,null,2));
await mkdir(join(root,'assets'),{recursive:true});
await writeFile(join(root,'assets','manifest.json'),JSON.stringify({fetchedAt:new Date().toISOString(),records},null,2));
console.log(JSON.stringify({total:queue.length,available:records.filter(r=>r.path).length,unavailable:records.filter(r=>!r.path).length}));
