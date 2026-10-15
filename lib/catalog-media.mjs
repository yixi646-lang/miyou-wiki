import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function loadRegisteredMedia(){
 const index=new Map();
 for(const file of ['data/sources/character-artwork-2026-10-03.json','data/sources/zenless/core-material-icons-2026-10-03.json','data/sources/visual-assets-2026-10-04.json']){
  let source;try{source=JSON.parse(await readFile(join(root,file),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  for(const record of source.records??[])if(record.image)index.set(record.id,record);
 }
 return index;
}
export function applyRegisteredMedia(entry,index){
 const record=index.get(entry.id);if(!record)return entry;
 if(entry.category==='characters'&&record.status==='saved'){
  entry.details={...entry.details,artwork:{...entry.details?.artwork,image:record.image,source:{name:record.sourceName,url:record.url}}};
  if(record.avatar){entry.image=record.avatar.image;entry.imageRemote=record.avatar.url;}
 }else if(entry.category==='sets'&&record.parts){
  entry.details={...entry.details,parts:(entry.details?.parts??[]).map(part=>{
   const image=record.parts.find(p=>p.name===part.name&&p.type===part.type);
   return image?{...part,image:image.image,source:{name:image.sourceName,url:image.url}}:part;
  })};
 }else if(entry.category==='materials'){
  entry.image=record.image;entry.imageRemote=record.url;
  if(record.imageFrame)entry.imageFrame={...record.imageFrame};else delete entry.imageFrame;
 }
 const source={name:record.sourceName??(record.status==='standalone'?'BWIKI · 材料独立图标':'Nanoka · 材料首帧'),url:record.sourceUrl??record.url,note:entry.category==='characters'?'角色立绘':entry.category==='sets'?'套装部件图':'核心技强化材料图标'};
 entry.sources??=[];if(!entry.sources.some(s=>s.url===source.url))entry.sources.push(source);
 if(record.avatar&&!entry.sources.some(s=>s.url===record.avatar.url))entry.sources.push({name:record.avatar.sourceName,url:record.avatar.url,note:'角色头像'});
 return entry;
}
