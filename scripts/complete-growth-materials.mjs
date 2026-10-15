import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openLibrary} from '../lib/database.mjs';
import {template,parameters,wikiText} from '../lib/wiki-facts.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const gi=await read('data/sources/genshin/materials.json'),zz=await read('data/sources/zenless/nanoka-items.json'),en=await read('data/sources/zenless/growth-items-english.json');
const growth=Object.fromEntries(await Promise.all(['genshin','starrail','zenless'].map(async g=>[g,await read(`data/growth/${g}.json`)])));
const titles=[...new Set(Object.keys(growth.zenless.materials).map(id=>en[id.split('-materials-')[1]]?.name).filter(Boolean))];
const cache='data/sources/zenless/growth-material-pages.json';let pages;
try{pages=(await read(cache)).pages;}catch{pages=[];for(let i=0;i<titles.length;i+=30){const u='https://zenless-zone-zero.fandom.com/api.php?'+new URLSearchParams({action:'query',prop:'revisions',rvprop:'content',rvslots:'main',titles:titles.slice(i,i+30).join('|'),redirects:'1',format:'json',formatversion:'2'});const o=await(await fetch(u,{signal:AbortSignal.timeout(25000)})).json();pages.push(...o.query.pages);}await writeFile(cache,JSON.stringify({fetchedAt:new Date().toISOString(),titles,pages},null,2));}
const pageMap=new Map(pages.filter(p=>p.revisions).map(p=>[p.title.toLowerCase(),p]));
const translateSource=t=>{
 const parts=[];for(const [pattern,text]of [[/Expert Challenge/i,'HIA 专业挑战室'],[/Notorious Hunt/i,'恶名狩猎'],[/Outpost Logistics/i,'前哨站后勤商店'],[/Combat Simulation/i,'HIA 实战模拟室'],[/Signal Shop|Fading Signal/i,'信号商店'],[/Event|reward/i,'活动奖励'],[/New Eridu City Fund/i,'丽都城募'],[/Crafting|Craft|Synthesis/i,'材料合成'],[/Dismantling/i,'材料分解'],[/Convenience Store/i,'杂货店'],[/Investigation Specialization/i,'调查员特训'],[/W-Engine Specialization/i,'音擎特训']])if(pattern.test(t))parts.push(text);
 return [...new Set(parts)].join(' / ');
};
const library=openLibrary('data/library/wiki.sqlite');let index=0;const changes=[],failures=[];
const ids=Object.values(growth).flatMap(d=>Object.keys(d.materials));
async function worker(){while(index<ids.length){const id=ids[index++],old=library.get(id);if(!old)continue;const patch=structuredClone(old);let changed=false;
 if(old.game==='zenless'&&old.origin==='snapshot'){
  const title=en[old.sourceId]?.name,page=pageMap.get(title?.toLowerCase());
  if(page){const p=parameters(template(wikiText(page),'Item Infobox')),acquisition=Object.entries(p).filter(([k])=>/^source\d+$/.test(k)).map(([,v])=>translateSource(v)).filter(Boolean);
   patch.details.acquisition=[...new Set([...(old.details.acquisition??[]),...acquisition])];
   if(p.effect&&/EXP/i.test(p.effect)){const num=p.effect.match(/([\d,]+)\s*EXP/i)?.[1];if(num)patch.details.facts.单份经验值=num.replaceAll(',','');}
   const source={name:'ZZZ Wiki · '+old.name,url:'https://zenless-zone-zero.fandom.com/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_')),note:'材料获取地点与效果；事实字段来自公开 Wiki 模板。'};if(!patch.sources.some(s=>s.url===source.url))patch.sources.push(source);changed=true;
  }
 }
 if(!old.image){let url=old.imageRemote;
  if(old.game==='genshin'){const k=Object.entries(gi.data.ChineseSimplified.materials).find(([,v])=>String(v.id)===old.sourceId)?.[0],icon=gi.image.materials[k]?.filename_icon;if(icon)url=`https://static.nanoka.cc/assets/gi/${icon}.webp`;}
  if(old.game==='zenless'){const icon=zz[old.sourceId]?.icon;if(icon)url=`https://static.nanoka.cc/assets/zzz/${icon.split('/').at(-1).replace(/\.(png|webp)$/,'')}.webp`;}
  if(url){const path=`assets/${old.game}/materials/${old.sourceId}.webp`;try{let bytes;try{bytes=await readFile(path);}catch{const res=await fetch(url,{signal:AbortSignal.timeout(16000)});if(!res.ok)throw Error('HTTP '+res.status);if(!res.headers.get('content-type')?.startsWith('image/'))throw Error('无效图片');bytes=Buffer.from(await res.arrayBuffer());await mkdir(`assets/${old.game}/materials`,{recursive:true});await writeFile(path,bytes,{flag:'wx'});}patch.image='/'+path;patch.imageRemote=url;changed=true;}catch(e){failures.push({id,error:e.message});}}
 }
 if(changed)changes.push(patch);
}}
await Promise.all(Array.from({length:5},worker));
library.db.exec('BEGIN IMMEDIATE');try{for(const p of changes)library.update(p.id,p,p.revision);library.db.exec('COMMIT');}catch(e){library.db.exec('ROLLBACK');throw e;}
for(const game of Object.keys(growth)){const path=`data/catalog/${game}.json`,catalog=await read(path);for(const p of changes.filter(p=>p.game===game)){const i=catalog.entries.findIndex(e=>e.id===p.id);if(i>=0&&catalog.entries[i].origin==='snapshot'){const clean=structuredClone(p);delete clean.revision;delete clean.updatedAt;catalog.entries[i]=clean;}}await writeFile(path,JSON.stringify(catalog,null,2));for(const m of Object.values(growth[game].materials)){const live=library.get(m.id);m.name=live.name;m.image=live.image??null;}await writeFile(`data/growth/${game}.json`,JSON.stringify(growth[game],null,2));}
library.close();console.log(JSON.stringify({changed:changes.length,wikiPages:pages.filter(p=>p.revisions).length,imageFailures:failures}));
