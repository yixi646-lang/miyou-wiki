import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {membersOf,configureMembers,switchEquipment} from '../modules/character-assessment/core/teams.mjs';
import {calculateTeam,comboDamage,captureTeamPlan} from '../modules/character-assessment/core/combat.mjs';
import {recommendedGoal,goalHelpHTML,recommendationFor} from '../modules/character-assessment/core/profiles.mjs';
import {removeCharacter} from '../modules/character-assessment/core/actions.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const item=(location,id)=>({setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location,lock:true,id});
function sample(){const s=blankState();s.selected='Furina';s.good.characters=['Furina','Barbara','Albedo'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));s.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true,id:'wf'},{key:'HarbingerOfDawn',level:90,ascension:6,refinement:5,location:'Albedo',lock:false,id:'wa'}];s.good.artifacts=[item('Furina','af'),item('Albedo','aa')];const scenario={members:['Barbara','Albedo'],active:'Furina',enemyLevel:100,resistance:10,conditional:{},characters:{Albedo:{bonusStats:{def:80}}},combo:[]};s.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,scenarios:{Furina:scenario},teams:[{id:'team-old',name:'旧队伍',character:'Furina',scenario}],plans:{Furina:[captureTeamPlan(s.good,'Furina',scenario,'旧配装')]},activeTeams:{Furina:'team-old'}});return s;}
const node=(dataset={},attrs={},value='')=>({dataset,value,type:'',hasAttribute:k=>Object.hasOwn(attrs,k),checkValidity:()=>true});

test('旧角色队伍无损迁移为账号队伍；交换首位保留各成员条件，移除角色保留队伍及历史快照',()=>{
 const state=sample(),original=structuredClone(state.good),w=readWorkspace(state);assert.equal(w.activeTeamId,'team-old');assert.deepEqual(membersOf(w.teams[0]),['Furina','Barbara','Albedo']);assert.equal(w.teamPlans.length,1);assert.equal(w.plans.Furina.length,1);
 const s=configureMembers(w.teams[0].scenario,membersOf(w.teams[0]),['Albedo','Furina','Barbara']);assert.deepEqual(s.bonusStats,{def:80});assert.deepEqual(s.characters.Furina.bonusStats,{});assert.equal(s.active,'Furina');writeWorkspace(state,w);assert.deepEqual(state.good,original);
 removeCharacter(state,'Furina');const after=readWorkspace(state);assert.equal(after.teams.length,1);assert.deepEqual(after.teams[0].members,['Barbara','Albedo']);assert.equal(after.teamPlans.length,1);assert.equal(after.teamPlans[0].character.key,'Furina');validateState(state,data);
 assert.throws(()=>configureMembers({},[],['TravelerAnemoF','TravelerCryoF']),/一个旅行者/);
});

test('独立队伍当前页切换武器/圣遗物、方案保存及恢复只改变试算；账号锁定保护与显式应用分别生效',async()=>{
 const prior=globalThis.document;globalThis.document={activeElement:null,querySelector:()=>null};const folder=await createTestWorkspace('assessment-independent-teams');let store,router,bench;
 try{let state=sample(),locked=true,changes=0;const original=structuredClone(state.good),pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false};
  const make=()=>createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'<aside>我的角色</aside>',changed:()=>changes++,toast:()=>{},isReadOnly:()=>locked});bench=make();bench.render();
  assert.doesNotMatch(pane.innerHTML,/<aside>|当前查看/);assert.equal((pane.innerHTML.match(/data-native="open-team-member"/g)??[]).length,4);
  state.selected='Barbara';bench.reset();bench.render();assert.equal(bench.getResult().members[0].key,'Furina');assert.deepEqual(state.good,original);
  await bench.change(node({teamEquipment:'weapons',member:'Furina',slot:''},{'data-team-equipment':''},'1'));
  await bench.change(node({teamEquipment:'artifacts',member:'Furina',slot:'flower'},{'data-team-equipment':''},'1'));
  assert.deepEqual(state.good,original);assert.match(pane.innerHTML,/比较基准 → 当前试算/);assert.match(pane.innerHTML,/应用到实际装备/);assert.equal(bench.getResult().members.length,3);
  await assert.rejects(bench.click(node({native:'apply-team-trial'})),/锁定/);assert.deepEqual(state.good,original);
  const beforeTeam=calculateTeam(original,'Furina',readWorkspace(state).teams[0].scenario),row=beforeTeam.rows.find(r=>r.owner==='Albedo'&&r.group==='skill');
  const w=readWorkspace(state);w.teams[0].scenario.combo=[{owner:'Albedo',path:row.path,count:2,reaction:''}];writeWorkspace(state,w);bench.render();assert.match(pane.innerHTML,/固定组合期望/);
  await bench.change(node({}, {'data-native-plan-name':''},'候选配装'));await bench.click(node({native:'save-plan'}));assert.deepEqual(state.good,original);
  const saved=readWorkspace(state).teamPlans.at(-1);assert.equal(saved.teamBuilds[0].weapon.id,'wa');assert.equal(saved.teamBuilds[2].weapon,null);assert.equal(saved.teamBuilds[0].artifacts[0].id,'aa');assert.equal(saved.teamBuilds[2].artifacts.length,0);
  await bench.click(node({native:'clear-plan-preview'}));assert.deepEqual(bench.getResult(),beforeTeam.members.length?calculateTeam(original,'Furina',readWorkspace(state).teams[0].scenario):null);
  await bench.click(node({native:'preview-plan',index:'1'}));assert.match(pane.innerHTML,/当前配装：队伍方案：候选配装/);assert.deepEqual(state.good,original);
  await bench.click(node({native:'new-team'}));const second=readWorkspace(state).teams[1].id;
  await bench.change(node({teamMember:'0'},{'data-team-member':''},''));assert.equal(bench.getResult().members[0].key,'Barbara');
  await bench.change(node({}, {'data-native-team-select':''},'team-old'));assert.equal(bench.getResult().members[0].key,'Furina');assert.equal(readWorkspace(state).teams.find(t=>t.id===second).members[0],'Barbara');assert.equal(state.selected,'Barbara');
  bench.dispose();state=JSON.parse(JSON.stringify(state));bench=make();bench.render();assert.match(pane.innerHTML,/value="team-old" selected/);assert.deepEqual(state.good,original);
  await bench.click(node({native:'preview-plan',index:'1'}));store=createAccountStore(join(folder,'assessment.sqlite'));const account=store.action({action:'create',name:'隔离测试',state},data);store.write({accountId:account.account.id,revision:account.revision,state},data);assert.deepEqual(store.read(account.account.id).state.good,original);
  locked=false;await bench.click(node({native:'apply-team-trial'}));assert.equal(state.good.weapons[1].location,'Furina');assert.equal(state.good.weapons[0].location,'');assert.equal(state.good.artifacts[1].location,'Furina');assert.equal(state.good.artifacts[0].location,'');validateState(state,data);
  await bench.click(node({nativePage:'artifacts'}));assert.doesNotMatch(pane.innerHTML,/替换对比|data-native="compare-artifact"/);
  router=createAssessmentRouter({storagePath:join(folder,'route.sqlite'),json:()=>{},body:()=>{}});for(const resource of ['core/teams.mjs','core/recommendation-data.mjs']){let status;await router.handle({method:'HEAD'},{setHeader(){},writeHead(c){status=c;},end(){}},new URL('http://localhost/assessment/'+resource));assert.equal(status,200);}assert.ok(changes>0);
 }finally{bench?.dispose();router?.close();store?.close();await cleanupTestWorkspace(folder);if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('装备试算计入移交成员的损失、固定动作合计与独立反应条件，来源数据始终只读',()=>{
 const state=sample(),original=structuredClone(state.good),s=readWorkspace(state).teams[0].scenario,before=calculateTeam(state.good,'Furina',s),row=before.rows.find(r=>r.owner==='Albedo'&&r.group==='skill');s.combo=[{owner:'Albedo',path:row.path,count:3,reaction:''}];
 const next=switchEquipment(state.good,'Furina','artifacts','1','flower',catalog),after=calculateTeam(next,'Furina',s);
 assert.notEqual(before.members.find(m=>m.key==='Albedo').panel.hp,after.members.find(m=>m.key==='Albedo').panel.hp);assert.notEqual(comboDamage(original,'Furina',s,before).value,comboDamage(next,'Furina',s,after).value);assert.deepEqual(state.good,original);
 assert.throws(()=>switchEquipment(state.good,'Barbara','weapons','0','',catalog),/武器类型/);
 const reactions=structuredClone(s);reactions.reaction='vaporize';assert.equal(calculateTeam(original,'Furina',reactions).members.find(m=>m.key==='Barbara').rows.find(r=>r.path==='normal.0')?.reaction,undefined);
});

test('全120角色与旅行者14元素推荐均可校验、离线使用，区分生命/攻击/防御治疗与反应玩法',()=>{
 const state=blankState();for(const[key,m]of Object.entries(catalog.characters)){const g=recommendedGoal(key,m.element),p=recommendationFor(key);assert.ok(p?.source.url);assert.match(p.source.url,/keqingmains/);assert.ok(g.effectiveRolls>0);assert.notEqual(g.role,'custom');assert.ok(Object.values(g.weights).some(v=>v>0));state.goals[key]=g;}
 assert.equal(Object.keys(state.goals).length,134);validateState(state,data);
 assert.equal(state.goals.Charlotte.weights.atk_,1);assert.equal(state.goals.Charlotte.weights.hp_,0);assert.equal(state.goals.Xilonen.weights.def_,1);assert.equal(state.goals.KukiShinobu.weights.critRate_,0);assert.equal(state.goals.Mavuika.weights.enerRech_,0);assert.equal(state.goals.Skirk.weights.enerRech_,0);assert.equal(state.goals.Nahida.weights.critRate_,1);
 const help=goalHelpHTML('Furina');assert.match(help,/7.25|不会改变伤害公式/);assert.match(help,/data-ae="apply-recommendation"/);assert.doesNotMatch(help,/<details[^>]*\bopen\b/);
});
