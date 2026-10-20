import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {blankState,defaultGoal,equipment} from '../modules/character-assessment/core/model.mjs';
import {artifactFromDraft} from '../modules/character-assessment/core/artifacts.mjs';
import {scanPreview} from '../modules/character-assessment/core/import-sync.mjs';
import {createManagedState} from '../modules/character-assessment/core/managed-inventory.mjs';
import {importMatchDecision,chooseImportMatch} from '../modules/character-assessment/import-matching.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';

const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const char=key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:1,burst:1}});
const draft=(level=16,counts=[2,2,2,2])=>({setKey:'GoldenTroupe',rarity:5,slotKey:'flower',mainStatKey:'hp',level,initialCount:4,lines:['critRate_','critDMG_','atk_','enerRech_'].map((key,i)=>({key,counts:[0,0,0,counts[i]]}))});
const art=(level=16,counts)=>({...artifactFromDraft(draft(level,counts),data),id:7,location:'Furina',note:'保留备注'});
const weapon={key:'FavoniusSword',level:20,ascension:0,refinement:1,location:'Furina',lock:false,id:0};
const sample=()=>{const state=blankState();state.selected='Furina';state.good.characters=[char('Furina')];state.good.artifacts=[art()];state.good.weapons=[structuredClone(weapon)];return state;};
const source=(items=[art(20,[3,2,2,2])])=>({format:'GOOD',version:3,artifacts:items.map(({note,...item})=>item)});
const resolve=(preview,action='update',target)=>preview.matches.map(match=>importMatchDecision(match,action,target??match.candidates[0].targetIndex));

test('合法强化先生成待确认项，明确选择更新、新增或跳过后才决定结果',()=>{
  const state=sample(),before=structuredClone(state),input=source();input.artifacts[0].id=999;
  const preview=scanPreview(state,input,data);
  assert.equal(preview.unresolved,1);assert.equal(preview.changes.artifacts.added,0);assert.equal(preview.state.good.artifacts[0].level,16);assert.match(preview.matches[0].candidates[0].reason,/普通强化/);
  const updated=scanPreview(state,input,data,{decisions:resolve(preview)});
  assert.equal(updated.unresolved,0);assert.equal(updated.state.good.artifacts.length,1);assert.equal(updated.state.good.artifacts[0].id,7);assert.equal(updated.state.good.artifacts[0].level,20);assert.equal(updated.state.good.artifacts[0].note,'保留备注');assert.equal(updated.changes.artifacts.updated,1);
  const added=scanPreview(state,input,data,{decisions:resolve(preview,'new')});assert.equal(added.state.good.artifacts.length,2);assert.equal(added.state.good.artifacts[1].id,8);assert.equal(added.state.good.artifacts[0].level,16);
  const skipped=scanPreview(state,input,data,{decisions:resolve(preview,'skip')});assert.equal(skipped.skipped,1);assert.equal(skipped.changed,false);assert.deepEqual(state,before);
});

test('整批精确匹配优先且相同副本按数量保留，不用扫描编号推断身份',()=>{
  const state=sample(),upgraded={...art(20,[3,2,2,2]),location:''},exact=art();upgraded.id=0;exact.id=999;
  const preview=scanPreview(state,source([upgraded,exact]),data);assert.equal(preview.matches.length,0);assert.equal(preview.changes.artifacts.unchanged,1);assert.equal(preview.changes.artifacts.added,1);assert.equal(preview.state.good.artifacts[0].level,16);
  state.good.artifacts.push({...art(),id:8,location:''});
  const incoming=[{...art(),id:99,location:''},{...art(),id:0}];incoming[0].substats.reverse();
  const duplicates=scanPreview(state,source(incoming),data);assert.equal(duplicates.changed,false);assert.equal(duplicates.changes.artifacts.unchanged,2);
});

test('候选排除非法成长、不同主属性；满级重塑单独提示；支持新增第四条',()=>{
  const state=sample(),impossible=art(20,[3,3,1,2]);
  assert.equal(scanPreview(state,source([impossible]),data).matches.length,0);
  const sands=sample();sands.good.artifacts=[{...art(),slotKey:'sands',mainStatKey:'hp_'}];assert.equal(scanPreview(sands,source([{...art(20,[3,2,2,2]),slotKey:'sands',mainStatKey:'def_'}]),data).matches.length,0);
  state.good.artifacts=[art(20,[3,2,2,2])];
  const reshape=scanPreview(state,source([art(20,[2,2,3,2])]),data);assert.equal(reshape.unresolved,1);assert.match(reshape.matches[0].candidates[0].reason,/重塑/);
  const three={...draft(0,[1,1,1,0]),initialCount:3},four={...draft(4,[1,1,1,1]),initialCount:3};
  state.good.artifacts=[{...artifactFromDraft(three,data),id:7,location:'Furina'}];
  assert.equal(scanPreview(state,source([{...artifactFromDraft(four,data),location:'Furina'}]),data).unresolved,1);
});

test('武器成长保留本地编号；歧义不自动选择，重复占用、伪造和过期确认均被拒绝',()=>{
  const state=sample();state.good.weapons.push({...weapon,id:1,location:''});
  const input={format:'GOOD',version:3,weapons:[{...weapon,level:40,ascension:1,id:99}]},preview=scanPreview(state,input,data);
  assert.equal(preview.unresolved,1);assert.equal(preview.matches[0].candidates.length,2);
  const updated=scanPreview(state,input,data,{decisions:resolve(preview,'update',1)});assert.equal(updated.state.good.weapons[1].id,1);assert.equal(updated.state.good.weapons[1].level,40);assert.equal(updated.state.good.weapons[0].location,'');
  const stale=resolve(preview);stale[0].targetFingerprint='伪造';assert.throws(()=>scanPreview(state,input,data,{decisions:stale}),/候选/);
  const changed=structuredClone(input);changed.weapons[0].refinement=2;assert.throws(()=>scanPreview(state,changed,data,{decisions:resolve(preview)}),/失效/);
  const onlyOne=sample(),twice=source([art(20,[3,2,2,2]),{...art(20,[3,2,2,2]),location:''}]),both=scanPreview(onlyOne,twice,data);
  assert.throws(()=>scanPreview(onlyOne,twice,data,{decisions:resolve(both)}),/其他项目/);
  const pending={};chooseImportMatch(pending,both,{kind:'artifacts',incomingIndex:0,action:'update',targetIndex:0});
  const reserved=scanPreview(onlyOne,twice,data,{decisions:pending.decisions});assert.equal(reserved.matches[1].candidates[0].claimed,true);
});

test('完整扫描中跳过疑似项保留其旧件；部分导入保持未提供类别',()=>{
  const state=sample();state.good.artifacts.push({...art(),id:8,slotKey:'plume',mainStatKey:'atk',location:''});
  const input=source(),preview=scanPreview(state,input,data,{mode:'sync'});
  const skipped=scanPreview(state,input,data,{mode:'sync',decisions:resolve(preview,'skip')});
  assert.deepEqual(skipped.state.good.artifacts,[state.good.artifacts[0]]);assert.equal(skipped.changes.artifacts.removed,1);assert.deepEqual(skipped.state.good.weapons,state.good.weapons);
});

test('服务端确认复核锁定、版本和候选，保留编号、引用、方案、原始快照及更新前存档',async()=>{
  const folder=await createTestWorkspace('import-match-store');let store;
  try{
    store=createAccountStore(join(folder,'accounts.sqlite'));const initial=sample();initial.goals.Furina=defaultGoal('hp','hydro');
    initial.customInventory={version:1,showMarkers:true,characters:[char('Albedo')],weapons:[],artifacts:[],equipmentAssignments:[{character:'Albedo',kind:'artifacts',slot:'flower',reference:{id:7,signature:JSON.stringify(['GoldenTroupe','flower',5,'hp',16,initial.good.artifacts[0].substats.map(s=>[s.key,s.value]).sort(([a],[b])=>a.localeCompare(b))]),occurrence:0}},{character:'Albedo',kind:'weapons',slot:'',reference:{id:0,signature:JSON.stringify(['FavoniusSword',20,0,1]),occurrence:0}}]};
    initial.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,scenarios:{},teams:[],plans:{Furina:[{id:'saved',name:'旧配装',character:initial.good.characters[0],weapon:initial.good.weapons[0],artifacts:initial.good.artifacts}]}});
    let saved=store.action({action:'create',name:'隔离导入',state:initial},data);const input=source(),payload={action:'import-scan',accountId:saved.account.id,revision:saved.revision,good:input,mode:'merge'};
    const preview=store.action({...payload,action:'preview-scan'},data);assert.equal(preview.unresolved,1);assert.deepEqual(store.read(saved.account.id).state,initial);
    assert.throws(()=>store.action({...payload,decisions:resolve(preview)},data),e=>e.status===423);
    saved=store.action({action:'unlock',accountId:saved.account.id,revision:saved.revision},data);
    assert.throws(()=>store.action(payload,data),e=>e.status===409);
    assert.throws(()=>store.action({...payload,revision:saved.revision},data),/疑似装备/);
    const updated=store.action({...payload,revision:saved.revision,decisions:resolve(preview),source:'new.good.json'},data);
    assert.equal(updated.account.locked,true);assert.equal(updated.state.good.artifacts[0].id,7);assert.equal(updated.state.good.artifacts[0].level,20);
    assert.deepEqual(updated.state.engineStorage,initial.engineStorage);assert.deepEqual(updated.state.goals,initial.goals);assert.deepEqual(store.original(saved.account.id).state,initial);assert.deepEqual(store.recovery(saved.account.id).previousState,initial);
    assert.deepEqual(updated.state.customInventory.equipmentAssignments[1],initial.customInventory.equipmentAssignments[1]);
    const view=createManagedState(updated.state,updated.account);assert.equal(equipment(view.good,'Albedo').artifacts[0].level,20);assert.equal(equipment(view.good,'Albedo').weapon.id,0);
  }finally{store?.close();await cleanupTestWorkspace(folder);}
});

test('导入代表交互：预览不写库，逐项选择改变统计，确认后提交服务端且新模块可加载',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const folder=await createTestWorkspace('import-match-dom');const store=createAccountStore(join(folder,'accounts.sqlite'));
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let router,server,active=null;
  try{
    const initial=sample();store.action({action:'create',name:'导入界面隔离',state:initial},data);
    router=createAssessmentRouter({storagePath:join(folder,'router.sqlite'),json:(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));},body:async()=>({})});
    server=createServer((req,res)=>{void router.handle(req,res,new URL(req.url,'http://localhost')).then(handled=>{if(!handled){res.writeHead(404);res.end();}});});server.listen(0,'127.0.0.1');await once(server,'listening');
    const address=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/assessment/import-matching.mjs','/assessment/core/equipment-matching.mjs']){const response=await prior.fetch(address+path);assert.equal(response.status,200,path);await response.text();}
    assert.equal((await prior.fetch(address+'/assessment/accounts-store.mjs')).status,404);
    Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
    Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
    Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
    Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(value){if(value)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
    Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(value){for(const option of this.options)option.selected=option.value===value;},configurable:true});
    const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;};
    globalThis.document=document;globalThis.CSS={escape:s=>s};globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-16T00:00:00Z'}});
    const messages=[],requests=[],host=document.querySelector('main');
    await mountAssessment({host,toast:value=>messages.push(value),api:async(path,request)=>{
      if(path==='assessment/accounts'){if(request?.method==='POST'){requests.push(request.body);return store.action(request.body,data);}return store.list();}
      if(path==='assessment/recommendations')return {version:2,revision:0,records:{}};
      return request?.method==='POST'?store.write(request.body,data):store.read();
    }});
    const q=selector=>host.querySelector(selector),tick=()=>new Promise(setImmediate),until=async check=>{for(let i=0;i<100&&!check();i++)await tick();assert.ok(check(),messages.join('\n'));};
    const click=async selector=>{const node=q(selector);assert.ok(node,selector);assert.equal(node.disabled,false,selector);node.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();};
    assert.ok(q('[data-tab="import"]'),host.textContent+'\n'+messages.join('\n'));await click('[data-tab="import"]');
    const file=new File([JSON.stringify(source())],'partial.good.json',{type:'application/json'}),fileInput=q('[data-import-file]');Object.defineProperty(fileInput,'files',{value:[file],configurable:true});fileInput.dispatchEvent(new window.Event('change',{bubbles:true}));await until(()=>q('[data-import-mode]'));
    q('[data-import-mode]').value='merge';q('[data-import-mode]').dispatchEvent(new window.Event('change',{bubbles:true}));await until(()=>q('[data-import-match-action="update"]'));
    assert.equal(q('[data-ae="confirm-import"]').disabled,true);assert.deepEqual(store.read().state.good,initial.good);assert.match(q('.ae-import-match-table').textContent,/暴击率/);
    await click('[data-import-match-action="new"]');assert.equal(q('[data-import-match-action="new"]').getAttribute('aria-pressed'),'true');assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-import-match-action="skip"]');assert.equal(q('[data-import-match-action="skip"]').getAttribute('aria-pressed'),'true');
    await click('[data-import-match-action="update"]');assert.equal(q('[data-ae="confirm-import"]').disabled,true);
    await click('[data-account-action="unlock"]');await until(()=>q('[data-ae="confirm-import"]')&&!q('[data-ae="confirm-import"]').disabled);
    await click('[data-ae="confirm-import"]');await until(()=>store.read().state.good.artifacts[0].level===20&&q('[data-account-action="unlock"]'));
    const request=requests.find(r=>r.action==='import-scan');assert.equal(request.decisions[0].action,'update');assert.equal(store.read().state.good.artifacts.length,1);assert.equal(store.read().state.good.artifacts[0].id,7);assert.equal(store.read().account.locked,true);assert.deepEqual(store.recovery(store.read().account.id).previousState.good,initial.good);
  }finally{
    await disposeAssessment();Object.assign(globalThis,prior);if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}router?.close();store.close();await cleanupTestWorkspace(folder);
  }
});
