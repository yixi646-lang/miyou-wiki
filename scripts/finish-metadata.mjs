import {readFile,writeFile}from'node:fs/promises';
import{openLibrary}from'../lib/database.mjs';
import{fileURLToPath}from'node:url';
import{join}from'node:path';
import{normalizeDate,plain}from'../lib/normalize.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const library=openLibrary(join(root,'data/library/wiki.sqlite'));let modified=0;
try{for(const game of ['starrail','zenless']){
  const catalog=await read(`data/catalog/${game}.json`);
  const semantic=game==='starrail'?(await read('data/sources/starrail/bwiki-category-角色.json')).query.results:null;
  for(const entry of catalog.entries){
    const previous=JSON.stringify(entry);
    if(game==='zenless'&&entry.category==='characters'){
      const raw=await read(`data/sources/zenless/characters/${entry.sourceId}.json`);
      const names=value=>value&&typeof value==='object'?plain(value.name??Object.values(value)[0]):value?plain(value):'';
      entry.element=names(raw.special_element_type)||names(raw.element_type);
      entry.details.facts.伤害类型=names(raw.hit_type);
    }
    if(game==='starrail'&&entry.category==='characters'&&(entry.name.startsWith('三月七')||entry.name.startsWith('开拓者'))){
      const title=`${entry.name.startsWith('三月七')?'三月七':'开拓者'}•${entry.type}`;
      const item=semantic[title];if(item){entry.releaseVersion=item.printouts['实装版本']?.[0]??entry.releaseVersion;entry.releaseDate=normalizeDate(item.printouts['实装日期']?.[0])??entry.releaseDate;entry.region=item.printouts['阵营']?.[0]??entry.region;entry.aliases=[...new Set([...entry.aliases,title])];if(!entry.sources.some(s=>s.url===item.fullurl))entry.sources.push({name:`BWIKI · ${title}`,url:item.fullurl,note:'角色变体的实装版本与日期'});}
    }
    if(previous!==JSON.stringify(entry)){
      const current=library.get(entry.id);
      if(current?.origin==='snapshot'&&current.revision===2){library.update(entry.id,entry,current.revision);modified++;}
      else console.log('保留本地修改：',entry.id);
    }
  }
  await writeFile(join(root,'data/catalog',`${game}.json`),JSON.stringify(catalog,null,2));
}console.log('修订初始化资料',modified);}finally{library.close();}
