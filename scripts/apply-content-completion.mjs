import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {openLibrary} from '../lib/database.mjs';
import {writeCompressedBackup} from '../lib/backup.mjs';
import {plain} from '../lib/normalize.mjs';
import {TRAVELER_ELEMENTS} from '../shared/traveler.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const research=await read('data/sources/release-date-research-2026-10-03.json');
const patches=new Map(research.groups.flatMap(group=>group.ids.map(id=>[id,group])));
if(patches.size!==25)throw Error('日期更新范围必须为原清单25条');
const rawElements={冰:5,风:4,岩:6,雷:7,草:8,水:3,火:2};
function text(value,params=[]){return plain(value).replace(/\{(?:LINK#[^}]+|\/LINK)\}/g,'').replace(/\{param(\d+):([A-Z\d]+)\}/g,(_,n,format)=>{
 const value=params[Number(n)-1];if(!Number.isFinite(value))return '〔未收录〕';const percent=format.endsWith('P'),digits=Number(format.match(/\d+/)?.[0]??0);return (value*(percent?100:1)).toFixed(digits)+(percent?'%':'');
});}
function skills(raw){return [...raw.skills.map((skill,i)=>({name:text(skill.name),type:['普通攻击','元素战技','元素爆发'][i]??'技能',description:text(skill.desc),levels:Object.values(skill.promote??{}).sort((a,b)=>a.level-b.level).map(level=>({level:level.level,description:text(skill.desc,level.param),specs:level.desc.filter(Boolean).map(line=>{const [name,...value]=line.split('|');return{name:text(name),value:text(value.join('|'),level.param)};})}))})),...(raw.passives??[]).map(p=>({name:text(p.name),type:'固有天赋',description:text(p.desc,p.param_list)}))];}
const travelerData={};
for(const id of ['10000005','10000007']){
 const elements={};
 for(const element of TRAVELER_ELEMENTS){const n=rawElements[element];const raw=id==='10000005'?await read(`data/sources/genshin/growth/characters/${id}-${n}.json`):JSON.parse(gunzipSync(await readFile(join(root,`data/sources/genshin/traveler/${id}-${n}.json.gz`))));
  elements[element]={element,profileId:`genshin-characters-${id}-${element}`,skills:skills(raw),upgrades:raw.constellations.map((c,i)=>({name:text(c.name),type:`命之座 ${i+1}`,description:text(c.desc,c.param_list)})),sources:[{name:'Nanoka · 旅行者'+element+'元素技能与命之座',url:`https://static.nanoka.cc/gi/7.1/zh/character/${id}-${n}.json`,note:'空、荧分别使用对应角色来源；角色共用等级，不拆分独立图鉴条目。'}]};
 }
 travelerData[`genshin-characters-${id}`]={defaultElement:'冰',elements};
}
function patch(entry){const fact=patches.get(entry.id);if(!fact)return entry;const next={...entry,releaseDate:fact.date,releaseVersion:fact.version,releaseDateBasis:fact.basis,sources:[...(entry.sources??[])]};for(const source of fact.sources)if(!next.sources.some(s=>s.url===source.url))next.sources.push({...source,note:'实装日期核查，2026-10-03'});
 if(travelerData[entry.id]){next.element='冰';next.details={...entry.details,traveler:travelerData[entry.id]};}
 return next;
}
const catalogs=Object.fromEntries(await Promise.all(['genshin','zenless'].map(async g=>[g,await read(`data/catalog/${g}.json`)])));
const growth=await read('data/growth/zenless.json');const fees=Object.values(growth.recipes).filter(r=>r.feeStatus==='unverified');if(fees.length!==24)throw Error('配方更新范围必须为原清单24条');
const library=openLibrary(resolve(root,'data/library/wiki.sqlite'));
try{
 for(const id of patches.keys())if(!library.get(id))throw Error('正式库缺少目标条目 '+id);
 const timestamp=new Date().toISOString().replaceAll(':','-');
 const backupPath=`data/backups/wiki-before-content-completion-${timestamp}.json.gz`,growthBackupPath=`data/backups/zenless-growth-before-zero-fees-${timestamp}.json.gz`;
 const backup={path:backupPath,bytes:await writeCompressedBackup(join(root,backupPath),library.export())};
 const growthBackup={path:growthBackupPath,bytes:await writeCompressedBackup(join(root,growthBackupPath),growth)};
 const changed=[];
 library.db.exec('BEGIN IMMEDIATE');
 try{for(const id of patches.keys()){const current=library.get(id),{revision,updatedAt,...entry}=current;library.update(id,patch(entry),revision);changed.push({id,name:entry.name,date:patches.get(id).date,version:patches.get(id).version});}library.db.exec('COMMIT');}catch(error){library.db.exec('ROLLBACK');throw error;}
 for(const [game,catalog]of Object.entries(catalogs)){catalog.entries=catalog.entries.map(patch);await writeFile(join(root,`data/catalog/${game}.json`),JSON.stringify(catalog,null,2));}
 for(const recipe of fees){recipe.currency={id:'zenless-materials-10',count:0};recipe.feeStatus='user-default';recipe.feeBasis='用户于2026-10-03要求暂设为0；计算设置，非已核实免费。';}
 growth.synthesisNotes=growth.synthesisNotes.map(note=>note.includes('认证章与组件')?'绝区零芯片保留已有合成费用；24条认证章与组件配方按用户设置暂计0丁尼。':note);
 await writeFile(join(root,'data/growth/zenless.json'),JSON.stringify(growth,null,2));
 await writeFile(join(root,'docs/内容补齐执行记录-2026-10-03.json'),JSON.stringify({updatedAt:new Date().toISOString(),backup,growthBackup,dates:changed,zeroFeeRecipes:fees.map(r=>r.id),travelers:Object.keys(travelerData),entryCount:library.all().length},null,2));
 console.log(JSON.stringify({dates:changed.length,zeroFees:fees.length,travelers:Object.keys(travelerData).length,entries:library.all().length}));
}finally{library.close();}
