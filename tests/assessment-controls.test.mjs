import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankState,validateState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {recommendedGoal} from '../modules/character-assessment/core/profiles.mjs';
import {resetGoalGroup} from '../modules/character-assessment/core/actions.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
import {blocksLockedButton,blocksLockedInput} from '../modules/character-assessment/core/permissions.mjs';
import {readWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {draftFromArtifact} from '../modules/character-assessment/core/artifacts.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
import {join} from 'node:path';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const artifact={setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location:'Furina',lock:true,id:'test-artifact'};
const sample=()=>{const s=blankState();s.good.characters=[{key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}];s.selected='Furina';s.good.artifacts=[structuredClone(artifact)];s.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true}];return s;};
const target=(dataset={},attributes={})=>({dataset,id:'',value:'',hasAttribute:k=>Object.hasOwn(attributes,k),checkValidity:()=>true});
function fixture(locked){
  const state=sample(),pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,append(){}};let changes=0;
  const bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',buildHTML:()=>'',changed:()=>changes++,toast:()=>{},selectCharacter:k=>state.selected=k,isReadOnly:()=>locked});
  return{state,pane,bench,changes:()=>changes};
}
test('分组恢复默认在锁定时可用，只恢复所选设置且保留装备与已保存队伍',async()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null};
  try{
    const {state,pane,bench}=fixture(true),defaults=recommendedGoal('Furina','hydro');
    state.good.characters.push({key:'Albedo',level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:6}});
    state.goals.Albedo=recommendedGoal('Albedo','geo');
    const g=structuredClone(defaults);g.level=70;g.talent.skill=3;g.weights.critRate_=0;g.mainStats.sands=['atk_'];g.mainStats.goblet=['atk_'];g.mainStats.circlet=['atk_'];g.sets=['GoldenTroupe'];g.panel={hp:40000};g.notes='自定义说明';state.goals.Furina=g;
    const originalGOOD=structuredClone(state.good),otherGoal=structuredClone(state.goals.Albedo);
    for(const group of ['targets','weights','sands','goblet','circlet','sets','panel','notes']){
      const before=structuredClone(state.goals.Furina),expected=structuredClone(before);
      if(group==='targets')for(const k of ['level','ascension','weaponLevel','talent','effectiveRolls'])expected[k]=structuredClone(defaults[k]);
      else if(['sands','goblet','circlet'].includes(group))expected.mainStats[group]=structuredClone(defaults.mainStats[group]);
      else expected[group]=structuredClone(defaults[group]);
      resetGoalGroup(state,'Furina',group,{element:'hydro'});assert.deepEqual(state.goals.Furina,expected);
    }
    state.goals.Furina.role='healer';state.goals.Furina.panel.hp=50000;
    resetGoalGroup(state,'Furina','all',{element:'hydro'});assert.deepEqual(state.goals.Furina,{...defaultGoal('healer','hydro'),effectiveRolls:0});
    assert.deepEqual(state.goals.Albedo,otherGoal);assert.equal(blocksLockedButton(target({ae:'reset-goal'})),false);
    const row=bench.getResult().rows.find(r=>r.group==='skill'&&r.unit!=='%');
    const w=readWorkspace(state);w.scenarios.Furina={enemyLevel:80,resistance:20,members:['Albedo'],active:'Albedo',bonusStats:{atk:100},combo:[{path:row.path,count:2,reaction:''}],characters:{Albedo:{bonusStats:{def:20}}}};w.teamDraft={members:['Furina','Albedo'],scenario:structuredClone(w.scenarios.Furina)};state.engineStorage['wiki.native.v1']=JSON.stringify(w);
    await bench.click(target({native:'page-teams'}));
    for(const owner of ['Furina','Albedo']){
      const list=bench.getResult().conditions,index=list.findIndex(c=>c.owner===owner&&c.options.some(o=>o.value!==c.value));assert.ok(index>=0);
      const condition=list[index];await bench.change({...target({nativeCond:String(index)},{'data-native-cond':''}),value:condition.options.find(o=>o.value!==condition.value).value});
    }
    const configured=readWorkspace(state);configured.teams=[{id:'reset-test-team',name:'保留队伍',character:'Furina',scenario:structuredClone(configured.scenarios.Furina)}];state.engineStorage['wiki.native.v1']=JSON.stringify(configured);
    const savedTeams=structuredClone(configured.teams),teammateConditions=structuredClone(configured.teamDraft.scenario.characters.Albedo.conditional);
    const reset=async(group,owner)=>{const button=target({native:'reset-scenario-group',group,...(owner?{owner}:{})});assert.equal(blocksLockedButton(button),false);await bench.click(button);};
    await reset('conditions','Furina');let s=readWorkspace(state).teamDraft.scenario;assert.equal(s.conditional,undefined);assert.deepEqual(s.characters.Albedo.conditional,teammateConditions);assert.deepEqual(s.bonusStats,{atk:100});
    await reset('conditions');s=readWorkspace(state).teamDraft.scenario;assert.equal(s.characters.Albedo.conditional,undefined);assert.deepEqual(s.characters.Albedo.bonusStats,{def:20});
    assert.match(pane.innerHTML,/data-group="bonus"/);assert.match(pane.innerHTML,/data-group="combo"/);
    await reset('bonus');s=readWorkspace(state).teamDraft.scenario;assert.equal(s.bonusStats,undefined);assert.equal(s.combo.length,1);
    await reset('combo');s=readWorkspace(state).teamDraft.scenario;assert.deepEqual(s.combo,[]);assert.equal(s.enemyLevel,80);assert.equal(s.resistance,20);assert.deepEqual(s.members,['Albedo']);assert.equal(s.active,'Albedo');
    assert.deepEqual(readWorkspace(state).teams,savedTeams);assert.deepEqual(state.good,originalGOOD);validateState(state,data);
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('锁定时只读分析入口可用，所有圣遗物编辑入口和草稿输入被阻止',async()=>{
  const prior=globalThis.document,content={innerHTML:''},listeners={};let bench;
  const dialog={open:false,setAttribute(){},addEventListener(k,f){listeners[k]=f;},querySelector:()=>content,showModal(){this.open=true;},close(){this.open=false;listeners.close();},remove(){}};
  globalThis.document={activeElement:null,body:{style:{overflow:''}},createElement:()=>dialog};
  try{
    const f=fixture(true),{state,pane}=f;bench=f.bench;const before=structuredClone(state);
    bench.openArtifact(0);assert.equal(dialog.open,true);assert.doesNotMatch(pane.innerHTML,/data-custom-editor/);assert.match(content.innerHTML,/档位组合/);assert.doesNotMatch(content.innerHTML,/data-custom-editor|<input/);
    assert.equal(blocksLockedButton(target({ae:'artifact-details'})),false);assert.equal(blocksLockedButton(target({native:'view-artifact'})),false);
    for(const action of ['new-artifact','new-custom','edit-artifact','custom-from-artifact','edit-custom','artifact-mode','save-custom','custom-to-inventory']){
      const button=target({native:action,index:'0'});assert.equal(blocksLockedButton(button),true);await assert.rejects(bench.click(button),/锁定/);
    }
    const input=target({customField:'level'},{'data-custom-field':''});input.value='10';assert.equal(blocksLockedInput(input),true);await assert.rejects(bench.change(input),/锁定/);
    assert.deepEqual(state,before);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('可连续新增队伍，重命名保留原条件，保存只更新所选队伍',async()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null};
  try{
    const {state,bench}=fixture(true),original=structuredClone(state.good);
    await bench.click(target({native:'new-team'}));await bench.change({...target({nativeTeamName:''},{'data-native-team-name':''}),value:'双水队'});
    const first=readWorkspace(state).teams[0];assert.equal(first.name,'双水队');
    await bench.click(target({native:'new-team'}));await bench.change({...target({nativeSetting:'enemyLevel'}),type:'number',value:'80'});
    await bench.change({...target({nativeTeamName:''},{'data-native-team-name':''}),value:'第二队'});await bench.click(target({native:'save-team'}));
    let teams=readWorkspace(state).teams;assert.equal(teams.length,2);assert.deepEqual(teams[0],first);assert.equal(teams[1].name,'第二队');assert.equal(teams[1].scenario.enemyLevel,80);assert.notEqual(teams[0].id,teams[1].id);
    await bench.change({...target({nativeTeamSelect:''},{'data-native-team-select':''}),value:first.id});await bench.change({...target({nativeTeamName:''},{'data-native-team-name':''}),value:'改名双水队'});
    teams=readWorkspace(state).teams;assert.equal(teams[0].name,'改名双水队');assert.deepEqual(teams[0].scenario,first.scenario);assert.equal(teams[1].name,'第二队');assert.deepEqual(state.good,original);validateState(state,data);
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('取消圣遗物编辑或添加丢弃草稿，不修改库存与工作区',async()=>{
  const prior=globalThis.document,content={innerHTML:'',querySelectorAll:()=>[]};let dialog,bench;
  globalThis.document={activeElement:null,body:{style:{overflow:''}},createElement:()=>{
    const listeners={};dialog={open:false,setAttribute(){},addEventListener(k,f){listeners[k]=f;},querySelector:()=>content,showModal(){this.open=true;},close(){this.open=false;listeners.close();},remove(){}};return dialog;
  }};
  try{
    const f=fixture(false),{state,pane,changes}=f,before=structuredClone(state);bench=f.bench;
    bench.openArtifact(0);assert.equal(dialog.open,true);assert.match(content.innerHTML,/data-native="cancel-artifact"/);assert.doesNotMatch(pane.innerHTML,/data-custom-editor/);
    await bench.change({...target({customCount:'0',tier:'3'},{'data-custom-count':''}),value:'5'});await bench.click(target({native:'cancel-artifact'}));
    assert.equal(dialog.open,false);assert.doesNotMatch(pane.innerHTML,/data-custom-editor/);assert.deepEqual(state,before);
    await bench.click(target({native:'new-artifact'}));assert.equal(dialog.open,true);await bench.click(target({native:'cancel-artifact'}));assert.deepEqual(state,before);assert.equal(changes(),0);assert.equal(globalThis.document.body.style.overflow,'');
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('保存接口在锁定时允许独立自定义圣遗物及队伍配置，原始实际资料保持隔离',async()=>{
  const folder=await createTestWorkspace('assessment-artifact-lock'),store=createAccountStore(join(folder,'assessment.sqlite'));
  try{
    const state=sample();state.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,scenarios:{},teams:[],plans:{},customArtifacts:[{id:'theory',name:'原配置',draft:draftFromArtifact(artifact,data)}]});
    const imported=store.action({action:'create',name:'检查账号',state},data),changed=structuredClone(imported.state),w=readWorkspace(changed);w.teams.push({id:'team',name:'新队伍',character:'Furina',scenario:{enemyLevel:80}});changed.engineStorage['wiki.native.v1']=JSON.stringify(w);
    let saved=store.write({accountId:imported.account.id,revision:imported.revision,state:changed},data);assert.equal(saved.account.locked,true);
    for(const edit of [w=>w.customArtifacts[0].name='新配置',w=>w.customArtifacts.pop(),w=>w.customArtifacts.push({...structuredClone(w.customArtifacts[0]),id:'new'})]){
      const changed=structuredClone(imported.state),native=readWorkspace(changed);edit(native);changed.engineStorage['wiki.native.v1']=JSON.stringify(native);saved=store.write({accountId:saved.account.id,revision:saved.revision,state:changed},data);assert.deepEqual(saved.state.good,imported.state.good);
    }
    assert.deepEqual(store.original(saved.account.id).state,state);
  }finally{store.close();await cleanupTestWorkspace(folder);}
});
