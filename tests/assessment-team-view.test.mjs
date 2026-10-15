import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {basePanel} from '../modules/character-assessment/core/evaluate.mjs';
import {recommendedGoal} from '../modules/character-assessment/core/profiles.mjs';
import {idlePanel,calculateTeam,comboDamage,captureTeamPlan,goodWithPlan,upgradeReference,artifactReplacementPreview} from '../modules/character-assessment/core/combat.mjs';
import {readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
import {characterArtifactHTML,openArtifactDialog} from '../modules/character-assessment/analysis-dialog.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const artifact=(setKey,slotKey,location,id)=>({setKey,slotKey,rarity:5,level:20,mainStatKey:slotKey==='flower'?'hp':'atk',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location,lock:true,id});
function sample(){
  const state=blankState();state.selected='Furina';
  state.good.characters=['Furina','Barbara','Albedo'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));
  state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true,id:'f-weapon'}];
  state.good.artifacts=[artifact('GoldenTroupe','flower','Furina','f-flower'),artifact('GoldenTroupe','plume','Furina','f-plume'),artifact('HuskOfOpulentDreams','flower','Albedo','a-flower'),artifact('HuskOfOpulentDreams','plume','Albedo','a-plume')];
  state.goals.Furina=recommendedGoal('Furina','hydro');
  const w=readWorkspace(state);w.scenarios.Furina={members:['Barbara','Albedo'],active:'Furina',enemyLevel:100,resistance:10,bonusStats:{atk:120},conditional:{},characters:{Albedo:{bonusStats:{def:80}}},combo:[]};w.teamDraft={members:['Furina','Barbara','Albedo'],scenario:structuredClone(w.scenarios.Furina)};writeWorkspace(state,w);return state;
}
const target=(dataset={},attrs={})=>({dataset,value:'',type:'',hasAttribute:k=>Object.hasOwn(attrs,k),checkValidity:()=>true});

test('非战斗面板保留常驻套装加成，队伍各成员面板与组合分别计算',()=>{
  const state=sample();state.good.characters.push({key:'Noelle',level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}});
  const good=structuredClone(state.good),s=readWorkspace(state).scenarios.Furina;s.members.push('Noelle');
  const idle=idlePanel(good,'Furina'),team=calculateTeam(good,'Furina',s);
  assert.equal(team.members.length,4);assert.ok(team.members.every(m=>m.panel&&!m.error));
  assert.ok(team.members.find(m=>m.key==='Furina').panel.hp>idle.hp);
  assert.ok(team.members.find(m=>m.key==='Furina').panel.atk>idle.atk);
  const albedo=good.characters.find(c=>c.key==='Albedo'),arts=good.artifacts.filter(a=>a.location==='Albedo');
  assert.ok(idlePanel(good,'Albedo').def>basePanel(albedo,null,arts,data).def);
  const furina=team.rows.find(r=>r.owner==='Furina'&&r.group==='skill'),albedoRow=team.rows.find(r=>r.owner==='Albedo'&&r.group==='skill');
  s.combo=[{owner:'Furina',path:furina.path,count:2,reaction:''},{owner:'Albedo',path:albedoRow.path,count:3,reaction:''}];
  assert.ok(Math.abs(comboDamage(good,'Furina',s,team).value-(furina.average*2+albedoRow.average*3))<1e-6);
  assert.deepEqual(idlePanel(good,'Furina'),idle);assert.deepEqual(state.good,good);
});

test('队伍配装方案兼容原有方案，试算与收益计算不修改实际装备',async()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null,querySelector:()=>null};
  const folder=await createTestWorkspace('assessment-team-view');let store,router;
  try{
    const state=sample(),original=structuredClone(state.good),s=readWorkspace(state).scenarios.Furina;
    const saved=captureTeamPlan(state.good,'Furina',s,'全队方案');assert.equal(saved.teamBuilds.length,3);
    state.good.characters.find(c=>c.key==='Albedo').talent.skill=10;
    const restored=goodWithPlan(state.good,'Furina',saved);assert.equal(restored.characters.find(c=>c.key==='Albedo').talent.skill,9);
    const legacy={character:saved.character,weapon:saved.weapon,artifacts:saved.artifacts,scenario:s};
    assert.equal(goodWithPlan(state.good,'Furina',legacy).characters.find(c=>c.key==='Albedo').talent.skill,10);
    state.good=original;const w=readWorkspace(state);w.plans.Furina=[saved];w.teamPlans=[{...structuredClone(saved),id:'test-plan',teamId:''}];writeWorkspace(state,w);
    const pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};let updates=0;
    let evaluationUpdates=0;
    const bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>updates++,toast:()=>{},isReadOnly:()=>true,onEvaluationChange:()=>evaluationUpdates++});
    bench.render();assert.equal(bench.getPage(),'teams');assert.doesNotMatch(pane.innerHTML,/data-native-page="characters"/);assert.match(pane.innerHTML,/data-team-panel="loadouts"/);assert.match(pane.innerHTML,/data-team-panel-results/);assert.doesNotMatch(pane.innerHTML,/<summary>提升收益参考/);
    await bench.click(target({native:'preview-plan',index:'0'}));assert.match(pane.innerHTML,/当前配装：队伍方案：全队方案/);assert.deepEqual(state.good,original);
    await assert.rejects(bench.click(target({native:'apply-plan',index:'0'})),/锁定/);
    await bench.click(target({native:'clear-plan-preview'}));assert.deepEqual(state.good,original);
    const row=calculateTeam(state.good,'Furina',s).rows.find(r=>r.owner==='Albedo'&&r.group==='skill');
    const reference=upgradeReference(state.good,'Furina',s,data,{owner:row.owner,path:row.path});assert.ok(reference.length>0);assert.ok(reference.every(r=>Number.isFinite(r.delta)));assert.deepEqual(state.good,original);
    assert.match(bench.upgradeHTML(),/提升收益参考/);
    await bench.change({...target({}, {'data-native-upgrade-target':''}),value:JSON.stringify({owner:row.owner,path:row.path})});
    await assert.rejects(bench.click(target({native:'upgrade'})),/只选择当前角色/);
    const own=calculateTeam(state.good,'Furina',{}).rows.find(r=>r.owner==='Furina'&&r.group==='skill');
    await bench.change({...target({}, {'data-native-upgrade-target':''}),value:JSON.stringify({owner:own.owner,path:own.path})});
    await bench.click(target({native:'upgrade'}));assert.ok(evaluationUpdates>0);assert.match(bench.upgradeHTML(),/<th>期望值增加量<\/th>/);
    state.good.characters[0].talent.auto=2;assert.doesNotMatch(bench.upgradeHTML(),/<th>期望值增加量<\/th>/);state.good.characters[0].talent.auto=1;
    assert.deepEqual(state.good,original);validateState(state,data);
    store=createAccountStore(join(folder,'assessment.sqlite'));const account=store.action({action:'create',name:'测试账号',state},data);
    const after=structuredClone(account.state),workspace=readWorkspace(after);workspace.plans.Furina[0].name='另一个名称';writeWorkspace(after,workspace);
    store.write({accountId:account.account.id,revision:account.revision,state:after},data);
    assert.equal(store.read(account.account.id).account.locked,true);assert.deepEqual(store.read(account.account.id).state.good,original);
    const broken=structuredClone(state);const invalid=readWorkspace(broken);invalid.plans.Furina[0].teamBuilds[1].character.level=999;writeWorkspace(broken,invalid);assert.throws(()=>validateState(broken,data),/队伍配装方案/);
    router=createAssessmentRouter({storagePath:join(folder,'route.sqlite'),json:()=>{},body:()=>{}});
    for(const resource of ['core/combat.mjs','analysis-dialog.mjs']){let status;await router.handle({method:'HEAD'},{setHeader(){},writeHead(code){status=code;},end(){}},new URL('http://localhost/assessment/'+resource));assert.equal(status,200);}
  }finally{router?.close();store?.close();await cleanupTestWorkspace(folder);if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('队伍伤害按角色分开展示，各角色表格仅包含自己的计算过程入口',()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null,querySelector:()=>null};
  try{
    const state=sample(),pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
    const bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>{},toast:()=>{}});
    bench.render();
    assert.equal((pane.innerHTML.match(/class="ae-damage-member"/g)??[]).length,3);
    for(const owner of ['Furina','Barbara','Albedo']){
      const block=pane.innerHTML.match(new RegExp('data-damage-owner="'+owner+'"[\\s\\S]*?(?=<details class="ae-damage-member"|$)'))?.[0];
      assert.ok(block);assert.match(block,/<th>计算项目<\/th>/);assert.match(block,/<details class="ae-calculation-group"/);
      const traceOwners=[...block.matchAll(/data-native="trace" data-owner="([^"]+)"/g)].map(m=>m[1]);
      assert.ok(traceOwners.length);assert.ok(traceOwners.every(k=>k===owner));assert.match(block,new RegExp('data-native-trace="'+owner+'"'));
    }
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('圣遗物单件和五件分析共用角色权重，分析浮层关闭恢复滚动与焦点',()=>{
  const state=sample(),settings={character:state.good.characters[0],good:state.good,goal:state.goals.Furina,catalog,data,slotKey:'flower'};
  for(const [slot,mainStatKey] of [['sands','atk_'],['goblet','hydro_dmg_'],['circlet','critRate_']])state.good.artifacts.push({...artifact('GoldenTroupe','flower','Furina','f-'+slot),slotKey:slot,mainStatKey,substats:state.good.artifacts[0].substats.filter(s=>s.key!==mainStatKey)});
  const single=characterArtifactHTML(settings),all=characterArtifactHTML({...settings,all:true});
  assert.doesNotMatch(single,/ae-artifact-overview|data-analysis-slot/);assert.match(single,/生之花/);assert.match(single,/档位组合/);assert.doesNotMatch(single,/<input|data-custom-editor/);
  assert.equal((single.match(/class="ae-analysis-piece"/g)??[]).length,1);assert.equal((all.match(/class="ae-analysis-piece"/g)??[]).length,5);
  for(const slot of ['flower','plume','sands','goblet','circlet'])assert.match(all,new RegExp('data-analysis-part="'+slot+'"'));
  const partial=characterArtifactHTML({...settings,good:{...state.good,artifacts:state.good.artifacts.slice(0,2)},all:true});assert.match(partial,/未填写/);
  const prior=globalThis.document;let focused=0,removed=0,closed=0,positioned=0;const content={innerHTML:''},listeners={},part={open:false,scrollIntoView(){positioned++;},querySelector:()=>({focus(){}})};
  const dialog={open:false,className:'',innerHTML:'',setAttribute(){},addEventListener(k,f){listeners[k]=f;},querySelector:q=>q==='[data-analysis-content]'?content:q==='[data-analysis-part="plume"]'?part:null,showModal(){this.open=true;},close(){this.open=false;listeners.close();},remove(){removed++;}};
  globalThis.document={activeElement:{isConnected:true,focus(){focused++;}},body:{style:{overflow:'auto'}},createElement:()=>dialog};
  try{
    const view=openArtifactDialog({...settings,root:{append(){}},all:true,onClose:()=>closed++});assert.equal(dialog.open,true);assert.equal(document.body.style.overflow,'hidden');
    const before=content.innerHTML;listeners.click({target:{closest:q=>q==='[data-analysis-slot]'?{dataset:{analysisSlot:'plume'}}:null}});assert.equal(content.innerHTML,before);assert.equal(part.open,true);assert.equal(positioned,1);
    listeners.cancel({preventDefault(){}});assert.equal(document.body.style.overflow,'auto');assert.equal(focused,1);assert.equal(removed,1);assert.equal(closed,1);view.close();assert.equal(removed,1);
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('队伍配置自动保存并恢复所选队伍，评价角色选择不再改变队伍',async()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null};
  try{
    let state=sample();const original=structuredClone(state.good),pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};let updates=0;
    const make=()=>createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>updates++,toast:()=>{},selectCharacter:k=>state.selected=k,isReadOnly:()=>true});
    let bench=make();await bench.click(target({native:'new-team'}));const first=readWorkspace(state).teams[0].id;
    await bench.change({...target({}, {'data-native-team-name':''}),value:'自动保存测试队'});
    await bench.change({...target({nativeSetting:'enemyLevel'}),type:'number',value:'120'});
    await bench.change({...target({nativeSetting:'active'}),value:'Albedo'});
    await bench.change({...target({nativeBonus:'atk'}),type:'number',value:'180'});
    const condition=bench.getResult().conditions.findIndex(c=>c.options.some(o=>o.value!==c.value));assert.ok(condition>=0);
    const value=bench.getResult().conditions[condition].options.find(o=>o.value!==bench.getResult().conditions[condition].value).value;
    await bench.change({...target({nativeCond:String(condition)}, {'data-native-cond':''}),value});
    await bench.click(target({native:'add-combo'}));
    const configured=structuredClone(readWorkspace(state));assert.equal(configured.teams[0].scenario.enemyLevel,120);
    await bench.click(target({native:'new-team'}));const second=readWorkspace(state).teams[1].id;
    await bench.change({...target({nativeSetting:'enemyLevel'}),type:'number',value:'80'});
    await bench.change({...target({}, {'data-native-team-select':''}),value:first});
    bench.dispose();state=JSON.parse(JSON.stringify(state));bench=make();bench.render();
    assert.match(pane.innerHTML,new RegExp('value="'+first+'" selected'));assert.match(pane.innerHTML,/自动保存测试队/);
    assert.deepEqual(readWorkspace(state).scenarios.Furina,configured.scenarios.Furina);assert.equal(readWorkspace(state).teams[1].scenario.enemyLevel,80);
    await bench.click(target({native:'reset-scenario-group',group:'bonus'}));assert.equal(readWorkspace(state).teams[0].scenario.bonusStats,undefined);assert.equal(readWorkspace(state).activeTeamId,first);
    assert.equal(readWorkspace(state).teams[1].id,second);assert.deepEqual(state.good,original);assert.ok(updates>0);validateState(state,data);
    state.selected='Barbara';bench.reset();bench.render();assert.equal(bench.getResult().members.length,3);assert.equal(bench.getResult().members[0].key,'Furina');assert.doesNotMatch(pane.innerHTML,/当前查看/);bench.dispose();
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('圣遗物词条浮层保持只读，库存取消替换对比入口',async()=>{
  const prior=globalThis.document,content={innerHTML:'',querySelectorAll:()=>[]};let dialog,listeners,removed=0,focused=0,bench;
  globalThis.document={activeElement:{isConnected:true,closest:()=>null,focus(){focused++;}},body:{style:{overflow:'auto'}},createElement:()=>{
    listeners={};dialog={open:false,setAttribute(){},addEventListener(k,f){listeners[k]=f;},querySelector:()=>content,showModal(){this.open=true;},close(){this.open=false;listeners.close();},remove(){removed++;}};return dialog;
  }};
  try{
    const state=sample(),w=readWorkspace(state),scenario=w.scenarios.Furina;
    w.teams=[{id:'barbara-team',name:'芭芭拉队',character:'Barbara',scenario:{members:['Furina','Albedo'],enemyLevel:85,resistance:20,conditional:{},characters:{},combo:[]}}];writeWorkspace(state,w);
    const before=structuredClone(state),candidate=state.good.artifacts[2],preview=artifactReplacementPreview(state.good,'Furina',scenario,'Furina',candidate,2);
    assert.equal(preview.after.good.artifacts[2].location,'Furina');assert.equal(preview.after.good.artifacts[0].location,'');assert.equal(preview.after.good.artifacts.filter(a=>a.location==='Albedo'&&a.slotKey==='flower').length,0);
    assert.notEqual(preview.before.members.find(m=>m.key==='Albedo').panel.def,preview.after.members.find(m=>m.key==='Albedo').panel.def);
    const pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false,append(){}};
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>{throw Error('只读对比不应保存');},toast:()=>{},isReadOnly:()=>true});
    await bench.click(target({nativePage:'artifacts'}));const html=pane.innerHTML;
    await bench.click(target({native:'view-artifact',index:'2'}));assert.equal(dialog.open,true);assert.match(content.innerHTML,/档位组合/);assert.doesNotMatch(content.innerHTML,/data-custom-editor/);assert.equal(pane.innerHTML,html);
    listeners.cancel({preventDefault(){}});assert.equal(document.body.style.overflow,'auto');assert.equal(focused,1);
    assert.doesNotMatch(pane.innerHTML,/data-native="compare-artifact"|替换对比/);assert.deepEqual(state,before);bench.dispose();assert.equal(document.body.style.overflow,'auto');assert.equal(removed,1);assert.equal(pane.innerHTML,html);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
