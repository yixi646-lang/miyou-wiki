import{readFile,writeFile}from'node:fs/promises';
import{openLibrary}from'../lib/database.mjs';
import{genshinTalentLevels,plain}from'../lib/normalize.mjs';
import{fileURLToPath}from'node:url';
import{join}from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(await readFile(join(root,'data/catalog/genshin.json'),'utf8'));
const raw=JSON.parse(await readFile(join(root,'data/sources/genshin/talents.json'),'utf8'));
const library=openLibrary(join(root,'data/library/wiki.sqlite'));let changed=0;
try{for(const entry of catalog.entries){if(entry.category!=='characters')continue;const previous=JSON.stringify(entry),slug=entry.aliases.find(key=>raw.data.ChineseSimplified.talents[key]);if(!slug)continue;
  for(const[key,skill]of Object.entries(raw.data.ChineseSimplified.talents[slug])){if(!skill?.name)continue;const target=entry.details.skills.find(s=>s.name===plain(skill.name));if(!target)continue;const levels=genshinTalentLevels(skill,raw.stats.talents[slug]?.[key]);if(levels.length)target.levels=levels;}
  if(previous!==JSON.stringify(entry)){const current=library.get(entry.id);const{revision,updatedAt,...original}=current??{};if(current?.origin==='snapshot'&&JSON.stringify(original)===previous){library.update(entry.id,entry,revision);changed++;}}
}await writeFile(join(root,'data/catalog/genshin.json'),JSON.stringify(catalog,null,2));console.log('补充技能等级数值',changed);}finally{library.close();}
