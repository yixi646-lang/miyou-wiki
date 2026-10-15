// Wiki 的源码级适配器。只引用数值、机制和字段描述，不挂载上游网页。
import {getCharSheet,getWeaponSheet,getArtSheet,resonanceData,resonanceSheets,getMoonsignSheet,hexereiSheet,MoonsignConditionalSection,reactionData,reactionConditionals} from '@genshin-optimizer/gi/sheets';
import {dataObjForCharacterNew,dataObjForWeapon,dataObjForArtifact,constant,input,common,infoManager,dynamicData,mergeData,optimize,precompute,prod,sum,dynRead,min,max} from '@genshin-optimizer/gi/wr';
import {getSubstatValue} from '@genshin-optimizer/gi/util';
import {compactArtifacts,optimizeTcUsingNodes} from '@genshin-optimizer/gi/solver-tc';
import {pruneAll,pruneExclusion,artSetPerm,filterFeasiblePerm,countBuilds,filterArts} from '@genshin-optimizer/gi/solver';
import {ComputeWorker} from '../vendor/source/libs/gi/solver/src/GOSolver/ComputeWorker';
import {BNBSplitWorker} from '../vendor/source/libs/gi/solver/src/GOSolver/BNBSplitWorker/index';
import {DefaultSplitWorker} from '../vendor/source/libs/gi/solver/src/GOSolver/DefaultSplitWorker';
import {levelUpArtifact,dustReshape,elixirDefinition,expandNodes,makeObjective,evalMarkovNode,accumulateEvaluations,toStats} from '@genshin-optimizer/gi/upopt';
import {uiDataForTeam} from '@genshin-optimizer/gi/uidata';
import {allElementWithPhyKeys} from '@genshin-optimizer/gi/consts';
import {allStats} from '@genshin-optimizer/gi/stats';
import zh from './zh.json';
import upstream from '../upstream.json';

const dict:any=zh;
const missingText=new Map<string,{namespace:string,key:string}>();
export function mechanicTextDiagnostics(){return [...missingText.values()];}
const labels:any={hp:'生命值',hp_:'生命值加成',atk:'攻击力',atk_:'攻击力加成',def:'防御力',def_:'防御力加成',eleMas:'元素精通',enerRech_:'元素充能效率',critRate_:'暴击率',critDMG_:'暴击伤害',heal_:'治疗加成',incHeal_:'受治疗加成',shield_:'护盾强效',all_dmg_:'全部伤害加成',base:'基础伤害',dmg_:'伤害加成',dmgInc:'伤害提高',baseDmg_:'基础伤害倍率',specialDmg_:'特殊伤害倍率',mult_:'倍率',multi:'反应倍率',enemyDefRed_:'敌人防御降低',enemyDefIgn_:'无视敌人防御',enemyLevel:'敌人等级',moveSPD_:'移动速度',atkSPD_:'攻击速度',cdRed_:'冷却缩减',staminaDec_:'体力消耗降低',healInc:'额外治疗量',flatDmg:'伤害值',staminaGlidingDec_:'滑翔体力消耗降低',skillCDRed_:'元素战技冷却缩减',burstCDRed_:'元素爆发冷却缩减',staminaChargedDec_:'重击体力消耗降低',staminaSprintDec_:'冲刺体力消耗降低',normalEle_dmg_:'普通攻击元素伤害加成',weakspotDMG_:'弱点伤害加成',autoBoost:'普通攻击等级提升',skillBoost:'元素战技等级提升',burstBoost:'元素爆发等级提升',dmgRed_:'受到的伤害降低',duration:'持续时间',count:'次数',stacks:'层数',lvl:'等级',asc:'突破',auto:'普通攻击等级',skill:'元素战技等级',burst:'元素爆发等级',energyCost:'元素能量',reaction:'元素反应',level:'等级',none:'未启用',on:'启用',off:'关闭',hit:'非暴击',critHit:'暴击',avgHit:'期望值'};
const groups:any={normal:'普通攻击',charged:'重击',plunging:'下落攻击',skill:'元素战技',burst:'元素爆发',passive:'固有天赋',lockedPassive:'强化天赋',sprint:'替代冲刺',passive1:'固有天赋一',passive2:'固有天赋二',passive3:'固有天赋三',reaction:'元素反应',constellation1:'命之座一',constellation2:'命之座二',constellation3:'命之座三',constellation4:'命之座四',constellation5:'命之座五',constellation6:'命之座六',weapon:'武器效果',artifact:'套装效果',moonsign:'月兆',nicole:'元素投射',custom:'自定义组合'};
const elements:any={anemo:'风',geo:'岩',electro:'雷',dendro:'草',hydro:'水',pyro:'火',cryo:'冰',physical:'物理'};
const reactions:any={vaporize:'蒸发',melt:'融化',spread:'蔓激化',aggravate:'超激化',overloaded:'超载',superconduct:'超导',electrocharged:'感电',burning:'燃烧',shattered:'碎冰',bloom:'绽放',burgeon:'烈绽放',hyperbloom:'超绽放',crystallize:'结晶',swirl:'扩散',lunarcharged:'月感电',lunarbloom:'月绽放',lunarcrystallize:'月结晶',stellarconduct:'星超导',stellarswirl:'星扩散'};
const get=(obj:any,path:any)=>Array.isArray(path)?path.reduce((o,k)=>o?.[k],obj):String(path).split('.').reduce((o,k)=>o?.[k],obj);
// 上游在插值参数中使用词典引用；先取本地中文，避免把角色名称占位符显示到界面。
function resolveTextReferences(text:string,seen:string[]=[]):string{
  return text.replace(/\$t\(\s*([\w]+):([^()]+?)\s*\)|\$\{\s*([\w]+):([^{}]+?)\s*\}/g,(token,ns,key,templateNs,templateKey)=>{
    const namespace=ns??templateNs,path=String(key??templateKey).trim().replace(/:/g,'.'),id=`${namespace}:${path}`;
    if(seen.includes(id)||seen.length>=16)return token;
    const value=get(dict[namespace],path);
    if(typeof value!=='string'&&typeof value!=='number')return token;
    return resolveTextReferences(String(value),[...seen,id]);
  });
}
export function statLabel(key:string):string{
  if(dict.statKey_gen?.[key])return dict.statKey_gen[key];
  if(labels[key])return labels[key];if(groups[key])return groups[key];if(reactions[key])return reactions[key];
  for(const [e,n]of Object.entries(elements))if(key.startsWith(e+'_')){const suffix=key.slice(e.length+1);return n+(suffix==='dmg_'?'元素伤害加成':suffix==='enemyRes_'?'敌人抗性':suffix==='res_'?'元素抗性':statLabel(suffix));}
  for(const [e,n]of Object.entries({...groups,...reactions}))if(key.startsWith(e+'_'))return n+statLabel(key.slice(e.length+1));
  if(key==='dmg')return'伤害';if(key==='heal')return'治疗量';if(key==='low')return'低空坠地冲击';if(key==='high')return'高空坠地冲击';
  if(/^\d+$/.test(key))return`第 ${Number(key)+1} 段`;return'效果数值';
}
export function textOf(node:any,ui?:any):string{
  if(node==null||typeof node==='boolean')return'';if(typeof node==='function')return ui?textOf(node(ui),ui):'';
  if(Array.isArray(node))return node.map(x=>textOf(x,ui)).join('');if(typeof node!=='object')return resolveTextReferences(String(node));
  const props=node.props??{};
  if(node.type==='Translate'){
    let raw=get(dict[props.ns],String(props.key18).replace(/:/g,'.')),values=props.values??{};
    if(raw===undefined&&values.count!==undefined)raw=get(dict[props.ns],`${props.key18}_${Number(values.count)===1?'one':'other'}`)??get(dict[props.ns],`${props.key18}_other`)??get(dict[props.ns],`${props.key18}_one`);
    if(raw===undefined&&/^(char|weapon|artifact)_/.test(props.ns)&&!props.ns.endsWith('_gen'))raw=get(dict[`${props.ns}_gen`],props.key18);
    if(raw===undefined&&String(props.key18).endsWith('.description'))raw=get(dict[props.ns],String(props.key18).replace(/\.description$/,'.fields'));
    // 不能精炼的武器只提供精一说明，兼容旧导入中留下的更高精炼编号。
    if(raw===undefined&&props.ns.startsWith('weapon_')&&/^passiveDescription\.\d+$/.test(props.key18)){
      const descriptions=dict[props.ns]?.passiveDescription,indices=Object.keys(descriptions??{}).filter(k=>/^\d+$/.test(k)).map(Number);
      if(indices.length===1&&indices[0]===0)raw=descriptions[0];
    }
    if(raw===undefined){raw=dict._missing?.[`${props.ns}:${props.key18}`];if(raw===undefined){missingText.set(`${props.ns}:${props.key18}`,{namespace:props.ns,key:props.key18});return'说明尚未收录';}}
    // 游戏生成说明按段落存放为对象 / 数组，不能把它们当作缺失的译文。
    const paragraphs=(v:any):string=>typeof v==='object'&&v!==null?Object.values(v).map(paragraphs).join('\n'):String(v??'');
    return resolveTextReferences(paragraphs(raw).replace(/{{\s*([^}]+)\s*}}/g,(_:string,k:string)=>textOf(values[k],ui))).replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  }
  if(node.type==='br')return'\n';
  return textOf(props.children,ui);
}
const baseKey=(key:string)=>/^Traveler.*[FM]$/.test(key)?key.slice(0,-1):key;
const gender=(key:string)=>key.startsWith('Traveler')&&key.endsWith('F')?'F':'M';
const location=(key:string)=>key.startsWith('Traveler')?'Traveler':key;
const equipped=(good:any,key:string)=>({weapon:good.weapons?.find((w:any)=>w.location===location(key)),artifacts:(good.artifacts??[]).filter((a:any)=>a.location===location(key))});
function cachedArt(a:any,index:number){const sub=(s:any)=>({...s,accurateValue:s.key?Number(allStats.art.subRollCorrection[a.rarity]?.[s.key]?.[s.value.toFixed(s.key.endsWith('_')?1:0)]??s.value):0});return{...a,id:String(a.id??index),substats:a.substats.map(sub),unactivatedSubstats:a.unactivatedSubstats?.filter((s:any)=>s.key).map(sub)};}
// Wiki 下拉框用空字符串表示取消；上游公式以未设置条件为准，不改写账号原文。
function normalizedConditions(value:any,source=''):any{return Object.fromEntries(Object.entries(value??{}).filter(([,v])=>v!==''&&v!==undefined&&v!==null).map(([k,v])=>{
  if(v&&typeof v==='object'&&!Array.isArray(v))return[k,normalizedConditions(v,k)];
  // 早期逐元素开关保存为 on；仅兼容有明确元素含义的字段，不猜测层数或触发状态。
  const element=source==='ScrollOfTheHeroOfCinderCity'?k.match(/^(?:react|nightsoul)_(anemo|geo|electro|hydro|pyro|dendro|cryo)$/)?.[1]:['ViridescentVenerer','KaedeharaKazuha'].includes(source)?k.match(/^swirl(electro|hydro|pyro|cryo)$/)?.[1]:undefined;
  return[k,v==='on'&&element?element:v];
}));}
function settingsFor(settings:any,key:string,selected:string){const own=key===selected?settings:(settings.characters?.[key]??{});return{...own,conditional:normalizedConditions({resonance:settings.conditional?.resonance??{},reaction:settings.conditional?.reaction??{},...(own.conditional??{})})};}
function construct(good:any,selected:string,settings:any,dynamic?:any){
  const members=[selected,...(settings.members??[]).filter((k:string)=>k!==selected)].slice(0,4),team:any={},sheets:any={},builds:any={};
  for(const key of members){
    const c=good.characters?.find((x:any)=>x.key===key);if(!c)continue;const ck=baseKey(key),sheet=getCharSheet(ck as any,gender(key) as any);if(!sheet)throw Error('当前计算核心未支持这个角色。');
    if(team[ck])throw Error('队伍中不能重复加入同一角色或旅行者的不同元素。');
    const e=equipped(good,key),s=settingsFor(settings,key,selected),enemy:any={enemyLevel:settings.enemyLevel??100,enemyDefRed_:settings.enemyDefRed_??0,enemyDefIgn_:settings.enemyDefIgn_??0};
    for(const ele of allElementWithPhyKeys)enemy[`${ele}_enemyRes_`]=settings.resistances?.[ele]??settings.resistance??10;
    const sheetData={...sheet.data,display:{...sheet.data.display}};
    const characterData=dataObjForCharacterNew({...c,key:ck,infusionAura:s.infusion??'',customMultiTargets:[],conditional:s.conditional??{},bonusStats:s.bonusStats??{},enemyOverride:enemy,hitMode:s.hitMode??'avgHit',reaction:s.reaction??''} as any,{chars:{get:(k:string)=>good.characters?.find((x:any)=>baseKey(x.key)===k)}} as any);
    // 上游共鸣带站场角色门控，随每个成员加入；只有站场来源向队伍发送一次。
    const parts=[common,sheetData,characterData,resonanceData];
    // 反应公共减益没有该门控，只注入一次。
    if(!Object.keys(team).length)parts.push(reactionData);
    if(e.weapon){const ws=getWeaponSheet(e.weapon.key);if(!ws)throw Error('当前计算核心未支持这把武器。');parts.push(ws.data,dataObjForWeapon({...e.weapon,id:String(e.weapon.id??'equipped')}));}
    const setCounts:any={};e.artifacts.forEach((a:any,i:number)=>{if(!getArtSheet(a.setKey))throw Error('当前计算核心未支持这个套装。');if(dynamic?.key!==key||dynamic.substatsOnly){
      const artData=dataObjForArtifact(cachedArt(dynamic?.key===key?{...a,substats:[]}:a,i));parts.push(artData);
      if(dynamic?.key!==key&&dynamic?.borrowed?.includes(a.wikiSearchIndex)){
        const flag=dynRead('borrow:'+a.wikiSearchIndex),negative:any={art:{},artSet:{[a.setKey]:prod(-1,flag)}};
        for(const [stat,node]of Object.entries(artData.art??{}))if((node as any)?.operation)negative.art[stat]=prod(-1,node as any,flag);
        parts.push(negative);
      }
    }setCounts[a.setKey]=(setCounts[a.setKey]??0)+1;});
    if(dynamic?.key===key){parts.push(dynamic.substatsOnly?{art:Object.fromEntries(Object.keys(dynamicData.art).filter(k=>dynamic.subkeys.includes(k)).map(k=>[k,sum(dynamicData.art[k],Number(dynamic.fixedStats?.[k]??0)/(k.endsWith('_')?100:1))]))}:dynamicData);for(const set of dynamic.sets??[])setCounts[set]??=0;}
    for(const k of Object.keys(setCounts))parts.push(getArtSheet(k as any).data);
    team[ck]=parts;sheets[ck]=sheet;builds[ck]={...e,setCounts,key};
  }
  if(!Object.keys(team).length)throw Error('请先添加角色并填写配装。');
  const active=baseKey(settings.active??selected);const ui=uiDataForTeam(team,gender(selected) as any,(team[active]?active:baseKey(selected)) as any);
  return{ui,sheets,builds};
}
function fieldMetadata(node:any):any{
  if(!node)return{};
  if(node.info?.path&&(infoManager[node.info.path]?.name||statLabel(node.info.path)!=='效果数值'))return node.info;
  // 未触发分支也使用同一输出名称；只读输出分支，不从倍率的输入属性猜名称。
  const branches=['match','threshold'].includes(node.operation)?node.operands.slice(2):node.operation==='lookup'?Object.values(node.table):[];
  for(const branch of branches){const info=fieldMetadata(branch);if(info.path)return info;}
  return node.info??{};
}
const resultTypes=new WeakMap<object,string>();
function resultType(node:any):string{
  if(!node||typeof node!=='object')return'';
  if(node.info?.wikiResultType)return node.info.wikiResultType;
  if(resultTypes.has(node))return resultTypes.get(node)!;
  // 最终伤害/治疗可能再乘天赋倍率；只沿输出算术追溯，不用元素、名称或数值猜类型。
  const kinds=['add','mul','min','max'].includes(node.meta?.op)
    ?new Set((node.meta.ops??[]).map(resultType).filter(Boolean)):new Set<string>();
  const kind=kinds.size===1?[...kinds][0]:'';resultTypes.set(node,kind);return kind;
}
function documentFields(fields:any[],ui:any,includeHidden=false){
  return (fields??[]).filter(f=>includeHidden||!f.canShow||f.canShow(ui)).map(f=>{
    const n=f.node?ui.get(f.node):null,value=n?.value??(typeof f.value==='function'?f.value(ui):f.value);
    // 条件未满足时上游节点是空值，既没有生效数值，也可能没有字段信息。
    if(n?.isEmpty)return null;
    const metadata=fieldMetadata(f.node),path=n?.info?.path??metadata.path??'';
    const label=textOf(f.text??infoManager[path]?.name,ui)||statLabel(path),unit=n?.info?.unit||metadata.unit||textOf(f.unit,ui);
    return{label:label+textOf(f.textSuffix??infoManager[path]?.textSuffix,ui),statKey:path,resultType:resultType(n)||metadata.wikiResultType||'',value:typeof value==='number'?value*(unit==='%'?100:1):textOf(value,ui),unit,textOnly:value===undefined,precision:f.fixed??n?.info?.fixed??1};
  }).filter(f=>f&&(f.label||f.value));
}
function conditionalPaths(node:any,seen=new Set<any>()):string[]{
  if(!node||typeof node!=='object'||seen.has(node))return[];seen.add(node);
  if(node.operation==='read'&&node.path?.[0]==='conditional')return[node.path.slice(1).join('.')];
  return [...(node.operands??[]),...Object.values(node.table??{})].flatMap(child=>conditionalPaths(child,seen));
}
function documentControls(sections:any[],ui:any,owner:string,source:string,output:any[],effects:any[],document:any,includeHidden=false){
  let current={...document};
  let pending:any[]=[],afterFields=false;
  const effectFor=(section:any)=>{
    if(section.header)current={title:textOf(section.header.title,ui)||document.title,description:textOf(section.header.description,ui),badge:textOf(section.header.action,ui)};
    const title=current.title||document.title,description=current.description||'',badge=current.badge||'';
    const id=JSON.stringify([owner,source,document.sourceName,title]);
    let effect=effects.find(e=>e.id===id);
    if(!effect){effect={id,owner,source,sourceName:document.sourceName,title,badge,description,fields:[]};effects.push(effect);}
    if(description&&!effect.description.includes(description))effect.description=[effect.description,description].filter(Boolean).join('\n\n');
    const text=textOf(section.text,ui);
    if(text&&!effect.description.includes(text))effect.description=[effect.description,text].filter(Boolean).join('\n\n');
    return effect;
  };
  for(const section of sections??[]){
    if(!includeHidden&&section.canShow&&!ui.get(section.canShow).value)continue;
    const effect=effectFor(section);
    const states=typeof section.states==='function'?section.states(ui):section.states;
    if(!states){
      effect.fields.push(...documentFields(section.fields,ui,includeHidden));
      // 上游有些开关把数值放在紧随其后的独立字段中，归回对应开关卡片。
      // 不收录此前的攻击数值、其他技能或没有开关的独立效果。
      pending=pending.filter(c=>c.documentId===effect.id);
      for(const c of pending)if(c.value){
        const fields=(section.fields??[]).filter((f:any)=>{const paths=conditionalPaths(f.node);return!paths.length||paths.includes(c.path.join('.'));});
        c.currentFields.push(...documentFields(fields,ui,includeHidden));
      }
      if(section.fields?.length)afterFields=true;
      continue;
    }
    if(afterFields)pending=[];afterFields=false;
    const title=textOf(section.name??section.header?.title,ui)||'触发条件';
    const common={owner,source,sourceName:effect.sourceName,documentId:effect.id,description:textOf(section.text,ui)||(source==='角色机制'&&['普通攻击','元素战技','元素爆发','替代冲刺'].includes(effect.sourceName)?'':effect.description)};
    const add=(c:any)=>{c.currentFields=[];output.push(c);pending.push(c);};
    if(section.path){add({...common,title,path:[...section.path],value:ui.get(section.value).value??'',options:[{value:'',label:'未启用'},...Object.entries(states).map(([value,s]:any)=>({value,label:textOf(s.name,ui)||({ss:'辉映·星扩散',sc:'辉映·星超导'} as any)[value]||(/^\d+$/.test(value)?`${value} 层`:value==='on'?'启用':'触发'),fields:documentFields(s.fields,ui,includeHidden)}))]});}
    else for(const [on,s]of Object.entries(states) as any[])if(s.path)add({...common,title:textOf(s.name,ui)||title,path:[...s.path],value:ui.get(s.value).value??'',options:[{value:'',label:'未启用'},{value:on,label:'启用',fields:documentFields(s.fields,ui,includeHidden)}]});
  }
}
function allControls(context:any,selected:string,includeHidden=false){
  const output:any[]=[],effects:any[]=[];
  for(const [ck,pair]of Object.entries(context.ui) as any[]){const ui=pair.target,sheet=context.sheets[ck],build=context.builds[ck];
    for(const [talentKey,talent]of Object.entries(sheet.talent) as any[])documentControls(talent.sections,ui,build.key,'角色机制',output,effects,{title:textOf(talent.name,ui)||statLabel(talentKey),sourceName:groups[talentKey]??(talentKey==='auto'?'普通攻击':statLabel(talentKey))},includeHidden);
    if(sheet.data.display?.moonsign)documentControls([MoonsignConditionalSection(ck as any,sheet)],ui,build.key,'元素共鸣',output,effects,{title:'月兆',sourceName:'月兆'},includeHidden);
    if(build.weapon)documentControls(getWeaponSheet(build.weapon.key).document,ui,build.key,'武器效果',output,effects,{title:dict.weaponNames_gen?.[build.weapon.key],sourceName:dict.weaponNames_gen?.[build.weapon.key]},includeHidden);
    for(const [set,count]of Object.entries(build.setCounts) as any[])for(const n of [1,2,4])if(count>=n)documentControls(getArtSheet(set as any).setEffectDocument(n as any),ui,build.key,'套装效果',output,effects,{title:dict.artifactNames_gen?.[set],sourceName:`${dict.artifactNames_gen?.[set]} · ${n}件套`},includeHidden);
    if(ck===baseKey(selected)){for(const resonance of [...resonanceSheets,getMoonsignSheet(ui.getDisplay().moonsign?ui:undefined),hexereiSheet])if(includeHidden||resonance.canShow(ui))documentControls(resonance.sections,ui,build.key,'元素共鸣',output,effects,{title:textOf(resonance.name,ui),description:textOf(resonance.desc,ui),sourceName:'元素共鸣'},includeHidden);documentControls(reactionConditionals,ui,build.key,'反应条件',output,effects,{title:'元素反应',sourceName:'元素反应'},includeHidden);}
  }
  return{conditions:output.filter((c,i)=>output.findIndex(x=>x.owner===c.owner&&x.path.join('.')===c.path.join('.'))===i),effects:effects.filter(e=>e.description||e.fields.length||output.some(c=>c.documentId===e.id))};
}
// 离线审计同一套说明提取逻辑，同时覆盖尚未解锁 / 未触发的隐藏字段。
export function inspectMechanicDocuments(good:any,key:string,settings:any={}){return allControls(construct(good,key,settings),key,true);}
function thinTrace(n:any,depth=0):any{return{value:n.value,unit:n.info?.unit??'',label:textOf(infoManager[n.info?.path]?.name)||statLabel(n.info?.path??''),op:n.meta?.op??'const',children:depth<4?(n.meta?.ops??[]).filter((x:any)=>!x.isEmpty).slice(0,12).map((x:any)=>thinTrace(x,depth+1)):[]};}
export function calculateBuild(good:any,key:string,settings:any={}){
  const context=construct(good,key,settings),ui=context.ui[baseKey(key)].target,panel:any={},rows:any[]=[];
  for(const stat of ['hp','atk','def','eleMas','enerRech_','critRate_','critDMG_','heal_','shield_',...allElementWithPhyKeys.map(e=>`${e}_dmg_`)]){const n=ui.get(input.total[stat]);panel[stat]=Number(n.value??0)*(stat.endsWith('_')?100:1);}
  const modes:any={hit:ui.child({hit:{hitMode:constant('hit')}}).getDisplay(),critHit:ui.child({hit:{hitMode:constant('critHit')}}).getDisplay(),avgHit:ui.getDisplay()};
  function crawl(obj:any,path:string[]){for(const [name,node]of Object.entries(obj) as any[]){const p=[...path,name];if(node?.meta){if(typeof node.value!=='number'||!Number.isFinite(node.value)||node.isEmpty)continue;
    const group=p[0];if(group==='basic')continue;rows.push({path:p.join('.'),group,resultType:resultType(node),label:textOf(infoManager[node.info?.path]?.name,ui)||p.slice(1).map(statLabel).join(' · ')||statLabel(group),unit:node.info?.unit??'',hit:get(modes.hit,p)?.value??node.value,crit:get(modes.critHit,p)?.value??node.value,average:node.value,variant:node.info?.variant??''});
  }else if(node&&typeof node==='object')crawl(node,p);}}
  crawl(modes.avgHit,[]);
  return{panel,rows,...allControls(context,key),members:Object.values(context.builds).map((b:any)=>b.key),active:settings.active??key};
}
// 搜索仍读取同一套 GO 节点，只取目标数值与面板；说明、三种命中展示在最终方案中生成。
export function calculateOptimizationBuild(good:any,key:string,settings:any={},paths:string[]=[]){
  const context=construct(good,key,settings),ui=context.ui[baseKey(key)].target,panel:any={},rows:any[]=[];
  for(const stat of ['hp','atk','def','eleMas','enerRech_','critRate_','critDMG_','heal_','shield_',...allElementWithPhyKeys.map(e=>`${e}_dmg_`)]){const n=ui.get(input.total[stat]);panel[stat]=Number(n.value??0)*(stat.endsWith('_')?100:1);}
  if(paths.length){const display=ui.getDisplay();for(const path of paths){const node=get(display,path);if(path.split('.')[0]==='basic'||!node?.meta||node.isEmpty||typeof node.value!=='number'||!Number.isFinite(node.value))continue;rows.push({path,group:path.split('.')[0],resultType:resultType(node),average:node.value,unit:node.info?.unit??'',variant:node.info?.variant??''});}}
  return {panel,rows};
}
// 潜力与理论方案只读取指定目标；仍使用完整队伍依赖，不生成无关展示和机制说明。
export function calculateObjectiveBuild(good:any,key:string,settings:any={},paths:string[]=[],withHitModes=false){
  const context=construct(good,key,settings),ui=context.ui[baseKey(key)].target,panel:any={},rows:any[]=[];
  let data:any,hit:any,crit:any;
  for(const path of new Set(paths)){
    if(path.startsWith('panel:')){const stat=path.slice(6),raw=input.total[stat];if(!raw)continue;const node=ui.get(raw);if(typeof node.value==='number'&&Number.isFinite(node.value))panel[stat]=node.value*(stat.endsWith('_')?100:1);continue;}
    if(path.split('.')[0]==='basic')continue;
    data??=mergeData(ui.data);const raw=get(data,['display',...path.split('.')]);if(!raw?.operation)continue;
    const node=ui.get(raw);if(node.isEmpty||typeof node.value!=='number'||!Number.isFinite(node.value))continue;
    const row:any={path,group:path.split('.')[0],resultType:resultType(node),average:node.value,unit:node.info?.unit??'',variant:node.info?.variant??''};
    if(withHitModes){hit??=ui.child({hit:{hitMode:constant('hit')}});crit??=ui.child({hit:{hitMode:constant('critHit')}});row.hit=hit.get(raw).value??node.value;row.crit=crit.get(raw).value??node.value;}
    rows.push(row);
  }
  return {panel,rows};
}
export function calculateTrace(good:any,key:string,settings:any,path:string){const {ui}=construct(good,key,settings);const data=ui[baseKey(key)].target;const n=get(data.getDisplay(),path);if(!n)throw Error('请重新选择伤害目标。');return thinTrace(n);}
export const calculatorVersion=`GO ${upstream.version} / Wiki 原生适配`;

// 同一角色的五件作为动态输入；其他成员保留装备，队友增益也通过 GO 的团队节点传递。
function metricCoefficients(objective:string,weights:any,rarity:number){
  const keys=['hp','atk','def','hp_','atk_','def_','eleMas','enerRech_','critRate_','critDMG_'];
  return Object.fromEntries(keys.map(k=>{const values=allStats.art.sub[objective==='weightedRolls'?5:rarity][k],average=values.reduce((n:number,v:number)=>n+v,0)/values.length,w=Number(weights[k]??0);if(!Number.isFinite(w))throw Error('词条评价权重无效。');return [k,objective==='cv'?(k==='critRate_'?200:k==='critDMG_'?100:0):objective==='weightedRolls'?w/average:w>0?1/average:0];}));
}
function metricValue(artifacts:any[],objective:string,weights:any){return artifacts.reduce((n,a)=>{const coefficients=metricCoefficients(objective,weights,a.rarity);return n+a.substats.reduce((v:number,s:any)=>v+(coefficients[s.key]??0)*s.value/(s.key.endsWith('_')?100:1),0);},0);}
// 理论分配只动态增加副词条；潜力节点含五件的主副词条，须扣除主词条并按各件星级换算。
function researchMetricNode(good:any,role:string,target:string,objective:string,substatsOnly:boolean,fixedStats:any,metric:any){
  const weights=metric.goals?.[target]?.weights??{},artifacts=equipped(good,target).artifacts;
  if(target!==role)return constant(metricValue(artifacts,objective,weights));
  const coefficients=metricCoefficients(objective,weights,substatsOnly?5:metric.artifact.rarity);
  if(substatsOnly)return sum(...Object.entries(coefficients).filter(([,coefficient])=>coefficient).map(([k,coefficient])=>prod(sum(dynRead(k),Number(fixedStats[k]??0)/(k.endsWith('_')?100:1)),Number(coefficient))));
  const artifact=metric.artifact,others=artifacts.filter(a=>a.slotKey!==artifact.slotKey),base:any={};
  for(const a of others){base[a.mainStatKey]=(base[a.mainStatKey]??0)+allStats.art.main[a.rarity][a.mainStatKey][a.level];for(const s of cachedArt(a,0).substats)if(s.key)base[s.key]=(base[s.key]??0)+s.accurateValue/(s.key.endsWith('_')?100:1);}
  base[artifact.mainStatKey]=(base[artifact.mainStatKey]??0)+allStats.art.main[artifact.rarity][artifact.mainStatKey][artifact.rarity*4];
  return sum(constant(metricValue(others,objective,weights)),...Object.entries(coefficients).filter(([,coefficient])=>coefficient).map(([k,coefficient])=>prod(sum(dynRead(k),-Number(base[k]??0)),Number(coefficient))));
}
function optimizationNodes(good:any,anchor:string,scenario:any,role:string,sets:string[],objective:string,target=anchor,substatsOnly=false,borrowed:number[]=[],fixedStats:any={},metric:any=null){
  const members=[anchor,...scenario.members??[]], dynamic={key:role,sets,substatsOnly,borrowed,fixedStats,subkeys:['hp','atk','def','hp_','atk_','def_','eleMas','enerRech_','critRate_','critDMG_']};
  const own=(owner:string,override:any={},idle=false)=>{
    const s=owner===anchor?scenario:scenario.characters?.[owner]??{};
    const settings=idle?{members:[],active:owner,conditional:{},characters:{},bonusStats:{},reaction:'',infusion:''}:{...scenario,...s,members:members.filter(k=>k!==owner),active:scenario.active??anchor,characters:Object.fromEntries(members.filter(k=>k!==owner).map(k=>[k,k===anchor?scenario:scenario.characters?.[k]??{}])),...override};
    const context=construct(good,owner,settings,dynamic),ui=context.ui[baseKey(owner)].target;
    return mergeData(ui.data);
  };
  const node=(owner:string,path:string,override:any={},idle=false)=>{
    const data=own(owner,override,idle),raw=path.startsWith('panel:')?input.total[path.slice(6)]:get(data,['display',...path.split('.')]);
    if(!raw?.operation)throw Error('计算目标已不可用，请重新选择。');
    return optimize([raw],data,({path}:any)=>path[0]!=='dyn')[0];
  };
  let targetNode:any;
  if(['cv','weightedRolls','effectiveRolls'].includes(objective))targetNode=metric?researchMetricNode(good,role,target,objective,substatsOnly,fixedStats,metric):dynRead(objective);
  else if(objective==='combo'){
    if(!scenario.combo?.length)throw Error('请先设置固定动作组合。');
    targetNode=sum(...scenario.combo.map((action:any)=>{
      const owner=action.owner??anchor,s=owner===anchor?scenario:scenario.characters?.[owner]??{},override:any={reaction:action.reaction==='inherit'?s.reaction??'':action.reaction??'',hitMode:action.hitMode??'avgHit'};
      if(action.infusion&&action.infusion!=='inherit')override.infusion=action.infusion==='none'?'':action.infusion;
      if(action.bonusStats)override.bonusStats={...s.bonusStats,...Object.fromEntries(Object.entries(action.bonusStats).map(([k,v])=>[k,Number(s.bonusStats?.[k]??0)+Number(v)]))};
      return prod(node(owner,action.path,override),action.count??1);
    }));
  }else if(objective.startsWith('idlePanel:'))targetNode=node(target,'panel:'+objective.slice(10),{},true);
  else targetNode=node(target,objective);
  if((objective.startsWith('panel:')||objective.startsWith('idlePanel:'))&&objective.split(':')[1].endsWith('_'))targetNode=prod(targetNode,100);
  const bounds=(owner:string,r:any)=>{
    const groups=[];
    for(const [mode,enabled,low,high]of [['battle',r.battleEnabled!==false,r.minimums,r.maximums],['idle',r.idleEnabled===true,r.idleMinimums,r.idleMaximums]] as any[]){
      if(!enabled)continue;const entries=[];
      for(const [k,v]of Object.entries(low??{}))entries.push(sum(prod(node(owner,'panel:'+k,{},mode==='idle'),k.endsWith('_')?100:1),-Number(v)));
      for(const [k,v]of Object.entries(high??{}))entries.push(sum(Number(v),prod(node(owner,'panel:'+k,{},mode==='idle'),k.endsWith('_')?-100:-1)));
      if(entries.length)groups.push(min(...entries));
    }
    return groups.length?[{value:r.boundMatch==='any'?max(...groups):min(...groups),min:0}]:[];
  };
  return {targetNode,bounds};
}
export async function solveGOArtifacts(request:any,options:any={}){
  const {good,key,scenario,role,sets,objective,targetKey,indices,metrics={},roleRules={}}=request;
  const borrowed=indices.filter((i:number)=>good.artifacts[i].location&&good.artifacts[i].location!==location(role));
  const indexedGOOD={...good,artifacts:good.artifacts.map((a:any,i:number)=>({...a,wikiSearchIndex:i}))};
  const graph=optimizationNodes(indexedGOOD,key,scenario,role,sets,objective,targetKey,false,borrowed),constraints=Object.entries(roleRules).flatMap(([owner,r])=>graph.bounds(owner,r));
  let arts=compactArtifacts(indices.map((i:number)=>cachedArt({...good.artifacts[i],id:String(i)},i)),0,false);
  for(const values of Object.values(arts.values) as any[])for(const a of values){Object.assign(a.values,metrics[Number(a.id)]??{});if(borrowed.includes(Number(a.id)))a.values['borrow:'+a.id]=1;}
  for(const i of borrowed)arts.base['borrow:'+i]=0;
  for(const k of Object.keys(metrics[indices[0]]??{}))arts.base[k]=0;
  let nodes=optimize(pruneExclusion([...constraints.map(c=>c.value),graph.targetNode],{}),{},()=>false);
  const minimums=[...constraints.map(c=>c.min),-Infinity],topN=Math.max(5,Math.min(100,request.topN??30));
  ({nodes,arts}=pruneAll(nodes,minimums,arts,topN,{}, {reaffine:true,pruneArtRange:true,pruneNodeRange:true,pruneOrder:true}));
  const setup:any={command:'setup',arts,optTarget:nodes.at(-1),constraints:nodes.slice(0,-1).map((value,i)=>({value,min:minimums[i]})),topN};
  let tested=0,skipped=0,failed=0;const report=(r:any)=>{tested+=r.tested??0;skipped+=r.skipped??0;failed+=r.failed??0;};
  const compute=new ComputeWorker(setup,report);let splitter:any;
  try{splitter=new BNBSplitWorker(setup,report);}catch{splitter=new DefaultSplitWorker(setup,report);}
  const filters=request.patterns?.map((pattern:string[])=>Object.fromEntries(['flower','plume','sands','goblet','circlet'].map((s,i)=>[s,pattern[i]?{kind:'required',sets:new Set([pattern[i]])}:{kind:'exclude',sets:new Set()}])))??filterFeasiblePerm(artSetPerm({},new Set(sets)),arts);
  let complete=true;
  const budget=Math.max(1,Math.floor(request.budget??1200)),chunk=Math.min(2048,budget);
  const visit=async(filter:any):Promise<boolean>=>{
    if(options.cancelled?.()||tested>=budget)return false;
    const remaining=Math.min(chunk,budget-tested);
    // 每个子批次开始前重新计算剩余预算，避免连续批次超出上限。
    if(countBuilds(filterArts(arts,filter))>remaining){
      for(const child of new DefaultSplitWorker(setup,report).split(filter,remaining))if(!await visit(child))return false;
      return true;
    }
    compute.compute(filter);compute.refresh(true);splitter.setThreshold(compute.threshold);
    options.progress?.({tested,failed,skipped});await new Promise(r=>setTimeout(r,0));
    return true;
  };
  outer:for(const filter of filters)for(const batch of splitter.split(filter,chunk)){
    // 常量目标时上游 BNB 可直接返回整个笛卡尔积；继续用其默认拆分器保持 Wiki 的预算与取消响应。
    if(!await visit(batch)){complete=false;break outer;}
  }
  compute.refresh(true);return {builds:compute.builds,tested,skipped,failed,complete,cancelled:!!options.cancelled?.()};
}
export function solveGOTheory(request:any){
  const {good,key,scenario,objective,tc}=request,role=request.role??key,target=request.targetKey??role;
  const graph=optimizationNodes(good,key,scenario,role,[],objective,target,true,[],tc.artifact.substats.stats,{goals:request.goals});
  const constraints=graph.bounds(role,request.panelRules??{}).map(c=>({value:c.value,minimum:c.min}));
  const scales=new Set<string>();
  precompute([graph.targetNode,...constraints.map(c=>c.value)],{},f=>{scales.add(String(f.path[1]));return String(f.path[1]);},1);
  // GO 将不影响目标的属性合并为 other；限制其容量，避免绕过 Wiki 的未勾选项和次数上限。
  const stats=tc.artifact.substats.stats,type=tc.artifact.substats.type,rarity=tc.artifact.substats.rarity,keys=Object.keys(stats);
  const remaining=(k:string)=>Math.max(0,tc.optimization.maxSubstats[k]-Math.round(stats[k]/getSubstatValue(k as any,rarity,type)));
  const needed=tc.optimization.distributedSubstats-keys.filter(k=>!scales.has(k)).reduce((n,k)=>n+remaining(k),0);
  if(needed>0)constraints.push({value:sum(...keys.filter(k=>scales.has(k)).map(k=>prod(dynRead(k),1/getSubstatValue(k as any,rarity,type,false)))),minimum:needed-1e-8});
  const nodes=[graph.targetNode,...constraints.map(c=>c.value)];let result:any;
  // 上游用 ceil 反推固定次数；消除乘除浮点误差，不改变用于计算的固定属性数值。
  const safeTC={...tc,artifact:{...tc.artifact,substats:{...tc.artifact.substats,stats:Object.fromEntries(keys.map(k=>[k,stats[k]>0?stats[k]*(1-1e-12):0]))}}};
  optimizeTcUsingNodes(nodes,constraints,safeTC,r=>{if(r.resultType==='finalize')result=r;});
  const values=precompute(nodes,{},f=>String(f.path[1]),1)([{values:result.maxBuffer}]);
  if(!Number.isFinite(values[0])||constraints.some((c,i)=>values[i+1]+1e-8<c.minimum))throw Error('没有满足词条分配范围与面板要求的理论配装，请调整约束。');
  return result;
}
export function analyzeGOPotential(request:any){
  const {good,key,scenario,role=key,objective,targetKey=role,artifact,mode='upgrade',initialValues={},prob4=0.2,threshold=0}=request;let affixes=[...(request.affixes??[])];
  const equippedArts=equipped(good,role).artifacts,build:any=Object.fromEntries(equippedArts.map((a:any,i:number)=>[a.slotKey,cachedArt(a,i)])),art=cachedArt(artifact,-1);
  const graph=optimizationNodes(good,key,scenario,role,[art.setKey],objective,targetKey,false,[],{},{goals:request.goals,artifact}),obj=makeObjective([graph.targetNode],[threshold]),unconditional={...obj,threshold:[-Infinity]};
  const reshapeRoots=(cases:any[],pair:string[])=>cases.flatMap(c=>dustReshape({art:{...art,totalRolls:c.totalRolls,substats:art.substats.map((s:any)=>({...s,initialValue:c.initialValues[s.key]}))},affixes:[...pair] as any,mintotal:2},build).map(r=>({...r,p:r.p*c.weight})));
  const initialCases=request.initialCases??[{initialValues,totalRolls:art.totalRolls??9,weight:1}];
  const autoAffixes=mode==='reshape'&&!affixes.length;
  if(autoAffixes){
    // 自动推荐只比较按初始次数分组的均值；实际概率计算仍使用全部合法初始档位分支。
    const grouped=new Map<number,any>();for(const c of initialCases){let g=grouped.get(c.totalRolls);if(!g){g={totalRolls:c.totalRolls,weight:0,initialValues:{}};grouped.set(c.totalRolls,g);}g.weight+=c.weight;for(const [k,v]of Object.entries(c.initialValues))g.initialValues[k]=(g.initialValues[k]??0)+c.weight*Number(v);}
    const means=[...grouped.values()];for(const g of means)for(const k in g.initialValues)g.initialValues[k]/=g.weight;
    const keys=art.substats.filter((s:any)=>s.key).map((s:any)=>s.key);let best=-Infinity;
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const pair=[keys[i],keys[j]],value=reshapeRoots(means,pair).reduce((v,{p,n}:any)=>v+p*evalMarkovNode(unconditional,n).evaluation.f_mu[0],0);if(value>best){best=value;affixes=pair;}}
  }
  let roots:any[];
  if(mode==='reshape')roots=reshapeRoots(initialCases,affixes);
  else if(mode==='define')roots=elixirDefinition({...art,affixes:[...affixes],prob_4line:prob4},build);
  else roots=levelUpArtifact(art,build);
  roots=roots.filter(r=>Number.isFinite(r.p)&&r.p>0);if(!roots.length)throw Error('所选条件下没有可发生的强化结果。');
  // GO 的马尔可夫节点评价采用局部正态近似；明确区分概率估计与具体可生成结果。
  const evaluated=roots.map(r=>({...r,value:evalMarkovNode(unconditional,r.n).evaluation.f_mu[0]})),average=evaluated.reduce((n,r)=>n+r.p*r.value,0);
  const aggregate=accumulateEvaluations(roots.map(({p,n})=>({p,n:evalMarkovNode(obj,n)})));
  const orderedRoots=[...evaluated].sort((a,b)=>b.value-a.value),sampleRoots=mode==='reshape'?[...new Set([0,.5,1,.25,.75].map(f=>orderedRoots[Math.round(f*(orderedRoots.length-1))]).concat([...evaluated].sort((a,b)=>b.p-a.p)[0]))]:roots;
  const rollNodes=expandNodes(sampleRoots),ranked=rollNodes.map(({p,n})=>({p,n,value:evalMarkovNode(unconditional,n).evaluation.f_mu[0]})).sort((a,b)=>b.value-a.value);
  // 分散取不同次数分配与真实离散档位，先去重再限量；均值不作为一件装备。
  const other:any={};for(const a of equippedArts)if(a.slotKey!==art.slotKey)for(const s of [{key:a.mainStatKey,accurateValue:allStats.art.main[a.rarity][a.mainStatKey][a.level]*(a.mainStatKey.endsWith('_')?100:1)},...cachedArt(a,0).substats])if(s.key)other[s.key]=(other[s.key]??0)+s.accurateValue/(s.key.endsWith('_')?100:1);
  const examples:any[]=[],seen=new Set<string>(),order=ranked.length?[0,0.5,1,0.25,0.75,0.125,0.875].map(f=>Math.round(f*(ranked.length-1))):[],indices=[...new Set([...order,...ranked.map((_,i)=>i)])];
  examplesLoop:for(const index of indices)for(const profile of ['high','mixed','low']){const {p,n}:any=ranked[index];if(p<=0)continue;
    const stats={...n.base},initials:any={};for(const [i,{key,rolls}]of (n.subs??[]).entries()){const tiers=allStats.art.sub[art.rarity][key];let value=0;for(let j=0;j<rolls;j++){const v=tiers[profile==='high'?tiers.length-1:profile==='low'?0:1+(i+j)%2];value+=v;if(j===0&&(mode==='define'||mode==='upgrade'&&!art.substats.some((s:any)=>s.key===key)&&!art.unactivatedSubstats?.some((s:any)=>s.key===key)))initials[key]=v*(key.endsWith('_')?100:1);}stats[key]=(stats[key]??0)+value;}
    const substats=['hp','atk','def','hp_','atk_','def_','eleMas','enerRech_','critRate_','critDMG_'].flatMap(k=>{
      let value=(stats[k]??0)-(other[k]??0);if(k===art.mainStatKey)value-=allStats.art.main[art.rarity][k][art.rarity*4];
      const recorded=artifact.substats.find((s:any)=>s.key===k)?.initialValue,pending=art.unactivatedSubstats?.find((s:any)=>s.key===k)?.accurateValue;
      const initialValue=mode==='reshape'?((n.base[k]??0)-(other[k]??0))*(k.endsWith('_')?100:1):mode==='define'?initials[k]:recorded??pending??(mode==='upgrade'&&art.level<4?art.substats.find((s:any)=>s.key===k)?.accurateValue:undefined)??initials[k];
      return value>1e-7?[{key:k,value:Math.round(value*(k.endsWith('_')?1000:1))/(k.endsWith('_')?10:1),...(initialValue===undefined?{}:{initialValue})}]:[];
    });
    const totalRolls=mode==='define'?n.subs.reduce((s:number,r:any)=>s+r.rolls,0):mode==='reshape'?4+n.subs.reduce((s:number,r:any)=>s+r.rolls,0):request.finalTotalRolls;
    const signature=JSON.stringify(substats.map(s=>[s.key,s.value]));if(seen.has(signature))continue;seen.add(signature);
    const candidate={setKey:artifact.setKey,slotKey:artifact.slotKey,mainStatKey:artifact.mainStatKey,rarity:art.rarity,level:art.rarity*4,location:'',lock:false,substats,...(totalRolls===undefined?{}:{totalRolls})};
    // 与实际GOOD求值一样，按显示数值查回精确词条；复用本候选已编译的目标和完整队伍依赖。
    let objectiveValue:number|undefined;if(!['cv','weightedRolls','effectiveRolls'].includes(objective)){const values=toStats(build,candidate as any);for(const s of cachedArt(candidate,-1).substats)if(s.key)values[s.key]=(values[s.key]??0)+s.accurateValue/(s.key.endsWith('_')?100:1);objectiveValue=obj.computeWithDerivs(values)[0][0];}
    examples.push({artifact:candidate,objectiveValue,rollPatternProbability:p,tierProfile:profile});if(examples.length>=18)break examplesLoop;
  }
  // GO upAvg 是超过阈值的平均差额；Wiki 展示的是目标值，须加回比较阈值。
  return {average,probability:aggregate.p,conditionalAverage:aggregate.p>0?threshold+aggregate.upAvg:null,lower:aggregate.lower,upper:aggregate.upper,approximate:true,affixes,autoAffixes,recommendationApproximate:autoAffixes,examples};
}

export const GO_SEARCH_COMMIT=upstream.sourceCommit;
