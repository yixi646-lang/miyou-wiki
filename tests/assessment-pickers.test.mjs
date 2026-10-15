import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {catalogCandidates,filterCatalogCandidates} from '../modules/character-assessment/catalog-picker.mjs';
import {artifactMajorVersion,artifactVersionChoices,compareArtifactSets,compareCharacterRelease} from '../modules/character-assessment/core/artifact-order.mjs';
import {filterArtifacts,artifactFilters} from '../modules/character-assessment/core/inventory.mjs';
import {filterTeamCharacters} from '../modules/character-assessment/character-filters.mjs';
import {growthTeamChoices,growthTeamScenario} from '../modules/character-assessment/core/teams.mjs';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {calculateTeam} from '../modules/character-assessment/core/combat.mjs';
import {readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {createManagedState} from '../modules/character-assessment/core/managed-inventory.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
import {openAccountEquipmentPicker} from '../modules/character-assessment/inventory-dialogs.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const base=new URL('../modules/character-assessment/core/',import.meta.url),data=JSON.parse(readFileSync(new URL('game-stats.json',base))),catalog=JSON.parse(readFileSync(new URL('catalog.json',base)));
const char=key=>({key,level:90,ascension:6,constellation:0,talent:{auto:8,skill:8,burst:8}});
function sample(){
  const state=blankState();state.selected='HuTao';state.good.characters=['HuTao','Bennett','Furina'].map(char);
  state.good.weapons=[{id:'original',key:'FavoniusLance',level:90,ascension:6,refinement:1,location:'HuTao',lock:false}];
  const w=readWorkspace(state);w.teams=[{id:'buff',name:'胡桃增益队',members:['Bennett','HuTao'],character:'Bennett',scenario:{enemyLevel:123,resistance:31,resistances:{pyro:17},members:['HuTao'],active:'HuTao',conditional:{Bennett:{burst:'on'},resonance:{pyro:'on'}},bonusStats:{atk_:5},characters:{HuTao:{conditional:{HuTao:{hp:'on'}},bonusStats:{pyro_dmg_:10},reaction:'vaporize'}},combo:[]}},{id:'other',name:'其他队伍',character:'Furina',members:['Furina'],scenario:{members:[],enemyLevel:100,resistance:10,conditional:{},characters:{}}}];w.activeTeamId='other';writeWorkspace(state,w);return state;
}
test('目录选择联合筛选，不提供不兼容武器或不存在的圣遗物部位',()=>{
  const weapons=catalogCandidates(catalog,data,'weapons',{weaponType:'polearm'}),found=filterCatalogCandidates(weapons,data,'weapons',{search:'护摩',rarity:['5'],stat:['critDMG_']});assert.deepEqual(found.map(([key])=>key),['StaffOfHoma']);
  assert.equal(filterCatalogCandidates(weapons,data,'weapons',{search:'护摩',rarity:['4']}).length,0);
  const sets=catalogCandidates(catalog,data,'sets',{slot:'flower'});assert(sets.every(([key])=>data.art.data[key].slots.includes('flower')));
});
test('圣遗物目录与实际装备共用登场大版本筛选和先后顺序，未记录版本排在末尾',()=>{
  const sets=catalogCandidates(catalog,data,'sets',{slot:'flower'}),ordered=sets.toSorted((a,b)=>compareArtifactSets(a[1],b[1]));
  assert(ordered.findIndex(([key])=>key==='CrimsonWitchOfFlames')>ordered.findIndex(([key])=>key==='BlizzardStrayer'));
  assert(ordered.findIndex(([key])=>key==='EmblemOfSeveredFate')>ordered.findIndex(([key])=>key==='GoldenTroupe'));
  const found=filterCatalogCandidates(sets,data,'sets',{version:['2','4'],search:''});assert(found.length);assert(found.every(([,m])=>['2','4'].includes(artifactMajorVersion(m))));
  assert.deepEqual(artifactVersionChoices([['unknown',{}],['ten',{releaseVersion:'10.0'}],['two',{releaseVersion:'2.3'}],['one',{releaseVersion:'1.0'}]]).map(([v])=>v),['10','2','1','unknown']);
  assert(compareArtifactSets({releaseVersion:'2.3'}, {})<0);assert.equal(artifactMajorVersion({}),'unknown');
  const items=['GoldenTroupe','EmblemOfSeveredFate','CrimsonWitchOfFlames'].map((setKey,i)=>({setKey,slotKey:'flower',rarity:5,level:20-i,mainStatKey:'hp',substats:[],location:'',lock:false}));
  assert.deepEqual(filterArtifacts(items,catalog,data,{...artifactFilters(),sort:'release'}).map(({a})=>a.setKey),['GoldenTroupe','EmblemOfSeveredFate','CrimsonWitchOfFlames']);
  assert.deepEqual(filterArtifacts(items,catalog,data,{...artifactFilters(),version:'4',sort:'release'}).map(({a})=>a.setKey),['GoldenTroupe']);
  const source=new Map(JSON.parse(readFileSync(new URL('../data/catalog/genshin.json',import.meta.url))).entries.map(e=>[e.id,e]));
  for(const m of Object.values(catalog.sets)){const entry=source.get(m.wikiId);if(entry)for(const field of ['sourceId','releaseVersion','releaseDate'])assert.equal(m[field],entry[field]);}
});
test('角色浮层按首次登场由新到旧，保留原有搜索和元素星级筛选',()=>{
  const entries=Object.entries(catalog.characters),ordered=entries.toSorted((a,b)=>compareCharacterRelease(a[1],b[1]));
  assert(ordered.findIndex(([key])=>key==='Furina')<ordered.findIndex(([key])=>key==='HuTao'));
  assert(ordered.findIndex(([key])=>key==='HuTao')<ordered.findIndex(([key])=>key==='Bennett'));
  assert(compareCharacterRelease({releaseVersion:'4.0',releaseDate:'2023-09-05'},{releaseVersion:'4.0',releaseDate:'2023-08-16'})<0);
  assert(compareCharacterRelease({releaseVersion:'7.0'},{})<0);
  const roster=['Bennett','Furina','HuTao'].map(char);
  assert.deepEqual(filterTeamCharacters(roster,catalog,{}).map(c=>c.key),['Furina','HuTao','Bennett']);
  assert.deepEqual(filterTeamCharacters(roster,catalog,{element:['pyro'],rarity:['5']}).map(c=>c.key),['HuTao']);
  const source=new Map(JSON.parse(readFileSync(new URL('../data/catalog/genshin.json',import.meta.url))).entries.map(e=>[e.id,e]));
  for(const [,m]of entries)for(const field of ['sourceId','releaseVersion','releaseDate'])assert.equal(m[field],source.get(m.wikiId)[field]);
});

test('收益队伍只包含当前角色，并完整继承首位与队友条件，选取不会改写原队伍',()=>{
  const state=sample(),w=readWorkspace(state),original=structuredClone(w),teams=growthTeamChoices(state,'HuTao',w);assert.deepEqual(teams.map(t=>t.id),['buff']);
  const team=teams[0],scenario=growthTeamScenario(team,'HuTao');assert.equal(scenario.enemyLevel,123);assert.equal(scenario.resistances.pyro,17);assert.equal(scenario.active,'HuTao');assert.equal(scenario.reaction,'vaporize');assert.equal(scenario.bonusStats.pyro_dmg_,10);assert.equal(scenario.characters.Bennett.bonusStats.atk_,5);assert.deepEqual(scenario.conditional.HuTao,team.scenario.characters.HuTao.conditional.HuTao);assert.deepEqual(scenario.conditional.resonance,team.scenario.conditional.resonance);
  const before=calculateTeam(state.good,'Bennett',team.scenario).members.find(m=>m.key==='HuTao'),after=calculateTeam(state.good,'HuTao',scenario).members.find(m=>m.key==='HuTao');assert.deepEqual(after.panel,before.panel);assert.deepEqual(after.rows,before.rows);assert.deepEqual(w,original);
});
test('圣遗物库存套装筛选使用目录浮层，保留其他筛选和锁定账号装备',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main class="assessment-root"><section id="pane"></section></main></body></html>');
  const prior={document:globalThis.document,CSS:globalThis.CSS};let bench;
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===String(v);},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;};
  globalThis.document=document;globalThis.CSS={escape:s=>s};document.body.style.overflow='auto';
  try{
    const state=sample(),keys=catalogCandidates(catalog,data,'sets',{slot:'flower'}).filter(([key])=>data.art.data[key].rarities.includes(5)).sort((a,b)=>compareArtifactSets(a[1],b[1])).slice(0,30).map(([key])=>key);
    assert.equal(keys.length,30);
    state.good.artifacts=keys.map((setKey,i)=>({id:String(i),setKey,slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[],location:'',lock:false}));
    const original=structuredClone(state.good),pane=document.querySelector('#pane'),messages=[];let writes=0;
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed(){writes++;},toast:message=>messages.push(message),isReadOnly:()=>true});
    await bench.click({dataset:{nativePage:'artifacts'}});
    assert.equal(pane.querySelector('select[data-artifact-filter="set"]'),null);
    const trigger=()=>pane.querySelector('[data-native="choose-artifact-filter-set"]'),value=key=>pane.querySelector(`[data-artifact-filter="${key}"]`).value;
    assert.match(trigger().textContent,/全部套装/);
    for(const [key,next]of [['rarity','5'],['main','hp'],['status','free'],['minLevel','10']]){const input=pane.querySelector(`[data-artifact-filter="${key}"]`);input.value=next;await bench.change(input);}
    pane.querySelector('[data-native-disclosure="artifact-filters"]').open=true;
    const tick=()=>new Promise(setImmediate),click=async selector=>{const button=document.querySelector(`dialog ${selector}`);assert(button,selector);button.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();};
    await bench.click(trigger());
    let dialog=document.querySelector('dialog');assert(dialog);assert.equal(document.body.style.overflow,'hidden');assert.equal(dialog.querySelector('select'),null);
    assert.equal(dialog.querySelector('[data-catalog-empty]').textContent,'全部套装');
    assert.equal(dialog.querySelectorAll('[data-catalog-choice]').length,24);
    await click('[data-catalog-page="1"]');assert.equal(document.querySelectorAll('dialog [data-catalog-choice]').length,6);
    await click('[data-catalog-page="-1"]');
    const chosen=keys[10],major=artifactMajorVersion(catalog.sets[chosen]);
    await click(`[data-catalog-filter="version"][data-value="${major}"]`);
    assert([...document.querySelectorAll('dialog [data-catalog-choice]')].every(button=>artifactMajorVersion(catalog.sets[button.dataset.catalogChoice])===major));
    const input=document.querySelector('dialog [data-catalog-search]');input.value=catalog.sets[chosen].name;input.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();
    assert.equal(document.querySelector('dialog [data-catalog-search]'),input);
    await click(`[data-catalog-choice="${chosen}"]`);
    assert.equal(document.querySelector('dialog'),null);assert.equal(document.body.style.overflow,'auto');assert.equal(value('set'),chosen);
    assert.match(trigger().textContent,new RegExp(catalog.sets[chosen].name));assert.equal(pane.querySelectorAll('.ae-artifact-card').length,1);
    for(const [key,expected]of [['rarity','5'],['main','hp'],['status','free'],['minLevel','10']])assert.equal(value(key),expected);
    assert(pane.querySelector('[data-native-disclosure="artifact-filters"]').open);
    await bench.click(trigger());assert.equal(document.querySelector(`dialog [data-catalog-choice="${chosen}"]`).getAttribute('aria-pressed'),'true');
    await click('[data-analysis-close]');assert.equal(value('set'),chosen);
    await bench.click(trigger());await click('[data-catalog-empty]');assert.equal(value('set'),'');assert.equal(pane.querySelectorAll('.ae-artifact-card').length,30);
    assert.match(trigger().textContent,/全部套装/);assert.deepEqual(state.good,original);assert.equal(writes,0);assert.deepEqual(messages,[]);
  }finally{bench?.dispose();for(const[key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test('库存替换套装浮层联合筛选、重置分页并保留父层焦点、滚动及锁定装备',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main class="assessment-root"><button id="launcher">替换</button></main></body></html>');
  const prior=globalThis.document;let picker,active=null;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;};
  globalThis.document=document;document.body.style.overflow='auto';document.querySelector('#launcher').focus();
  try{
    const initial=sample(),artifact=(setKey,id,slotKey='flower')=>({id,setKey,slotKey,rarity:5,level:20,mainStatKey:slotKey==='flower'?'hp':'atk',substats:[{key:'critRate_',value:3.9}],location:'',lock:false});
    initial.good.artifacts=[...Array.from({length:25},(_,i)=>artifact('GoldenTroupe',String(i))),artifact('NoblesseOblige','original-noblesse'),artifact('EmblemOfSeveredFate','other-slot','plume')];
    initial.customInventory={version:1,showMarkers:true,characters:[],weapons:[],artifacts:[artifact('NoblesseOblige','custom-noblesse')]};
    const state=createManagedState(initial,{kind:'imported'}),original=structuredClone(state),messages=[];let choices=0;
    picker=openAccountEquipmentPicker({root:document.querySelector('main'),state,member:'HuTao',kind:'artifacts',slot:'flower',catalog,data,weights:{},locked:true,onChoose:()=>{choices++;},onRestore:()=>{choices++;},toast:m=>messages.push(m)});
    const q=selector=>picker.dialog.querySelector(selector),top=()=>[...document.querySelectorAll('dialog')].at(-1),tick=()=>new Promise(setImmediate),click=async(selector,dialog=picker.dialog)=>{const button=dialog.querySelector(selector);assert(button,selector);assert(!button.disabled,selector);button.focus();button.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();};
    assert.match(q('[data-inventory-picker-choose-set]').textContent,/全部套装/);assert.equal(q('[data-inventory-picker-equipment=""]').disabled,true);
    await click('[data-inventory-picker-filter="origin"][data-value=""]');await click('[data-inventory-picker-filter="main"][data-value="hp"]');await click('[data-inventory-picker-page="1"]');assert.match(q('.ae-equipment-picker-toolbar').textContent,/第 2 \/ 2 页/);
    await click('[data-inventory-picker-choose-set]');assert.equal(document.querySelectorAll('dialog').length,2);assert.equal(top().querySelector('select'),null);assert.deepEqual([...top().querySelectorAll('[data-catalog-choice]')].map(b=>b.dataset.catalogChoice).sort(),['GoldenTroupe','NoblesseOblige']);
    const search=top().querySelector('[data-catalog-search]');search.value=catalog.sets.NoblesseOblige.name;search.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();assert.equal(top().querySelectorAll('[data-catalog-choice]').length,1);
    await click('[data-catalog-choice="NoblesseOblige"]',top());assert.equal(document.querySelectorAll('dialog').length,1);assert.equal(document.body.style.overflow,'hidden');assert.equal(document.activeElement,q('[data-inventory-picker-choose-set]'));
    assert.equal(q('[data-inventory-picker-filter="set"]').value,'NoblesseOblige');assert.match(q('.ae-equipment-picker-toolbar').textContent,/2 件候选 · 第 1 \/ 1 页/);assert.equal(q('[data-inventory-picker-filter="main"][data-value="hp"]').getAttribute('aria-pressed'),'true');
    await click('[data-inventory-picker-filter="origin"][data-value="custom"]');assert.equal(q('.ae-equipment-picker-candidates').children.length,1);
    await click('[data-inventory-picker-choose-set]');assert.equal(top().querySelector('[data-catalog-choice="NoblesseOblige"]').getAttribute('aria-pressed'),'true');await click('[data-analysis-close]',top());assert.equal(q('[data-inventory-picker-filter="set"]').value,'NoblesseOblige');
    await click('[data-inventory-picker-choose-set]');await click('[data-catalog-empty]',top());assert.equal(q('[data-inventory-picker-filter="set"]').value,'');assert.match(q('[data-inventory-picker-choose-set]').textContent,/全部套装/);assert.equal(q('.ae-equipment-picker-candidates').children.length,1);assert.equal(q('[data-inventory-picker-filter="origin"][data-value="custom"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(state,original);assert.equal(choices,0);assert.deepEqual(messages,[]);
    await click('[data-inventory-picker-choose-set]');picker.close();assert.equal(document.querySelectorAll('dialog').length,0);assert.equal(document.body.style.overflow,'auto');assert.equal(document.activeElement,document.querySelector('#launcher'));
  }finally{picker?.close();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});

test('实际界面：配装浮层、直接筛选、自定义装备取消与保存、当前角色队伍收益',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main></main></body></html>');
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS},folder=await createTestWorkspace('assessment-picker-ui'),store=createAccountStore(join(folder,'accounts.sqlite')),messages=[];
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'scrollIntoView',{value(){},configurable:true});
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){if(v)this.setAttribute('checked','');else this.removeAttribute('checked');},configurable:true});
  Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===String(v);},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;};
  globalThis.document=document;globalThis.CSS={escape:s=>s};globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-08'}});document.body.style.overflow='auto';
  const initial=store.action({action:'create',name:'选择窗口测试',state:sample()},data);store.action({action:'unlock',accountId:initial.account.id,revision:initial.revision},data);
  try{
    const host=document.querySelector('main');await mountAssessment({host,toast:m=>messages.push(m),api:async(path,request)=>path==='assessment/accounts'?store.list():path==='assessment/recommendations'?{version:2,revision:0,records:{}}:request?.method==='POST'?store.write(request.body,data):store.read()});
    const tick=()=>new Promise(setImmediate),q=s=>host.querySelector(s),click=async selector=>{const button=q(selector);assert(button,selector);assert(!button.disabled,selector);button.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();assert.deepEqual(messages.filter(m=>!m.startsWith('已')),[]);},search=async(selector,text)=>{const input=q(selector);input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();};
    const top=()=>[...host.querySelectorAll('dialog')].at(-1),choose=async name=>{await search('[data-catalog-search]',name);assert.equal(top().querySelector('select'),null);await click('[data-catalog-choice]');};
    assert.equal(q('select[data-weapon="key"]'),null);assert.equal(q('select[data-art="setKey"]'),null);
    await click('[data-ae="choose-build-weapon"]');await click('[data-catalog-filter="rarity"][value="5"]');await choose('护摩');assert.equal(q('[data-weapon="key"]').value,'StaffOfHoma');assert.equal(q('dialog'),null);
    await click('[data-ae="choose-build-set"][data-slot="flower"]');assert.equal(top().querySelector('[data-catalog-filter="rarity"]'),null);assert(top().querySelector('[data-catalog-filter="version"][data-value="4"]'));
    await click('[data-catalog-filter="version"][data-value="4"]');assert([...top().querySelectorAll('[data-catalog-choice]')].every(n=>artifactMajorVersion(catalog.sets[n.dataset.catalogChoice])==='4'));assert(top().querySelector('[data-catalog-choice="GoldenTroupe"]'));await click('[data-catalog-clear]');await choose('魔女');assert.equal(q('[data-slot="flower"] [data-art="setKey"]').value,'CrimsonWitchOfFlames');
    await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');assert.equal(top().querySelector('[data-inventory-picker-filter="rarity"]'),null);await click('[data-inventory-picker-filter="version"][data-value="1"]');assert(top().querySelector('[data-inventory-picker-equipment="0"]'));await click('[data-analysis-close]');
    await click('[data-tab="engine"]');await click('[data-native-page="teams"]');await click('[data-native="open-team-equipment"][data-member="Furina"][data-kind="artifacts"][data-slot="flower"]');assert.equal(top().querySelector('[data-team-picker-filter="rarity"]'),null);assert.equal(top().querySelector('[data-team-picker-filter="sort"][data-value="release"]').getAttribute('aria-pressed'),'true');await click('[data-team-picker-filter="version"][data-value="1"]');assert(top().querySelector('[data-team-picker-action="choose"]'));await click('[data-team-picker-action="clear"]');assert.equal(top().querySelector('[data-team-picker-filter="version"][data-value=""]').getAttribute('aria-pressed'),'true');await click('[data-analysis-close]');
    await click('[data-native-page="weapons"]');await click('[data-native="new-weapon"]');assert.equal(top().querySelector('select[data-trial-filter]'),null);await click('[data-trial-filter="type"][value="bow"]');await search('[data-trial-filter="search"]','西风猎弓');assert(q('[data-trial-action="choose-weapon"][data-key="FavoniusWarbow"]'));await click('[data-trial-action="cancel-trial"]');assert.equal(q('dialog'),null);
    await click('[data-native="new-weapon"]');await click('[data-trial-filter="type"][value="bow"]');await search('[data-trial-filter="search"]','西风猎弓');await click('[data-trial-action="choose-weapon"][data-key="FavoniusWarbow"]');await click('[data-trial-action="apply-trial"]');assert.equal(q('dialog'),null);messages.splice(0);
    await click('[data-native-page="artifacts"]');await click('[data-native="new-artifact"]');assert(q('dialog [data-custom-editor]'));assert.equal(q('[data-pane="engine"] [data-custom-editor]'),null);
    const input=q('dialog [data-custom-count]');input.value='2';input.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();assert.equal(q('dialog [data-custom-count]'),input);
    await click('[data-native="choose-custom-set"]');await choose('黄金剧团');assert(q('dialog [data-custom-editor]'));assert.equal(document.body.style.overflow,'hidden');await click('[data-native="cancel-artifact"]');assert.equal(q('dialog'),null);assert.equal(document.body.style.overflow,'auto');
    await click('[data-tab="import"]');await click('[data-ae="save"]');const saved=store.read(),view=createManagedState(saved.state,saved.account);assert(view.good.weapons.some(w=>w.key==='FavoniusWarbow'));assert.equal(view.good.artifacts.length,1);
    await click('[data-tab="evaluation"]');const growth=q('[data-native-disclosure="growth-reference"]');assert(growth);assert.deepEqual([...growth.querySelectorAll('[data-native-growth-team]')].map(b=>b.dataset.value),['solo','buff']);
    await click('[data-native-growth-team][value="buff"]');await click('[data-native="open-upgrade-target"]');assert.equal(top().querySelector('select'),null);assert.doesNotMatch(top().textContent,/班尼特|其他队伍/);await click('[data-growth-group][value="skill"]');const path=q('[data-growth-path]').dataset.growthPath;await click('[data-growth-path]');await click('[data-native="upgrade"]');
    const context=growthTeamScenario(readWorkspace(view).teams.find(t=>t.id==='buff'),'HuTao'),row=calculateTeam(view.good,'HuTao',context).rows.find(r=>r.owner==='HuTao'&&r.path===path);assert(q('[data-native-disclosure="growth-reference"] table').textContent.includes(row.average.toFixed(1)));assert.match(q('[data-native-disclosure="growth-reference"]').textContent,/提升前 → 提升后|期望值增加量/);
    await click('[data-native="close-upgrade"]');assert.equal(q('[data-native-disclosure="growth-reference"] table'),null);await click('[data-tab="import"]');await click('[data-ae="save"]');assert.equal(readWorkspace(store.read().state).activeTeamId,'other');assert.equal(readWorkspace(store.read().state).growthTeams.HuTao,'buff');
  }finally{disposeAssessment();await new Promise(setImmediate);store.close();for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}await cleanupTestWorkspace(folder);}
});
