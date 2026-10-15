// 从已保存的来源模板补充统计分类，仅增加元数据，不重新采集或改写资料文本。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {writeCompressedBackup} from '../lib/backup.mjs';
import {openLibrary} from '../lib/database.mjs';
import {signalSourceType} from '../lib/signal-channels.mjs';
import {wikiText,template,parameters,poolFields,poolNames} from '../lib/wiki-facts.mjs';
const library=openLibrary('data/library/wiki.sqlite'),updates=new Map();
try {
 for(const game of ['genshin','starrail','zenless']){
  const file=JSON.parse(await readFile(`data/sources/${game}/history-pages.json`,'utf8')),pages=file.pages??file.query?.pages??[],byTitle=new Map(pages.map(p=>[p.title,p]));
  const entries=library.all().filter(e=>e.game===game&&e.category==='banners');
  for(const entry of entries){const page=entry.aliases?.map(a=>byTitle.get(a)).find(Boolean);if(!page)throw Error('缺少原始模板: '+entry.id);
   const text=wikiText(page),inf=parameters(template(text,game==='genshin'?'Wish':game==='starrail'?'Warp':'Signal Search Infobox'));
   if(game==='zenless')inf.type=signalSourceType(page.title,inf.type);
   const includeOrdinary=!entry.banner.end&&/Standard|Beginner|Novice|Bangboo|Exclusive|Collaboration|Stable/.test(inf.type??'');
   const permanent=/^(Standard|Beginner|Novice|Bangboo Channel|Stable Channel|Permanent Channel)$/.test(inf.type??''),selection=/Chronicled|Lightrace|Rescreening|Reverberation|Rerun/.test(inf.type??'');
   const mode=permanent?'standard':selection?'selection':'event';
   const fields=Object.entries(poolFields(text,game)).filter(([key,value])=>/^(character|weapon|lightcone|agent|w-engine|bangboo)_/.test(key)&&(/_(?:[345]|[SAB])_F$/.test(key)||includeOrdinary||/Chronicled|Lightrace/.test(inf.type??''))&&poolNames(value).length);
   if(fields.length!==entry.banner.groups.length)throw Error('分组结构不匹配: '+entry.id);
   const groups=entry.banner.groups.map((group,i)=>{const [sourceKey,value]=fields[i],r=sourceKey.match(/_([345SAB])/)[1],rarity=({S:5,A:4,B:3}[r]??Number(r));
    if(group.items.length!==poolNames(value).length||group.items.some(item=>item.rarity!==rarity))throw Error('内容结构不匹配: '+entry.id);
    const role=mode==='selection'&&rarity===5?'selectable':!permanent&&sourceKey.endsWith('_F')?'up':'pool';return {...group,sourceKey,role};
   });
   updates.set(entry.id,{...entry.banner,mode,sourceType:inf.type,groups});
  }
 }
 await mkdir('data/backups',{recursive:true});const backup=`data/backups/wiki-before-banner-stats-${new Date().toISOString().replaceAll(':','-')}.json.gz`;
 await writeCompressedBackup(backup,library.export());
 library.db.exec('BEGIN IMMEDIATE');try{for(const [id,banner]of updates){const old=library.get(id);if(JSON.stringify(old.banner)!==JSON.stringify(banner))library.update(id,{...old,banner},old.revision);}library.db.exec('COMMIT');}catch(error){library.db.exec('ROLLBACK');throw error;}
 for(const game of ['genshin','starrail','zenless']){const path=`data/catalog/${game}.json`,catalog=JSON.parse(await readFile(path,'utf8'));catalog.entries=catalog.entries.map(entry=>updates.has(entry.id)?{...entry,banner:{...entry.banner,...updates.get(entry.id)}}:entry);await writeFile(path,JSON.stringify(catalog,null,2));}
 const report={updatedAt:new Date().toISOString(),count:updates.size,backup,roles:Object.fromEntries(['up','selectable','pool'].map(role=>[role,[...updates.values()].flatMap(b=>b.groups).filter(g=>g.role===role).length]))};await writeFile('data/sources/banner-statistics-metadata.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {library.close();}
