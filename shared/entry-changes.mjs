const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const labels = { name: '名称', aliases: '别名', rarity: '稀有度', element: '元素 / 属性', type: '类型', region: '地区 / 阵营', kind: '分类', releaseVersion: '实装版本', releaseDate: '实装日期', image: '图片', imageRemote: '图片来源', details: '详情', summary: '简介', skills: '技能', upgrades: '命座 / 星魂 / 影画', effects: '装备效果', materials: '养成材料', facts: '基础资料', parts: '套装部件', artwork: '立绘', sources: '资料来源', stats: '基础属性', statsTable: '成长数值', statsLevel: '面板等级', secondary: '副属性', banner: '卡池记录', signatureIds: '专武关联' };
const at = (value, path) => path.reduce((item, key) => item?.[key], value);

export function entryChangePreview({ base, local, incoming, result = incoming, sourceBatch = '', policy = 'merge' }) {
  const fields = [];
  function label(path) {
    return path.map((key, index) => {
      if (!Number.isInteger(key)) return labels[key] ?? ({ traveler: '旅行者', elements: '元素方案', levels: '技能等级', specs: '数值', description: '说明', terms: '术语注释', source: '来源' }[key] ?? key);
      const item = at(incoming, path.slice(0, index + 1)) ?? at(local, path.slice(0, index + 1));
      return item?.name ?? (item?.level !== undefined ? '等级 ' + item.level : item?.rank !== undefined ? '强化 ' + item.rank : '第 ' + (key + 1) + ' 项');
    }).join(' / ');
  }
  function visit(before, after, path = []) {
    if (equal(before, after)) return;
    if (Array.isArray(before) && Array.isArray(after) && before.length === after.length && before.every((item, index) => plain(item) && plain(after[index]) && ['id', 'key', 'name', 'level', 'rank'].every(key => equal(item[key], after[index][key])))) {
      for (let index = 0; index < before.length; index++) visit(before[index], after[index], [...path, index]);
      return;
    }
    if ((plain(before) || before === undefined) && (plain(after) || after === undefined) && (plain(before) || plain(after))) {
      for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
        if (!path.length && ['revision', 'updatedAt'].includes(key)) continue;
        visit(before?.[key], after?.[key], [...path, key]);
      }
      return;
    }
    const adopted = at(result, path), localModified = base === undefined ? null : !equal(at(base, path), before);
    fields.push({ path: path.join('.'), label: label(path), before, after, result: adopted, localModified,
      status: policy === 'skip' ? '跳过已有' : equal(adopted, after) ? (after === undefined ? '移除字段' : '采用新值') : '保留本地' });
  }
  visit(local ?? undefined, incoming ?? undefined);
  const entry = incoming ?? local ?? base ?? {};
  return { id: entry.id, name: entry.name, game: entry.game, category: entry.category, sourceBatch,
    sources: incoming?.sources ?? [], localModified: base === undefined ? null : !equal(local, base),
    action: policy === 'skip' ? '跳过已有' : !local ? (result ? '新增' : '保留本地移除') : !incoming ? (result ? '保留本地' : '移除') : equal(local, result) ? '保留本地' : '更新', fields };
}
