import {categoryLabel,isExcludedEntry} from './catalog.mjs';
import {isLocalImage} from './asset-image.mjs';

export const SEARCH_TYPES={all:'全部',characters:'角色',weapons:'武器类装备',sets:'套装类装备',materials:'材料',banners:'历史卡池',versions:'版本档案',artwork:'立绘'};
export const SEARCH_SORTS={relevance:'相关度',name:'名称',release:'登场时间',rarity:'稀有度'};
const collator=new Intl.Collator('zh-Hans-CN',{numeric:true,sensitivity:'base'});
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase();
const textOf=value=>Array.isArray(value)?value.map(textOf).join(' '):value&&typeof value==='object'?Object.values(value).map(textOf).join(' '):String(value??'');
const link=(game,params)=>'/?'+new URLSearchParams({game,...params});
const versionText=v=>textOf([v.version,v.title,v.alias,v.releaseDate,v.sections?.map(s=>[s.label,s.items]),v.maintenance]);

export function buildSearchDocuments({game,entries=[],versions=[],artwork={}}){
 const documents=entries.filter(e=>e.game===game&&!isExcludedEntry(e)).map(e=>({
  type:'entries',category:e.category,game,id:e.id,title:e.name,aliases:e.aliases??[],rarity:e.rarity??null,
  label:categoryLabel(game,e.category),href:link(game,{entry:e.id}),
  description:textOf([e.element,e.type,e.region,e.kind,e.secondary,e.releaseVersion,e.tags,e.acquisitionChannels,e.banner?.groups?.map(group=>group.items?.map(item=>item.name))]),
  date:e.banner?.start??e.releaseDate??''
 }));
 for(const v of versions){
  documents.push({type:'versions',category:'versions',game,id:v.version,title:[v.alias??v.version,v.title].filter(Boolean).join(' · '),aliases:[v.version,v.alias].filter(Boolean),label:'版本档案',href:link(game,{screen:'versions',version:v.version}),description:versionText(v),sections:v.sections??[],date:v.releaseDate??'',rarity:null});
 }
 const characters=new Map([...entries,...artwork.entries??artwork.galleryEntries??[]].filter(e=>e.game===game&&e.category==='characters'&&!isExcludedEntry(e)).map(e=>[e.id,e]));
 for(const e of characters.values()){
  const image=artwork.images?.[e.id],choices=[],seenImages=new Set(),seenKeys=new Set();
  if(isLocalImage(image))choices.push(artwork.variants?.[e.id]?.find(c=>c.image===image)??{key:'main',label:'主立绘',image});
  choices.push(...artwork.variants?.[e.id]??[]);
  for(const c of choices){
   if(!isLocalImage(c.image)||seenImages.has(c.image)||seenKeys.has(c.key))continue;
   seenImages.add(c.image);seenKeys.add(c.key);
   documents.push({type:'artwork',category:'artwork',game,id:e.id+':'+c.key,entryId:e.id,variantKey:c.key,title:e.name+' · '+c.label,aliases:[e.name,...e.aliases??[],c.label],label:c.type==='skin'?'皮肤立绘':'角色立绘',href:link(game,{screen:'artwork',q:e.name,artwork:e.id,variant:c.key}),description:textOf([e.element,e.rarity,c.label]),date:e.releaseDate??'',rarity:e.rarity??null});
  }
 }
 return documents;
}
export function searchDocuments(documents,query,{type='all',sort='relevance',direction='desc'}={}){
 const needle=normalize(query).trim(),terms=needle.split(/\s+/).filter(Boolean);
 if(!terms.length)return [];
 return documents.flatMap(doc=>{
  if(type!=='all'&&doc.type!==type&&doc.category!==type)return [];
  const name=normalize(doc.title),aliases=doc.aliases.map(normalize),text=normalize([doc.title,...doc.aliases,doc.label,doc.description].join(' '));
  if(!terms.every(term=>text.includes(term)))return [];
  const score=name===needle||aliases.includes(needle)?100:name.startsWith(needle)?80:name.includes(needle)?60:terms.every(term=>[name,...aliases].some(a=>a.includes(term)))?40:10;
  const section=doc.sections?.find(s=>terms.every(term=>normalize(textOf([s.label,s.items])).includes(term)));
  const source=section?textOf([section.label,section.items]):doc.description;
  const pos=Math.min(...terms.map(term=>normalize(source).indexOf(term)).filter(n=>n>=0)),start=Number.isFinite(pos)?Math.max(0,pos-30):0;
  const excerpt=(start?'…':'')+source.slice(start,start+150)+(source.length>start+150?'…':'');
  return [{...doc,score,excerpt,href:doc.href+(section?'#version-'+encodeURIComponent(section.key):'')}];
 }).sort((a,b)=>{
  const factor=direction==='asc'?1:-1;
  const compare=(av,bv)=>{const missing=v=>v===undefined||v===null||v==='';if(missing(av)!==missing(bv))return missing(av)?1:-1;return (typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av??''),String(bv??'')))*factor;};
  const primary=sort==='name'?compare(a.title,b.title):sort==='release'?compare(a.date,b.date):sort==='rarity'?compare(a.rarity,b.rarity):compare(a.score,b.score);
  return primary||Boolean(b.date)-Boolean(a.date)||collator.compare(b.date,a.date)||collator.compare(a.title,b.title)||collator.compare(a.game,b.game)||collator.compare(a.id,b.id);
 });
}

export function groupSearchResults(results){
 const groups=[];
 for(const category of Object.keys(SEARCH_TYPES).filter(key=>key!=='all')){
  for(const game of ['genshin','starrail','zenless']){
   const matches=results.filter(r=>r.category===category&&r.game===game);if(!matches.length)continue;
   if(category==='artwork'){
    const entries=new Map();for(const match of matches){if(!entries.has(match.entryId))entries.set(match.entryId,{...match,matches:[]});entries.get(match.entryId).matches.push(match);}
    groups.push({category,game,matches,items:[...entries.values()]});
   }else groups.push({category,game,matches,items:matches});
  }
 }
 return groups;
}
