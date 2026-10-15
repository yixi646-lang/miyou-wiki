import {validateGoal,validateGuide,ROLES} from './model.mjs';
import {recommendationPlans,planField,builtinPlanValue,splitGuideTeams,normalizeGuideArtifactPlans} from './recommendation-plans.mjs';

export const emptyRecommendationSettings=()=>({version:2,revision:0,records:{}});
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function splitSettingsTeams(settings){for(const [key,record] of Object.entries(settings.records))for(const plan of record.guidePlans?.plans??[]){plan.value.teams=splitGuideTeams(plan.value.teams);plan.value=normalizeGuideArtifactPlans(plan.value,key);}return settings;}
export function validateGuideCatalog(guide,key,catalog){
  validateGuide(guide);
  if(guide.weapons.some(w=>!catalog.weapons[w.key]||catalog.weapons[w.key].weaponType!==catalog.characters[key]?.weaponType))fail('推荐武器不存在或与角色武器类型不符。');
  if(guide.teams.some(t=>t.slots.some(s=>s.characters.some(k=>!Object.hasOwn(catalog.characters,k)))))fail('配队中包含未收录的角色。');
  if(guide.build?.sets.some(k=>!Object.hasOwn(catalog.sets,k)))fail('攻略中包含未收录的圣遗物套装。');
  if(guide.artifactPlans?.some(p=>p.sets.some(k=>!Object.hasOwn(catalog.sets,k))))fail('圣遗物方案中包含未收录的套装。');
  return guide;
}
function validateValue(value,key,kind,catalog){
  if(kind==='guide'){validateGuideCatalog(value,key,catalog);return;}
  validateGoal(value,key);
  if(['sands','goblet','circlet'].some(k=>!Array.isArray(value.mainStats[k]))||value.sets.length>2||new Set(value.sets).size!==value.sets.length||value.sets.some(k=>!Object.hasOwn(catalog.sets,k)))fail('评价方案的主词条或套装不正确。');
}
export function validateRecommendationSettings(settings,catalog){
  if(!record(settings)||settings.version!==2||!Number.isSafeInteger(settings.revision)||settings.revision<0||!record(settings.records))fail('方案设置格式不正确。');
  for(const[key,p]of Object.entries(settings.records)){
    if(!Object.hasOwn(catalog.characters,key)||!record(p)||Object.keys(p).some(k=>!['guidePlans','goalPlans'].includes(k)))fail('方案角色编号或字段不正确。');
    for(const kind of ['guide','goal']){
      const collection=p[planField(kind)];if(collection===undefined)continue;
      if(!record(collection)||!Array.isArray(collection.plans)||!collection.plans.length||collection.plans.length>100)fail('每类方案须保留 1–100 套。');
      const ids=new Set();
      for(const plan of collection.plans){
        if(!record(plan)||!validId(plan.id)||ids.has(plan.id)||typeof plan.name!=='string'||!plan.name.trim()||plan.name.length>100||typeof plan.builtin!=='boolean'||plan.builtin!==(plan.id==='builtin'))fail('方案编号、名称或内置标记不正确。');
        ids.add(plan.id);validateValue(plan.value,key,kind,catalog);
      }
      if(!ids.has('builtin')||!ids.has(collection.defaultId)||!ids.has(collection.displayId))fail('内置、默认和显示方案须指向已有方案。');
    }
  }
  return structuredClone(settings);
}

// 旧覆盖及自定义内容分别迁移，读取时不改写原文件；下次保存写入新结构。
export function migrateRecommendationSettings(input,catalog){
  if(input?.version===2)return validateRecommendationSettings(splitSettingsTeams(validateRecommendationSettings(input,catalog)),catalog);
  if(!record(input)||input.version!==1||!Number.isSafeInteger(input.revision)||input.revision<0||!record(input.records))fail('旧默认设置格式不正确。');
  const next=emptyRecommendationSettings();next.revision=input.revision;
  for(const[key,p]of Object.entries(input.records)){
    if(!Object.hasOwn(catalog.characters,key)||!record(p)||Object.keys(p).some(k=>!['guide','guideDraft','goals','defaultRole'].includes(k)))fail('旧默认设置角色编号或字段不正确。');
    const target=next.records[key]={},element=catalog.characters[key].element;
    if(p.guide||p.guideDraft){
      const c=recommendationPlans(key,'guide',next,element);target.guidePlans=c;
      if(p.guide){const value=structuredClone(p.guide);value.build??=builtinPlanValue(key,'guide').build;c.plans.push({id:'legacy-guide-default',name:'原自定义默认攻略',builtin:false,value});c.defaultId=c.displayId='legacy-guide-default';}
      if(p.guideDraft){
        if(p.guide&&JSON.stringify(p.guide)===JSON.stringify(p.guideDraft))c.displayId='legacy-guide-default';
        else{const value=structuredClone(p.guideDraft);value.build??=builtinPlanValue(key,'guide').build;c.plans.push({id:'legacy-guide-custom',name:'原自定义攻略',builtin:false,value});c.displayId='legacy-guide-custom';}
      }
    }
    if(p.goals!==undefined){
      if(!record(p.goals))fail('旧评价设置格式不正确。');
      const c=recommendationPlans(key,'goal',next,element);target.goalPlans=c;
      const baseRole=c.plans[0].value.role;
      for(const[role,value]of Object.entries(p.goals)){
        if(!Object.hasOwn(ROLES,role)||value?.role!==role)fail('旧评价用途不正确。');
        c.plans.push({id:'legacy-goal-'+role,name:ROLES[role].name+' · 原默认设置',builtin:false,value:structuredClone(value)});
      }
      if(p.defaultRole&&!p.goals[p.defaultRole])fail('旧默认用途缺少设置。');
      const active=p.defaultRole??(p.goals[baseRole]?baseRole:null);
      if(active)c.defaultId=c.displayId='legacy-goal-'+active;
    }
  }
  return validateRecommendationSettings(splitSettingsTeams(next),catalog);
}

export function updateRecommendationSettings(current,request,catalog){
  if(request?.revision!==current.revision)fail('方案已被另一个页面修改，请关闭面板后重新打开。',409);
  const {key,kind,action,id}=request;
  if(!Object.hasOwn(catalog.characters,key)||!['guide','goal'].includes(kind)||!['add','copy','save','delete','default','display'].includes(action))fail('方案操作已更新，请刷新页面后重试。');
  const next=structuredClone(current),p=next.records[key]??={},field=planField(kind),c=p[field]??=recommendationPlans(key,kind,current,catalog.characters[key].element);
  const plan=c.plans.find(p=>p.id===id);
  const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>100)fail('方案名称须为 1–100 个字。');return value.trim();};
  if(action==='add'||action==='copy'){
    if(c.plans.length>=100)fail('该角色此类方案最多保存 100 套。');
    if(!validId(request.newId)||request.newId==='builtin'||c.plans.some(p=>p.id===request.newId))fail('新方案编号重复或无效。');
    if(action==='copy'&&!plan)fail('要复制的方案不存在。');
    const value=structuredClone(action==='copy'?plan.value:request.value??builtinPlanValue(key,kind,catalog.characters[key].element));
    c.plans.push({id:request.newId,name:name(request.name),builtin:false,value});
  }else{
    if(!plan)fail('方案不存在。');
    if(action==='save'){
      if(plan.builtin)fail('内置方案固定只读，请复制后编辑。',423);
      plan.name=name(request.name);plan.value=structuredClone(request.value);
      if(request.display!==false)c.displayId=id;
    }else if(action==='delete'){
      if(c.defaultId===id)fail('默认方案不可删除，请先指定其他默认方案。');
      if(plan.builtin)fail('内置方案固定保留，只能复制。',423);
      c.plans=c.plans.filter(p=>p.id!==id);if(c.displayId===id)c.displayId=c.defaultId;
    }else if(action==='default')c.defaultId=id;
    else c.displayId=id;
  }
  next.revision++;return validateRecommendationSettings(splitSettingsTeams(validateRecommendationSettings(next,catalog)),catalog);
}
