import {defaultScenario} from './workspace.mjs';
import {equipmentLocation,validateGOOD} from './model.mjs';

// 队伍属于账号；character 仅作为兼容旧计算接口的首位成员编号。
export const membersOf=team=>team?.members??[team?.character,...(team?.scenario?.members??[])].filter(Boolean);
export function configureMembers(scenario,previous,next){
  if(next.length>4||new Set(next).size!==next.length)throw Error('队伍最多四人，成员不能重复。');
  if(new Set(next.map(equipmentLocation)).size!==next.length)throw Error('一支队伍只能选择一个旅行者元素方案。');
  const s=structuredClone(scenario??defaultScenario()),settings={...s.characters};
  if(previous[0])settings[previous[0]]={conditional:s.conditional??{},bonusStats:s.bonusStats??{},reaction:s.reaction??'',infusion:s.infusion??''};
  const shared={resonance:s.conditional?.resonance??{},reaction:s.conditional?.reaction??{}};
  for(const field of ['conditional','bonusStats','reaction','infusion'])delete s[field];
  Object.assign(s,settings[next[0]]??{});s.conditional={...shared,...s.conditional};
  s.characters=Object.fromEntries(next.slice(1).map(k=>[k,settings[k]??{}]));s.members=next.slice(1);
  s.active=next.includes(s.active)?s.active:next[0]??'';
  s.combo=(s.combo??[]).map(a=>({...a,owner:a.owner??previous[0]})).filter(a=>next.includes(a.owner));
  return s;
}
export function growthTeamChoices(state,key,w){
  if(!w)try{w=JSON.parse(state.engineStorage?.['wiki.native.v1']??'null');}catch{}
  return (w?.teams??[]).filter(team=>{const members=membersOf(team);return members.includes(key)&&members.every(member=>state.good.characters.some(c=>c.key===member));});
}
export function growthTeamScenario(team,key){
  if(!team)return defaultScenario();
  const members=membersOf(team);if(!members.includes(key))throw Error('这支队伍没有当前角色。');
  return configureMembers(team.scenario,members,[key,...members.filter(member=>member!==key)]);
}
export function independentWorkspace(w,state){
  if(w.independentTeams)return w;
  for(const t of w.teams)t.members=membersOf(t);
  w.activeTeamId=w.activeTeams?.[state.selected]??w.teams[0]?.id??'';
  const character=state.selected||state.good.characters[0]?.key;
  const s=structuredClone(w.scenarios[character]??defaultScenario());
  w.teamDraft={members:[character,...(s.members??[])].filter(Boolean),scenario:s};
  w.teamPlans=Object.entries(w.plans).flatMap(([owner,list])=>list.map((p,index)=>({...structuredClone(p),id:`legacy-${owner}-${index}`,legacyOwner:owner,legacyIndex:index,teamId:w.teams.find(t=>t.character===owner)?.id??''})));
  w.independentTeams=true;return w;
}
export function switchEquipment(good,member,kind,index,slot,catalog){
  if(!good.characters.some(c=>c.key===member))throw Error('请选择队伍中的角色。');
  if(!['weapons','artifacts'].includes(kind))throw Error('装备类型不正确。');
  const item=index===''?null:good[kind][Number(index)];
  if(index!==''&&(!Number.isInteger(Number(index))||!item))throw Error('候选装备已不可用。');
  if(kind==='weapons'&&item&&catalog.weapons[item.key]?.weaponType!==catalog.characters[member]?.weaponType)throw Error('武器类型与角色不符。');
  if(kind==='artifacts'&&item&&item.slotKey!==slot)throw Error('圣遗物部位不符。');
  const next=structuredClone(good),location=equipmentLocation(member);
  for(const old of next[kind])if(old.location===location&&(kind==='weapons'||old.slotKey===slot))old.location='';
  if(item)next[kind][Number(index)].location=location;
  for(const k of ['weapons','artifacts'])next[k]=next[k].filter(a=>!a.wikiTrialOnly||a.location);
  return next;
}

export const hasTrialEquipment=good=>['weapons','artifacts'].some(k=>good[k].some(a=>a.wikiTrialOnly&&a.location));
export function replaceWithTrialEquipment(good,member,kind,slot,raw,catalog,data){
  if(!good.characters.some(c=>c.key===member)||!['weapons','artifacts'].includes(kind))throw Error('请选择有效的成员与装备类型。');
  if(kind==='weapons'&&(!data.weapon.data[raw.key]||catalog.weapons[raw.key]?.weaponType!==catalog.characters[member]?.weaponType))throw Error('武器类型与角色不符。');
  if(kind==='artifacts'&&raw.slotKey!==slot)throw Error('圣遗物部位不符。');
  const item={...structuredClone(raw),location:'',lock:false};delete item.id;
  const result=validateGOOD({format:'GOOD',version:3,[kind]:[item]},data);if(result.errors.length)throw Error(result.errors[0]);
  const next=switchEquipment(good,member,kind,'',slot,catalog);
  next[kind].push({...item,id:'trial-'+crypto.randomUUID(),wikiTrialOnly:true,location:equipmentLocation(member)});
  return next;
}
export function actualEquipmentFromTrial(source,trial){
  if(hasTrialEquipment(trial))throw Error('自定义试算装备只能保存在队伍方案中，不能应用到实际装备。');
  const next=structuredClone(trial);next.characters=source.characters;
  for(const k of ['weapons','artifacts'])next[k]=next[k].filter(a=>!a.wikiTrialOnly);
  return next;
}
