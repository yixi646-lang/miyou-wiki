import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {isExcludedEntry} from '../shared/catalog.mjs';

export async function auditLibrary({root,entries}){
 const included=entries.filter(e=>!isExcludedEntry(e)),ids=new Set(included.map(e=>e.id)),issues=[],seen=new Set();
 const add=(entry,type,field,value,evidence='')=>{const key=[entry.id,type,field,String(value)].join('|');if(seen.has(key))return;seen.add(key);issues.push({id:entry.id,name:entry.name,game:entry.game,category:entry.category,type,field,value:value??'未填写',evidence});};
 const checkImage=(entry,path,value)=>{if(typeof value!=='string'||!value.startsWith('/assets/'))return;const target=resolve(root,'.'+value);if(!target.startsWith(resolve(root,'assets')+sep)||!existsSync(target))add(entry,'图片缺失',path,value,'本地图片路径不存在');};
 const walk=(entry,value,path='details')=>{if(typeof value==='string'){checkImage(entry,path,value);if(['待核查','待确认','unverified','unknown'].includes(value))add(entry,'待核查',path,value,'资料中已明确标记');}else if(Array.isArray(value))value.forEach((v,i)=>walk(entry,v,`${path}[${i}]`));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(/^(?:conflicts|sourceConflicts)$/i.test(k)&&v&&(Array.isArray(v)?v.length:Object.keys(v).length))add(entry,'来源冲突',path+'.'+k,JSON.stringify(v),'已有冲突记录，需逐项核对来源');walk(entry,v,path+'.'+k);}};
 for(const entry of included){
  for(const field of ['image','details'])walk(entry,entry[field],field);
  if(['characters','weapons','sets'].includes(entry.category))for(const field of ['rarity','releaseVersion'])if(!entry[field])add(entry,'字段缺失',field,null,'角色或装备基础字段');
  if(entry.category==='characters'&&!entry.element)add(entry,'字段缺失','element',null,'角色元素 / 属性未录入');
  if(['characters','weapons','sets'].includes(entry.category)&&!entry.releaseDate)add(entry,'待核查','releaseDate',null,'缺少首次可获取日期，不能用版本日期代替');
  for(const id of entry.signatureIds??[])if(!ids.has(id))add(entry,'关联缺失','signatureIds',id,'对应角色编号不存在');
  for(const [i,group]of (entry.banner?.groups??[]).entries())for(const id of [...(group.entryIds??group.ids??[]),...(group.items??[]).map(i=>i.id).filter(Boolean)])if(!ids.has(id))add(entry,'关联缺失',`banner.groups[${i}]`,id,'卡池关联编号不存在');
  walk(entry,entry.releaseDateEvidence,'releaseDateEvidence');for(const group of entry.details?.materials??[])for(const item of group.items??[])if(item.id&&!ids.has(item.id))add(entry,'关联缺失','details.materials',item.id,'养成材料编号不存在');
  for(const [field,value]of Object.entries(entry))if(/status|confidence|verification|conflicts/i.test(field))walk(entry,value,field);
 }
 const read=async path=>{
  let source;
  try{source=await readFile(join(root,path),'utf8');}catch(error){if(error.code==='ENOENT')return null;throw new Error(`无法读取资料文件：${path}（${error.message}）`,{cause:error});}
  try{return JSON.parse(source.replace(/^\uFEFF/,''));}catch(error){throw new Error(`资料文件格式错误：${path}，请检查 JSON 内容。`,{cause:error});}
 };
 const [catalog,stats,upstream,scanner]=await Promise.all([read('modules/character-assessment/core/catalog.json'),read('modules/character-assessment/core/game-stats.json'),read('modules/character-assessment/upstream.json'),read('原神库存扫描器/中文界面预览/界面修改来源.json')]);
 const supported=new Set([['characters','char'],['weapons','weapon'],['sets','art']].flatMap(([kind,type])=>Object.entries(catalog?.[kind]??{}).filter(([key])=>stats?.[type]?.data?.[key]||kind==='characters'&&key.startsWith('Traveler')&&stats?.char?.data?.Traveler).map(([,meta])=>meta.wikiId)));
 const missingCore=included.filter(e=>e.game==='genshin'&&['characters','weapons','sets'].includes(e.category)&&!supported.has(e.id));
 for(const e of missingCore)add(e,'计算覆盖','wikiId',e.id,'百科已收录，当前计算资料未关联此条目');
 let scannerVersion=null;for(const file of ['version.json','versions.json','version.txt']){try{scannerVersion=(await readFile(join(root,'原神库存扫描器/中文界面预览/inventorylists',file),'utf8')).trim();break;}catch(error){if(error.code!=='ENOENT')throw error;}}
 const userDefaults=[];for(const game of ['genshin','starrail','zenless']){const growth=await read(`data/growth/${game}.json`);const collect=(v,path)=>{if(v&&typeof v==='object'){if(v.feeStatus==='user-default')userDefaults.push({game,field:path,value:v.fee??v.currency??0,evidence:v.feeBasis??v.feeNote??'用户指定的默认值，未宣称核实免费'});for(const[k,n]of Object.entries(v))collect(n,path+'.'+k);}};collect(growth,'growth');}
 const versions=Object.fromEntries(['genshin','starrail','zenless'].map(game=>[game,[...new Set(included.filter(e=>e.game===game).map(e=>e.releaseVersion).filter(Boolean))].sort((a,b)=>b.localeCompare(a,'en',{numeric:true}))[0]??'未标注']));
 return{checkedAt:new Date().toISOString(),entries:included.length,issues,userDefaults,coverage:{wiki:versions,core:{version:upstream?.version??'未安装',commit:upstream?.sourceCommit??'',counts:upstream?.coverage??{},missing:missingCore.length},scanner:{build:scanner?.build??'未安装',version:scannerVersion??'未标注',scope:'仅原神；版本以本地识别库记录为准'}}};
}
