import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openLibrary} from '../lib/database.mjs';
import {validateEntry} from '../shared/catalog.mjs';
import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const registeredMedia=await loadRegisteredMedia();
const library=openLibrary('data/library/wiki.sqlite');
const plans=Object.fromEntries(await Promise.all(['genshin','starrail','zenless'].map(async g=>[g,JSON.parse(await readFile(`.codex_tmp/growth-plan/${g}.json`,'utf8'))])));
// Cache only newly needed images; existing files and original records are retained.
let downloaded=0,failures=[];
const jobs=Object.values(plans).flatMap(p=>[...p.additions,...p.patches]).filter(e=>!e.image&&e.imageRemote);
let index=0;
async function worker(){while(index<jobs.length){const e=jobs[index++],path=`assets/${e.game}/materials/${e.sourceId}.webp`;try{const existing=await readFile(path);if(existing.length){e.image='/'+path;continue;}}catch{}try{const r=await fetch(e.imageRemote,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);if(!r.headers.get('content-type')?.startsWith('image/'))throw Error('不是图片');const bytes=Buffer.from(await r.arrayBuffer());await mkdir(`assets/${e.game}/materials`,{recursive:true});await writeFile(path,bytes,{flag:'wx'});e.image='/'+path;downloaded++;}catch(error){failures.push({id:e.id,error:error.message});}}}
await Promise.all(Array.from({length:5},worker));
const beforeFav=library.favorites();let added=0,updated=0;
library.db.exec('BEGIN IMMEDIATE');
try{
 for(const [game,plan]of Object.entries(plans))for(const patch of [...plan.additions,...plan.patches]){
  const old=library.get(patch.id);
  const result=old?{...old,applicability:patch.applicability,details:old.origin==='snapshot'?{...old.details,...patch.details,facts:{...old.details.facts,...patch.details.facts}}:{...old.details,...(!old.details.summary?{summary:patch.details.summary}:{})},sources:[...(old.sources??[]),...patch.sources.filter(s=>!old.sources?.some(t=>t.url===s.url))],image:old.image??patch.image,imageRemote:old.imageRemote??patch.imageRemote}:patch;
  applyRegisteredMedia(result,registeredMedia);
  validateEntry(result);
  if(old){library.update(old.id,result,old.revision);updated++;}else{library.create(result);added++;}
 }
 if(JSON.stringify(beforeFav)!==JSON.stringify(library.favorites()))throw Error('收藏状态发生变化');
 library.db.exec('COMMIT');
}catch(error){library.db.exec('ROLLBACK');throw error;}
for(const game of Object.keys(plans)){
 const file=`data/catalog/${game}.json`,catalog=JSON.parse(await readFile(file,'utf8'));
 for(const patch of [...plans[game].additions,...plans[game].patches]){const i=catalog.entries.findIndex(e=>e.id===patch.id),live=library.get(patch.id);delete live.revision;delete live.updatedAt;if(i<0)catalog.entries.push(live);else if(catalog.entries[i].origin==='snapshot')catalog.entries[i]=live;}
 await writeFile(file,JSON.stringify(catalog,null,2));
 const growthFile=`data/growth/${game}.json`,growth=JSON.parse(await readFile(growthFile,'utf8'));for(const m of Object.values(growth.materials)){const entry=library.get(m.id);m.name=entry.name;m.image=entry.image??null;m.imageFrame=entry.imageFrame;}await writeFile(growthFile,JSON.stringify(growth,null,2));
}
library.close();await writeFile('data/sources/growth-update.json',JSON.stringify({updatedAt:new Date().toISOString(),added,updated,downloaded,imageFailures:failures},null,2));console.log(JSON.stringify({added,updated,downloaded,imageFailures:failures}));
