import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {nativeKey,readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {createWorkbench,filterTeamCharacters} from '../modules/character-assessment/workbench.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';

const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const input=(dataset,value,type='')=>({dataset,value,type,hasAttribute:name=>Object.hasOwn(dataset,name.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),checkValidity:()=>true});

test('队伍元素和星级联合筛选保留已选成员；全部成员条件独立显示并自动保存，锁定时不修改实际资料',async()=>{
  const previousDocument=globalThis.document;
  globalThis.document={activeElement:null};
  let bench;
  try{
    const state=blankState();state.selected='Albedo';
    state.good.characters=['Furina','Barbara','Albedo','Mona','Kaeya'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:1,burst:1}}));
    const members=['Furina','Barbara','Albedo'];
    const scenario={...defaultScenario(),members:members.slice(1),active:'Furina',reaction:'melt',characters:{Barbara:{reaction:'',bonusStats:{hp:120}},Albedo:{infusion:'cryo',bonusStats:{def:80}}}};
    writeWorkspace(state,{...readWorkspace(state),activeTeamId:'team-a',teams:[{id:'team-a',name:'测试队伍',members,character:'Furina',scenario},{id:'team-b',name:'其他队伍',members:['Kaeya'],character:'Kaeya',scenario:defaultScenario()}]});
    const originalGOOD=structuredClone(state.good),otherTeam=structuredClone(readWorkspace(state).teams[1]);
    let saves=0;
    const pane={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false};
    const make=()=>createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>saves++,toast:()=>{},isReadOnly:()=>true});
    bench=make();bench.render();
    assert.equal((pane.innerHTML.match(/data-native="open-team-member"/g)??[]).length,4);
    assert.doesNotMatch(pane.innerHTML,/data-team-member-filter|<select data-team-member=/);
    assert.equal((pane.innerHTML.match(/class="ae-member-setting"/g)??[]).length,3);
    assert.doesNotMatch(pane.innerHTML,/data-team-condition-member/);
    assert.ok(pane.innerHTML.indexOf('data-native-disclosure="member-settings"')>pane.innerHTML.indexOf('角色、武器、套装与共鸣条件'));
    for(const owner of members){
      assert.match(pane.innerHTML,new RegExp(`data-native-setting="reaction" data-owner="${owner}"`));
      assert.match(pane.innerHTML,new RegExp(`data-native-setting="infusion" data-owner="${owner}"`));
      assert.match(pane.innerHTML,new RegExp(`data-native-bonus="critRate_" data-owner="${owner}"`));
    }
    const originalStorage=state.engineStorage[nativeKey],beforeFilterSaves=saves;
    assert.deepEqual(filterTeamCharacters(state.good.characters,catalog,{element:'hydro',rarity:'4'}).map(c=>c.key),['Barbara']);
    assert.deepEqual(filterTeamCharacters(state.good.characters,catalog,{element:'hydro',rarity:'5',search:'莫娜'}).map(c=>c.key),['Mona']);
    assert.equal((pane.innerHTML.match(/class="ae-member-setting"/g)??[]).length,3);
    assert.equal(state.engineStorage[nativeKey],originalStorage);assert.equal(saves,beforeFilterSaves);
    assert.deepEqual(new Set(filterTeamCharacters(state.good.characters,catalog,{element:'hydro',rarity:'5'}).map(c=>c.key)),new Set(['Furina','Mona']));
    await bench.change(input({teamMember:'3'},'Mona'));
    assert.equal((pane.innerHTML.match(/class="ae-member-setting"/g)??[]).length,4);
    await bench.change(input({nativeSetting:'reaction',owner:'Barbara'},'vaporize'));
    await bench.change(input({nativeSetting:'infusion',owner:'Albedo'},'pyro'));
    await bench.change(input({nativeBonus:'critRate_',owner:'Furina'},'10','number'));
    await bench.change(input({nativeBonus:'atk_',owner:'Mona'},'25','number'));
    const saved=readWorkspace(state).teams[0];
    assert.deepEqual(saved.members,['Furina','Barbara','Albedo','Mona']);
    assert.equal(saved.scenario.reaction,'melt');
    assert.equal(saved.scenario.characters.Barbara.reaction,'vaporize');
    assert.deepEqual(saved.scenario.characters.Barbara.bonusStats,{hp:120});
    assert.equal(saved.scenario.characters.Albedo.infusion,'pyro');
    assert.deepEqual(saved.scenario.characters.Albedo.bonusStats,{def:80});
    assert.equal(saved.scenario.bonusStats.critRate_,10);
    assert.deepEqual(saved.scenario.characters.Mona.bonusStats,{atk_:25});
    assert.deepEqual(readWorkspace(state).teams[1],otherTeam);assert.deepEqual(state.good,originalGOOD);
    bench.dispose();bench=make();bench.render();
    assert.match(pane.innerHTML,/<input type="number" value="25" data-native-bonus="atk_" data-owner="Mona"/);
    assert.match(pane.innerHTML,/<select data-native-setting="reaction" data-owner="Barbara"><option value="" >不触发<\/option><option value="vaporize" selected>/);
    await bench.click(input({native:'reset-scenario-group',group:'bonus',owner:'Mona'},''));
    assert.deepEqual(readWorkspace(state).teams[0].scenario.characters.Mona.bonusStats??{},{});
    assert.equal(readWorkspace(state).teams[0].scenario.bonusStats.critRate_,10);
    assert.deepEqual(state.good,originalGOOD);
  }finally{bench?.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('成员浮层实际筛选及选择；敌人、抗性和额外增益连续输入自动保存时保留输入节点与焦点', {skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
  const {document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
  document.body.style.overflow='auto';
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let active=null;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===v;},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
  globalThis.document=document;globalThis.CSS={escape:s=>s};
  globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-07'}});
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),tick=()=>new Promise(setImmediate);
  const state=blankState();state.selected='Furina';state.good.characters=['Furina','Barbara','Albedo','Mona'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:1,burst:1}}));
  writeWorkspace(state,{...readWorkspace(state),activeTeamId:'team',teams:[{id:'team',name:'代表队伍',character:'Furina',members:['Furina','Albedo'],scenario:{...defaultScenario(),members:['Albedo'],active:'Furina',characters:{Albedo:{bonusStats:{def:80}}}}}]});
  const original=structuredClone(state.good),account={id:'test',name:'隔离账号',locked:true},messages=[],payloads=[];let revision=1;
  try{
    let locked=true;Object.defineProperty(account,'locked',{get:()=>locked,enumerable:true});
    const host=document.querySelector('main');
    await mountAssessment({host,toast:m=>messages.push(m),api:async(path,request)=>{
      if(path==='assessment/accounts')return{accounts:[account]};
      if(path==='assessment/recommendations')return{version:2,revision:0,records:{}};
      if(request?.method==='POST'){payloads.push(structuredClone(request.body.state));return{account,revision:++revision,updatedAt:'2026-10-07T00:00:00Z'};}
      return{state,account,revision};
    }});
    const root=host.querySelector('.assessment-root'),query=s=>root.querySelector(s);
    const click=async(selector,notice)=>{const button=query(selector);assert.ok(button,selector);assert.equal(button.disabled,false);button.focus();button.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();if(notice)assert.match(messages.pop(),notice);assert.deepEqual(messages,[]);};
    await click('[data-tab="engine"]');
    assert.equal(query('[data-team-member-filter]'),null);assert.equal(query('select[data-team-member]'),null);
    await click('[data-native="open-team-member"][data-slot="2"]');
    assert.ok(query('dialog[open],dialog').open);assert.equal(document.body.style.overflow,'hidden');
    const filter=async(k,value)=>{const control=query(`[data-member-picker-filter="${k}"]`);control.value=value;control.focus();control.dispatchEvent(new window.Event(k==='search'?'input':'change',{bubbles:true}));await tick();};
    assert.equal(query('select[data-member-picker-filter]'),null);
    await click('[data-character-filter="element"][data-value="hydro"]');await click('[data-character-filter="rarity"][data-value="4"]');
    assert.deepEqual([...root.querySelectorAll('[data-member-picker-action="choose"]')].map(n=>n.dataset.key),['Barbara']);
    assert.deepEqual(readWorkspace(state).teams[0].members,['Furina','Albedo']);
    await click('[data-character-filter="rarity"][data-value="5"]');
    assert.equal(root.querySelectorAll('[data-member-picker-action="choose"]').length,3);
    await click('[data-character-filter="rarity"][data-value="4"]');await filter('search','莫娜');
    assert.deepEqual([...root.querySelectorAll('[data-member-picker-action="choose"]')].map(n=>n.dataset.key),['Mona']);
    await click('[data-member-picker-action="choose"][data-key="Mona"]');
    assert.equal(query('dialog'),null);assert.equal(document.body.style.overflow,'auto');
    assert.deepEqual(readWorkspace(state).teams[0].members,['Furina','Albedo','Mona']);assert.deepEqual(state.good,original);
    const enemy=query('[data-native-setting="enemyLevel"]'),resistance=query('[data-native-res="hydro"]'),bonus=query('[data-native-bonus="critDMG_"][data-owner="Mona"]');
    const type=async(node,value,selector)=>{node.focus();node.value=value;node.dispatchEvent(new window.Event('input',{bubbles:true}));await wait(500);assert.equal(query(selector),node);assert.equal(document.activeElement,node);assert.equal(node.value,value);assert.deepEqual(messages,[]);};
    for(const value of ['1','10','100'])await type(enemy,value,'[data-native-setting="enemyLevel"]');
    await type(resistance,'-20.5','[data-native-res="hydro"]');
    for(const value of ['1','10','100','10.5'])await type(bonus,value,'[data-native-bonus="critDMG_"][data-owner="Mona"]');
    bonus.value='';bonus.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
    assert.equal(query('[data-native-bonus="critDMG_"][data-owner="Mona"]'),bonus);
    assert.equal(readWorkspace(state).teams[0].scenario.characters.Mona.bonusStats.critDMG_,10.5);
    await type(bonus,'15.5','[data-native-bonus="critDMG_"][data-owner="Mona"]');
    await wait(700);
    const saved=readWorkspace(payloads.at(-1)).teams[0];
    assert.equal(saved.scenario.enemyLevel,100);assert.equal(saved.scenario.resistances.hydro,-20.5);assert.equal(saved.scenario.characters.Mona.bonusStats.critDMG_,15.5);
    assert.deepEqual(saved.scenario.characters.Albedo.bonusStats,{def:80});assert.deepEqual(state.good,original);
    assert.ok(query('[data-team-panel-results] .ae-team-member'));assert.ok(query('[data-team-damage-results] .ae-damage-member'));
    // 同一个真实交互场景继续验证两个自定义入口、方案快照和整队恢复。
    await click('[data-native="open-trial-equipment"][data-member="Furina"][data-kind="weapons"]');
    const search=query('[data-trial-filter="search"]');search.value='静水';search.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();
    await click('[data-trial-action="choose-weapon"][data-key="SplendorOfTranquilWaters"]');
    const refinement=query('[data-trial-weapon="refinement"]');refinement.value='5';refinement.dispatchEvent(new window.Event('input',{bubbles:true}));
    await click('[data-trial-action="apply-trial"]');
    assert.equal(query('dialog'),null);assert.match(query('[data-pane="engine"]').innerHTML,/自定义试算/);assert.deepEqual(state.good,original);
    await click('[data-native="open-trial-equipment"][data-member="Furina"][data-kind="artifacts"][data-slot="flower"]');
    assert.equal(query('[data-trial-custom-field="slotKey"]').disabled,true);
    assert.equal(query('[data-native="custom-to-inventory"]'),null);
    await click('[data-trial-action="artifact-mode"][data-mode="values"]');
    const subkey=query('[data-trial-custom-value-key="0"]');subkey.value='critRate_';subkey.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
    const subvalue=query('[data-trial-custom-value="0"]');subvalue.value='15.6';subvalue.dispatchEvent(new window.Event('input',{bubbles:true}));
    await click('[data-trial-action="apply-trial"]');
    assert.deepEqual(state.good,original);assert.equal(query('[data-native="apply-team-trial"]').disabled,true);
    const name=query('[data-native-plan-name]');name.value='自定义队伍方案';name.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();
    await click('[data-native="save-plan"]',/全队配装方案已保存/);validateState(state,data);
    const plan=readWorkspace(state).teamPlans.at(-1),build=plan.teamBuilds.find(b=>b.character.key==='Furina');
    assert.equal(build.weapon.key,'SplendorOfTranquilWaters');assert.equal(build.weapon.refinement,5);assert.equal(build.weapon.wikiTrialOnly,true);
    assert.equal(build.artifacts[0].wikiTrialOnly,true);assert.deepEqual(build.artifacts[0].substats,[{key:'critRate_',value:15.6}]);
    await click('[data-native="clear-plan-preview"]');
    assert.doesNotMatch(query('[data-pane="engine"]').innerHTML,/· 自定义试算/);assert.deepEqual(state.good,original);
    assert.equal(readWorkspace(state).teamPlans.at(-1).name,'自定义队伍方案');
    await click('[data-native="preview-plan"][data-index="0"]',/已切换配装/);
    assert.match(query('[data-pane="engine"]').innerHTML,/· 自定义试算/);assert.equal(query('[data-native="apply-team-trial"]').disabled,true);
    // 解锁也不能把理论装备写入库存。
    locked=false;query('[data-native="apply-team-trial"]').disabled=false;
    query('[data-native="apply-team-trial"]').dispatchEvent(new window.Event('click',{bubbles:true}));await tick();
    assert.match(messages.pop(),/只能保存在队伍方案/);assert.deepEqual(state.good,original);
    await click('[data-native="clear-plan-preview"]');assert.deepEqual(state.good,original);
    // 取消编辑保留当前试算和正式资料。
    await click('[data-native="open-trial-equipment"][data-member="Furina"][data-kind="weapons"]');
    await click('[data-trial-action="cancel-trial"]');assert.equal(query('dialog'),null);assert.deepEqual(state.good,original);
  }finally{disposeAssessment();await tick();for(const [k,v]of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
