export const MECHANISM_TOPICS = [
  { id: 'damage', name: '伤害与反应', match: /伤害|反应|暴击|击破|超击破/ },
  { id: 'attacks', name: '攻击与招式', match: /普通攻击|重击|下落攻击|追加攻击|追击|终结技|强化特殊技|连携技|冲刺|闪避|支援/ },
  { id: 'resources', name: '状态与资源', match: /状态|能量|回能|充能|夜魂|燃素|失衡|蓄能|资源|点数|层数/ },
  { id: 'buffs', name: '增益与减益', match: /提高|提升|降低|削减|增益|减益|抗性|穿透|易伤|加成|减抗/ },
  { id: 'survival', name: '防护与生存', match: /治疗|回复生命|恢复生命|护盾|减伤|无敌|免疫|生存/ },
  { id: 'triggers', name: '触发与叠加', match: /触发|间隔|持续|叠加|叠层|重置|刷新|次数|冷却/ },
  { id: 'other', name: '其他术语' },
];
export function mechanismTopics(record) {
  const text = record.name + ' ' + record.description;
  const topics = MECHANISM_TOPICS.filter(topic => topic.match?.test(text)).map(topic => topic.id);
  return topics.length ? topics : ['other'];
}
export function filterMechanisms(records, { search = '', scope = 'all', topic = 'all', element = 'all', character = 'all' } = {}) {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => (scope === 'all' || record.scope === scope) &&
    (topic === 'all' || mechanismTopics(record).includes(topic)) &&
    (element === 'all' || record.related.some(item => item.element === element)) &&
    (character === 'all' || record.related.some(item => item.id === character)) &&
    terms.every(term => [record.name, record.description, ...record.related.map(item => item.name)].join(' ').toLocaleLowerCase().includes(term)));
}

export function compareMechanismCharacters(a, b) {
  const version = item => String(item.releaseVersion ?? '').match(/\d+/g)?.slice(0, 2).map(Number) ?? [];
  const left = version(a), right = version(b);
  for (let index = 0; index < 2; index++) {
    const difference = (right[index] ?? -1) - (left[index] ?? -1);
    if (difference) return difference;
  }
  return String(b.releaseDate ?? '').localeCompare(String(a.releaseDate ?? '')) || a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id);
}

export function mechanismCharacters(records, entries = [], game) {
  const catalog = new Map(entries.filter(entry => entry.game === game && entry.category === 'characters').map(entry => [entry.id, entry]));
  const characters = new Map();
  for (const related of records.flatMap(record => record.related)) {
    if (!characters.has(related.id)) {
      const entry = catalog.get(related.id) ?? {};
      characters.set(related.id, { ...entry, id: related.id, name: entry.name ?? related.name, elements: [] });
    }
    const character = characters.get(related.id), element = related.element || character.element;
    if (element && !character.elements.includes(element)) character.elements.push(element);
  }
  return [...characters.values()].sort(compareMechanismCharacters);
}

export function filterMechanismCharacters(characters, { search = '', elements = [], rarities = [], types = [] } = {}) {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return characters.filter(character => (!elements.length || character.elements.some(element => elements.includes(element))) &&
    (!rarities.length || rarities.includes(String(character.rarity))) && (!types.length || types.includes(character.type)) &&
    words.every(word => [character.name, ...(character.aliases ?? []), ...character.elements, character.type].join(' ').toLocaleLowerCase().includes(word)));
}

export function mechanismGroup(record, characters) {
  if (record.scope === '通用机制' || !record.related.length) {
    const topic = MECHANISM_TOPICS.find(topic => topic.id === mechanismTopics(record)[0]);
    return { id: 'common:' + topic.id, name: '通用机制 · ' + topic.name, topic: MECHANISM_TOPICS.indexOf(topic) };
  }
  const index = new Map(characters.map(character => [character.id, character]));
  const character = record.related.map(item => index.get(item.id) ?? item).sort(compareMechanismCharacters)[0];
  return { id: character.id, name: character.name, character };
}

export function sortMechanisms(records, { sort = 'grouped', characters = [] } = {}) {
  const groups = new Map(records.map(record => [record, mechanismGroup(record, characters)]));
  return [...records].sort((a, b) => {
    if (sort !== 'name') {
      const left = groups.get(a), right = groups.get(b);
      if (!left.character !== !right.character) return left.character ? 1 : -1;
      const difference = left.character ? compareMechanismCharacters(left.character, right.character) : left.topic - right.topic;
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id);
  });
}
