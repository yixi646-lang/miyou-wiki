import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadMediaRegistry, registeredMediaIndex, publicMediaRegistry } from '../lib/media-registry.mjs';
import { applyRegisteredMedia } from '../lib/catalog-media.mjs';
import { entryChangePreview } from '../shared/entry-changes.mjs';

import { openLibrary } from '../lib/database.mjs';
import { testGroups } from '../scripts/test-groups.mjs';
import { filterMechanisms, mechanismTopics, mechanismCharacters, filterMechanismCharacters, sortMechanisms } from '../shared/mechanism-filters.mjs';
import { inspectEntryChanges } from '../scripts/maintenance-tools.mjs';
import { createTestWorkspace, cleanupTestWorkspace } from '../scripts/test-resources.mjs';

test('图片按用途和显式优先级选择，原始登记保留，独立头像不覆盖立绘', async () => {
  const directory = await createTestWorkspace('media-registry');
  const put = async (name, value) => { const file = join(directory, name); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, JSON.stringify(value)); };
  try {
    await put('data/sources/media-registry.json', { schemaVersion: 1, sources: [
      { id: 'repair', name: '修正', path: 'repair.json', priority: 20 },
      { id: 'base', name: '原始', path: 'base.json', priority: 10 },
    ] });
    const id = 'zenless-characters-a';
    await put('base.json', { records: [{ id, name: '甲', status: 'saved', image: '/assets/art.webp', url: 'https://example.com/art', avatar: { image: '/assets/original.webp', url: 'https://example.com/original' } }] });
    await put('repair.json', { records: [{ id, avatar: { image: '/assets/repaired.webp', temporary: true, derived: true, url: 'https://example.com/repair' } }] });
    const registry = await loadMediaRegistry({ rootDirectory: directory }), index = registeredMediaIndex(registry);
    assert.equal(index.get(id).image, '/assets/art.webp');
    assert.equal(index.get(id).avatar.image, '/assets/repaired.webp');
    const record = registry.entries[0].resources.find(resource => resource.role === 'avatar');
    assert.equal(record.candidates.length, 2);
    assert.equal(record.selected.priority, 20);
    const publicIndex = publicMediaRegistry(registry, [{ id, image: '/assets/local.webp' }]);
    assert.equal(publicIndex.entries[0].resources.find(item => item.role === 'avatar').currentImage, '/assets/local.webp');
    assert(!JSON.stringify(publicIndex).includes('"raw"'));
    const entry = { id, category: 'characters', sources: [], details: { skills: [{ name: '原技能' }] } };
    applyRegisteredMedia(entry, index);
    assert.equal(entry.image, '/assets/repaired.webp');
    assert.equal(entry.details.artwork.image, '/assets/art.webp');
    assert.equal(entry.details.skills[0].name, '原技能');
    await put('repair.json', { records: [{ id, avatar: { image: '/assets/equal.webp' } }] });
    await put('data/sources/media-registry.json', { schemaVersion: 1, sources: [{ id: 'base', path: 'base.json', priority: 10 }, { id: 'repair', path: 'repair.json', priority: 10 }] });
    await assert.rejects(loadMediaRegistry({ rootDirectory: directory }), /相同优先级/);
  } finally { await cleanupTestWorkspace(directory); }
});

test('当前头像登记保留蕾米埃尔修正版和两张临时头像', async () => {
  const index = registeredMediaIndex(await loadMediaRegistry());
  assert.match(index.get('zenless-characters-1581').avatar.image, /repaired/);
  for (const id of ['1631', '1641']) assert.equal(index.get('zenless-characters-' + id).avatar.temporary, true);
});

test('字段预览区分本地冲突与采用新值；导入只新增，预览不写资料', () => {
  const base = { id: 'a', game: 'genshin', category: 'characters', name: '甲', details: { x: '旧值', y: '旧值' } };
  const local = { ...base, details: { x: '本地', y: '旧值' } }, incoming = { ...base, details: { x: '更新', y: '新值' } };
  const preview = entryChangePreview({ base, local, incoming, result: { ...base, details: { x: '本地', y: '新值' } }, sourceBatch: 'D20261023000000' });
  assert.equal(preview.localModified, true);
  assert.equal(preview.fields.find(field => field.path === 'details.x').status, '保留本地');
  assert.equal(preview.fields.find(field => field.path === 'details.y').status, '采用新值');
  const skills=entryChangePreview({local:{...base,details:{skills:[{name:'技能甲',description:'旧说明'}]}},incoming:{...base,details:{skills:[{name:'技能甲',description:'新说明'}]}}});
  assert.equal(skills.fields[0].path,'details.skills.0.description');
  assert.match(skills.fields[0].label,/技能甲.*说明/);
  const db = openLibrary(':memory:');
  try {
    db.create(base);
    const before = db.export(), result = db.previewImport({ sourceBatch: '手工核查批次', entries: [incoming, { ...base, id: 'b', name: '乙' }] });
    const after = db.export();
    assert.deepEqual(after.entries, before.entries);
    assert.deepEqual(after.favorites, before.favorites);
    assert.deepEqual(after.growthPlans, before.growthPlans);
    db.importAdditions({ entries: [incoming, { ...base, id: 'b', name: '乙' }] });
    assert.equal(db.get('a').details.x, '旧值'); assert.equal(db.get('b').name, '乙');
  } finally { db.close(); }
});

test('测试分组覆盖所有测试，多个分组可去重选择', async () => {
  const groups = await testGroups(), selected = new Set(Object.entries(groups).filter(([key]) => key !== 'all').flatMap(([, group]) => group.files));
  assert.deepEqual([...selected].sort(), groups.all.files);
  assert(groups.search.files.includes('tests/unified-search.test.mjs'));
  assert(groups.updates.files.includes('tests/content-updates.test.mjs'));
  assert(groups.accounts.files.includes('tests/assessment-accounts.test.mjs'));
});

test('机制主题、属性与角色组合筛选不混入其他角色', () => {
 const records=[{name:'护盾',description:'吸收伤害',scope:'角色技能',related:[{id:'a',name:'甲',element:'冰'}]},{name:'回能',description:'恢复能量',scope:'角色技能',related:[{id:'b',name:'乙',element:'火'}]}];
 assert(mechanismTopics(records[0]).includes('survival'));
 assert.equal(filterMechanisms(records,{topic:'survival',element:'冰',character:'a'}).length,1);
 assert.equal(filterMechanisms(records,{topic:'survival',element:'火'}).length,0);
});
test('维护字段核对从隔离文件读取，结果不写回资料',async()=>{
 const dir=await createTestWorkspace('maintenance-diff');let db;
 try {const file=join(dir,'incoming.json');const base={id:'genshin-a',game:'genshin',category:'characters',name:'旧名称',details:{}};db=openLibrary(join(dir,'wiki.sqlite'));db.create(base);db.close();db=null;await writeFile(file,JSON.stringify({sourceBatch:'核查批次',entries:[{...base,name:'新名称'}]}));const result=await inspectEntryChanges(file,{databasePath:join(dir,'wiki.sqlite')});assert.equal(result[0].fields[0].path,'name');assert.equal(result[0].sourceBatch,'核查批次');db=openLibrary(join(dir,'wiki.sqlite'));assert.equal(db.get(base.id).name,'旧名称');}
 finally {db?.close();await cleanupTestWorkspace(dir);}
});


test('术语分组按通用机制与角色版本排列，角色筛选保留旅行者多元素', () => {
 const related=(id,name,element)=>({id,name,element});
 const records=[{id:'old',name:'甲',description:'伤害',scope:'角色技能',related:[related('a','旧角色','冰')]},{id:'common',name:'通用',description:'伤害',scope:'通用机制',related:[]},{id:'new',name:'乙',description:'护盾',scope:'角色技能',related:[related('b','新角色','火')]},{id:'traveler',name:'旅行者',description:'攻击',scope:'角色技能',related:[related('c','空','冰'),related('c','空','火')]}];
 const entries=[{id:'a',name:'旧角色',game:'genshin',category:'characters',releaseVersion:'1.9',rarity:5,type:'单手剑'},{id:'b',name:'新角色',game:'genshin',category:'characters',releaseVersion:'1.10',rarity:4,type:'法器'},{id:'c',name:'空',game:'genshin',category:'characters',releaseVersion:'1.0',rarity:5,type:'单手剑'}];
 const characters=mechanismCharacters(records,entries,'genshin');
 assert.deepEqual(characters.map(item=>item.id),['b','a','c']);
 assert.deepEqual(sortMechanisms(records,{characters}).map(item=>item.id),['common','new','old','traveler']);
 assert.equal(records[0].id,'old');
 assert.deepEqual(filterMechanismCharacters(characters,{elements:['火'],rarities:['5'],types:['单手剑']}).map(item=>item.id),['c']);
 assert.equal(filterMechanismCharacters(characters,{search:'新角色'}).length,1);
});
