import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {replaceWithTrialEquipment,actualEquipmentFromTrial,switchEquipment} from '../modules/character-assessment/core/teams.mjs';
import {calculateTeam,captureTeamPlan,goodWithPlan} from '../modules/character-assessment/core/combat.mjs';
import {defaultScenario,readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));

test('理论武器和圣遗物仅保存在队伍快照，锁定账号可保存；恢复库存装备后不残留理论物品',async()=>{
  const folder=await createTestWorkspace('trial-equipment');let store,router;
  try{
    const state=blankState();state.selected='Furina';state.good.characters=[{key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}];
    state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true,id:'actual-weapon'}];
    state.good.artifacts=[{setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9}],location:'Furina',lock:true,id:'actual-flower'}];
    const original=structuredClone(state.good),scenario={...defaultScenario(),active:'Furina'};
    const weapon={...state.good.weapons[0],key:'SplendorOfTranquilWaters',refinement:5};
    const artifact={...state.good.artifacts[0],substats:[{key:'critRate_',value:15.6},{key:'critDMG_',value:31.1}]};
    let trial=replaceWithTrialEquipment(state.good,'Furina','weapons','',weapon,catalog,data);
    trial=replaceWithTrialEquipment(trial,'Furina','artifacts','flower',artifact,catalog,data);
    assert.deepEqual(state.good,original);assert.throws(()=>actualEquipmentFromTrial(state.good,trial),/不能应用/);
    const before=calculateTeam(original,'Furina',scenario),after=calculateTeam(trial,'Furina',scenario);
    assert.notEqual(before.members[0].panel.critRate_,after.members[0].panel.critRate_);
    const plan={...captureTeamPlan(trial,'Furina',scenario,'理论对比'),id:'plan',teamId:'team'};
    assert.notEqual(plan.weapon.id,weapon.id);assert.equal(plan.weapon.wikiTrialOnly,true);
    assert.notEqual(plan.artifacts[0].id,artifact.id);assert.equal(plan.artifacts[0].wikiTrialOnly,true);
    const restored=goodWithPlan(state.good,'Furina',plan);
    assert.deepEqual(calculateTeam(restored,'Furina',scenario),after);assert.deepEqual(state.good,original);
    const w=readWorkspace(state);w.teamPlans=[plan];writeWorkspace(state,w);validateState(state,data);
    store=createAccountStore(join(folder,'assessment.sqlite'));
    const account=store.action({action:'create',name:'理论快照隔离测试',state:{...structuredClone(state),engineStorage:{}}},data);
    const saved=store.write({accountId:account.account.id,revision:account.revision,state},data);
    assert.deepEqual(store.read(account.account.id).state.good,original);assert.equal(readWorkspace(store.read(account.account.id).state).teamPlans[0].weapon.wikiTrialOnly,true);
    const bad=structuredClone(state);bad.good=trial;
    assert.throws(()=>validateState(bad,data),/不能写入账号库存/);
    assert.throws(()=>store.write({accountId:account.account.id,revision:saved.revision,state:bad},data),/已锁定/);
    const unlocked=store.action({action:'unlock',accountId:account.account.id,revision:saved.revision},data);
    assert.throws(()=>store.write({accountId:account.account.id,revision:unlocked.revision,state:bad},data),/不能写入账号库存/);
    assert.deepEqual(store.read(account.account.id).state.good,original);
    trial=switchEquipment(trial,'Furina','weapons','0','',catalog);trial=switchEquipment(trial,'Furina','artifacts','0','flower',catalog);
    assert.deepEqual(actualEquipmentFromTrial(original,trial),original);
    assert.throws(()=>replaceWithTrialEquipment(original,'Furina','weapons','',{...weapon,key:'FavoniusWarbow'},catalog,data),/武器类型/);
    assert.throws(()=>replaceWithTrialEquipment(original,'Furina','artifacts','sands',artifact,catalog,data),/部位/);
    router=createAssessmentRouter({storagePath:join(folder,'route.sqlite'),json:()=>{},body:()=>{}});let status;
    for(const path of ['trial-equipment-editor.mjs','inventory-dialogs.mjs','core/managed-inventory.mjs']){await router.handle({method:'HEAD'},{setHeader(){},writeHead(code){status=code;},end(){}},new URL('http://localhost/assessment/'+path));assert.equal(status,200,path);}
  }finally{router?.close();store?.close();await cleanupTestWorkspace(folder);}
});
