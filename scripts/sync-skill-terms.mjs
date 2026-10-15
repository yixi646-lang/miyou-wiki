import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {plain,hsrDescription} from '../lib/normalize.mjs';
import {resolveTermMarkup,resolveGenshinExplanation,normalizeSkillTerm} from '../shared/skill-terms.mjs';
import {acquisitionChannels} from '../shared/acquisition-channels.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const cachePath='data/sources/starrail/skill-explanations-4.6.json';
let cache;try{cache=await read(cachePath);}catch(error){if(error.code!=='ENOENT')throw error;cache={version:'4.6',characters:{}};}
const output={schemaVersion:1,characters:{}},failures=[];
const catalog=await read('data/catalog/starrail.json');
const jobs=catalog.entries.filter(e=>e.category==='characters');let cursor=0;
// 只保存名词解释所需字段，避免为这次补充再复制完整角色资料。
await Promise.all(Array.from({length:5},async()=>{
  while(cursor<jobs.length){const entry=jobs[cursor++],id=entry.sourceId;
    try{
      if(!cache.characters[id]){
        const url=`https://static.nanoka.cc/hsr/4.6/zh/character/${id}.json`;
        const response=await fetch(url,{signal:AbortSignal.timeout(18000)});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const raw=await response.json(),records=[];
        function collect(node){if(!node||typeof node!=='object')return;
          if(node.name&&node.extra&&typeof node.extra==='object'&&Object.keys(node.extra).length)records.push({name:plain(node.name),extra:node.extra});
          for(const [key,value] of Object.entries(node))if(key!=='extra')collect(value);
        }
        for(const key of ['skills','skill_trees','memosprite','unique','enhanced'])collect(raw[key]);
        cache.characters[id]={url,records};
      }
      const raw=cache.characters[id],skills={};
      for(const record of raw.records){const terms=Object.values(record.extra).filter(t=>t.name&&t.desc).map(t=>({name:plain(t.name),description:hsrDescription(t.desc,t.param??[])})).filter(t=>!t.description.includes('〔数值未收录〕'));
        if(terms.length)skills[record.name]=[...(skills[record.name]??[]),...terms];
      }
      if(Object.keys(skills).length)output.characters[entry.id]={source:{name:'Nanoka · 技能名词解释',url:raw.url,note:'正式版角色技能、行迹的 extra 原文；仅补充解释，不替换技能正文'},skills};
    }catch(error){failures.push({id,name:entry.name,error:error.message});}
  }
}));
await writeFile(join(root,cachePath),JSON.stringify(cache));
const genericNames=new Set(['基础概率','固定概率','抗性穿透','追加攻击','反击','行动提前','行动延后','附加伤害','负面效果','增益效果','额外回合','无法战斗状态','控制类负面状态','弱点击破状态','击破伤害','超击破伤害','真实伤害','分摊','持续效果','离场','召唤忆灵','连携攻击']);
const generic=new Map();
for(const data of Object.values(output.characters))for(const term of Object.values(data.skills).flat())if(genericNames.has(term.name)&&!generic.has(term.name))generic.set(term.name,{...term,source:data.source});
const curated=await read('data/sources/common-skill-terms.json');
output.common={...curated.games,starrail:[...generic.values()]};
const hyperlinks=await read('data/sources/genshin/skill-hyperlink-7.1.json'),hyperlinkParams=await read('data/sources/genshin/skill-hyperlinkparam-7.1.json');
const giTerms=new Map(Object.entries(hyperlinks).filter(([,term])=>term.name&&term.desc).map(([id,term])=>[id,{name:plain(term.name),description:plain(resolveGenshinExplanation(term.desc,hyperlinkParams))}]));
const giTalents=(await read('data/sources/genshin/talents.json')).data.ChineseSimplified.talents;
const giConstellations=(await read('data/sources/genshin/constellations.json')).data.ChineseSimplified.constellations;
for(const entry of (await read('data/catalog/genshin.json')).entries.filter(e=>e.category==='characters')){
  const groups=[entry.details,...Object.values(entry.details.traveler?.elements??{})],names=new Set(groups.flatMap(group=>[...(group.skills??[]),...(group.upgrades??[])].map(s=>s.name)));
  const data={source:{name:'Nanoka · 原神技能名词目录',url:'https://static.nanoka.cc/gi/7.1/zh/hyperlink.json',note:'LINK#N 的独立名词解释；PARAM 引用按同版本 hyperlinkparam 解析'},skills:{}};
  for(const records of [giTalents,giConstellations])for(const raw of Object.values(records)){
    if(![entry.name,...entry.aliases].includes(raw.name)&&!entry.details.traveler)continue;
    for(const skill of Object.values(raw)){if(!skill?.name||!names.has(plain(skill.name)))continue;
      const terms=new Map();
      for(const match of String(skill.descriptionRaw??'').matchAll(/\{LINK#N(\d+)\}([\s\S]*?)\{\/LINK\}/g)){
        const term=giTerms.get(match[1]);if(!term){failures.push({name:entry.name,skill:skill.name,noun:match[1],error:'名词原文缺失'});continue;}
        const name=plain(match[2]).replace(/^[「“"【〖\[]|[」”"】〗\]]$/g,'');
        terms.set(name,{...term,name});
      }
      if(terms.size)data.skills[plain(skill.name)]=[...terms.values()];
    }
  }
  if(Object.keys(data.skills).length)output.characters[entry.id]=data;
}
const nounPath='data/sources/zenless/skill-term-index-3.2.json';
let nouns;try{nouns=await read(nounPath);}catch(error){if(error.code!=='ENOENT')throw error;const response=await fetch('https://static.nanoka.cc/zzz/3.2/zh/noun.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('名词目录获取失败');nouns=await response.json();await writeFile(join(root,nounPath),JSON.stringify(nouns));}
const nounSource={name:'Nanoka · 绝区零名词目录',url:'https://static.nanoka.cc/zzz/3.2/zh/noun.json',note:'正式版 noun 原文及 Term 编号对应关系'};
output.common.zenless=Object.values(nouns).filter(n=>n.desc).map(n=>normalizeSkillTerm({name:plain(n.title)||plain(n.name),description:plain(resolveTermMarkup(n.desc,nouns)),source:nounSource})).filter(Boolean);
for(const entry of (await read('data/catalog/zenless.json')).entries.filter(e=>e.category==='characters')){
  const raw=await read(`data/sources/zenless/characters/${entry.sourceId}.json`),special=raw.special_element_type;
  const data={source:{name:'Nanoka · 技能名词解释',url:`https://static.nanoka.cc/zzz/3.2/zh/character/${entry.sourceId}.json`,note:'正式版特殊属性说明及 Term 名称还原'},skills:{},textRepairs:{}};
  function collectRepairs(node){if(!node||typeof node!=='object')return;for(const value of Object.values(node))if(typeof value==='string'&&/<Term:\d+>/.test(value)){const before=plain(value),after=plain(resolveTermMarkup(value,nouns));if(before!==after)data.textRepairs[before]=after;}else if(value&&typeof value==='object')collectRepairs(value);}
  for(const key of ['skill','passive','talent'])collectRepairs(raw[key]);
  if(special?.name&&special.desc){const term={name:plain(special.name),description:plain(special.desc)},skills={};
    for(const skill of entry.details.skills??[])if(skill.description.includes(term.name))skills[skill.name]=[term];
    data.skills=skills;
  }
  if(Object.keys(data.skills).length||Object.keys(data.textRepairs).length)output.characters[entry.id]=data;
}
output.failures=failures;
await writeFile(join(root,'shared/skill-term-data.json'),JSON.stringify(output));
const channels={};
for(const game of ['genshin','starrail','zenless'])for(const entry of (await read(`data/catalog/${game}.json`)).entries)if(entry.category==='weapons')channels[entry.id]=acquisitionChannels(entry);
await writeFile(join(root,'shared/weapon-channel-data.json'),JSON.stringify(channels));
console.log(JSON.stringify({characters:Object.keys(output.characters).length,skills:Object.values(output.characters).reduce((n,e)=>n+Object.keys(e.skills).length,0),failures}));
if(failures.length)process.exitCode=1;
