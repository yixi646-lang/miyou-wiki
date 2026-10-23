import {loadMediaRegistry,registeredMediaIndex} from './media-registry.mjs';
export async function loadRegisteredMedia(options){
 return registeredMediaIndex(await loadMediaRegistry(options));
}
export function applyRegisteredMedia(entry,index){
 const record=index.get(entry.id);if(!record)return entry;
 if(entry.category==='characters'&&record.status==='saved'){
  entry.details={...entry.details,artwork:{...entry.details?.artwork,image:record.image,source:{name:record.sourceName,url:record.url}}};
 }else if(entry.category==='sets'&&record.parts){
  entry.details={...entry.details,parts:(entry.details?.parts??[]).map(part=>{
   const image=record.parts.find(p=>p.name===part.name&&p.type===part.type);
   return image?{...part,image:image.image,source:{name:image.sourceName,url:image.url}}:part;
  })};
 }else if(entry.category==='materials'){
  entry.image=record.image;entry.imageRemote=record.url;
  if(record.imageFrame)entry.imageFrame={...record.imageFrame};else delete entry.imageFrame;
 }
 if(entry.category==='characters'&&record.avatar){entry.image=record.avatar.image;entry.imageRemote=record.avatar.derived?null:record.avatar.url;}
 const source={name:record.sourceName??(record.status==='standalone'?'BWIKI · 材料独立图标':'Nanoka · 材料首帧'),url:record.sourceUrl??record.url,note:entry.category==='characters'?'角色立绘':entry.category==='sets'?'套装部件图':'核心技强化材料图标'};
 entry.sources??=[];if(source.url&&!entry.sources.some(s=>s.url===source.url))entry.sources.push(source);
 if(record.avatar&&!entry.sources.some(s=>s.url===record.avatar.url))entry.sources.push({name:record.avatar.sourceName,url:record.avatar.url,note:record.avatar.derived?'临时头像：基于官方头像制作，非游戏原生透明素材':'角色头像'});
 return entry;
}
