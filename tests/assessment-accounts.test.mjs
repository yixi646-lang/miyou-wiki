import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {blankState,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {createAccountStore} from '../modules/character-assessment/accounts-store.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const data=JSON.parse(await readFile(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url),'utf8'));
const sample=()=>{const s=blankState();s.good.characters.push({key:'Furina',level:1,ascension:0,constellation:0,talent:{auto:1,skill:1,burst:1}});s.selected='Furina';s.good.weapons.push({key:'FavoniusSword',level:1,ascension:0,refinement:1,location:'Furina',lock:false,id:0});return s;};
test('账号复制完整保留配置和导入快照，副本可编辑且与原账号隔离',async()=>{
  const folder=await createTestWorkspace('assessment-account-copy');let store;
  try{
    store=createAccountStore(join(folder,'assessment.sqlite'));
    const initial=sample();initial.goals.Furina=defaultGoal('hp');
    initial.good.artifacts=[{setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9}],location:'Furina',lock:true}];
    initial.engineStorage['wiki.native.v1']=JSON.stringify({version:1,migrated:true,scenarios:{Furina:{enemyLevel:100,members:[]}},teams:[{id:'copy-team',name:'原队伍',character:'Furina',scenario:{enemyLevel:100,members:[]}}],plans:{Furina:[{id:'copy-plan',name:'原配装',character:initial.good.characters[0],weapon:initial.good.weapons[0],artifacts:initial.good.artifacts}]},customArtifacts:[]});
    const imported=store.action({action:'create',name:'扫描账号',state:initial,source:'scanner.json'},data);
    const changed=structuredClone(imported.state);changed.goals.Furina.level=80;
    const source=store.write({accountId:imported.account.id,revision:imported.revision,state:changed},data);
    const original=store.original(source.account.id).state;
    const copy=store.action({action:'copy',accountId:source.account.id,revision:source.revision},data);
    assert.notEqual(copy.account.id,source.account.id);assert.equal(copy.account.name,'扫描账号（副本）');assert.equal(copy.account.locked,false);
    assert.equal(store.list().activeId,copy.account.id);assert.deepEqual(copy.state,source.state);
    assert.equal(copy.account.source,source.account.source);assert.equal(copy.account.importedAt,source.account.importedAt);
    assert.deepEqual(store.original(copy.account.id).state,original);
    const edited=structuredClone(copy.state);edited.good.characters[0].level=2;edited.good.weapons[0].level=2;edited.good.artifacts[0].lock=false;edited.goals.Furina.level=70;
    const workspace=JSON.parse(edited.engineStorage['wiki.native.v1']);workspace.teams[0].name='副本队伍';workspace.plans.Furina[0].name='副本配装';edited.engineStorage['wiki.native.v1']=JSON.stringify(workspace);
    store.write({accountId:copy.account.id,revision:copy.revision,state:edited},data);
    assert.deepEqual(store.read(source.account.id),{account:source.account,revision:source.revision,state:source.state});assert.deepEqual(store.original(source.account.id).state,original);assert.deepEqual(store.original(copy.account.id).state,original);
    const second=store.action({action:'copy',accountId:source.account.id,revision:source.revision},data);assert.notEqual(second.account.name,copy.account.name);
    const count=store.list().accounts.length;
    assert.throws(()=>store.action({action:'copy',accountId:source.account.id,revision:0},data),e=>e.status===409);assert.equal(store.list().accounts.length,count);
  }finally{store?.close();await cleanupTestWorkspace(folder);}
});
test('多账号无损迁移、导入锁定、解锁编辑与原始快照隔离',async()=>{
  const folder=await createTestWorkspace('assessment-accounts');let store;
  try{
    const path=join(folder,'assessment.sqlite'),legacy=new DatabaseSync(path),old=sample();old.good.characters[0].level=2;
    legacy.exec('CREATE TABLE workspace(id INTEGER PRIMARY KEY,revision INTEGER,value TEXT)');legacy.prepare('INSERT INTO workspace VALUES(1,7,?)').run(JSON.stringify(old));legacy.close();
    store=createAccountStore(path);const first=store.read();assert.deepEqual(first.state,old);assert.equal(first.revision,7);assert.equal(first.account.locked,false);
    const imported=store.action({action:'create',name:'扫描账号',state:sample(),source:'scanner.json',locked:false},data);assert.equal(imported.account.locked,true);
    const changed=structuredClone(imported.state);changed.good.characters[0].level=3;
    assert.throws(()=>store.write({accountId:imported.account.id,revision:imported.revision,state:changed},data),e=>e.status===423);
    assert.throws(()=>store.action({action:'remove',accountId:imported.account.id,revision:imported.revision},data),e=>e.status===423);
    const analysis=structuredClone(imported.state);analysis.goals.Furina=defaultGoal('healer','hydro');analysis.goals.Furina.effectiveRolls=25;
    analysis.engineStorage['wiki.native.v1']=JSON.stringify({version:1,scenarios:{Furina:{enemyLevel:90,resistance:20,members:['Furina']}},teams:[],plans:{}});
    const analyzed=store.write({accountId:imported.account.id,revision:imported.revision,state:analysis},data);
    assert.equal(analyzed.account.locked,true);assert.equal(analyzed.state.goals.Furina.effectiveRolls,25);assert.equal(JSON.parse(analyzed.state.engineStorage['wiki.native.v1']).scenarios.Furina.enemyLevel,90);
    assert.deepEqual(analyzed.state.good,imported.state.good);assert.deepEqual(store.original(imported.account.id).state,imported.state);
    const renamed=store.action({action:'rename',accountId:imported.account.id,revision:analyzed.revision,name:'我的官服账号'},data);
    assert.equal(renamed.account.name,'我的官服账号');assert.equal(renamed.account.locked,true);
    for(const edit of [s=>s.good.characters.pop(),s=>s.good.weapons[0].refinement=2,s=>s.good.weapons[0].location='',s=>s.good.weapons[0].lock=true,s=>s.good.artifacts.push({setKey:'GladiatorsFinale'})]){
      const blocked=structuredClone(renamed.state);edit(blocked);assert.throws(()=>store.write({accountId:renamed.account.id,revision:renamed.revision,state:blocked},data),e=>e.status===423);
    }
    const unlocked=store.action({action:'unlock',accountId:imported.account.id,revision:renamed.revision},data);
    const saved=store.write({accountId:unlocked.account.id,revision:unlocked.revision,state:changed},data);
    assert.equal(store.read(first.account.id).state.good.characters[0].level,2);assert.equal(store.original(saved.account.id).state.good.characters[0].level,1);
    store.action({action:'switch',accountId:first.account.id},data);
    assert.equal(store.read().account.id,first.account.id);assert.equal(store.read(imported.account.id).state.good.characters[0].level,3);
    assert.throws(()=>store.write({accountId:saved.account.id,revision:0,state:changed},data),e=>e.status===409);
    store.close();store=createAccountStore(path);assert.equal(store.list().accounts.length,2);assert.equal(store.read(imported.account.id).state.good.characters[0].level,3);
  }finally{store?.close();await cleanupTestWorkspace(folder);}
});
test('全部账号备份保留内容，导入创建新账号且失败时不部分写入',async()=>{
  const folder=await createTestWorkspace('assessment-accounts-backup');const store=createAccountStore(join(folder,'assessment.sqlite'));
  try{
    store.action({action:'create',name:'正式扫描',state:sample()},data);const backup=store.export(),before=store.list().accounts.length;
    const broken=structuredClone(backup);broken.accounts.at(-1).state.good.characters[0].level=999;
    assert.throws(()=>store.import({backup:broken},data));assert.equal(store.list().accounts.length,before);
    const restored=store.import({backup},data);assert.equal(store.list().accounts.length,before*2);assert.equal(restored.account.locked,true);assert.equal(restored.state.good.characters[0].key,'Furina');
    const copies=store.list().accounts.slice(before);assert.ok(copies.every(a=>a.locked));assert.ok(copies.every(a=>store.original(a.id).state));
  }finally{store.close();await cleanupTestWorkspace(folder);}
});
