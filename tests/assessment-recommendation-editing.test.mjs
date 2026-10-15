import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {recommendedGoal,editableGuide,characterGuideHTML,goalHelpHTML} from '../modules/character-assessment/core/profiles.mjs';
import {recommendationPlans,recommendationPlan,splitGuideTeams} from '../modules/character-assessment/core/recommendation-plans.mjs';
import {emptyRecommendationSettings,updateRecommendationSettings,migrateRecommendationSettings} from '../modules/character-assessment/core/recommendation-settings.mjs';
import {createRecommendationStore} from '../modules/character-assessment/recommendation-store.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {resetGoalGroup} from '../modules/character-assessment/core/actions.mjs';
import {blocksLockedButton} from '../modules/character-assessment/core/permissions.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));

test('旧攻略备选按各位置组合拆分，说明保留且重复处理不增加队伍',()=>{
  const teams=[{note:'保留适用条件',slots:[{label:'位置一',characters:['Shenhe','Ganyu']},{label:'位置二',characters:['Furina']},{label:'位置三',characters:['Bennett','Zhongli']},{label:'位置四',characters:[]}]}],before=structuredClone(teams),split=splitGuideTeams(teams);
  assert.equal(split.length,4);assert(split.every(t=>t.note===teams[0].note&&t.slots.length===4&&t.slots.every(s=>s.characters.length<=1)));
  assert.deepEqual(split.map(t=>t.slots.map(s=>s.characters[0]??'')),[['Shenhe','Furina','Bennett',''],['Shenhe','Furina','Zhongli',''],['Ganyu','Furina','Bennett',''],['Ganyu','Furina','Zhongli','']]);
  assert.deepEqual(teams,before);assert.deepEqual(splitGuideTeams(split),split);
  const guide=editableGuide('Shenhe');guide.teams=teams;
  const settings=emptyRecommendationSettings();settings.records.Shenhe={guidePlans:{defaultId:'custom',displayId:'custom',plans:[{id:'builtin',name:'内置',builtin:true,value:editableGuide('Shenhe')},{id:'custom',name:'旧攻略',builtin:false,value:guide}]}};
  const migrated=migrateRecommendationSettings(settings,catalog);assert.equal(recommendationPlan('Shenhe','guide',migrated).value.teams.length,4);assert.deepEqual(settings.records.Shenhe.guidePlans.plans[1].value.teams,teams);
});

test('攻略多方案保存立即显示，默认与显示独立；旧默认可以删除，内置方案固定只读',async()=>{
  const folder=await createTestWorkspace('recommendation-plans');
  try{
    const path=join(folder,'recommendations.json'),store=createRecommendationStore(path,catalog),original=editableGuide('Shenhe');let settings=store.read();
    const write=req=>settings=store.write({key:'Shenhe',kind:'guide',revision:settings.revision,...req});
    write({action:'copy',id:'builtin',newId:'custom',name:'冰翎辅助自定义'});
    const guide=structuredClone(recommendationPlan('Shenhe','guide',settings).value);guide.intro='已编辑的攻略 <img onerror="test">';guide.weapons[0].note='已编辑的武器条件';
    write({action:'save',id:'custom',name:'冰翎辅助自定义',value:guide});
    assert.equal(recommendationPlans('Shenhe','guide',settings).defaultId,'builtin');assert.equal(editableGuide('Shenhe',settings).intro,guide.intro);
    const html=characterGuideHTML('Shenhe',catalog,undefined,{settings});assert.match(html,/已编辑的攻略 &lt;img/);assert.doesNotMatch(html,/<img onerror/);
    write({action:'default',id:'custom'});write({action:'display',id:'builtin'});
    const collection=recommendationPlans('Shenhe','guide',settings);assert.equal(collection.defaultId,'custom');assert.equal(collection.displayId,'builtin');
    assert.throws(()=>write({action:'delete',id:'custom'}),/默认方案不可删除/);
    for(const action of ['save','delete'])assert.throws(()=>write({action,id:'builtin',name:'篡改',value:guide}),e=>e.status===423);
    write({action:'copy',id:'custom',newId:'another',name:'新默认'});write({action:'default',id:'another'});write({action:'display',id:'custom'});write({action:'delete',id:'custom'});
    const after=recommendationPlans('Shenhe','guide',settings);assert.equal(after.displayId,'another');assert.equal(after.defaultId,'another');assert.equal(after.plans.some(p=>p.id==='custom'),false);
    assert.deepEqual(after.plans.find(p=>p.id==='builtin').value,original);assert.deepEqual(createRecommendationStore(path,catalog).read(),settings);
    assert.throws(()=>store.write({key:'Shenhe',kind:'guide',action:'default',id:'builtin',revision:0}),e=>e.status===409);
  }finally{await cleanupTestWorkspace(folder);}
});

test('评价多方案显示值与默认值分开；采用与分组恢复遵循默认，旧目标和其他元素保留',()=>{
  let settings=emptyRecommendationSettings();const original=recommendedGoal('Furina','hydro'),g=structuredClone(original);g.weights.critRate_=.25;g.level=80;g.notes='自定义方案说明';
  const write=req=>settings=updateRecommendationSettings(settings,{key:'Furina',kind:'goal',revision:settings.revision,...req},catalog);
  write({action:'add',newId:'assessment',name:'自定义评价',value:g});write({action:'display',id:'assessment'});
  assert.deepEqual(recommendedGoal('Furina','hydro',settings),original);assert.deepEqual(recommendationPlan('Furina','goal',settings).value,g);
  assert.match(goalHelpHTML('Furina',settings),/目标有效词条|自定义评价/);assert.match(goalHelpHTML('Furina',settings),/0.25/);
  const state=blankState();state.goals.Furina=structuredClone(original);state.goals.Furina.notes='账号已有目标';const before=structuredClone(state);
  write({action:'default',id:'assessment'});assert.deepEqual(state,before);resetGoalGroup(state,'Furina','weights',{element:'hydro',settings});assert.deepEqual(state.goals.Furina,{...before.goals.Furina,weights:g.weights});
  write({action:'display',id:'builtin'});assert.deepEqual(recommendedGoal('Furina','hydro',settings),g);assert.deepEqual(recommendationPlan('Furina','goal',settings).value,original);
  write({action:'default',id:'builtin'});write({action:'delete',id:'assessment'});assert.deepEqual(recommendedGoal('Furina','hydro',settings),original);
  assert.deepEqual(recommendedGoal('TravelerCryoF','cryo',settings),recommendedGoal('TravelerCryoF','cryo'));assert.deepEqual(recommendedGoal('TravelerPyroF','pyro',settings),recommendedGoal('TravelerPyroF','pyro'));
});

test('旧攻略及各用途评价无损迁移，不在读取时覆盖文件；旧自定义攻略被显示',async()=>{
  const folder=await createTestWorkspace('recommendation-migration');
  try{
    const guide=editableGuide('Shenhe');guide.weapons[0].note='用户已保存条件';const goal=recommendedGoal('Shenhe');goal.weights.atk_=1.5;
    const old={version:1,revision:7,records:{Shenhe:{guideDraft:guide,goals:{[goal.role]:goal},defaultRole:goal.role}}},path=join(folder,'recommendations.json');writeFileSync(path,JSON.stringify(old));const bytes=readFileSync(path);
    const store=createRecommendationStore(path,catalog),s=store.read();assert.equal(s.version,2);assert.equal(s.revision,7);assert.deepEqual(readFileSync(path),bytes);
    assert.deepEqual(recommendationPlan('Shenhe','guide',s).value,guide);assert.deepEqual(recommendedGoal('Shenhe',undefined,s),goal);
    assert.equal(recommendationPlans('Shenhe','guide',s).defaultId,'builtin');assert.equal(recommendationPlans('Shenhe','guide',s).displayId,'legacy-guide-custom');
    const next=store.write({key:'Shenhe',kind:'guide',action:'default',id:'legacy-guide-custom',revision:7});assert.equal(next.revision,8);assert.equal(JSON.parse(readFileSync(path)).version,2);
    const different={...structuredClone(old),records:{Shenhe:{guide,guideDraft:{...guide,intro:'另一份自定义'}}}};const migrated=migrateRecommendationSettings(different,catalog);assert.equal(recommendationPlans('Shenhe','guide',migrated).plans.length,3);assert.equal(recommendationPlan('Shenhe','guide',migrated,'default').value.intro,guide.intro);assert.equal(recommendationPlan('Shenhe','guide',migrated).value.intro,'另一份自定义');
  }finally{await cleanupTestWorkspace(folder);}
});

test('通用方案 API 与账号锁定独立，服务端拒绝内置写入及默认删除',async()=>{
  const folder=await createTestWorkspace('recommendation-router');let router;
  try{
    router=createAssessmentRouter({storagePath:join(folder,'assessment.sqlite'),recommendationPath:join(folder,'recommendations.json'),json:(res,status,data)=>{res.status=status;res.data=data;},body:async req=>req.body});
    const call=async(path,method='GET',body)=>{const res={};assert.equal(await router.handle({method,body},res,new URL('http://localhost/api/assessment/'+path)),true);return res;};
    const first=(await call('state')).data,created=(await call('accounts','POST',{action:'create',name:'锁定账号',state:blankState()})).data;assert.equal(created.account.locked,true);
    let settings=(await call('recommendations')).data;
    for(const kind of ['guide','goal']){
      settings=(await call('recommendations','POST',{revision:settings.revision,key:'Furina',kind,action:'copy',id:'builtin',newId:'copy',name:'可编辑副本'})).data;
      const value=recommendationPlans('Furina',kind,settings).plans.find(p=>p.id==='copy').value;if(kind==='guide')value.intro='通用修改';else value.weights.critDMG_=.5;
      settings=(await call('recommendations','POST',{revision:settings.revision,key:'Furina',kind,action:'save',id:'copy',name:'可编辑副本',value})).data;
      await assert.rejects(call('recommendations','POST',{revision:settings.revision,key:'Furina',kind,action:'save',id:'builtin',name:'篡改',value}),e=>e.status===423);
    }
    assert.deepEqual((await call('state?account='+created.account.id)).data,created);assert.deepEqual((await call('state?account='+first.account.id)).data,first);
    assert.equal(recommendationPlan('Furina','goal',settings).value.weights.critDMG_,.5);
    for(const ae of ['edit-guide','edit-goal-default','edit-weight-default','set-plan-default','apply-displayed-goal','reset-goal','apply-recommendation'])assert.equal(blocksLockedButton({dataset:{ae}}),false);
    const res={setHeader(){},writeHead(status){this.status=status;},end(){}};assert.equal(await router.handle({method:'HEAD'},res,new URL('http://localhost/assessment/core/recommendation-plans.mjs')),true);assert.equal(res.status,200);
  }finally{router?.close();await cleanupTestWorkspace(folder);}
});
