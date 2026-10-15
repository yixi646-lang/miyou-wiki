import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {characterMaterialGroups} from '../shared/character-materials.mjs';
import {characterMaterialsHTML} from '../public/character-materials.mjs';

const load = path => JSON.parse(readFileSync(new URL('../'+path, import.meta.url), 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

for (const game of ['genshin','starrail','zenless']) {
  test(`${game}：所有已收录角色展示真实材料种类、不泄露数量、不修改源资料`, () => {
    const data = load(`data/growth/${game}.json`), catalog = load(`data/catalog/${game}.json`);
    const entries = Array.isArray(catalog) ? catalog : catalog.entries;
    const before = JSON.stringify(data);
    const characters = entries.filter(entry => entry.category === 'characters');
    assert(characters.length > 0);
    for (const entry of characters) {
      const groups = characterMaterialGroups(entry, data);
      assert(groups.length >= 3, `${entry.name}材料用途缺失`);
      for (const group of groups) {
        assert.equal(new Set(group.items.map(item => item.id)).size, group.items.length);
        for (const item of group.items) {
          assert(data.materials[item.id], `${entry.name}材料未收录：${item.id}`);
          assert.equal(item.name, data.materials[item.id].name);
          assert(!Object.hasOwn(item, 'count'));
          assert(!Object.hasOwn(item, 'quantity'));
        }
      }
      const html = characterMaterialsHTML(groups, escape);
      assert(!/[×]|<b>|screen=calculator/.test(html));
      assert(html.includes('entry='+encodeURIComponent(groups[0].items[0].id)));
    }
    assert.equal(JSON.stringify(data), before);
  });
}

test('空与荧默认冰元素；七元素分别使用对应天赋材料，等级突破共用', () => {
  const data = load('data/growth/genshin.json'), entries = load('data/catalog/genshin.json');
  for (const entry of (Array.isArray(entries) ? entries : entries.entries).filter(e => e.details?.traveler)) {
    const defaultGroups = characterMaterialGroups(entry, data);
    assert.deepEqual(defaultGroups, characterMaterialGroups(entry, data, '冰'));
    for (const [element, variant] of Object.entries(entry.details.traveler.elements)) {
      const groups = characterMaterialGroups(entry, data, element), profile = data.profiles[variant.profileId];
      const actual = groups.find(group => group.name === '天赋').items.map(item => item.id).sort();
      const expected = [...new Set(profile.tracks.flatMap(track => track.steps.flat()).filter(item => item.count > 0 && item.id !== profile.currencyId).map(item => item.id))].sort();
      assert.deepEqual(actual, expected, `${entry.name} ${element}`);
      assert.deepEqual(groups.slice(0,2), defaultGroups.slice(0,2));
    }
  }
});

test('新增角色材料合并阶段、使用现有图标、排除零用量并转义名称', () => {
  const entry = {id:'genshin-characters-local', game:'genshin', category:'characters', details:{materials:[
    {name:'突破一',items:[{id:'ore',name:'原材料',count:3},{id:'unused',name:'无用',count:0}]},
    {name:'突破二',items:[{id:'ore',name:'原材料',count:30}]}
  ]}};
  const groups = characterMaterialGroups(entry, {}, '冰', id => id === 'ore' ? {id,game:'genshin',name:'<新名称>',image:'/assets/materials/ore.webp'} : null);
  assert.equal(groups.length,1);
  assert.equal(groups[0].items.length,1);
  const html = characterMaterialsHTML(groups, escape);
  assert(html.includes('&lt;新名称&gt;'));
  assert(html.includes('/assets/materials/ore.webp'));
  assert(!html.includes('无用'));
  assert.deepEqual(characterMaterialGroups({...entry,category:'weapons'}, {}), []);
});

test('三游戏同系列材料连续排列，各系列按高阶到低阶展示', () => {
  const examples = [
    ['genshin','10000121','角色突破',['104124','104123','104122','104121']],
    ['genshin','10000121','天赋',['104361','104360','104359']],
    ['starrail','1001','角色晋阶',['111013','111012','111011']],
    ['starrail','1001','行迹提升',['110143','110142','110141']],
    ['zenless','1011','角色晋升',['100232','100222','100212']],
    ['zenless','1011','技能',['100133','100123','100113']]
  ];
  for (const [game, role, groupName, numbers] of examples) {
    const data = load(`data/growth/${game}.json`);
    const groups = characterMaterialGroups({id:`${game}-characters-${role}`,game,category:'characters'},data);
    const ids = groups.find(group => group.name === groupName).items.map(item => item.id);
    const expected = numbers.map(number => `${game}-materials-${number}`);
    assert.deepEqual(ids.slice(ids.indexOf(expected[0]),ids.indexOf(expected[0])+expected.length),expected);
  }
});
