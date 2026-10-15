// 只展示一种条目类别时使用两列，并独立记住手动列数。
export function bannerHistoryLayout(entries) {
  const kinds = new Set(entries.map(entry => {
    const groups = entry.banner?.groups ?? [];
    const featured = groups.filter(group => ['up', 'selectable'].includes(group.role));
    const items = (featured.length ? featured : groups).flatMap(group => group.items ?? []);
    const categories = new Set(items.map(item => item.category ?? item.id?.split('-')[1]));
    return categories.size === 1 ? [...categories][0] : 'mixed';
  }));
  const kind = kinds.size === 1 ? [...kinds][0] : 'mixed';
  return ['characters', 'weapons'].includes(kind)
    ? {base: 2, scope: `banner-periods-${kind}`}
    : {base: 1, scope: 'banner-periods'};
}

// 输入已经筛选、排序的卡池；分组只改变展示，不补入未匹配的池子。
export function groupBannerPeriods(entries) {
  const periods = new Map();
  for (const entry of entries) {
    const b = entry.banner;
    if (entry.category !== 'banners' || !b) continue;
    // 常驻、自选和时间未知的池子独立展示，避免把不同规则混成一组。
    const separate = !b.start || ['standard', 'selection'].includes(b.mode);
    const key = JSON.stringify([entry.game, entry.releaseVersion, b.start, b.end ?? null,
      b.timeZone ?? '', b.schedule?.key ?? '', b.mode ?? '', separate ? entry.id : '']);
    if (!periods.has(key)) periods.set(key, {
      key, game: entry.game, version: entry.releaseVersion, start: b.start,
      end: b.end, timeZone: b.timeZone, schedule: b.schedule, mode: b.mode,
      entries: [], panes: [],
    });
    periods.get(key).entries.push(entry);
  }
  return [...periods.values()].map(period => {
    const panes = new Map();
    for (const entry of period.entries) {
      const type = entry.type ?? '卡池内容';
      if (!panes.has(type)) panes.set(type, {type, pools: [], sharedGroups: []});
      panes.get(type).pools.push({entry, groups: entry.banner.groups ?? []});
    }
    for (const pane of panes.values()) {
      if (pane.pools.length < 2) continue;
      // 仅合并同类型并行池中完全相同的低星 UP 名单。可选/普通内容不合并。
      const eligible = group => group.role === 'up' && group.items?.length &&
        group.items.every(item => item.rarity > 0 && item.rarity <= 4);
      const signature = group => JSON.stringify([group.name, group.role,
        group.items.map(item => [item.id ?? item.name, item.rarity]).sort((a, b) =>
          String(a[0]).localeCompare(String(b[0]))) ]);
      const common = new Set(pane.pools[0].groups.filter(eligible).map(signature));
      for (const pool of pane.pools.slice(1)) {
        const own = new Set(pool.groups.filter(eligible).map(signature));
        for (const key of common) if (!own.has(key)) common.delete(key);
      }
      pane.sharedGroups = pane.pools[0].groups.filter(group => eligible(group) && common.has(signature(group)));
      pane.pools = pane.pools.map(pool => ({...pool,
        groups: pool.groups.filter(group => !eligible(group) || !common.has(signature(group))),
      }));
    }
    return {...period, panes: [...panes.values()]};
  });
}
