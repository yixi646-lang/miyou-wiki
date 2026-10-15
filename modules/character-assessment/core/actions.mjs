import {equipmentLocation,defaultGoal,ELEMENTS} from './model.mjs';
import {snapshotItem} from './managed-inventory.mjs';
import {recommendedGoal,goalDefaults} from './profiles.mjs';
import {readWorkspace,writeWorkspace,scenarioFor} from './workspace.mjs';
import {membersOf,configureMembers} from './teams.mjs';

export function switchTravelerElement(state,key,element){
  const character=state.good.characters.find(c=>c.key===key),match=/^Traveler(?:Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)([MF])$/.exec(key);
  if(!character||!match||!Object.hasOwn(ELEMENTS,element))throw Error('请选择空或荧，以及有效的旅行者元素。');
  const nextKey='Traveler'+element[0].toUpperCase()+element.slice(1)+match[1];
  const shared=state.good.characters.find(c=>c.key.startsWith('Traveler')&&c.key.endsWith(match[1])&&!c.wikiCustom)??character;
  for(const variant of state.good.characters)if(variant.wikiCustom&&variant.key.startsWith('Traveler')&&variant.key.endsWith(match[1])){variant.level=shared.level;variant.ascension=shared.ascension;}
  if(!state.good.characters.some(c=>c.key===nextKey)){
    state.good.characters.push({...snapshotItem(character),key:nextKey,wikiCustom:true,level:shared.level,ascension:shared.ascension,constellation:0,talent:{auto:1,skill:1,burst:1}});
  }
  state.selected=nextKey;return nextKey;
}

export function resetGoalGroup(state,key,group,{element='pyro',supported=true,settings}={}){
  const recommended=supported?recommendedGoal(key,element,settings):{...defaultGoal('custom',element),effectiveRolls:0,mainStats:{sands:[],goblet:[],circlet:[]}};
  const current=state.goals[key]??recommended;
  const defaults=supported?(settings?.version===2?recommended:goalDefaults(key,element,current.role,settings)):{...defaultGoal(current.role,element),effectiveRolls:0};
  let next=structuredClone(current);
  if(group==='all')next=structuredClone(defaults);
  else if(['sands','goblet','circlet'].includes(group))next.mainStats[group]=structuredClone(defaults.mainStats[group]);
  else{
    const fields={targets:['level','ascension','weaponLevel','talent','effectiveRolls'],weights:['weights'],sets:['sets'],panel:['panel'],notes:['notes']}[group];
    if(!fields)throw Error('不支持的评价恢复分组。');
    for(const field of fields)next[field]=structuredClone(defaults[field]);
  }
  state.goals[key]=next;return next;
}
export function resetScenarioGroup(state,key,group,owner){
  const w=readWorkspace(state),s=structuredClone(w.scenarios[key]??scenarioFor(state,key));
  if(group==='conditions'){
    if(!owner||owner===key)delete s.conditional;
    for(const [character,settings] of Object.entries(s.characters??{}))if(!owner||owner===character)delete settings.conditional;
  }else if(group==='bonus')delete s.bonusStats;
  else if(group==='combo')s.combo=[];
  else throw Error('不支持的计算条件恢复分组。');
  w.scenarios[key]=s;writeWorkspace(state,w);return s;
}

const teamName=name=>{if(typeof name!=='string'||!name.trim()||name.trim().length>150)throw Error('队伍名称须为 1–150 个字。');return name.trim();};
export function addTeam(state,character,scenario){
  const w=readWorkspace(state),names=new Set(w.teams.map(t=>t.name));let n=1;while(names.has('队伍 '+n))n++;
  const team={id:crypto.randomUUID(),name:'队伍 '+n,character,scenario:structuredClone(scenario)};
  w.teams.push(team);writeWorkspace(state,w);return team;
}
export function saveTeam(state,{id,character,scenario,name}){
  const w=readWorkspace(state),team={id:id||crypto.randomUUID(),name:teamName(name),character,scenario:structuredClone(scenario)},index=w.teams.findIndex(t=>t.id===team.id);
  if(index<0)w.teams.push(team);else w.teams[index]=team;writeWorkspace(state,w);return team;
}
export function renameTeam(state,id,name){
  const w=readWorkspace(state),team=w.teams.find(t=>t.id===id);if(!team)throw Error('请先选择已保存的队伍。');
  team.name=teamName(name);writeWorkspace(state,w);return team;
}
export function removeTeam(state,id){
  const w=readWorkspace(state),team=w.teams.find(t=>t.id===id);if(!team)return false;
  w.teams=w.teams.filter(t=>t.id!==id);w.removedTeamIds=[...new Set([...(w.removedTeamIds??[]),id])];writeWorkspace(state,w);return true;
}
export function removePlan(state,key,index){
  const w=readWorkspace(state),list=w.plans[key];if(!list?.[index])return false;list.splice(index,1);if(!list.length)delete w.plans[key];writeWorkspace(state,w);return true;
}
export function removeEquipment(state,kind,index){
  if(!['weapons','artifacts'].includes(kind))throw Error('装备分类不正确。');
  const item=state.good[kind][index];if(!item)return false;
  if(item.lock)throw Error('请先解除这件装备的锁定，再移除。');
  state.good[kind].splice(index,1);return true;
}
export function removeCharacter(state,key){
  // 界面中的空、荧各为一个角色；移除时一并移除该外观的元素方案。
  const keys=new Set(state.good.characters.filter(c=>c.key===key||key.startsWith('Traveler')&&c.key.startsWith('Traveler')&&c.key.at(-1)===key.at(-1)).map(c=>c.key));
  if(!keys.size)return false;
  state.good.characters=state.good.characters.filter(c=>!keys.has(c.key));
  const remainingLocations=new Set(state.good.characters.map(c=>equipmentLocation(c.key)));
  for(const kind of ['weapons','artifacts'])for(const item of state.good[kind])if([...keys].some(k=>equipmentLocation(k)===item.location)&&!remainingLocations.has(item.location))item.location='';
  const w=readWorkspace(state);
  const scrub=(s,owner)=>{if(!s)return;s.members=(s.members??[]).filter(k=>!keys.has(k));for(const k of keys)delete s.characters?.[k];if(keys.has(s.active))s.active=owner;};
  for(const k of keys){delete state.goals[k];delete state.comparisons[k];delete w.scenarios[k];delete w.plans[k];}
  for(const [k,s]of Object.entries(w.scenarios))scrub(s,k);
  for(const [k,plans]of Object.entries(w.plans))for(const p of plans)scrub(p.scenario,k);
  for(const t of [...w.teams,w.teamDraft].filter(Boolean)){const previous=membersOf(t),next=previous.filter(k=>!keys.has(k));t.scenario=configureMembers(t.scenario,previous,next);t.members=next;t.character=next[0]??'';}
  // 队伍和历史配装快照独立保留；移除角色只移除成员关系。
  writeWorkspace(state,w);
  if(keys.has(state.selected)||!state.good.characters.some(c=>c.key===state.selected))state.selected=state.good.characters[0]?.key??'';
  return true;
}
