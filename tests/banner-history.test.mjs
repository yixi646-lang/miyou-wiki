import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupBannerPeriods} from '../shared/banner-history.mjs';
import {withBannerSchedules} from '../shared/banner-schedule.mjs';
import {selectEntries, summarizeEntry, buildFacets} from '../shared/catalog.mjs';
import {bannerStatisticFacetKeys} from '../shared/banner-stats.mjs';

const group = (ids, rarity = 4, role = 'up') => ({name: `${rarity} 星 角色`, role,
  items: ids.map(id => ({id, name: id, rarity})),
});
const pool = (id, overrides = {}) => ({id, game: 'genshin', category: 'banners',
  name: id, type: '角色活动祈愿', releaseVersion: '7.1',
  banner: {start: '2026-09-23 11:00:00', end: '2026-10-13 17:59:59',
    timeZone: 'UTC+8', mode: 'event', schedule: {key: 'upper', label: '上半'},
    groups: [group([id], 5), group(['a', 'b', 'c'])], ...overrides},
});
const contents = groups => groups.map(g => JSON.stringify([g.name, g.role,
  g.items.map(i => [i.id, i.rarity]).sort((a, b) => a[0].localeCompare(b[0])),
])).sort();

test('同期卡池完整分组、并行低星名单合并，保持输入顺序且不修改原资料', () => {
  const first = pool('first'), second = pool('second');
  second.banner.groups[1].items.reverse();
  const weapon = {...pool('weapon'), type: '武器活动祈愿'};
  const old = pool('old', {start: '2026-09-01 18:00:00'});
  const input = [second, weapon, first, old], snapshot = structuredClone(input);
  const periods = groupBannerPeriods(input);
  assert.equal(periods.length, 2);
  assert.deepEqual(periods[0].entries.map(e => e.id), ['second', 'weapon', 'first']);
  assert.equal(periods[0].panes.length, 2);
  const characterPane = periods[0].panes.find(p => p.type === first.type);
  assert.equal(characterPane.sharedGroups.length, 1);
  assert.deepEqual(characterPane.pools.map(p => p.entry.id), ['second', 'first']);
  for (const p of characterPane.pools)
    assert.deepEqual(contents([...p.groups, ...characterPane.sharedGroups]), contents(p.entry.banner.groups));
  assert.deepEqual(input, snapshot);
  // 搜索、收藏或类型筛选后的输入不得把同一期的其他池子补回来。
  assert.deepEqual(groupBannerPeriods([weapon])[0].entries.map(e => e.id), ['weapon']);
});

test('起止时刻、时区、版本或安排不同的池子分开；自选和常驻独立', () => {
  const entries = [pool('base'), pool('different-start', {start: '2026-09-23 12:00:00'}),
    pool('different-end', {end: '2026-10-13 18:00:00'}), pool('different-zone', {timeZone: '服务器时间'}),
    {...pool('different-version'), releaseVersion: '7.0'},
    pool('different-phase', {schedule: {key: 'full'}}),
    pool('selection1', {mode: 'selection'}), pool('selection2', {mode: 'selection'}),
    pool('standard1', {mode: 'standard', end: null}), pool('standard2', {mode: 'standard', end: null}),
    pool('unknown1', {start: null}), pool('unknown2', {start: null})];
  assert.equal(groupBannerPeriods(entries).length, entries.length);
});

test('不同名单、概率角色不同或普通池内容不能被错误合并', () => {
  for (const changed of [group(['a', 'b', 'd']), group(['a', 'b', 'c'], 4, 'selectable'),
    group(['a', 'b', 'c'], 4, 'pool'), group(['a', 'b', 'c'], 3)]) {
    const first = pool('first'), second = pool('second', {groups: [group(['second'], 5), changed]});
    const pane = groupBannerPeriods([first, second])[0].panes[0];
    assert.equal(pane.sharedGroups.length, 0);
    assert.equal(pane.pools[0].groups.length, 2);
    assert.equal(pane.pools[1].groups.length, 2);
  }
});

test('三个游戏的现有卡池均保留完整内容；统计条目筛选不超过三项', async () => {
  for (const game of ['genshin', 'starrail', 'zenless']) {
    const raw = JSON.parse(await readFile(new URL(`../data/catalog/${game}.json`, import.meta.url), 'utf8'));
    const entries = withBannerSchedules((Array.isArray(raw) ? raw : raw.entries).map(summarizeEntry));
    const banners = selectEntries(entries, {game, category: 'banners'}), periods = groupBannerPeriods(banners);
    assert.equal(periods.flatMap(p => p.entries).length, banners.length, game);
    const displayed = new Set();
    for (const period of periods) for (const pane of period.panes) for (const p of pane.pools) {
      assert.ok(!displayed.has(p.entry.id), `重复卡池 ${p.entry.id}`);
      displayed.add(p.entry.id);
      assert.deepEqual(contents([...p.groups, ...pane.sharedGroups]), contents(p.entry.banner.groups), p.entry.id);
    }
    for (const category of ['characters', 'weapons']) {
      const keys = bannerStatisticFacetKeys(category);
      const facets = buildFacets(entries, {game, category}).filter(f => keys.includes(f.key));
      assert.ok(facets.length >= 2 && facets.length <= 3, `${game}:${category}`);
      assert.ok(facets.every(f => !['region', 'ascensionStat', 'releaseMajor', 'releaseVersion', 'acquisitionChannels'].includes(f.key)));
    }
  }
});
