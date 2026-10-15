import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {materialAcquisition, withMaterialAcquisitionSource} from '../shared/material-acquisition.mjs';
import {materialAcquisitionHTML} from '../public/material-acquisition.mjs';
import {summarizeEntry} from '../shared/catalog.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const supplement = read('data/material-acquisition/genshin.json');
const catalogs = ['genshin', 'starrail', 'zenless'].flatMap(game => read(`data/catalog/${game}.json`).entries);
const lookup = id => catalogs.find(entry => entry.id === id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

test('获取条件来自原文，前往采集不被当作地点，未知途径保留', () => {
  const entry = {details:{acquisition:['60级以上兽怪暴徒掉落', '突破至均衡等级4后，反物质军团掉落', '推荐：清籁岛采集', '前往采集', '拟造花萼【收容舱段】', '星尘兑换：兑换后合成', '「万能合成机」- 材料置换', '某个尚未分类的渠道']}};
  const data = materialAcquisition(entry), routes = data.groups.flatMap(group => group.routes);
  assert.equal(routes.find(route => route.condition === '60级以上').name, '兽怪暴徒掉落');
  assert.equal(routes.find(route => route.condition === '突破至均衡等级4后').name, '反物质军团掉落');
  assert.equal(routes.find(route => route.name === '前往采集').location, '');
  assert.equal(routes.find(route => route.name.includes('清籁岛')).location, '清籁岛');
  assert.equal(routes.find(route => route.name.includes('花萼')).location, '收容舱段');
  assert(data.groups.find(group => group.name === '商店与兑换').routes.some(route => route.name.includes('兑换后合成')));
  assert(data.groups.find(group => group.name === '合成与置换').routes.some(route => route.name.includes('材料置换')));
  assert(data.groups.find(group => group.name === '其他途径').routes.some(route => route.name === '某个尚未分类的渠道'));
});

test('自由哲学按实际奖励编号关联忘却之峡，仅列含该材料的难度', () => {
  const entry = lookup('genshin-materials-104303'), original = structuredClone(entry);
  const data = materialAcquisition(entry, {supplement}), route = data.groups.find(group => group.name === '副本与挑战').routes[0];
  assert.equal(route.location, '忘却之峡');assert.equal(route.region, '蒙德');
  assert.deepEqual(route.days, ['周一', '周四', '周日']);
  assert(route.difficulties.every(level => level.name.includes('IV')));
  assert.equal(route.difficulties[0].unlockRank, 45);
  const html = materialAcquisitionHTML(entry, data, escape);
  assert(html.includes('忘却之峡'));assert(html.includes('冒险等阶要求'));assert(html.includes('推荐队伍等级'));
  assert(!/<details[^>]*\bopen\b/.test(html));assert(html.includes('不表示必定掉落'));
  const summary = summarizeEntry(withMaterialAcquisitionSource(entry, supplement));
  assert(summary.sources.some(source => source.name === supplement.source.name));
  assert.equal(summary.details, undefined);assert.equal(summary.acquisition, undefined);
  const edited = {...entry, details:{...entry.details, acquisition:['用户自定义途径']}};
  assert(!withMaterialAcquisitionSource(edited, supplement).sources.some(source => source.name === supplement.source.name));
  assert.deepEqual(entry, original);
});

test('合成入口沿用原料、数量和用户暂设费用，链接原料且输出转义', () => {
  const entry = lookup('zenless-materials-100221'), recipe = read('data/growth/zenless.json').recipes[entry.id];
  const data = materialAcquisition(entry, {recipe, lookup}), html = materialAcquisitionHTML(entry, data, escape);
  assert.equal(data.production.currency.count, 0);assert.equal(data.production.feeStatus, 'user-default');
  assert(html.includes('entry=zenless-materials-100211'));assert(html.includes('×3'));assert(html.includes('未核实免费'));
  const malicious = {game:'genshin', details:{acquisition:['<script>alert(1)</script>掉落']}};
  assert(!materialAcquisitionHTML(malicious, null, escape).includes('<script>'));
  assert(materialAcquisitionHTML({details:{}}, null, escape).includes('尚未收录'));
});

test('三游戏材料原文完整保留，168个秘境关联均有同版本奖励证据', () => {
  const materials = catalogs.filter(entry => entry.category === 'materials');
  for (const entry of materials) {
    const original = structuredClone(entry), data = materialAcquisition(entry, {supplement});
    const routes = data.groups.flatMap(group => group.routes).map(route => route.original);
    for (const value of entry.details?.acquisition ?? []) assert(routes.includes(value.trim()), entry.id + ' ' + value);
    assert.deepEqual(entry, original);
  }
  const raw = JSON.parse(gunzipSync(readFileSync(new URL('../' + supplement.source.snapshot, import.meta.url))).toString('utf8'));
  const domains = Object.values(raw.data.ChineseSimplified.domains);
  assert.equal(Object.keys(supplement.records).length, 168);assert.deepEqual(supplement.gaps, []);
  for (const [id, record] of Object.entries(supplement.records)) for (const linked of record.domains) {
    const domain = domains.find(item => item.id === linked.id);
    assert(domain.rewardPreview.some(item => String(item.id) === record.sourceId), id);
    assert.equal(linked.entrance, domain.entranceName);assert.equal(linked.region, domain.regionName);
  }
});
