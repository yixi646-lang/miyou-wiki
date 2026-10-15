// 只反查已有消耗记录；产物本身不是该材料的用途。
export function buildMaterialUsageIndex(data) {
  const index = new Map();
  const slot = id => {
    if (!index.has(id)) index.set(id, {consumers: new Map(), recipes: []});
    return index.get(id);
  };
  function consume(id, profile, purpose) {
    if (!id) return;
    const entryId = profile.entryId ?? profile.id;
    const users = slot(id).consumers;
    if (!users.has(entryId)) users.set(entryId, {
      id: entryId, name: profile.name, category: profile.category,
      purposes: new Set(), elements: new Set()
    });
    const user = users.get(entryId);
    user.purposes.add(purpose);
    if (profile.id !== entryId && profile.element) user.elements.add(profile.element);
  }
  const consumes = (items, profile, purpose) => {
    for (const item of items ?? []) if (item.count > 0) consume(item.id, profile, purpose);
  };
  for (const profile of Object.values(data.profiles ?? {})) {
    if (profile.xp?.some(n => n > 0)) {
      consume(profile.expItem?.id, profile, '等级经验');
      if (profile.currencyPerExp > 0) consume(profile.currencyId, profile, '等级提升');
    }
    for (const stage of profile.ascensions ?? []) consumes(stage, profile, profile.category === 'weapons' ? '装备突破' : '角色突破');
    for (const track of profile.tracks ?? []) {
      for (const step of track.steps ?? []) consumes(step, profile, track.group ?? track.name ?? '技能提升');
    }
  }
  for (const [key, recipe] of Object.entries(data.recipes ?? {})) {
    const outputId = recipe.id ?? key;
    const ids = new Set((recipe.inputs ?? []).filter(item => item.count > 0).map(item => item.id));
    if (recipe.currency?.count > 0) ids.add(recipe.currency.id);
    for (const id of ids) slot(id).recipes.push({...recipe, id: outputId});
  }
  return index;
}

export function materialUsage(entry, index, lookup, inventory = {}) {
  const row = index.get(entry.id);
  const users = new Map();
  for (const user of row?.consumers.values() ?? []) {
    users.set(user.id, {...user, purposes: [...user.purposes], elements: [...user.elements]});
  }
  // 保留已有用途关联，包括计算器按最高档折算而未直接使用的低档经验材料。
  for (const category of ['characters', 'weapons']) {
    for (const id of entry.applicability?.[category] ?? []) {
      if (!users.has(id)) users.set(id, {id, category, purposes: entry.applicability?.purposes ?? [], elements: []});
    }
  }
  const result = {characters: [], weapons: [], recipes: []};
  for (const user of users.values()) {
    const live = lookup(user.id);
    if (!live || live.game !== entry.game || !['characters', 'weapons'].includes(live.category)) continue;
    result[live.category].push({...user, name: live.name, category: live.category});
  }
  const material = id => {
    const live = lookup(id);
    return live?.game === entry.game ? {id, name: live.name, category: live.category} : {id, name: id, category: null};
  };
  result.recipes = (row?.recipes ?? []).map(recipe => ({
    ...recipe, output: material(recipe.id),
    inputs: (recipe.inputs ?? []).map(item => ({...material(item.id), count: item.count})),
    currency: recipe.currency ? {...material(recipe.currency.id), count: recipe.currency.count} : null
  }));
  for (const category of ['characters', 'weapons']) result[category].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const count = inventory[entry.id];
  result.inventory = {recorded: Object.hasOwn(inventory, entry.id) && Number.isFinite(count) && count >= 0, count: Number.isFinite(count) && count >= 0 ? count : null};
  return result;
}
