import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addCardDisclosureControls,setCardDisclosure,installDisclosureControls} from '../public/disclosures.mjs';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {captureTeamPlan} from '../modules/character-assessment/core/combat.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));

test('局部按钮只控制直属子卡片，叶子不加按钮，标题自身和深层状态保留',()=>{
  const prior=globalThis.document,priorObserver=globalThis.MutationObserver;globalThis.document={createElement:()=>({dataset:{},innerHTML:''})};
  const scope='details,[data-card-disclosure]';
  const make=(title,children=[],{ignored=false,group=false}={})=>{
    const controls=[],summary={textContent:title,classList:{add(){}},querySelector:()=>controls[0]??null,append:c=>{controls.push(c);summary.textContent+='展开折叠';}};
    const card={dataset:{},open:false,parentElement:null,controls,summary,matches:selector=>selector==='details'&&!group,
      closest(selector){return selector===scope?this:ignored?this:this.parentElement?.closest(selector)??null;},
      querySelector:()=>summary,querySelectorAll(selector){return children.flatMap(c=>[c,...c.querySelectorAll(scope)]).filter(c=>selector===scope||c.matches('details'));}};
    for(const child of children)child.parentElement=card;
    return card;
  };
  try{
    const third=make('普通攻击'),second=make('芙宁娜',[third]),filter=make('筛选',[],{ignored:true}),outer=make('队伍伤害',[second,filter]),sibling=make('角色配装');
    const resistance=make('按元素分别设置抗性'),bonus=make('额外增益'),settings=make('站场与敌人',[resistance,bonus],{group:true});
    const container={querySelectorAll:selector=>[outer,...outer.querySelectorAll(scope),sibling,settings,...settings.querySelectorAll(scope)].filter(c=>selector===scope||c.matches('details'))};addCardDisclosureControls(container);addCardDisclosureControls(container);
    for(const d of [outer,second,settings]){assert.equal(d.controls.length,1);assert.match(d.controls[0].innerHTML,/data-fold-scope="card"/);assert.match(d.controls[0].innerHTML,/展开<\/button>.*折叠<\/button>/);}
    for(const d of [third,sibling,resistance,bonus])assert.equal(d.controls.length,0);
    assert.equal(filter.controls.length,0);assert.equal(outer.dataset.cardDisclosureTitle,'队伍伤害');
    outer.open=true;
    setCardDisclosure(outer,true);assert.ok(outer.open&&second.open);assert.equal(third.open,false);assert.equal(sibling.open,false);assert.equal(filter.open,false);
    setCardDisclosure(second,true);assert.ok(outer.open&&second.open&&third.open);
    setCardDisclosure(outer,false);assert.equal(outer.open,true);assert.equal(second.open,false);assert.equal(third.open,true);
    setCardDisclosure(third,false);assert.equal(third.open,true);
    setCardDisclosure(settings,true);assert.ok(resistance.open&&bonus.open);assert.equal(settings.open,false);
    setCardDisclosure(settings,false);assert.ok(!resistance.open&&!bonus.open);assert.equal(third.open,true);
    // 点击标题内按钮阻止 summary 默认切换，并使用同一层级规则。
    let click,prevented=false,stopped=false,bulk=false;globalThis.MutationObserver=class{observe(){}};
    const host={querySelector:selector=>selector==='.ae-independent-team'?container:selector==='[data-page-fold-controls]'?{}:null,querySelectorAll:selector=>container.querySelectorAll(selector),addEventListener:(_,fn)=>{click=fn;},contains:()=>true};
    installDisclosureControls(host,{onBulk:()=>{bulk=true;}});
    const button={dataset:{fold:'expand',foldScope:'card'},closest:selector=>selector==='[data-fold]'?button:outer};
    click({target:button,preventDefault:()=>{prevented=true;},stopPropagation:()=>{stopped=true;}});
    assert.ok(prevented&&stopped&&outer.open&&second.open&&third.open);assert.equal(bulk,false);
  }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;if(priorObserver===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=priorObserver;}
});

test('机制条件按角色直接展示，保留效果说明折叠；重绘不修改锁定账号数据',()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null};let bench;
  try{
    const state=blankState();state.selected='Furina';state.good.characters=['Furina','Zhongli'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));
    state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true}];
    const w=readWorkspace(state);w.teamDraft={members:['Furina','Zhongli'],scenario:{...defaultScenario(),members:['Zhongli']}};writeWorkspace(state,w);
    const original=structuredClone(state);let details=[],changes=0;
    const pane={html:'',get innerHTML(){return this.html;},set innerHTML(value){this.html=value;details=[...value.matchAll(/<details\b([^>]*)>/g)].filter(m=>m[1].includes('data-native-disclosure=')).map(m=>({dataset:{nativeDisclosure:m[1].match(/data-native-disclosure="([^"]+)"/)[1]},open:/\bopen\b/.test(m[1])}));},querySelectorAll:()=>details,querySelector:()=>null,contains:()=>false};
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>{changes++;},toast:()=>{},isReadOnly:()=>true});bench.render();
    assert.match(pane.innerHTML,/<section class="panel ae-section ae-enemy-settings">/);
    for(const owner of ['Furina','Zhongli'])assert.match(pane.innerHTML,new RegExp(`<section class="ae-condition-group" data-condition-owner="${owner}" data-native-disclosure="conditions-${owner}">`));
    assert.doesNotMatch(pane.innerHTML,/<details[^>]+data-native-disclosure="conditions-/);bench.render();
    assert.equal(changes,0);assert.deepEqual(state,original);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('未命名队伍可清空并保存，删除命名队伍保留其他队伍、配装快照与实际数据；重绘保留折叠',async()=>{
  const prior=globalThis.document;globalThis.document={activeElement:null};let bench;
  try{
    const state=blankState();state.selected='Furina';state.good.characters=['Furina','Barbara'].map(key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:9,burst:9}}));
    state.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:true}];
    const scenario=defaultScenario(),w=readWorkspace(state);w.teamDraft={members:['Furina'],scenario};w.teams=[{id:'one',name:'队伍一',members:['Furina'],character:'Furina',scenario},{id:'two',name:'队伍二',members:['Barbara'],character:'Barbara',scenario}];w.activeTeamId='';w.teamPlans=[{...captureTeamPlan(state.good,'Furina',scenario,'保存的配装'),id:'plan-one',teamId:'one'}];writeWorkspace(state,w);
    const original=structuredClone(state.good),teams=structuredClone(w.teams);let details=[{dataset:{cardDisclosureTitle:'队伍战斗面板'},open:false,querySelector:()=>({textContent:'队伍战斗面板展开折叠'})}];
    const pane={html:'',get innerHTML(){return this.html;},set innerHTML(value){this.html=value;details=[{dataset:{},open:true,querySelector:()=>({textContent:'队伍战斗面板'})}];},querySelectorAll:()=>details,querySelector:()=>null,contains:()=>false};
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed:()=>{},toast:()=>{},isReadOnly:()=>true});bench.render();assert.equal(details[0].open,false);
    assert.match(pane.innerHTML,/data-native="remove-team" >删除队伍/);
    await bench.click({dataset:{native:'remove-team'}});let after=readWorkspace(state);assert.deepEqual(after.teamDraft.members,[]);assert.deepEqual(after.teams,teams);assert.deepEqual(state.good,original);assert.match(pane.innerHTML,/请选择队伍成员/);
    const roundtrip=JSON.parse(JSON.stringify(state));assert.deepEqual(readWorkspace(roundtrip).teamDraft.members,[]);
    await bench.change({dataset:{},value:'one',hasAttribute:k=>k==='data-native-team-select'});await bench.click({dataset:{native:'remove-team'}});after=readWorkspace(state);
    assert.deepEqual(after.teams,[teams[1]]);assert.equal(after.activeTeamId,'two');assert.equal(after.teamPlans[0].teamId,'');assert.equal(after.teamPlans[0].name,'保存的配装');assert.deepEqual(after.teamDraft.members,[]);assert.deepEqual(state.good,original);validateState(state,data);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
