import {snapshotItem} from './managed-inventory.mjs';
import {calculateBuild} from './calculator.mjs';
import {equipment,equipmentLocation,ELEMENTS,SLOTS} from './model.mjs';

export function teamKeys(good,key,scenario={}){
  return [...new Set([key,...(scenario.members??[])].filter(Boolean))].filter(k=>good.characters.some(c=>c.key===k)).slice(0,4);
}
export function memberScenario(good,key,scenario,member){
  const keys=teamKeys(good,key,scenario),own=member===key?scenario:(scenario.characters?.[member]??{});
  return {...scenario,...own,members:keys.filter(k=>k!==member),active:scenario.active??key,
    conditional:{resonance:scenario.conditional?.resonance??{},reaction:scenario.conditional?.reaction??{},...(own.conditional??{})},
    bonusStats:own.bonusStats??{},reaction:own.reaction??(member===key?scenario.reaction??'':''),infusion:own.infusion??'',
    characters:Object.fromEntries(keys.filter(k=>k!==member).map(k=>[k,k===key?{conditional:scenario.conditional??{},bonusStats:scenario.bonusStats??{},reaction:scenario.reaction??'',infusion:scenario.infusion??''}:scenario.characters?.[k]??{}]))};
}
export const idlePanel=(good,key)=>calculateBuild(good,key,{members:[],active:key,conditional:{},characters:{},bonusStats:{},reaction:'',infusion:''}).panel;
export const isDamageRow=r=>r.unit!=='%'&&(r.resultType?['damage','heal'].includes(r.resultType):['normal','charged','plunging','skill','burst','reaction'].includes(r.group)||/^constellation\d+$/.test(r.group)&&['physical','heal',...Object.keys(ELEMENTS),'stellarconduct','stellarswirl'].includes(r.variant));
export function calculateTeam(good,key,scenario={}){
  const members=teamKeys(good,key,scenario).map(member=>{
    try{return{key:member,...calculateBuild(good,member,memberScenario(good,key,scenario,member))};}
    catch(error){return{key:member,error:error.message,panel:null,rows:[],conditions:[]};}
  });
  const main=members.find(m=>m.key===key);if(!main||main.error)throw Error(main?.error??'请先选择可计算的角色。');
  return {...main,members,rows:members.flatMap(m=>m.rows.filter(isDamageRow).map(r=>({...r,owner:m.key}))),conditions:main.conditions,active:scenario.active??key};
}
export function artifactReplacementPreview(good,key,scenario,target,candidate,index){
  if(!teamKeys(good,key,scenario).includes(target))throw Error('请选择这支队伍中的替换角色。');
  if(!candidate||!SLOTS.includes(candidate.slotKey))throw Error('这件圣遗物已不可用。');
  if(index!==undefined&&(!Number.isInteger(index)||!good.artifacts[index]))throw Error('这件圣遗物已被移除。');
  const current=equipment(good,target).artifacts.find(a=>a.slotKey===candidate.slotKey)??null;
  const next=structuredClone(good),location=equipmentLocation(target);
  for(const a of next.artifacts)if(a.location===location&&a.slotKey===candidate.slotKey)a.location='';
  if(index===undefined)next.artifacts.push({...structuredClone(candidate),location});
  else next.artifacts[index]={...next.artifacts[index],...structuredClone(candidate),location};
  return {current,candidate,target,key,scenario,
    before:{...calculateTeam(good,key,scenario),good},after:{...calculateTeam(next,key,scenario),good:next}};
}
export function comboDamage(good,key,scenario,team=calculateTeam(good,key,scenario),{calculate=calculateBuild}={}){
  const cache=new Map(),items=[];
  for(const action of scenario.combo??[]){
    const owner=action.owner??key;if(!team.members.some(m=>m.key===owner))throw Error('组合中的角色不在当前队伍中，请重新选择。');
    const settings=memberScenario(good,key,scenario,owner),reaction=action.reaction==='inherit'?settings.reaction??'':action.reaction??'',infusion=!action.infusion||action.infusion==='inherit'?settings.infusion:action.infusion==='none'?'':action.infusion;
    const bonusStats={...settings.bonusStats,...Object.fromEntries(Object.entries(action.bonusStats??{}).map(([stat,value])=>[stat,Number(settings.bonusStats?.[stat]??0)+Number(value)]))},id=JSON.stringify([owner,reaction,infusion,bonusStats]);
    if(!cache.has(id))cache.set(id,reaction===(settings.reaction??'')&&infusion===settings.infusion&&!Object.keys(action.bonusStats??{}).length?team.members.find(m=>m.key===owner):calculate(good,owner,{...settings,reaction,infusion,bonusStats}));
    const row=cache.get(id).rows.find(r=>r.path===action.path);if(!row||!isDamageRow(row)||row.variant==='heal'||row.resultType==='heal')throw Error('组合中的伤害项目已不可用，请重新选择。');
    const hitMode=action.hitMode??'avgHit',value=row[hitMode==='hit'?'hit':hitMode==='critHit'?'crit':'average'];
    if(!Number.isFinite(action.count)||action.count<0||action.count>1000)throw Error('动作次数 / 权重须在 0–1000 之间。');
    items.push({owner,row,count:action.count,hitMode,value:value*action.count});
  }
  return{value:items.reduce((n,r)=>n+r.value,0),items};
}
export function captureTeamPlan(good,key,scenario,name){
  const teamBuilds=teamKeys(good,key,scenario).map(member=>{const e=equipment(good,member);return{character:snapshotItem(good.characters.find(c=>c.key===member)),weapon:e.weapon?snapshotItem(e.weapon):null,artifacts:e.artifacts.map(snapshotItem)};});
  return {...teamBuilds.find(b=>b.character.key===key),name,teamBuilds,scenario:structuredClone(scenario),savedAt:new Date().toISOString()};
}
export function goodWithPlan(source,key,plan){
  const good=structuredClone(source),builds=(plan.teamBuilds??[{character:plan.character,weapon:plan.weapon,artifacts:plan.artifacts}]).filter(b=>good.characters.some(c=>c.key===b.character.key));
  // 原单角色与全队快照均可在账号内使用，队伍成员由当前独立队伍决定。
  const locations=new Set(builds.map(b=>equipmentLocation(b.character.key)));
  for(const kind of ['weapons','artifacts'])for(const item of good[kind])if(locations.has(item.location))item.location='';
  for(const build of builds){
    const member=build.character.key,loc=equipmentLocation(member);good.characters=good.characters.map(c=>c.key===member?{...c,...snapshotItem(build.character)}:c);
    if(member.startsWith('Traveler'))for(const c of good.characters)if(c.key.startsWith('Traveler')&&c.key.at(-1)===member.at(-1)){c.level=build.character.level;c.ascension=build.character.ascension;}
    for(const kind of ['weapons','artifacts'])for(const raw of kind==='weapons'?(build.weapon?[build.weapon]:[]):build.artifacts??[]){
      const identity=x=>{const{id,location,lock,wikiCustom,...rest}=snapshotItem(x);return JSON.stringify(rest);};
      let item=good[kind].find(x=>raw.id!==undefined?x.id===raw.id:identity(x)===identity(raw));
      if(item)Object.assign(item,snapshotItem(raw),{location:loc});else good[kind].push({...snapshotItem(raw),location:loc});
    }
  }
  return good;
}
export function upgradeReference(good,key,scenario,data,target){
  const team=calculateTeam(good,key,scenario),row=team.rows.find(r=>r.owner===target.owner&&r.path===target.path);
  const score=(input,settings)=>target.combo?comboDamage(input,key,settings).value:calculateTeam(input,key,settings).rows.find(r=>r.owner===target.owner&&r.path===target.path)?.average;
  const baseline=target.combo?comboDamage(good,key,scenario,team).value:row?.average;
  if(baseline===undefined)throw Error('请先选择可计算的队伍伤害项目。');
  const result=[];
  for(const stat of ['atk_','hp_','def_','eleMas','critRate_','critDMG_','enerRech_']){
    const tiers=data.art.sub[5][stat],value=tiers.reduce((n,v)=>n+v,0)/tiers.length*(stat.endsWith('_')?100:1),next={...scenario,bonusStats:{...scenario.bonusStats,[stat]:(scenario.bonusStats?.[stat]??0)+value}},after=score(good,next);
    if(after!==undefined)result.push({stat,value,base:baseline,delta:after-baseline});
  }
  for(const talent of ['auto','skill','burst']){
    const c=good.characters.find(c=>c.key===key);if(c.talent[talent]>=10)continue;
    const next=structuredClone(good);next.characters.find(c=>c.key===key).talent[talent]++;
    const after=score(next,scenario);if(after!==undefined)result.push({talent,base:baseline,delta:after-baseline});
  }
  return result.sort((a,b)=>b.delta-a.delta);
}
