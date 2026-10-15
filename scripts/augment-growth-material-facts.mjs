import {readFile,writeFile} from 'node:fs/promises';
import {openLibrary} from '../lib/database.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const gi=await read('data/sources/genshin/materials.json'),sr=await read('data/sources/starrail/items.json');
const giMap=Object.fromEntries(Object.values(gi.data.ChineseSimplified.materials).map(i=>[i.id,i]));
const library=openLibrary('data/library/wiki.sqlite');const updates=[];
for(const old of library.all().filter(e=>e.category==='materials'&&e.origin==='snapshot')){
 const e=structuredClone(old),a=e.applicability;if(!a)continue;
 if(e.game==='genshin'){
  const raw=giMap[e.sourceId];if(raw?.dropDomainName){const text=`${raw.dropDomainName}${raw.daysOfWeek?.length?'（'+raw.daysOfWeek.join(' / ')+'）':''}`;e.details.acquisition=[...new Set([text,...(e.details.acquisition??[])])];e.details.facts.获取秘境=raw.dropDomainName;if(raw.daysOfWeek?.length)e.details.facts.开放日期=raw.daysOfWeek.join(' / ');}
 }else if(e.game==='starrail'){
  const map={Virtual:'通用货币',AvatarExp:'角色经验素材',EquipmentExp:'光锥经验素材',TracePathMaterial:'行迹素材',AvatarPromotionMaterial:'角色晋阶素材',TraceMaterial:'行迹素材',CommonMonsterDrop:'角色与光锥通用材料'};
  e.kind=map[sr[e.sourceId]?.sub_type]??(a.purposes.includes('行迹升级')?'行迹与晋阶材料':e.kind);
 }else{
  if(e.sourceId==='10'){a.purposes=a.purposes.filter(t=>t!=='等级经验');e.details.facts.用途=a.purposes.join('、');e.details.summary='用于代理人晋升、音擎改造、技能升级和核心技强化。';}
  e.kind=e.sourceId==='10'?'通用货币':e.name.includes('认证章')?'代理人晋升材料':e.name.includes('组件')?'音擎改造材料':e.name.includes('芯片')?'技能芯片':a.purposes.includes('核心技强化')?'核心技强化材料':e.name.includes('仓鼠笼')?'技能高级素材':a.purposes.includes('等级经验')?'经验素材':e.kind;
 }
 if(JSON.stringify(e)!==JSON.stringify(old))updates.push(e);
}
library.db.exec('BEGIN IMMEDIATE');try{for(const e of updates)library.update(e.id,e,e.revision);library.db.exec('COMMIT');}catch(e){library.db.exec('ROLLBACK');throw e;}
for(const game of ['genshin','starrail','zenless']){const path=`data/catalog/${game}.json`,c=await read(path);for(const e of updates.filter(e=>e.game===game)){const i=c.entries.findIndex(t=>t.id===e.id);if(i>=0&&c.entries[i].origin==='snapshot'){const clean=structuredClone(e);delete clean.revision;delete clean.updatedAt;c.entries[i]=clean;}}await writeFile(path,JSON.stringify(c,null,2));}
library.close();console.log('补充秘境、开放日期和材料分类',updates.length);
