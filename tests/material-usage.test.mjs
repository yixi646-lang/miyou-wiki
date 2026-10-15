import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMaterialUsageIndex, materialUsage} from '../shared/material-usage.mjs';
import {materialUsageHTML} from '../public/material-usage.mjs';

const entries = new Map([
  ['ore', {id: 'ore', name: '矿石', game: 'genshin', category: 'materials'}],
  ['coin', {id: 'coin', name: '摩拉', game: 'genshin', category: 'materials'}],
  ['bar', {id: 'bar', name: '产物', game: 'genshin', category: 'materials'}],
  ['traveler', {id: 'traveler', name: '空', game: 'genshin', category: 'characters'}],
  ['weapon', {id: 'weapon', name: '试验武器', game: 'genshin', category: 'weapons'}],
  ['foreign', {id: 'foreign', name: '跨游戏', game: 'starrail', category: 'characters'}]
]);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

test('反查消耗方向、旅行者共用编号、正费用与零费用边界', () => {
  const data = {
    profiles: {
      fire: {id: 'traveler-fire', entryId: 'traveler', category: 'characters', element: '火', ascensions: [[{id: 'ore', count: 1}]], tracks: [{group: '天赋', steps: [[{id: 'ore', count: 2}]]}]},
      ice: {id: 'traveler-ice', entryId: 'traveler', category: 'characters', element: '冰', ascensions: [[{id: 'ore', count: 1}]], tracks: []},
      weapon: {id: 'weapon', category: 'weapons', xp: [1], expItem: {id: 'ore'}, currencyId: 'coin', currencyPerExp: 0, ascensions: [[{id: 'ore', count: 0}]], tracks: []}
    },
    recipes: {bar: {id: 'bar', outputCount: 1, inputs: [{id: 'ore', count: 3}], currency: {id: 'coin', count: 0}, feeStatus: 'user-default'}}
  };
  const original = structuredClone(data), index = buildMaterialUsageIndex(data);
  const usage = materialUsage(entries.get('ore'), index, id => entries.get(id), {ore: 0});
  assert.equal(usage.characters.length, 1);
  assert.deepEqual(usage.characters[0].elements, ['火', '冰']);
  assert.deepEqual(usage.characters[0].purposes, ['角色突破', '天赋']);
  assert.deepEqual(usage.weapons[0].purposes, ['等级经验']);
  assert.equal(usage.recipes[0].output.id, 'bar');
  assert.equal(usage.recipes[0].feeStatus, 'user-default');
  assert.deepEqual(usage.inventory, {recorded: true, count: 0});
  assert.equal(materialUsage(entries.get('bar'), index, id => entries.get(id)).recipes.length, 0);
  assert.equal(materialUsage(entries.get('coin'), index, id => entries.get(id)).recipes.length, 0);
  assert.equal(materialUsage(entries.get('coin'), index, id => entries.get(id)).weapons.length, 0);
  assert.deepEqual(data, original);
  data.recipes.bar.currency.count = 50;
  assert.equal(materialUsage(entries.get('coin'), buildMaterialUsageIndex(data), id => entries.get(id)).recipes.length, 1);
});

test('保留已有低档材料关联、过滤跨游戏，未填写库存不能当作零', () => {
  const entry = {...entries.get('ore'), applicability: {characters: ['traveler', 'foreign'], weapons: ['weapon'], purposes: ['等级经验']}};
  const usage = materialUsage(entry, new Map(), id => entries.get(id));
  assert.equal(usage.characters.length, 1);
  assert.equal(usage.weapons.length, 1);
  assert.deepEqual(usage.inventory, {recorded: false, count: null});
});

test('详情分组默认折叠、可跳转、不误称零费用已核实，输出安全转义', () => {
  const entry = entries.get('ore');
  const usage = {characters: [{id: 'traveler', name: '<script>', purposes: ['天赋'], elements: ['火']}], weapons: [], inventory: {recorded: true, count: 0}, recipes: [{output: entries.get('bar'), outputCount: 1, inputs: [{...entry, count: 3}], currency: {...entries.get('coin'), count: 0}, feeStatus: 'user-default'}]};
  const html = materialUsageHTML(entry, usage, escape);
  assert.equal((html.match(/<details /g) ?? []).length, 3);
  assert(!/<details[^>]*\bopen\b/.test(html));
  assert(html.includes('entry=traveler'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('未核实免费'));
  assert(!html.includes('screen=calculator'));
  assert(!html.includes('养成计算器'));
  assert(html.includes('其他制作配方尚未收录'));
});
