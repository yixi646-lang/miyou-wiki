import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isLocalImage} from '../shared/asset-image.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildArtworkIndex({rootDirectory=root,databasePath=join(rootDirectory,'data/library/wiki.sqlite'),sourceEntries,outputPath=join(rootDirectory,'public/character-artwork-index.json')}={}){
 const root=rootDirectory;
 let entries=sourceEntries?sourceEntries.filter(entry=>entry.category==='characters'):[];
 if(!sourceEntries&&existsSync(databasePath)){
  // 只读取角色图片字段，不初始化或修改正式资料库。
  const database=new DatabaseSync(databasePath,{readOnly:true});
  try{entries=database.prepare("SELECT payload FROM entries WHERE category='characters' ORDER BY id").all().map(row=>JSON.parse(row.payload));}
  finally{database.close();}
 }else if(!sourceEntries)for(const game of ['genshin','starrail','zenless']){
  const catalog=JSON.parse(await readFile(join(root,`data/catalog/${game}.json`),'utf8'));
  entries.push(...catalog.entries.filter(entry=>entry.category==='characters'));
 }
 const extraPath=join(root,'data/character-artwork-variants.json');
 const extraData=existsSync(extraPath)?JSON.parse(await readFile(extraPath,'utf8')):{};
 const extra=extraData.variants??{},galleryEntries=extraData.galleryEntries??[];
 for(const entry of galleryEntries){
  if(entries.some(item=>item.id===entry.id))throw Error(`独立立绘角色编号重复：${entry.id}`);
  entries.push({...entry,galleryOnly:true,details:{artwork:{image:extra[entry.id]?.[0]?.image}}});
 }
 const images={},variants={};
 for(const entry of entries){
  const image=entry.details?.artwork?.image;
  if(!isLocalImage(image))continue;
  await access(join(root,image.slice(1)));images[entry.id]=image;
  const choices=[entry.galleryOnly?{...extra[entry.id][0]}:{key:'main',label:'主立绘',image}],seen=new Set([image]);
  for(const choice of extra[entry.id]??[]){
   if(!/^[a-z0-9-]+$/.test(choice.key??'')||!choice.label||!isLocalImage(choice.image))throw Error(`扩展立绘格式无效：${entry.id}`);
   await access(join(root,choice.image.slice(1)));
   if(seen.has(choice.image))continue;
   if(choices.some(item=>item.key===choice.key))throw Error(`扩展立绘类型重复：${entry.id}`);
   choices.push({key:choice.key,label:choice.label,image:choice.image,...(choice.type==='skin'?{type:'skin'}:{})});seen.add(choice.image);
  }
  if(choices.length>1||entry.galleryOnly)variants[entry.id]=choices;
 }
 await writeFile(outputPath,JSON.stringify({schemaVersion:2,images,variants,galleryEntries},null,2));
 return {characters:Object.keys(images).length,variants:Object.values(variants).reduce((sum,choices)=>sum+choices.length-1,0)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildArtworkIndex()));
