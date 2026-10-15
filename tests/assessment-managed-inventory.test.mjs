import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {blankState,equipment,validateState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {createManagedState,serializeManagedState,syncManagedState,storeCustomEquipment,equipManagedEquipment,restoreManagedEquipment,isCustom,convertCustomToDefault} from '../modules/character-assessment/core/managed-inventory.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {removeCharacter,removeEquipment,switchTravelerElement} from '../modules/character-assessment/core/actions.mjs';
import {mountAssessment,disposeAssessment} from '../modules/character-assessment/ui.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const character=key=>({key,level:90,ascension:6,constellation:0,talent:{auto:1,skill:1,burst:1}});
const sample=()=>{const state=blankState();state.selected='Furina';state.good.characters=[character('Furina')];state.good.weapons=[{id:0,key:'FavoniusSword',level:90,ascension:6,refinement:1,location:'Furina',lock:false}];state.good.artifacts=[{id:0,setKey:'GoldenTroupe',rarity:5,level:20,slotKey:'flower',mainStatKey:'hp',substats:[],location:'Furina',lock:false}];return state;};

test('自定义转为默认配置保留当前配装、卸下状态和目标，锁定及版本校验生效，导入快照不改写',async()=>{
  const folder=await createTestWorkspace('custom-to-default'),store=createAccountStore(join(folder,'accounts.sqlite'));
  try{
    const initial=sample();initial.good.artifacts.push({...initial.good.artifacts[0],id:1,slotKey:'plume',mainStatKey:'atk'});
    let saved=store.action({action:'create',name:'转换账号',state:initial},data);
    const original=store.original(saved.account.id).state;
    saved=store.action({action:'unlock',accountId:saved.account.id,revision:saved.revision},data);
    const view=createManagedState(saved.state,saved.account);
    view.good.characters.push({...character('Albedo'),wikiCustom:true});syncManagedState(view);
    equipManagedEquipment(view,'Albedo','weapons',0);
    const weaponId=storeCustomEquipment(view,'weapons',{...initial.good.weapons[0],refinement:5});
    const artifactId=storeCustomEquipment(view,'artifacts',{...initial.good.artifacts[0],substats:[{key:'critRate_',value:15.6}]});
    equipManagedEquipment(view,'Furina','weapons',view.good.weapons.findIndex(w=>w.id===weaponId));
    equipManagedEquipment(view,'Furina','artifacts',view.good.artifacts.findIndex(a=>a.id===artifactId),'flower');
    equipManagedEquipment(view,'Furina','artifacts','','plume');
    view.goals.Albedo={...defaultGoal('defense'),notes:'保留评价目标'};view.engineStorage.saved='保留工作区';
    // 后续扫描已有的角色优先使用原有资料，历史自定义版本不应覆盖它。
    view.customInventory.characters.push({...character('Furina'),constellation:2});syncManagedState(view);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:serializeManagedState(view)},data);
    const before=structuredClone(saved.state);
    saved=store.action({action:'lock',accountId:saved.account.id,revision:saved.revision},data);
    const conversion=convertCustomToDefault(before,data);
    assert.throws(()=>store.write({accountId:saved.account.id,revision:saved.revision,state:conversion.state},data),e=>e.status===423);
    saved=store.action({action:'unlock',accountId:saved.account.id,revision:saved.revision},data);
    assert.throws(()=>store.write({accountId:saved.account.id,revision:saved.revision-1,state:conversion.state},data),e=>e.status===409);
    const converted={...store.write({accountId:saved.account.id,revision:saved.revision,state:conversion.state},data),converted:conversion.counts};
    assert.deepEqual(converted.converted,{characters:1,weapons:1,artifacts:1});assert.equal(converted.account.locked,false);
    assert.deepEqual(converted.state.good.weapons,[{...initial.good.weapons[0],location:'Albedo'},{...initial.good.weapons[0],id:weaponId,refinement:5,location:'Furina'}]);
    assert.equal(equipment(converted.state.good,'Furina').artifacts[0].id,artifactId);
    assert.deepEqual(equipment(converted.state.good,'Furina').artifacts[0].substats,[{key:'critRate_',value:15.6}]);
    assert.equal(converted.state.good.artifacts.find(a=>a.id===1).location,'');assert.equal(converted.state.good.artifacts[0].location,'');
    assert.equal(converted.state.good.characters.find(c=>c.key==='Furina').constellation,0);
    assert.deepEqual(converted.state.customInventory.characters,[{...character('Furina'),constellation:2}]);
    assert.deepEqual(converted.state.customInventory.weapons,[]);assert.deepEqual(converted.state.customInventory.artifacts,[]);
    assert.equal(converted.state.customInventory.equipmentAssignments,undefined);assert.equal(converted.state.customInventory.unequippedSlots,undefined);
    assert.deepEqual(converted.state.goals,before.goals);assert.deepEqual(converted.state.engineStorage,before.engineStorage);
    const reloaded=createManagedState(store.read(saved.account.id).state,converted.account);
    assert.ok(reloaded.good.characters.every(c=>!isCustom(c)));assert.ok(reloaded.good.weapons.every(w=>!isCustom(w)));assert.ok(reloaded.good.artifacts.every(a=>!isCustom(a)));
    assert.deepEqual(store.original(saved.account.id).state,original);
    const repeated=convertCustomToDefault(converted.state,data);
    assert.equal(repeated.changed,false);assert.equal(store.read(saved.account.id).revision,converted.revision);
  }finally{store.close();await cleanupTestWorkspace(folder);}
});

test('主角七元素自定义按元素保留天赋、命座和目标，锁定保存不改原导入记录',async()=>{
  const folder=await createTestWorkspace('traveler-seven-elements'),store=createAccountStore(join(folder,'accounts.sqlite'));
  try{
    const initial=sample();initial.good.characters.push({...character('TravelerGeoM'),constellation:4});
    const imported=store.action({action:'create',name:'七元素主角',state:initial},data),view=createManagedState(imported.state,imported.account);
    for(const element of ['anemo','geo','electro','dendro','hydro','pyro','cryo']){
      const key=switchTravelerElement(view,'TravelerGeoM',element),c=view.good.characters.find(c=>c.key===key);
      assert.equal(c.level,90);assert.equal(c.ascension,6);
      if(element!=='geo'){assert.equal(c.wikiCustom,true);assert.equal(c.constellation,0);assert.deepEqual(c.talent,{auto:1,skill:1,burst:1});c.talent.skill=7;c.constellation=3;}
      view.goals[key]={...defaultGoal('custom'),notes:element};syncManagedState(view);
    }
    assert.equal(view.good.characters.filter(c=>c.key.startsWith('Traveler')&&c.key.endsWith('M')).length,7);
    const cryo=switchTravelerElement(view,'TravelerGeoM','cryo');assert.equal(view.good.characters.find(c=>c.key===cryo).talent.skill,7);
    assert.equal(switchTravelerElement(view,cryo,'geo'),'TravelerGeoM');assert.equal(view.good.characters.find(c=>c.key==='TravelerGeoM').constellation,4);
    assert.throws(()=>switchTravelerElement(view,'Furina','cryo'),/有效/);assert.throws(()=>switchTravelerElement(view,cryo,'light'),/有效/);
    const saved=store.write({accountId:imported.account.id,revision:imported.revision,state:serializeManagedState(view)},data);assert.deepEqual(saved.state.good,initial.good);
    const reloaded=createManagedState(saved.state,saved.account);const next=switchTravelerElement(reloaded,'TravelerGeoM','cryo');assert.equal(reloaded.good.characters.find(c=>c.key===next).talent.skill,7);assert.equal(reloaded.good.characters.find(c=>c.key===next).constellation,3);assert.equal(reloaded.goals[next].notes,'cryo');assert.equal(reloaded.goals.TravelerGeoM.notes,'geo');
  }finally{store.close();await cleanupTestWorkspace(folder);}
});

test('统一库存独立持久化，锁定时编辑角色及装备、装备覆盖、删除恢复、扫描和副本备份均不改写原始资料',async()=>{
  const folder=await createTestWorkspace('managed-inventory');const store=createAccountStore(join(folder,'accounts.sqlite'));
  try{
    const initial=sample();let saved=store.action({action:'create',name:'导入账号',state:initial},data);
    const original=structuredClone(saved.state),view=createManagedState(saved.state,saved.account);
    view.good.characters.push({...character('Mona'),wikiCustom:true});
    const weaponId=storeCustomEquipment(view,'weapons',{...initial.good.weapons[0],refinement:5,wikiTrialOnly:true});
    const artifactId=storeCustomEquipment(view,'artifacts',{...initial.good.artifacts[0],substats:[{key:'critRate_',value:15.6}],wikiTrialOnly:true});
    equipManagedEquipment(view,'Furina','weapons',view.good.weapons.findIndex(w=>w.id===weaponId),undefined,{locked:true});
    equipManagedEquipment(view,'Furina','artifacts',view.good.artifacts.findIndex(a=>a.id===artifactId),'flower',{locked:true});
    assert.equal(equipment(view.good,'Furina').weapon.refinement,5);assert.equal(equipment(view.good,'Furina').artifacts[0].substats[0].value,15.6);
    view.good.characters.find(c=>c.key==='Mona').constellation=3;
    const payload=serializeManagedState(view);assert.deepEqual(payload.good,original.good);validateState(payload,data);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:payload},data);
    assert.deepEqual(store.original(saved.account.id).state,original);assert.equal(saved.account.locked,true);assert.equal(saved.account.counts.characters,2);assert.equal(saved.account.customCounts.weapons,1);
    const restored=createManagedState(saved.state,saved.account);assert.equal(equipment(restored.good,'Furina').weapon.refinement,5);assert.ok(isCustom(restored.good.characters.find(c=>c.key==='Mona')));
    assert.throws(()=>equipManagedEquipment(restored,'Furina','weapons',0,undefined,{locked:true}),/已锁定/);
    // 删除覆盖装备时自动重新显示原有装备，实际资料字节内容保持不变。
    removeEquipment(restored,'weapons',restored.good.weapons.findIndex(w=>w.id===weaponId));syncManagedState(restored);
    assert.equal(equipment(restored.good,'Furina').weapon.id,0);assert.deepEqual(serializeManagedState(restored).good,original.good);
    restoreManagedEquipment(restored,'Furina');assert.equal(equipment(restored.good,'Furina').artifacts[0].id,0);
    removeCharacter(restored,'Mona');assert.deepEqual(serializeManagedState(restored).good,original.good);
    const invalid=structuredClone(saved.state);invalid.good.characters[0].level=80;assert.throws(()=>store.write({accountId:saved.account.id,revision:saved.revision,state:invalid},data),e=>e.status===423);
    const hidden=structuredClone(saved.state);hidden.customInventory.showMarkers=false;assert.throws(()=>store.write({accountId:saved.account.id,revision:saved.revision,state:hidden},data),/标记/);
    const copy=store.action({action:'copy',accountId:saved.account.id,revision:saved.revision},data);assert.equal(copy.account.kind,'copy');
    copy.state.customInventory.showMarkers=false;store.write({accountId:copy.account.id,revision:copy.revision,state:copy.state},data);
    const backup=store.export(),roundtrip=store.import({backup},data);assert.equal(roundtrip.account.kind,'copy');assert.equal(roundtrip.state.customInventory.showMarkers,false);assert.deepEqual(store.original(roundtrip.account.id).state,original);
    const unlocked=store.action({action:'unlock',accountId:saved.account.id,revision:saved.revision},data);
    const scan={...initial.good,characters:[...initial.good.characters,character('Mona')]};
    const scanned=store.action({action:'import-scan',accountId:saved.account.id,revision:unlocked.revision,good:scan,mode:'merge'},data);
    assert.equal(scanned.state.customInventory.characters[0].constellation,3);
    const scannedView=createManagedState(scanned.state,scanned.account);assert.equal(scannedView.good.characters.filter(c=>c.key==='Mona').length,1);assert.equal(scannedView.good.characters.find(c=>c.key==='Mona').constellation,0);
    assert.deepEqual(serializeManagedState(scannedView).customInventory.characters,scanned.state.customInventory.characters);
    assert.deepEqual(store.original(scanned.account.id).state,original);
  }finally{store.close();await cleanupTestWorkspace(folder);}
});

test('锁定自定义角色可装备导入原件，引用持久化、备份和解除不改变库存数值或实际装备记录',async()=>{
  const folder=await createTestWorkspace('custom-character-equipment');const store=createAccountStore(join(folder,'accounts.sqlite'));
  try{
    const initial=sample();let saved=store.action({action:'create',name:'导入原件引用',state:initial},data);
    const view=createManagedState(saved.state,saved.account);view.good.characters.push({...character('Albedo'),wikiCustom:true});syncManagedState(view);
    equipManagedEquipment(view,'Albedo','weapons',0,undefined,{locked:true});equipManagedEquipment(view,'Albedo','artifacts',0,'flower',{locked:true});
    assert.equal(equipment(view.good,'Albedo').weapon.key,'FavoniusSword');assert.equal(equipment(view.good,'Albedo').artifacts[0].setKey,'GoldenTroupe');
    assert.equal(isCustom(equipment(view.good,'Albedo').weapon),false);assert.equal(view.good.weapons.length,1);assert.equal(view.good.artifacts.length,1);
    const payload=serializeManagedState(view);assert.deepEqual(payload.good,initial.good);assert.equal(payload.customInventory.weapons.length,0);assert.equal(payload.customInventory.artifacts.length,0);assert.equal(payload.customInventory.equipmentAssignments.length,2);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:payload},data);assert.equal(saved.account.locked,true);
    const restored=createManagedState(saved.state,saved.account);assert.equal(equipment(restored.good,'Albedo').weapon.refinement,1);assert.equal(equipment(restored.good,'Albedo').artifacts[0].level,20);
    assert.deepEqual(serializeManagedState(restored).good,initial.good);assert.deepEqual(store.original(saved.account.id).state.good,initial.good);
    const copied=store.import({backup:store.export()},data),backupView=createManagedState(copied.state,copied.account);assert.equal(equipment(backupView.good,'Albedo').weapon.key,'FavoniusSword');assert.deepEqual(copied.state.good,initial.good);
    const missing=structuredClone(saved.state);missing.good.weapons[0].key='HarbingerOfDawn';assert.equal(equipment(createManagedState(missing,saved.account),'Albedo').weapon,undefined);
    const invalid=structuredClone(saved.state);invalid.customInventory.equipmentAssignments[0].character='Furina';assert.throws(()=>validateState(invalid,data),/装备引用/);
    const duplicate=structuredClone(saved.state);duplicate.customInventory.equipmentAssignments.push(structuredClone(duplicate.customInventory.equipmentAssignments[0]));assert.throws(()=>validateState(duplicate,data),/重复/);
    assert.throws(()=>equipManagedEquipment(restored,'Albedo','weapons','',undefined,{locked:true}),/不能移除/);
    restoreManagedEquipment(restored,'Albedo',{kind:'weapons'});assert.equal(equipment(restored.good,'Albedo').weapon,undefined);assert.equal(equipment(restored.good,'Furina').weapon.location,'Furina');
    removeCharacter(restored,'Albedo');syncManagedState(restored);assert.deepEqual(restored.customInventory.equipmentAssignments,[]);assert.deepEqual(serializeManagedState(restored).good,initial.good);
    const removed=store.write({accountId:saved.account.id,revision:saved.revision,state:serializeManagedState(restored)},data);assert.deepEqual(removed.state.good,initial.good);
  }finally{store.close();await cleanupTestWorkspace(folder);}
});

test('恢复指定部位及全部圣遗物保持武器和其他角色配装，移除可持久化后在锁定时恢复',async()=>{
  const folder=await createTestWorkspace('equipment-restore-scope'),store=createAccountStore(join(folder,'accounts.sqlite'));
  try{
    const initial=sample();initial.good.characters.push(character('Mona'));
    initial.good.artifacts.push({...structuredClone(initial.good.artifacts[0]),id:1,slotKey:'plume',mainStatKey:'atk'},{...structuredClone(initial.good.artifacts[0]),id:2,location:'Mona'});
    let saved=store.action({action:'create',name:'恢复范围',state:initial},data),view=createManagedState(saved.state,saved.account);
    const w=storeCustomEquipment(view,'weapons',{...initial.good.weapons[0],refinement:5}),f=storeCustomEquipment(view,'artifacts',initial.good.artifacts[0]),p=storeCustomEquipment(view,'artifacts',initial.good.artifacts[1]);
    const equip=(kind,id,slot)=>equipManagedEquipment(view,'Furina',kind,view.good[kind].findIndex(a=>a.id===id),slot,{locked:true});
    equip('weapons',w);equip('artifacts',f,'flower');equip('artifacts',p,'plume');
    restoreManagedEquipment(view,'Furina',{kind:'artifacts',slot:'flower'});
    assert.equal(equipment(view.good,'Furina').artifacts.find(a=>a.slotKey==='flower').id,0);assert.equal(equipment(view.good,'Furina').artifacts.find(a=>a.slotKey==='plume').id,p);assert.equal(equipment(view.good,'Furina').weapon.id,w);
    restoreManagedEquipment(view,'Furina',{kind:'artifacts'});assert.deepEqual(equipment(view.good,'Furina').artifacts.map(a=>a.id),[0,1]);assert.equal(equipment(view.good,'Furina').weapon.id,w);assert.equal(equipment(view.good,'Mona').artifacts[0].id,2);
    assert.throws(()=>equipManagedEquipment(view,'Furina','artifacts','','flower',{locked:true}),/不能移除/);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:serializeManagedState(view)},data);
    saved=store.action({action:'unlock',accountId:saved.account.id,revision:saved.revision},data);view=createManagedState(saved.state,saved.account);
    equipManagedEquipment(view,'Furina','artifacts','','flower');assert.equal(equipment(view.good,'Furina').artifacts.some(a=>a.slotKey==='flower'),false);
    const payload=serializeManagedState(view);assert.deepEqual(payload.good,initial.good);validateState(payload,data);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:payload},data);saved=store.action({action:'lock',accountId:saved.account.id,revision:saved.revision},data);
    const invalid=structuredClone(saved.state);invalid.customInventory.unequippedSlots.push({character:'Furina',kind:'weapons',slot:''});assert.throws(()=>store.write({accountId:saved.account.id,revision:saved.revision,state:invalid},data),e=>e.status===423);
    view=createManagedState(saved.state,saved.account);assert.equal(equipment(view.good,'Furina').artifacts.some(a=>a.slotKey==='flower'),false);
    restoreManagedEquipment(view,'Furina',{kind:'artifacts'});assert.equal(equipment(view.good,'Furina').artifacts[0].id,0);assert.equal(equipment(view.good,'Furina').weapon.id,w);
    saved=store.write({accountId:saved.account.id,revision:saved.revision,state:serializeManagedState(view)},data);assert.deepEqual(saved.state.good,initial.good);assert.deepEqual(store.original(saved.account.id).state.good,initial.good);
    const roundtrip=store.import({backup:store.export()},data);assert.equal(equipment(createManagedState(roundtrip.state,roundtrip.account).good,'Furina').artifacts[0].id,0);
  }finally{store.close();await cleanupTestWorkspace(folder);}
});

test('锁定账号通过顶部悬浮筛选添加角色，库存自定义武器可编辑并在角色页面替换和恢复', {skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const folder=await createTestWorkspace('managed-inventory-ui');const store=createAccountStore(join(folder,'accounts.sqlite'));
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><head></head><body><main></main></body></html>');
  const prior={document:globalThis.document,fetch:globalThis.fetch,CSS:globalThis.CSS};let active=null;
  Object.defineProperty(document,'activeElement',{get:()=>active,configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'focus',{value(){active=this;},configurable:true});
  Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
  Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===v;},configurable:true});
  const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
  document.body.style.overflow='auto';globalThis.document=document;globalThis.CSS={escape:s=>s};
  globalThis.fetch=async url=>({json:async()=>url.includes('game-stats')?structuredClone(data):url.includes('catalog')?structuredClone(catalog):{version:'test',deployedAt:'2026-10-07'}});
  const tick=()=>new Promise(setImmediate),wait=ms=>new Promise(r=>setTimeout(r,ms)),messages=[];
  const initial=sample();initial.good.characters.push({...character('TravelerGeoM'),constellation:4});initial.good.artifacts[0].substats=[{key:'critRate_',value:3.9},{key:'enerRech_',value:5.8}];const imported=store.action({action:'create',name:'界面隔离账号',state:initial},data);
  try{
    const host=document.querySelector('main');await mountAssessment({host,toast:m=>messages.push(m),api:async(path,req)=>{
      if(path==='assessment/accounts')return req?.method==='POST'?store.action(req.body,data):store.list();if(path==='assessment/recommendations')return{version:2,revision:0,records:{}};
      if(req?.method==='POST')return store.write(req.body,data);return store.read();
    }});
    const q=s=>host.querySelector(s),click=async s=>{const t=q(s);assert.ok(t,s);assert.equal(t.disabled,false,s);t.focus();t.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();};
    const change=async(s,value)=>{const t=q(s);assert.ok(t,s);assert.equal(t.disabled,false,s);t.value=value;t.dispatchEvent(new window.Event(t.type==='search'?'input':'change',{bubbles:true}));await tick();};
    assert.ok(q('.ae-roster-title [data-ae="add"]'));assert.equal(q('#ae-add-character'),null);assert.equal(q('[data-custom-markers]'),null);assert.equal(q('[data-char="level"]').disabled,true);
    await click('[data-ae="add"]');await click('[data-character-filter="element"][data-value="hydro"]');await click('[data-character-filter="rarity"][data-value="5"]');await change('[data-inventory-picker-filter="search"]','莫娜');
    assert.deepEqual([...host.querySelectorAll('[data-inventory-picker-character]')].map(n=>n.dataset.inventoryPickerCharacter),['Mona']);
    await click('[data-inventory-picker-character="Mona"]');assert.equal(q('dialog'),null);assert.equal(document.body.style.overflow,'auto');assert.equal(q('[data-char="level"]').disabled,false);
    await change('[data-char="level"]','20');await wait(700);await tick();assert.equal(store.read().state.customInventory.characters[0].level,20);assert.deepEqual(store.read().state.good,initial.good);
    // 自定义角色可直接选择导入原件；原件数值保持只读，配装引用可以保存并解除。
    await click('[data-ae="add"]');await change('[data-inventory-picker-filter="search"]','阿贝多');await click('[data-inventory-picker-character="Albedo"]');
    await click('[data-ae="inventory-equip"][data-kind="weapons"]');assert.equal(q('button[data-inventory-picker-filter="origin"][aria-pressed="true"]').dataset.value,'');assert.equal(q('[data-inventory-picker-equipment="0"]').disabled,false);
    await click('[data-inventory-picker-equipment="0"]');assert.equal(q('[data-weapon="refinement"]').value,'1');assert.equal(q('[data-weapon="refinement"]').disabled,true);
    await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');assert.equal(q('[data-inventory-picker-equipment="0"]').disabled,false);
    assert.match(q('[data-inventory-picker-equipment="0"] .ae-equipment-owner').textContent,/已装备：芙宁娜/);assert.match(q('.ae-equipment-substats').textContent,/暴击率3.9%/);assert.match(q('.ae-equipment-substats').textContent,/元素充能效率5.8%/);
    assert.equal(q('[data-inventory-picker-equipment=""]').disabled,true);assert.equal(q('[data-inventory-picker-restore]').disabled,false);await click('[data-inventory-picker-equipment="0"]');
    assert.equal(q('[data-slot="flower"] [data-art="level"]').value,'20');assert.equal(q('[data-slot="flower"] [data-art="level"]').disabled,true);
    await wait(700);await tick();assert.equal(store.read().state.customInventory.equipmentAssignments.length,2);assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-ae="restore-account-equipment"]');await wait(700);await tick();assert.deepEqual(store.read().state.customInventory.equipmentAssignments,[]);assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-tab="weapons"]');
    assert.equal(q('[data-native="edit-weapon"][data-index="0"]').disabled,true);await click('[data-native="copy-inventory-item"][data-kind="weapons"][data-index="0"]');
    await change('[data-inventory-origin]','custom');assert.equal(host.querySelectorAll('.ae-weapon-card').length,1);assert.match(q('.ae-weapon-card').textContent,/自定义/);
    await click('[data-native="edit-weapon"][data-index="1"]');await change('[data-native-weapon="refinement"]','5');await wait(700);await tick();
    assert.equal(store.read().state.customInventory.weapons[0].refinement,5);assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-tab="evaluation"]');await click('[data-select="Furina"]');await click('[data-ae="inventory-equip"][data-kind="weapons"]');
    assert.equal(q('button[data-inventory-picker-filter="origin"][aria-pressed="true"]').dataset.value,'custom');await click('[data-inventory-picker-equipment="1"]');assert.equal(q('[data-weapon="refinement"]').value,'5');assert.equal(q('[data-weapon="refinement"]').disabled,false);
    await wait(700);await tick();assert.equal(store.read().state.customInventory.weapons[0].location,'Furina');assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-ae="restore-account-equipment"]');assert.equal(q('[data-weapon="refinement"]').value,'1');assert.equal(q('[data-weapon="refinement"]').disabled,true);
    await wait(700);await tick();assert.deepEqual(store.read().state.good,initial.good);assert.deepEqual(store.original(imported.account.id).state.good,initial.good);
    await click('[data-tab="artifacts"]');
    assert.equal(q('[data-native="edit-artifact"][data-index="0"]').disabled,true);
    await click('[data-native="new-artifact"]');assert.equal(q('[data-native="custom-to-inventory"]').disabled,false);
    await click('[data-native="custom-to-inventory"]');await change('[data-inventory-origin]','custom');
    assert.equal(host.querySelectorAll('.ae-artifact-card').length,1);assert.match(q('.ae-artifact-card').textContent,/自定义/);
    assert.equal(q('[data-native="cancel-artifact"]'),null);await wait(700);await tick();
    assert.equal(store.read().state.customInventory.artifacts.length,1);assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-tab="evaluation"]');await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');
    await click('[data-inventory-picker-equipment="1"]');assert.equal(q('[data-slot="flower"] [data-art="level"]').disabled,false);
    await click('[data-ae="inventory-equip"][data-kind="weapons"]');await click('[data-inventory-picker-equipment="1"]');
    await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');assert.equal(q('[data-inventory-picker-equipment=""]').disabled,true);await click('[data-inventory-picker-restore]');
    assert.equal(q('[data-slot="flower"] [data-art="level"]').disabled,true);assert.equal(q('[data-weapon="refinement"]').value,'5');
    await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');await click('[data-inventory-picker-equipment="1"]');
    const restoreAll=q('[data-ae="restore-account-artifacts"]');assert.equal(restoreAll.parentElement,q('[data-ae="artifact-overview"]').parentElement);assert.equal(restoreAll.disabled,false);
    await click('[data-ae="restore-account-artifacts"]');assert.equal(q('[data-slot="flower"] [data-art="level"]').value,'20');assert.equal(q('[data-slot="flower"] [data-art="level"]').disabled,true);assert.equal(q('[data-weapon="refinement"]').value,'5');
    await click('[data-account-action="unlock"]');await click('[data-ae="inventory-equip"][data-kind="artifacts"][data-slot="flower"]');
    assert.equal(q('[data-inventory-picker-equipment=""]').disabled,false);assert.equal(q('[data-inventory-picker-restore]').disabled,false);await click('[data-inventory-picker-equipment=""]');assert.equal(q('[data-slot="flower"] [data-art="level"]'),null);
    await click('[data-account-action="lock"]');await click('[data-ae="restore-account-artifacts"]');assert.equal(q('[data-slot="flower"] [data-art="level"]').value,'20');
    await wait(700);await tick();assert.deepEqual(store.read().state.good,initial.good);
    await click('[data-select="TravelerGeoM"]');assert.equal(q('[data-traveler-element]').disabled,false);
    await change('[data-traveler-element]','cryo');assert.equal(q('[data-traveler-element]').value,'cryo');assert.equal(q('[data-char="level"]').disabled,true);assert.equal(q('[data-talent="skill"]').disabled,false);
    await change('[data-talent="skill"]','7');await change('[data-traveler-element]','anemo');assert.equal(q('[data-talent="skill"]').value,'1');await change('[data-traveler-element]','cryo');assert.equal(q('[data-talent="skill"]').value,'7');
    await wait(700);await tick();assert.deepEqual(store.read().state.good,initial.good);assert.equal(store.read().state.customInventory.characters.find(c=>c.key==='TravelerCryoM').talent.skill,7);
    let scrollWrites=0;Object.defineProperty(q('.assessment-root'),'scrollTop',{get:()=>600,set(){scrollWrites++;},configurable:true});
    await click('[data-evaluation-tab="guide"]');await click('[data-evaluation-tab="overview"]');
    await click('[data-tab="engine"]');await click('[data-native-team-tab="panel"]');await click('[data-native-team-tab="conditions"]');
    await click('[data-tab="import"]');assert.equal(q('[data-ae="convert-custom"]').disabled,true);
    assert.match(q('[data-custom-conversion-counts]').textContent,/武器 1.*圣遗物 1/);
    await click('[data-account-action="unlock"]');assert.equal(q('[data-ae="convert-custom"]').disabled,false);
    await click('[data-ae="convert-custom"]');assert.equal(q('[data-ae="convert-custom"]').disabled,true);
    assert.match(q('[data-custom-conversion-counts]').textContent,/角色 0.*武器 0.*圣遗物 0/);
    assert.ok(store.read().state.good.characters.some(c=>c.key==='TravelerCryoM'&&c.talent.skill===7));
    assert.deepEqual(store.read().state.customInventory.weapons,[]);assert.deepEqual(store.read().state.customInventory.artifacts,[]);
    assert.deepEqual(store.original(imported.account.id).state.good,initial.good);assert.equal(scrollWrites,0);
    assert.deepEqual(messages.filter(m=>/失败|锁定|冲突/.test(m)),[]);await wait(20);
  }finally{disposeAssessment();await tick();store.close();for(const[k,v]of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}await cleanupTestWorkspace(folder);}
});
