import {readFile,writeFile} from 'node:fs/promises';
import {wikiText,template,parameters,factKey} from '../lib/wiki-facts.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const gi=await read('data/sources/genshin/crafts.json'),materials=await read('data/sources/genshin/materials.json');
const report={};
for(const game of ['genshin','starrail','zenless']){
 const path=`data/growth/${game}.json`,data=await read(path),recipes={};
 const add=(id,input,currency,source)=>{if(data.materials[id]&&data.materials[input.id])recipes[id]={id,outputCount:1,inputs:[input],...(currency?{currency}:{}),source};};
 if(game==='genshin'){
  for(const [key,recipe]of Object.entries(gi.data.ChineseSimplified.crafts)){
   const output=materials.data.ChineseSimplified.materials[key];if(!output||recipe.resultCount!==1||recipe.recipe.length!==1||recipe.recipe[0].count!==3)continue;
   add(`genshin-materials-${output.id}`,{id:`genshin-materials-${recipe.recipe[0].id}`,count:3},{id:'genshin-materials-202',count:recipe.moraCost},{name:'genshin-db · 合成配方',url:gi.url});
  }
 }else if(game==='starrail'){
  const cache=await read('data/sources/starrail/synthesis-material-pages.json'),byName=new Map(cache.pages.filter(p=>p.revisions).map(p=>[factKey(p.title),parameters(template(wikiText(p),'Item Infobox')).id]));
  for(const page of cache.pages){const text=wikiText(page),inf=parameters(template(text,'Item Infobox')),recipe=Object.fromEntries([...template(text,'Recipe').matchAll(/^\|\s*([^=\n]+?)\s*=[ \t]*([^\n]*)/gm)].map(([,key,value])=>[key.trim(),value.trim()]));if(recipe.type!=='Synthesis'||recipe.group!=='Material')continue;
   const inputs=Object.entries(recipe).filter(([key])=>!['type','group','count','result','result_count'].includes(key)).map(([name,count])=>({id:`starrail-materials-${byName.get(factKey(name))}`,count:Number(count)}));
   if(inputs.length!==1||inputs[0].count!==3)continue;
   add(`starrail-materials-${inf.id}`,inputs[0],null,{name:'Star Rail Wiki · '+page.title,url:'https://honkai-star-rail.fandom.com/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_'))});
  }
 }else{
  const cache=await read('data/sources/zenless/growth-material-pages.json'),byName=new Map(cache.pages.filter(p=>p.revisions).map(p=>[factKey(p.title),parameters(template(wikiText(p),'Item Infobox')).id]));
  for(const page of cache.pages){const family=parameters(template(wikiText(page),'Craft & Dismantle'));if(!family.item_1||!family.item_2||!family.item_3)continue;for(const tier of [2,3]){
   const id=byName.get(factKey(family['item_'+tier])),inputId=byName.get(factKey(family['item_'+(tier-1)]));
   if(id&&inputId){const chip=/Chip$/.test(family['item_'+tier]);add(`zenless-materials-${id}`,{id:`zenless-materials-${inputId}`,count:3},chip?{id:'zenless-materials-10',count:tier===2?100:300}:{id:'zenless-materials-10',count:0},{name:'ZZZ Wiki · 材料合成'+(chip?'；GameVika · 芯片合成费用':''),url:'https://zenless-zone-zero.fandom.com/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_')),...(chip?{feeUrl:'https://gamevika.com/en/zzz/wiki/skill-priority'}:{})});if(recipes[`zenless-materials-${id}`]&&!chip){recipes[`zenless-materials-${id}`].feeStatus='user-default';recipes[`zenless-materials-${id}`].feeBasis='用户于2026-10-03要求暂设为0；计算设置，非已核实免费。';}}
  }}
 }
 data.recipes=recipes;data.synthesisNotes=['按确定的同系列低阶 → 高阶配方计算，保留各阶直接养成需求后使用富余材料；支持连续合成。','已确认的合成货币费用加入货币需求。此为养成计划换算，可补充货币后执行合成；未计随机返还或额外产出。',...(game==='zenless'?['绝区零芯片保留已有合成费用；认证章与组件配方按用户设置暂计0丁尼。']:[])];
 await writeFile(path,JSON.stringify(data,null,2));report[game]={recipes:Object.keys(recipes).length};
}
await writeFile('data/sources/synthesis-update.json',JSON.stringify({updatedAt:new Date().toISOString(),games:report},null,2));console.log(JSON.stringify(report));
