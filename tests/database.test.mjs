import test from 'node:test';
import assert from 'node:assert/strict';
import {openLibrary} from '../lib/database.mjs';
const entry=(id='a')=>({id,name:'测试角色',game:'genshin',category:'characters',releaseDate:'2023-11-08',releaseVersion:'4.2',rarity:5,details:{summary:'原始内容'}});
test('旧备份导入保留普通资料并排除邦布频道',()=>{
 const db=openLibrary(':memory:'),bangboo={id:'zenless-banners-bangboo',game:'zenless',category:'banners',name:'卓越搭档',type:'邦布频道'};
 try{assert.throws(()=>db.create(bangboo),/不收录邦布/);const payload={entries:[entry(),bangboo]};const preview=db.previewImport(payload);assert.equal(preview.errors.length,0);assert.equal(preview.excluded.length,1);const imported=db.importAdditions(payload);assert.equal(imported.added,1);assert.equal(imported.excluded,1);assert.equal(db.get(bangboo.id),undefined);assert.equal(db.get('a').name,'测试角色');}finally{db.close();}
});
test('编辑采用版本检查；旧页面不能覆盖新编辑',()=>{
  const db=openLibrary(':memory:');try{const initial=db.create(entry());const changed=db.update('a',{...initial,name:'本地修改'},initial.revision);assert.equal(changed.revision,2);assert.throws(()=>db.update('a',initial,initial.revision),/其他页面/);assert.equal(db.get('a').name,'本地修改');}finally{db.close();}
});
test('导入先校验全部数据，只新增，已有编号保持编辑内容',()=>{
  const db=openLibrary(':memory:');try{db.create(entry());const payload={entries:[{...entry(),name:'不应该覆盖'},entry('b')],favorites:['b']};assert.equal(db.previewImport(payload).conflicts.length,1);const result=db.importAdditions(payload);assert.equal(result.added,1);assert.equal(db.get('a').name,'测试角色');assert.deepEqual(db.favorites(),['b']);assert.throws(()=>db.importAdditions({entries:[entry('c'),{...entry('d'),game:'unknown'}]}),/无效/);assert.equal(db.get('c'),undefined);}finally{db.close();}
});
test('收藏、来源与详情写入数据库，导出能重建资料',()=>{
  const db=openLibrary(':memory:'),restored=openLibrary(':memory:');try{db.create(entry());db.favorite('a',true);const backup=db.export();restored.importAdditions(backup);assert.equal(restored.get('a').details.summary,'原始内容');assert.equal(restored.get('a').releaseDate,'2023-11-08');assert.deepEqual(restored.favorites(),['a']);db.favorite('a',false);assert.deepEqual(db.favorites(),[]);}finally{db.close();restored.close();}
});
test('养成计划包含在备份中，增量导入只恢复缺失的游戏计划',()=>{
 const db=openLibrary(':memory:'),restored=openLibrary(':memory:');try{const plan={game:'genshin',goals:[],inventory:{},savedAt:'2026-10-03'};db.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin',JSON.stringify(plan));const backup=db.export();assert.deepEqual(backup.growthPlans.genshin,plan);restored.importAdditions(backup);assert.deepEqual(restored.export().growthPlans.genshin,plan);restored.importAdditions({...backup,growthPlans:{genshin:{...plan,savedAt:'2099-01-01'}}});assert.deepEqual(restored.export().growthPlans.genshin,plan);}finally{db.close();restored.close();}
});
