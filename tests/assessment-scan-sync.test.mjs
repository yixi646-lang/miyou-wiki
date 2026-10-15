import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {scanPreview} from '../modules/character-assessment/core/import-sync.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(await readFile(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url),'utf8'));
const character={key:'Furina',level:90,ascension:6,constellation:2,talent:{auto:6,skill:10,burst:10}};
const artifact={setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8}],location:'',lock:false};
const sample=()=>{const s=blankState();s.selected='Furina';s.good.source='Inventory_Kamera';s.good.characters=[structuredClone(character)];s.good.weapons=[{key:'FavoniusSword',level:90,ascension:6,refinement:5,location:'Furina',lock:false,id:0},{key:'SacrificialSword',level:90,ascension:6,refinement:5,location:'',lock:false,id:1}];s.good.artifacts=[{...structuredClone(artifact),id:0},{...structuredClone(artifact),id:1,location:'Furina'}];return s;};

test('重扫编号和排序变化不改装备，相同副本按数量保留，合并不误覆盖强化后的装备',()=>{
  const state=sample(),original=structuredClone(state),incoming=structuredClone(state.good);
  incoming.weapons.reverse().forEach((w,i)=>w.id=i);incoming.artifacts.reverse().forEach((a,i)=>{a.id=i;a.substats.reverse();});
  const same=scanPreview(state,incoming,data);assert.equal(same.changed,false);assert.deepEqual(same.state.good,state.good);assert.equal(same.changes.artifacts.unchanged,2);assert.equal(same.changes.weapons.unchanged,2);
  incoming.characters[0].level=80;incoming.artifacts=[{...structuredClone(artifact),level:16,id:0,location:'Furina'}];
  const changed=scanPreview(state,incoming,data);assert.equal(changed.state.good.characters[0].level,80);assert.equal(changed.state.good.artifacts.length,3);assert.equal(changed.changes.artifacts.added,1);assert.equal(changed.state.good.artifacts.find(a=>a.id===0).level,20);assert.equal(changed.state.good.artifacts.filter(a=>a.location==='Furina').length,1);assert.deepEqual(state,original);
});

test('现有账号扫描更新保护锁定，替换仅针对已提供类别，并保留目标、快照与更新前存档',async()=>{
  const folder=await createTestWorkspace('assessment-scan-sync');let store;
  try{
    store=createAccountStore(join(folder,'assessment.sqlite'));const initial=sample();initial.goals.Furina=defaultGoal('hp','hydro');
    initial.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,scenarios:{Furina:{enemyLevel:80,members:[]}},teams:[{id:'team',name:'我的队伍',character:'Furina',scenario:{members:[]}}],plans:{}});
    const imported=store.action({action:'create',name:'扫描账号',state:initial,source:'first.json'},data),incoming={format:'GOOD',version:3,characters:[{...character,level:80}],artifacts:[{...structuredClone(artifact),id:77,location:'Furina'}]};
    const count=store.list().accounts.length,payload={action:'preview-scan',accountId:imported.account.id,revision:imported.revision,good:incoming,mode:'sync'};
    const preview=store.action(payload,data);assert.equal(preview.changes.artifacts.removed,1);assert.equal(preview.changes.weapons.removed,0);assert.deepEqual(store.read(imported.account.id).state,initial);
    assert.throws(()=>store.action({...payload,action:'import-scan'},data),e=>e.status===423);
    const unlocked=store.action({action:'unlock',accountId:imported.account.id,revision:imported.revision},data);
    assert.throws(()=>store.action({...payload,action:'import-scan',revision:unlocked.revision},data),/确认完整扫描/);
    const result=store.action({...payload,action:'import-scan',revision:unlocked.revision,confirmReplace:true,source:'latest.json'},data);
    assert.equal(result.account.id,imported.account.id);assert.equal(store.list().accounts.length,count);assert.equal(result.account.locked,true);assert.equal(result.state.good.artifacts.length,1);assert.equal(result.state.good.weapons.length,2);assert.deepEqual(result.state.goals,initial.goals);assert.deepEqual(result.state.engineStorage,initial.engineStorage);assert.deepEqual(store.original(imported.account.id).state,initial);assert.deepEqual(store.recovery(imported.account.id).previousState,initial);
    const again=store.action({action:'unlock',accountId:result.account.id,revision:result.revision},data),recovery=store.recovery(result.account.id);
    const repeated=store.action({...payload,action:'import-scan',revision:again.revision,confirmReplace:true},data);assert.equal(repeated.unchanged,true);assert.equal(repeated.revision,again.revision);assert.deepEqual(store.recovery(result.account.id),recovery);
    const copied=store.action({action:'copy',accountId:repeated.account.id,revision:repeated.revision},data);assert.deepEqual(store.recovery(copied.account.id).previousState,initial);
    const restored=store.import({backup:store.export()},data);assert.deepEqual(store.recovery(restored.account.id).previousState,initial);
  }finally{store?.close();await cleanupTestWorkspace(folder);}
});
