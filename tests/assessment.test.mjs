import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from '../scripts/test-resources.mjs';
import {blankState,defaultGoal,importPreview,mergeGOOD,validateGOOD,validateState} from '../modules/character-assessment/core/model.mjs';
import {basePanel,rollValues,evaluate} from '../modules/character-assessment/core/evaluate.mjs';
import {calculateBuild} from '../modules/character-assessment/core/calculator.mjs';
import {readWorkspace} from '../modules/character-assessment/workbench.mjs';
const data=JSON.parse(await readFile(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url),'utf8'));
const character={key:'Furina',level:90,ascension:6,constellation:2,talent:{auto:6,skill:10,burst:10}};
const weapon={key:'FavoniusSword',level:90,ascension:6,refinement:5,location:'Furina',lock:false};
const artifact={setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location:'Furina',lock:false};
test('养成概览的圣遗物总双暴计入理之冠主词条，不计武器与角色双暴',()=>{
  const flower=structuredClone(artifact),goal=defaultGoal('hp','hydro');
  const good={format:'GOOD',version:3,characters:[character],weapons:[{...weapon,key:'HarbingerOfDawn'}],artifacts:[]};
  assert.equal(evaluate(character,good,goal,data).totalCV,0);
  for(const [mainStatKey,rarity,level,expected]of [['critRate_',5,20,85.6],['critDMG_',5,20,85.6],['hp_',5,20,23.4],['critRate_',5,0,32.8],['critRate_',4,16,69.8]]){
    const head={...artifact,slotKey:'circlet',mainStatKey,rarity,level,substats:[{key:mainStatKey==='critDMG_'?'critRate_':'critDMG_',value:mainStatKey==='critDMG_'?3.9:7.8}]};
    good.artifacts=[flower,head];const result=evaluate(character,good,goal,data);
    assert(Math.abs(result.totalCV-expected)<1e-6,`${mainStatKey} ${rarity}星 +${level}: ${result.totalCV}`);
    assert(Math.abs(result.pieces.filter(p=>p.rolls).reduce((sum,p)=>sum+p.rolls.cv,0)-23.4)<1e-6);
  }
});

test('基础面板使用原始曲线、武器白值和圣遗物百分比，角色机制留给完整引擎',()=>{
  const panel=basePanel(character,weapon,[],data);assert(Math.abs(panel.hp-15307.38835)<.001);assert(Math.abs(panel.atk-698.3251021)<.001);assert.equal(panel.critRate_,24.2);assert(Math.abs(panel.enerRech_-161.2531802)<.001);
  const equipped=basePanel(character,weapon,[artifact],data);assert(Math.abs(equipped.hp-(panel.hp*1.058+4780))<1);assert(Math.abs(equipped.critRate_-28.1)<.001);assert.equal(equipped.critDMG_,57.8);
});
test('实际词条次数与等效词条分开，生命角色按生命权重评价，无法匹配的数值不认定达标',()=>{
  const weighted=rollValues(artifact,data,{hp_:1,enerRech_:1,critRate_:0,critDMG_:0});assert.equal(weighted.details[0].minCount,1);assert.equal(weighted.details[0].maxCount,1);assert(weighted.total>weighted.effective);assert.equal(weighted.cv,15.6);
  assert(rollValues({...artifact,substats:[{key:'critRate_',value:99}]},data,{}).invalid.length);
  const good={format:'GOOD',version:3,characters:[character],weapons:[weapon],artifacts:[artifact]},goal=defaultGoal('hp','hydro'),r=evaluate(character,good,goal,data);assert.equal(r.pieces.filter(p=>p.missing).length,4);assert(r.advice.some(a=>a.label==='时之沙'));assert.notEqual(r.grade,'已达自定目标');
});
test('GOOD 预览不改当前状态，重复导入不增加物品，保留未提供资料与评价目标',()=>{
  const state=blankState();state.good.characters=[character];state.goals.Furina=defaultGoal('hp','hydro');const original=structuredClone(state),incoming={format:'GOOD',version:3,source:'Example scanner',characters:[{...character,constellation:3}],weapons:[weapon],artifacts:[artifact]};
  const preview=importPreview(state,incoming,data);assert.deepEqual(state,original);assert.equal(preview.state.good.characters[0].constellation,3);assert.deepEqual(preview.state.goals,state.goals);
  const repeated=mergeGOOD(preview.state.good,incoming);assert.equal(repeated.artifacts.length,1);assert.equal(repeated.weapons.length,1);
  const partial=mergeGOOD(repeated,{format:'GOOD',version:3,characters:[{...character,level:80}]});assert.equal(partial.artifacts.length,1);assert.equal(partial.weapons.length,1);
});
test('未知角色保留并提示，缺失养成字段、非法装备及原型污染文件被拦截',()=>{
  const unknown=validateGOOD({format:'GOOD',version:3,characters:[{...character,key:'FutureCharacter'}]},data);assert.equal(unknown.errors.length,0);assert.equal(unknown.warnings.length,1);
  assert(validateGOOD({format:'GOOD',version:3,characters:[{key:'Furina'}]},data).errors.length);
  assert(validateGOOD({format:'GOOD',version:3,artifacts:[{...artifact,mainStatKey:'critRate_'}]},data).errors.length);
  assert.throws(()=>validateGOOD(JSON.parse('{"format":"GOOD","version":3,"__proto__":{"polluted":true}}'),data));
  const state=blankState();state.good.characters=[character];state.goals.Furina=defaultGoal('hp','hydro');assert.equal(validateState(state,data).game,'genshin');
});
test('模块接口独立保存、冲突保护和重启恢复，不修改收藏与材料计划',{timeout:35000},async()=>{
  const directory=await createTestWorkspace('assessment-api');let child;const base='http://127.0.0.1:4196';
  const start=async()=>{child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server.mjs','--port=4196'],{cwd:new URL('../',import.meta.url),env:{...process.env,WIKI_DB_PATH:join(directory,'wiki.sqlite'),WIKI_ASSESSMENT_DB_PATH:join(directory,'assessment.sqlite'),WIKI_BACKUP_DIR:join(directory,'backups')},windowsHide:true,stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('测试服务未启动');};
  try{
    await start();const bootstrap=await(await fetch(base+'/api/bootstrap')).json();const initial=await(await fetch(base+'/api/assessment/state')).json();assert.equal(initial.revision,0);
    const state=blankState();state.good.characters=[character];state.good.weapons=[weapon];state.good.artifacts=[artifact];state.goals.Furina=defaultGoal('hp','hydro');state.selected='Furina';
    const post=body=>fetch(base+'/api/assessment/state',{method:'POST',headers:{'Content-Type':'application/json','X-Wiki-Token':bootstrap.token},body:JSON.stringify(body)});
    assert.equal((await post({revision:0,state})).status,200);assert.equal((await post({revision:0,state})).status,409);
    assert.equal((await fetch(base+'/assessment/server.mjs')).status,404);assert.equal((await fetch(base+'/assessment/vendor/adapt.mjs')).status,404);assert.equal((await fetch(base+'/assessment/vendor/go/assets/index-Bt51vV7-.js')).status,404);
    assert.equal((await fetch(base+'/assessment/vendor/go/index.html')).status,404);const native=await fetch(base+'/assessment/core/calculator.mjs');assert.equal(native.status,200);assert(!native.headers.get('content-security-policy').includes('unsafe-eval'));
    const filters=await fetch(base+'/assessment/character-filters.mjs');assert.equal(filters.status,200);assert.match(filters.headers.get('content-type'),/^text\/javascript/);assert.match(await filters.text(),/export function characterPickerFiltersHTML/);
    const after=await(await fetch(base+'/api/bootstrap')).json();assert.deepEqual(after.favorites,bootstrap.favorites);assert.equal(await(await fetch(base+'/api/growth/genshin/plan')).json(),null);
    await stopTestProcess(child);await start();const restored=await(await fetch(base+'/api/assessment/state')).json();assert.equal(restored.revision,1);assert.equal(restored.state.good.characters[0].key,'Furina');assert.equal(restored.state.goals.Furina.role,'hp');
  }finally{await stopTestProcess(child);await cleanupTestWorkspace(directory);}
});

test('源码计算保留已知面板、蒸发和气氛值，队伍共鸣只计算一次',()=>{
  const c={...character,constellation:0},good={format:'GOOD',version:3,characters:[c],weapons:[weapon],artifacts:[]};
  const basic=calculateBuild(good,'Furina'),bubble=r=>r.rows.find(n=>n.path==='skill.bubbleDmg').average;
  assert(Math.abs(basic.panel.hp-15307.38835)<.001);assert(Math.abs(basic.panel.atk-698.3251021)<.001);assert(Math.abs(bubble(basic)-1065.0113259088444)<.001);
  assert(Math.abs(bubble(calculateBuild(good,'Furina',{reaction:'vaporize'}))-bubble(basic)*2)<.001);
  assert(Math.abs(bubble(calculateBuild(good,'Furina',{conditional:{Furina:{burstFanfare:'300'}}}))-bubble(basic)*1.75)<.001);
  const team={...good,characters:[c,...['Xingqiu','Bennett','Albedo'].map(key=>({key,level:80,ascension:6,constellation:0,talent:{auto:1,skill:8,burst:8}}))]};
  assert(Math.abs(calculateBuild(team,'Furina',{members:['Xingqiu','Bennett','Albedo'],active:'Bennett'}).panel.hp-basic.panel.hp*1.25)<.001);
  const arts=['flower','plume'].map((slotKey,i)=>({...artifact,slotKey,level:0,mainStatKey:i?'atk':'hp',substats:[]}));
  const set=calculateBuild({...good,artifacts:arts},'Furina');assert(Math.abs(bubble(set)/bubble(basic)-set.panel.hp/basic.panel.hp*1.2)<.001);
  assert(basic.conditions.some(c=>c.title==='气氛值'));assert(basic.rows.some(r=>r.label==='荒性泡沫伤害'));
});

test('原生工作区迁入队伍与条件并保留源数据及用户目标',()=>{
  const state=blankState();state.good.characters=[character,{key:'Xingqiu',level:80,ascension:6,constellation:0,talent:{auto:1,skill:8,burst:8}}];state.goals.Furina=defaultGoal('hp','hydro');
  state.engineStorage={teamchar_a:JSON.stringify({key:'Furina',conditional:{Furina:{burstFanfare:'300'}},bonusStats:{hp_:10}}),teamchar_b:JSON.stringify({key:'Xingqiu',conditional:{}}),team_main:JSON.stringify({name:'双水',enemyOverride:{enemyLevel:95},conditional:{resonance:{}},loadoutData:[{teamCharId:'a'},{teamCharId:'b'}]})};
  const original=structuredClone(state),w=readWorkspace(state);assert.deepEqual(state,original);assert.equal(w.teams[0].name,'双水');assert.equal(w.scenarios.Furina.enemyLevel,95);assert.deepEqual(w.scenarios.Furina.members,['Xingqiu']);assert.equal(w.scenarios.Furina.conditional.Furina.burstFanfare,'300');
  state.engineStorage['wiki.native.v1']=JSON.stringify(w);assert.equal(validateState(state,data).game,'genshin');assert.equal(readWorkspace(state).teams.length,1);
});
