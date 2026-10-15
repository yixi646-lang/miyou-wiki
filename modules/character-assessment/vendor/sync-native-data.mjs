// 原生计算资料与中文索引同步，不依赖已退出运行的 GO 网页素材。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SLOT_NAMES} from '../core/model.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export function setPartImages(entry){
  return Object.fromEntries(Object.entries(SLOT_NAMES).flatMap(([slot,type])=>{
    const part=entry?.details?.parts?.find(p=>p.type===type);
    return part?.image?[[slot,{name:part.name??type,image:part.image}]]:[];
  }));
}
function merge(target,source,replace=false){
  for(const [key,value] of Object.entries(source)){
    if(value&&typeof value==='object'&&!Array.isArray(value)){
      if(!target[key]||typeof target[key]!=='object'||Array.isArray(target[key]))target[key]={};
      merge(target[key],value,replace);
    }else if(replace||target[key]===undefined)target[key]=value;
  }
  return target;
}
export function syncNativeData({sourceDirectory,outputDirectory,wikiEntries}){
  const dict=read(path.join(directory,'../core/zh.json'));
  for(const group of ['dm-localization','localization']){
    const locale=path.join(sourceDirectory,`libs/gi/${group}/assets/locales/chs`);
    if(!fs.existsSync(locale))continue;
    for(const file of fs.readdirSync(locale).filter(f=>f.endsWith('.json'))){
      const namespace=file.slice(0,-5);
      // 游戏生成文本随版本更新；手工中文保留本地补译，并补充上游新字段。
      dict[namespace]=merge(dict[namespace]??{},read(path.join(locale,file)),group==='dm-localization');
    }
  }
  merge(dict,read(path.join(directory,'zh-patches.json')),true);
  // 按固定源码的英文机制标签及游戏生成中文原文补译；不改动任何数值节点。
  for(const [identifier,text]of Object.entries(read(path.join(directory,'mechanic-zh.json')))){
    const [namespace,key]=identifier.split(':'),keys=key.split('.');let target=dict[namespace]??={};
    for(const part of keys.slice(0,-1))target=target[part]??={};
    target[keys.at(-1)]=text;
  }
  const stats=read(path.join(sourceDirectory,'libs/gi/stats/src/allStat_gen.json'));
  const wiki=wikiEntries??read(path.join(directory,'../../../data/catalog/genshin.json')).entries;
  const rows={characters:{},weapons:{},sets:{}};
  const entryFor=(name,category)=>wiki.find(e=>e.name===name&&e.category===category);
  for(const [key,name] of Object.entries(dict.charNames_gen)){
    if(key==='Somnia'||key==='Traveler'||/^Traveler[MF]$/.test(key))continue;
    const traveler=key.match(/^Traveler(Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)([MF])$/);
    const source=stats.char.data[key]??(traveler?stats.char.data.Traveler:undefined);
    if(!source)continue;
    const entry=entryFor(traveler?(traveler[2]==='M'?'空':'荧'):name,'characters');
    rows.characters[key]={name,element:traveler?traveler[1].toLowerCase():source.ele,weaponType:source.weaponType,rarity:source.rarity,wikiId:entry?.id??null,image:entry?.image??null,aliases:entry?.aliases??[],sourceId:entry?.sourceId??null,releaseVersion:entry?.releaseVersion??null,releaseDate:entry?.releaseDate??null};
  }
  for(const [key,name] of Object.entries(dict.weaponNames_gen)){
    const source=stats.weapon.data[key];if(!source)continue;
    const entry=entryFor(name,'weapons');rows.weapons[key]={name,weaponType:source.weaponType,rarity:source.rarity,wikiId:entry?.id??null,image:entry?.image??null,aliases:entry?.aliases??[]};
  }
  for(const [key,name] of Object.entries(dict.artifactNames_gen)){
    if(!stats.art.data[key])continue;
    const entry=entryFor(name,'sets');rows.sets[key]={name,wikiId:entry?.id??null,image:entry?.image??null,parts:setPartImages(entry),sourceId:entry?.sourceId??null,releaseVersion:entry?.releaseVersion??null,releaseDate:entry?.releaseDate??null};
  }
  fs.mkdirSync(outputDirectory,{recursive:true});
  fs.writeFileSync(path.join(outputDirectory,'zh.json'),JSON.stringify(dict));
  fs.writeFileSync(path.join(outputDirectory,'catalog.json'),JSON.stringify(rows));
  return rows;
}
