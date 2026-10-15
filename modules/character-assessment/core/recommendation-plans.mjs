import {defaultGoal} from './model.mjs';
import {recommendationData} from './recommendation-data.mjs';

export const planField=kind=>kind==='guide'?'guidePlans':'goalPlans';
export function defaultArtifactAdvice(build){
  const priority=Object.entries(build.talent).filter(([,v])=>v>1).sort((a,b)=>b[1]-a[1]).map(([key])=>({auto:'普通攻击',skill:'元素战技',burst:'元素爆发'})[key]).join(' → ');
  return `培养顺序参考：${priority||'按实际用途选择天赋'}。先保证循环与正确主词条，再比较副词条；具体天赋级数与权重沿用可修改的本地模板。`;
}
export function normalizeGuideArtifactPlans(guide,key){
  const value=structuredClone(guide),original=recommendationData.records[key]?.goal,build=value.build??=original?structuredClone({sets:original.sets,mainStats:original.mainStats,talent:original.talent}):{sets:[],mainStats:{sands:[],goblet:[],circlet:[]},talent:{auto:1,skill:1,burst:1}};
  value.artifactPlans??=build.sets.length?[{id:'artifact-1',name:'圣遗物方案 1',mode:build.sets.length===2?'two-two':'four',sets:[...build.sets],mainStats:structuredClone(build.mainStats),display:true}]:[];
  value.artifactAdvice??=defaultArtifactAdvice(build);return value;
}
export function syncGuideArtifactBuild(guide){
  const first=guide.artifactPlans[0];guide.build.sets=[...(first?.sets??[])];guide.build.mainStats=structuredClone(first?.mainStats??{sands:[],goblet:[],circlet:[]});return guide;
}
// 将旧的各位置多选组合拆成独立四人队；不修改原对象或队伍说明。
export function splitGuideTeams(teams){
  return teams.flatMap(team=>{
    let combinations=[[]];
    for(const slot of team.slots){const choices=[...new Set(slot.characters)];if(!choices.length)choices.push('');combinations=combinations.flatMap(previous=>choices.map(character=>[...previous,character]));}
    return combinations.map(characters=>({...structuredClone(team),slots:team.slots.map((slot,i)=>({...structuredClone(slot),characters:characters[i]?[characters[i]]:[]}))}));
  });
}
export function builtinPlanValue(key,kind,element='pyro'){
  const original=recommendationData.records[key];
  if(kind==='goal')return structuredClone(original?.goal??{...defaultGoal('custom',element),effectiveRolls:0});
  if(!original?.guide)throw Error('该角色暂无内置攻略。');
  const value=structuredClone(original.guide);
  value.teams=splitGuideTeams(value.teams);
  value.build??=structuredClone({sets:original.goal.sets,mainStats:original.goal.mainStats,talent:original.goal.talent});
  return normalizeGuideArtifactPlans(value);
}
export function recommendationPlans(key,kind,settings,element){
  const existing=settings?.records?.[key]?.[planField(kind)];
  if(existing){const collection=structuredClone(existing);if(kind==='guide')for(const plan of collection.plans){plan.value.teams=splitGuideTeams(plan.value.teams);plan.value=normalizeGuideArtifactPlans(plan.value,key);}return collection;}
  return {defaultId:'builtin',displayId:'builtin',plans:[{id:'builtin',name:'内置方案',builtin:true,value:builtinPlanValue(key,kind,element)}]};
}
export function recommendationPlan(key,kind,settings,selection='display',element){
  const collection=recommendationPlans(key,kind,settings,element);
  return collection.plans.find(p=>p.id===collection[selection==='default'?'defaultId':'displayId']);
}
