import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {createWorkbench,filterTeamEquipment} from '../modules/character-assessment/workbench.mjs';
import {recommendationFor,characterGuideHTML,recommendedGoal} from '../modules/character-assessment/core/profiles.mjs';
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const input=(dataset,value)=>({dataset,value,hasAttribute:k=>Object.hasOwn(dataset,k.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),checkValidity:()=>true});

test('锁定账号通过装备浮层筛选、分页与选择后只改变队伍试算，200件之后的库存仍可选择',async()=>{
  const prior=globalThis.document;let dialog,bench;
  const root={append(node){dialog=node;}};
  globalThis.document={activeElement:null,body:{style:{overflow:'auto'}},createElement(){
    const content={innerHTML:'',querySelectorAll:()=>[]},handlers={};
    return {handlers,content,open:false,setAttribute(){},addEventListener(k,fn){handlers[k]=fn;},querySelector:s=>s==='[data-analysis-content]'?content:null,showModal(){this.open=true;},close(){this.open=false;handlers.close?.();},remove(){this.removed=true;}};
  }};
  try{
    const state=blankState();state.selected='Furina';state.good.characters=['Furina','Albedo'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));
    state.goals.Furina=recommendedGoal('Furina','hydro');
    state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true},{key:'HarbingerOfDawn',level:90,ascension:6,refinement:5,location:'Albedo',lock:false},{key:'ThrillingTalesOfDragonSlayers',level:90,ascension:6,refinement:5,location:'',lock:false}];
    const artifact=(setKey,location)=>({setKey,slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location,lock:false});
    state.good.artifacts=[artifact('GoldenTroupe','Furina'),artifact('HuskOfOpulentDreams','Albedo'),...Array.from({length:205},()=>artifact('GoldenTroupe',''))];
    const w=readWorkspace(state);w.teamDraft={members:['Furina','Albedo'],scenario:{...defaultScenario(),members:['Albedo']}};writeWorkspace(state,w);
    const original=structuredClone(state.good),pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false,closest:()=>root};
    const messages=[];bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>{},toast:t=>messages.push(t),isReadOnly:()=>true});bench.render();
    assert.match(pane.innerHTML,/ae-loadout-row/);assert.doesNotMatch(pane.innerHTML,/仅显示前200件|搜索缩小/);
    const emit=(type,target)=>dialog.handlers[type]({target,stopPropagation(){}}),action=(name,index='',direction='')=>({dataset:{teamPickerAction:name,index,direction},disabled:false,closest:selector=>selector==='[data-team-picker-action]'?action(name,index,direction):null});
    await bench.click({dataset:{native:'open-team-equipment',member:'Furina',kind:'artifacts',slot:'flower'}});
    assert.equal(document.body.style.overflow,'hidden');assert.match(dialog.content.innerHTML,/207 件候选/);assert.equal((dialog.content.innerHTML.match(/data-team-picker-action="choose"/g)??[]).length,24);
    emit('click',action('page','','8'));assert.match(dialog.content.innerHTML,/data-index="206"/);
    emit('change',input({teamPickerFilter:'set'},'HuskOfOpulentDreams'));assert.match(dialog.content.innerHTML,/1 件候选/);
    const filter={set:'HuskOfOpulentDreams',rarity:'5',main:'hp',subs:['critRate_','critDMG_'],subMode:'all',subMin:{critRate_:4},minCV:'',minEffective:'',minLevel:'',maxLevel:'',sort:'level-desc'};
    assert.equal(filterTeamEquipment(state.good,'Furina','artifacts','flower',catalog,data,filter,state.goals.Furina.weights).length,0);
    filter.subMin.critRate_=3;assert.deepEqual(filterTeamEquipment(state.good,'Furina','artifacts','flower',catalog,data,filter,state.goals.Furina.weights).map(x=>x.i),[1]);
    emit('click',action('choose','1'));assert.equal(document.body.style.overflow,'auto');assert.deepEqual(state.good,original);assert.match(pane.innerHTML,/比较基准 → 当前试算/);
    await bench.click({dataset:{native:'open-team-equipment',member:'Furina',kind:'weapons',slot:''}});
    assert.match(dialog.content.innerHTML,/2 件候选/);assert.doesNotMatch(dialog.content.innerHTML,/data-team-picker-action="choose" data-index="2"/);
    emit('change',input({teamPickerFilter:'stat'},'critDMG_'));emit('change',input({teamPickerFilter:'lock'},'unlocked'));assert.match(dialog.content.innerHTML,/1 件候选/);
    emit('click',action('choose','1'));assert.deepEqual(state.good,original);assert.match(pane.innerHTML,/黎明神剑/);
    await assert.rejects(bench.click({dataset:{native:'apply-team-trial'}}),/锁定/);assert.deepEqual(state.good,original);assert.deepEqual(messages,[]);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('全角色攻略关联有效武器和四位置配队，旅行者保持元素，阅读不修改目标和装备',()=>{
  const state=blankState(),original=structuredClone(state);let count=0;
  for(const[key,m]of Object.entries(catalog.characters)){
    const guide=recommendationFor(key)?.guide;assert.ok(guide?.weapons.length,key);assert.ok(guide?.teams.length,key);
    for(const w of guide.weapons){assert.equal(catalog.weapons[w.key]?.weaponType,m.weaponType,key+' '+w.key);assert.ok(w.note);}
    for(const t of guide.teams){assert.equal(t.slots.length,4);for(const slot of t.slots){assert.ok(slot.label);assert.doesNotMatch(slot.label,/[a-z]{3,}/i);for(const id of slot.characters)assert.ok(catalog.characters[id],id);}}
    const html=characterGuideHTML(key,catalog,state.good);assert.match(html,/推荐武器|推荐圣遗物|配队示例/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);assert.match(html,/keqingmains\.com/);count++;
  }
  assert.equal(count,134);assert.deepEqual(state,original);
  for(const key of ['TravelerCryoF','TravelerCryoM'])assert.ok(recommendationFor(key).guide.teams.every(t=>t.slots[0].characters[0]===key));
});
