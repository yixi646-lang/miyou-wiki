import {travelerVariant} from './traveler.mjs';

function orderMaterials(items, recipes, materials) {
  // 仅使用已收录的逐阶合成关系，将同一材料系列连在一起。
  const lower = new Map();
  for (const [id, recipe] of Object.entries(recipes ?? {})) {
    if (recipe.inputs?.length !== 1) continue;
    const input = recipe.inputs[0], output = recipe.id ?? id;
    if (output === input.id || !(input.count > (recipe.outputCount ?? 1))) continue;
    const high = materials?.[output]?.rarity, low = materials?.[input.id]?.rarity;
    if (Number.isFinite(high) && Number.isFinite(low) && high <= low) continue;
    lower.set(output, input.id);
  }
  const family = id => {
    const seen = new Set();let tier = 0;
    while (lower.has(id) && !seen.has(id)) {seen.add(id);id = lower.get(id);tier++;}
    return {id, tier};
  };
  const families = new Map();
  for (const item of items) {
    const chain = family(item.id), group = families.get(chain.id) ?? [];
    group.push({item, tier:chain.tier});families.set(chain.id, group);
  }
  const rank = group => Math.max(...group.map(({item}) => item.rarity ?? 0));
  return [...families.values()].sort((a,b) => rank(b)-rank(a))
    .flatMap(group => group.sort((a,b) => b.tier-a.tier || (b.item.rarity ?? 0)-(a.item.rarity ?? 0)).map(({item}) => item));
}

// 只派生材料种类；原始消耗、库存及养成计划保持在原资料中。
export function characterMaterialGroups(entry, data = {}, element = '冰', resolveMaterial) {
  if (entry?.category !== 'characters') return [];
  const variant = travelerVariant(entry, element);
  const profile = data.profiles?.[variant?.profileId ?? entry.id];
  const groups = new Map();
  const resolve = resolveMaterial ?? (id => data.materials?.[id]);
  const add = (name, items) => {
    for (const item of items ?? []) {
      if (!item?.id || item.count !== undefined && !(item.count > 0)) continue;
      const material = resolve(item.id) ?? data.materials?.[item.id] ?? item;
      if (!material.name || material.game && material.game !== entry.game) continue;
      const group = groups.get(name) ?? new Map();
      group.set(item.id, {id:item.id, game:entry.game, name:material.name, rarity:material.rarity ?? data.materials?.[item.id]?.rarity ?? null,
        image:material.image ?? null, ...(material.imageFrame ? {imageFrame:material.imageFrame} : {})});
      groups.set(name, group);
    }
  };
  if (profile) {
    const hasExperience = profile.xp?.some(value => value > 0);
    const common = [];
    if (hasExperience && profile.expItem?.id) common.push({id:profile.expItem.id});
    if (hasExperience && profile.currencyPerExp > 0) common.push({id:profile.currencyId});
    add('等级提升', common);
    const withoutCommon = items => (items ?? []).filter(item => !common.some(c => c.id === item.id));
    const ascension = {genshin:'角色突破', starrail:'角色晋阶', zenless:'角色晋升'}[entry.game] ?? '角色突破';
    add(ascension, withoutCommon((profile.ascensions ?? []).flat()));
    for (const track of profile.tracks ?? []) {
      const name = entry.game === 'starrail' ? '行迹提升' : track.group ?? track.name ?? '技能提升';
      add(name, withoutCommon((track.steps ?? []).flat()));
    }
  } else {
    // 本地新增角色也可使用详情中手动维护的材料，不推测缺失技能材料。
    for (const group of entry.details?.materials ?? []) {
      const name = /^(突破|晋阶|晋升)/.test(group.name ?? '') ? '角色突破 / 晋阶' : group.name ?? '养成材料';
      add(name, group.items);
    }
  }
  return [...groups].map(([name, items]) => ({name, items:orderMaterials([...items.values()], data.recipes, data.materials)}));
}
