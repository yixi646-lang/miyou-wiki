const quotes=/「([^」\n]{1,40})」|【([^】\n]{1,40})】|\[([^\]\n]{1,40})\]|〖([^〗\n]{1,40})〗|“([^”\n]{1,40})”|"([^"\n]{1,40})"|\*\*([^*\n]{1,40})\*\*/g;
const cleanName=value=>String(value??'').replace(/\*\*/g,'').trim();
const termName=value=>cleanName(value).replace(/[\u200b-\u200d\u2060\ufeff]/g,'').replace(/^[「“"【〖\[]|[」”"】〗\]]$/g,'').trim();
const textAt=(skill,level)=>skill.levels?.find(row=>row.level===level)?.description??skill.description??'';

export function normalizeSkillTerm(term){
  if(!term||typeof term.name!=='string'||typeof term.description!=='string')return null;
  const name=termName(term.name),description=term.description.trim();
  if(!name||!cleanName(description).replace(/[\u200b-\u200d\u2060\ufeff]/g,'').trim())return null;
  return {...term,name,description};
}

const validTerms=terms=>(Array.isArray(terms)?terms:[]).map(normalizeSkillTerm).filter(Boolean);

export function resolveTermMarkup(value,nouns={}) {
  return String(value??'').replace(/<Term:(\d+)>([\s\S]*?)(?:<\/Term>|<\\Term>)/gi,(_,id,label)=>label||nouns[id]?.name||`〔名词 ${id} 待补充〕`)
    .replace(/<Term:(\d+)>/gi,(_,id)=>nouns[id]?.name||`〔名词 ${id} 待补充〕`);
}

export function resolveGenshinExplanation(value,params={}){
  return String(value??'').replace(/\{PARAM#P(\d+)\|(\d+)S(\d+)\}/g,(_,id,position,scale)=>{
    const number=params[id]?.[Number(position)-1];
    if(!Number.isFinite(number))throw Error(`原神名词参数缺失：${id}/${position}`);
    return String(Number((number*Number(scale)).toFixed(8)));
  }).replace(/\{LINK#[^}]+\}|\{\/LINK\}/g,'');
}

// 从角色自身原文中的独立小标题提取定义，保留全文和出处技能。
export function skillDefinitions(skills,level) {
  const definitions=[];
  for(const skill of skills){
    const description=textAt(skill,level);
    for(const block of description.split(/\n\s*\n/)){
      const [first,...lines]=block.split('\n'),name=termName(first);
      if(lines.length&&name.length>=2&&name.length<=30&&!/[，。；：!?！？]/.test(name)&&!['普通攻击','重击','下落攻击','点按','长按'].includes(name)){
        definitions.push({name,description:lines.join('\n'),skill:skill.name});
        if(name.includes('·')&&name.endsWith('模式'))definitions.push({name:name.split('·').at(-1).replace(/模式$/,''),description:lines.join('\n'),skill:skill.name});
      }
    }
    for(const term of validTerms(skill.terms))definitions.push({...term,skill:skill.name});
    definitions.push({name:skill.name,description,skill:skill.name});
    if(skill.type==='普通攻击'||skill.type==='普攻')definitions.push({name:'普通攻击·'+skill.name,description,skill:skill.name});
    if(skill.name.includes('：'))definitions.push({name:skill.name.split('：').slice(1).join('：'),description,skill:skill.name});
  }
  return definitions.map(normalizeSkillTerm).filter(Boolean);
}

export function skillExplanations(skills,skill,level) {
  const text=textAt(skill,level),definitions=skillDefinitions(skills,level),result=new Map();
  for(const term of validTerms(skill.terms))result.set(term.name,{...term,skill:skill.name});
  const names=new Set([...text.matchAll(quotes)].map(match=>termName(match.slice(1).find(Boolean))).filter(Boolean));
  // 同时支持原神未加引号的小标题术语，例如血偿勒令、玉璋护盾。
  for(const term of definitions)if(term.skill!==skill.name&&text.includes(term.name))names.add(term.name);
  for(const name of names){
    if(result.has(name))continue;
    const matches=definitions.filter(d=>d.name===name&&(d.skill!==skill.name||d.name!==skill.name));
    const term=matches.find(d=>d.name!==d.skill)??matches[0];
    if(term)result.set(name,term);
    else{
      // 名词的定义可能未加引号，引用同一角色实际说明效果的段落。
      const definition=skillDefinitionFor(skills,name,level);
      if(definition)result.set(name,{name,description:definition.body,skill:definition.s.name});
    }
  }
  return validTerms([...result.values()]);
}

function skillDefinitionFor(skills,name,level){
  if(!name)return;
  const candidates=[];
  for(const s of skills){
    const body=textAt(s,level),plain=cleanName(body).replace(/[「」“”"【】〖〗\[\]]/g,'');
    let score=0,offset=0;
    while((offset=plain.indexOf(name,offset))>=0){
      const before=plain.slice(Math.max(0,offset-18),offset),after=plain.slice(offset+name.length,offset+name.length+60);
      if(/^(?:效果[:：]|状态[:：]|[:：\n]|具有|能够|将|会|为|无法|命中|耗竭|完全形成|的(?:持续时间|伤害|效果|治疗量))/.test(after))score+=4;
      if(/(?:获得|积攒|转化为|进入|唤出|召唤|生成|创造|留下|称为|名为|赋予|形成|切换至|消耗|提供|施加|持有|基于|化身|形态的|发射|打出|浸析出|以|触发|搭乘|启用|借助|驱动|释放|替换为|奏响|呈现出|制造|拾取|持续)[^，。；\n]{0,12}$/.test(before)&&/持续|伤害|治疗|效果|消耗|上限|降低|提升|恢复|攻击|释放|移动|交互|留影/.test(plain.slice(Math.max(0,offset-80),offset+250)))score+=3;
      if(/^(?:形态|状态|效果)/.test(after)&&/伤害|治疗|攻击|降低|提升|消耗/.test(after))score+=2;
      offset+=name.length;
    }
    if(score)candidates.push({s,body,score});
  }
  return candidates.sort((a,b)=>b.score-a.score)[0];
}

export function skillDescriptionHTML(text,terms,escape){
  const names=[...new Set(validTerms(terms).map(term=>term.name))].sort((a,b)=>b.length-a.length),source=cleanName(text);
  let output='',offset=0;
  while(offset<source.length){
    let position=source.length,match='';
    for(const name of names){const found=source.indexOf(name,offset);if(found>=0&&found<position){position=found;match=name;}}
    output+=escape(source.slice(offset,position));if(!match)break;
    output+=`<button type="button" class="skill-term-reference" data-skill-term="${escape(match)}">${escape(match)}</button>`;
    offset=position+match.length;
  }
  return output;
}

export function attachSkillTerms(entry,index) {
  const data=index.characters?.[entry.id];
  if(entry.category!=='characters')return entry;
  const common=validTerms(index.common?.[entry.game]),local=validTerms(Object.values(data?.skills??{}).flat()),usedSources=new Map();
  const annotate=skill=>{
    const repair=text=>data?.textRepairs?.[text]??text;
    const description=repair(skill.description),levels=skill.levels?.map(row=>({...row,description:repair(row.description)}));
    const body=[description,...(levels??[]).map(row=>row.description)].join('\n');
    const terms=new Map([...common,...local].filter(term=>body.includes(term.name)&&(!['领唱','重唱'].includes(term.name)||body.includes('「'+term.name+'」'))).map(term=>[term.name,term]));
    for(const term of validTerms(data?.skills?.[skill.name]))terms.set(term.name,term);
    for(const term of validTerms(skill.terms))terms.set(term.name,term);
    for(const term of terms.values())if(term.source)usedSources.set(term.source.url,term.source);
    return {...skill,description,...(levels?{levels}:{}),...(terms.size||Object.hasOwn(skill,'terms')?{terms:[...terms.values()]}:{})};
  };
  const skills=(entry.details?.skills??[]).map(annotate),upgrades=(entry.details?.upgrades??[]).map(annotate);
  const traveler=entry.details?.traveler?{...entry.details.traveler,elements:Object.fromEntries(Object.entries(entry.details.traveler.elements).map(([element,variant])=>[element,{...variant,skills:variant.skills.map(annotate),upgrades:variant.upgrades.map(annotate)}]))}:null;
  const sources=[...(entry.sources??[])];
  if(data?.source)usedSources.set(data.source.url,data.source);
  for(const source of usedSources.values())if(!sources.some(s=>s.url===source.url))sources.push(source);
  return {...entry,details:{...entry.details,skills,upgrades,...(traveler?{traveler}:{})},sources};
}
