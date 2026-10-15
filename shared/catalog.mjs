import { setEffectTags } from './set-effects.mjs';
import { acquisitionChannels } from './acquisition-channels.mjs';
import { BANNER_PHASES } from './banner-schedule.mjs';
export const GAMES = {
  genshin: { name: '原神', short: '原神', en: 'GENSHIN IMPACT', symbol: '原', color: 'green', categories: { characters: '角色', weapons: '武器', sets: '圣遗物', materials: '材料' }, official: 'https://baike.mihoyo.com/ys/obc/' },
  starrail: { name: '崩坏：星穹铁道', short: '星穹铁道', en: 'HONKAI: STAR RAIL', symbol: '铁', color: 'violet', categories: { characters: '角色', weapons: '光锥', sets: '遗器 / 位面饰品', materials: '材料' }, official: 'https://wiki.hoyolab.com/pc/hsr/aggregate/character?lang=zh-cn' },
  zenless: { name: '绝区零', short: '绝区零', en: 'ZENLESS ZONE ZERO', symbol: '绝', color: 'orange', categories: { characters: '代理人', weapons: '音擎', sets: '驱动盘', materials: '材料' }, official: 'https://baike.mihoyo.com/zzz/wiki/' }
};

export const CATEGORIES = { characters: '角色', weapons: '武器类装备', sets: '套装类装备', materials: '材料', banners: '历史卡池' };
export const FACET_LABELS = { game: '游戏', category: '资料类别', rarity: '稀有度', element: '属性', type: '类型', region: '地区 / 阵营', secondary: '属性类型', kind: '分类' };
export const SORTS = { release: '登场顺序', name: '名称', rarity: '稀有度', attack: '基础攻击力', hp: '基础生命值', defense: '基础防御力', speed: '基础速度', added: '收录日期' };
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
const bannerPhaseOrder = Object.keys(BANNER_PHASES);
export const categoryLabel = (game, category) => GAMES[game]?.categories[category] ?? CATEGORIES[category] ?? category;
export const isExcludedEntry = entry => entry?.game==='zenless'&&(entry.category==='bangboo'||entry.type==='邦布频道'||entry.banner?.sourceType==='Bangboo Channel'||entry.banner?.groups?.some(group=>group.sourceKey?.startsWith('bangboo_')));
export const PAGE_SIZES = [20, 50, 100, 'all'];
export const normalizePageSize = value => value === 'all' ? 'all' : PAGE_SIZES.includes(Number(value)) ? Number(value) : 'all';
export const majorVersion = version => String(version ?? '').match(/^(\d+)\.\d+/)?.[1]?.concat('.0') ?? '';
export const versionLabel = version => version === 'unknown' ? '未标注' : version;
export function toggleFacet(filters, key, value, clear = false) {
  const active = filters[key] ?? [];
  const next = {...filters, [key]:clear ? [] : active.includes(value) ? active.filter(v => v !== value) : [...active, value]};
  if (key === 'releaseMajor') next.releaseVersion = [];
  return next;
}
export function summarizeEntry(entry) {
  const {details,raw,statsTable,...rest}=entry;
  return {...rest,...(entry.category==='weapons'?{acquisitionChannels:acquisitionChannels(entry)}:{}),listEffects:details?.effects??[],secondaryName:details?.facts?.副属性??details?.facts?.突破属性??null,ascensionStat:details?.facts?.突破属性??entry.ascensionStat??null};
}
export const rarityLabel = (entry) => entry.game === 'zenless' ? ({ 5: 'S 级', 4: 'A 级', 3: 'B 级', 2: 'C 级' }[entry.rarity] ?? '未标注') : entry.rarity ? `${entry.rarity} 星` : '未标注';

export function facetKeys(game, category) {
  const result = [];
  if (!game || game === 'all') result.push('game');
  if (!category || category === 'all') result.push('category');
  if (category === 'characters') {result.push('rarity', 'element', 'type', 'region');if(game==='genshin')result.push('ascensionStat');}
  else if (category === 'weapons') result.push('rarity', 'type', 'secondary', 'acquisitionChannels');
  else if (category === 'sets') result.push('kind', 'rarity', 'effect2', 'effect4');
  else if (category === 'materials') {result.push('kind','rarity','element');if(game==='starrail'||game==='zenless')result.push('type');}
  else if (category === 'banners') result.push('type','bannerPhase');
  else result.push('rarity');
  return category==='materials'?result:[...result, 'releaseMajor', 'releaseVersion'];
}

export function facetLabel(key, game, category) {
  if(key==='acquisitionChannels')return '获取渠道';
  if(key==='effect2')return '2 件套效果';
  if(key==='effect4')return '4 件套效果';
  if(key==='bannerPhase')return '卡池安排';
  if(category==='materials'&&key==='element')return '适用属性';
  if(category==='materials'&&key==='type')return game==='starrail'?'适用命途':'适用特性';
  if (key === 'ascensionStat') return '突破增加属性';
  if (key === 'releaseMajor') return category==='banners'?'卡池版本':'实装版本';
  if (key === 'releaseVersion') return '细分版本';
  if (key === 'type' && category === 'banners') return '卡池类型';
  if (key === 'element' && game === 'genshin') return '元素';
  if (key === 'type') return game === 'genshin' ? '武器类型' : game === 'starrail' ? '命途' : game === 'zenless' ? '特性' : '类型 / 命途';
  if (key === 'region') return game === 'genshin' ? '地区' : '阵营';
  if (key === 'secondary') return category === 'sets' ? '套装属性' : '副属性';
  if (key === 'rarity' && game === 'zenless') return '等级';
  return FACET_LABELS[key] ?? key;
}

export function valuesFor(entry, key) {
  if(key==='acquisitionChannels')return acquisitionChannels(entry);
  if(key==='bannerPhase')return entry.banner?.schedule?[entry.banner.schedule.key]:[];
  if(key==='releaseMajor')return [majorVersion(entry.releaseVersion)||'unknown'];
  if(key==='releaseVersion')return [entry.releaseVersion||'unknown'];
  if(key==='ascensionStat'){const value=entry.details?.facts?.突破属性??entry.ascensionStat;return value?[value]:[];}
  if(key==='effect2'||key==='effect4')return setEffectTags(entry,Number(key.slice(-1)));
  if(entry.category==='materials'&&entry.applicability){if(key==='element')return entry.applicability.elements??[];if(key==='type')return entry.game==='starrail'?entry.applicability.paths??[]:entry.game==='zenless'?entry.applicability.specialties??[]:[];}
  const value = entry[key];
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

function matches(entry, query, ignoredFacet) {
  if (query.game && query.game !== 'all' && entry.game !== query.game) return false;
  if (query.category && query.category !== 'all' && entry.category !== query.category) return false;
  if (query.favoriteIds && !query.favoriteIds.has(entry.id)) return false;
  if (query.featured && !entry.banner?.groups?.some(group=>group.items.some(item=>item.id===query.featured))) return false;
  const terms = String(query.search ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searchable = [entry.name, ...(entry.aliases ?? []), entry.element, entry.type, entry.region, entry.kind, entry.releaseVersion, ...(entry.secondary ?? []), ...(entry.tags ?? []),...(entry.applicability?.elements??[]),...(entry.applicability?.paths??[]),...(entry.applicability?.specialties??[]),...(entry.applicability?.purposes??[]), ...(entry.banner?.groups??[]).flatMap(group=>group.items.map(item=>item.name))].join(' ').toLocaleLowerCase();
  if (!terms.every(term => searchable.includes(term))) return false;
  for (const [key, wanted] of Object.entries(query.filters ?? {})) {
    if (key === ignoredFacet || ignoredFacet==='releaseMajor'&&key==='releaseVersion' || query.category==='materials'&&['releaseMajor','releaseVersion'].includes(key) || !wanted?.length) continue;
    if (!wanted.some(value => valuesFor(entry, key).includes(String(value)))) return false;
  }
  return true;
}

export function availableSorts(entries, query) {
  const base = entries.filter(entry => matches(entry, { game: query.game, category: query.category }));
  return ['release', 'name', 'rarity', ...['attack', 'hp', 'defense', 'speed'].filter(key => base.some(entry => Number.isFinite(entry.stats?.[key]))), 'added'];
}

export function selectEntries(entries, query = {}) {
  const result = entries.filter(entry => matches(entry, query));
  const sort = Object.hasOwn(SORTS, query.sort) ? query.sort : 'release';
  const direction = query.direction === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    if (sort === 'release') {
      const ap=String(a.releaseVersion??'').match(/\d+/g)?.map(Number)??[],bp=String(b.releaseVersion??'').match(/\d+/g)?.map(Number)??[];
      if (Boolean(ap.length)!==Boolean(bp.length)) return ap.length?-1:1;
      for(let i=0;i<Math.max(ap.length,bp.length);i++)if((ap[i]??0)!==(bp[i]??0))return ((ap[i]??0)-(bp[i]??0))*direction;
      // 卡池在同一版本内再按实际开启时间排列；角色与装备不以日期改变版本次序。
      if(a.banner&&b.banner){const c=collator.compare(a.banner.start??'',b.banner.start??'');if(c)return c*direction;}
      return collator.compare(a.name,b.name)||a.id.localeCompare(b.id);
    }
    let av = ['attack', 'hp', 'defense', 'speed'].includes(sort) ? a.stats?.[sort] : sort === 'added' ? a.fetchedAt : sort === 'release' ? a.releaseDate : a[sort];
    let bv = ['attack', 'hp', 'defense', 'speed'].includes(sort) ? b.stats?.[sort] : sort === 'added' ? b.fetchedAt : sort === 'release' ? b.releaseDate : b[sort];
    const amissing = av === undefined || av === null || av === '';
    const bmissing = bv === undefined || bv === null || bv === '';
    if (amissing !== bmissing) return amissing ? 1 : -1;
    let compared = typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av ?? ''), String(bv ?? ''));
    return compared * direction || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
  return result;
}

export function buildFacets(entries, query = {}) {
  return facetKeys(query.game, query.category).map(key => {
    const counts = new Map();
    for (const entry of entries) {
      if (!matches(entry, query, key)) continue;
      for (const value of new Set(valuesFor(entry, key))) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const value of query.filters?.[key] ?? []) if (!counts.has(String(value))) counts.set(String(value), 0);
    const values = [...counts].sort((a, b) => a[0]==='unknown'?1:b[0]==='unknown'?-1:key === 'rarity' ? Number(b[0]) - Number(a[0]) : key==='bannerPhase'?(bannerPhaseOrder.indexOf(a[0])<0?bannerPhaseOrder.length:bannerPhaseOrder.indexOf(a[0]))-(bannerPhaseOrder.indexOf(b[0])<0?bannerPhaseOrder.length:bannerPhaseOrder.indexOf(b[0]))||collator.compare(a[0],b[0]):['releaseMajor','releaseVersion'].includes(key)?collator.compare(b[0],a[0]):collator.compare(a[0], b[0]));
    return { key, label: facetLabel(key, query.game, query.category), values: values.map(([value, count]) => ({ value, count })) };
  }).filter(facet => facet.values.length > 1 || ['effect2','effect4','releaseMajor','releaseVersion'].includes(facet.key)&&facet.values.length || query.filters?.[facet.key]?.length);
}

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('条目必须是对象。');
  if(isExcludedEntry(entry))throw new Error('本项目不收录邦布及邦布频道。');
  if (!GAMES[entry.game]) throw new Error('未知游戏。');
  if (!CATEGORIES[entry.category]) throw new Error('未知分类。');
  if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 120) throw new Error('名称须为 1–120 个字符。');
  if (typeof entry.id !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(entry.id)) throw new Error('条目编号不合法。');
  if (entry.rarity !== undefined && entry.rarity !== null && (!Number.isInteger(entry.rarity) || entry.rarity < 1 || entry.rarity > 5)) throw new Error('稀有度须为 1–5。');
  if (entry.sources && (!Array.isArray(entry.sources) || entry.sources.some(source => typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url)))) throw new Error('来源须使用有效的 HTTP 或 HTTPS 链接。');
  if (entry.signatureIds && (!Array.isArray(entry.signatureIds) || entry.signatureIds.some(id => !/^[a-z0-9_-]{1,100}$/i.test(id)))) throw new Error('专武角色编号不合法。');
  for(const key of ['aliases','secondary','tags'])if(entry[key]!==undefined&&(!Array.isArray(entry[key])||entry[key].some(value=>typeof value!=='string')))throw new Error(`${key} 须为文字数组。`);
  if(entry.details!==undefined&&(!entry.details||typeof entry.details!=='object'||Array.isArray(entry.details)))throw new Error('详情须为 JSON 对象。');
  for(const key of ['skills','upgrades','effects','materials','parts','acquisition'])if(entry.details?.[key]!==undefined&&!Array.isArray(entry.details[key]))throw new Error(`详情 ${key} 须为数组。`);
  for(const group of entry.details?.materials??[])if(!group||!Array.isArray(group.items)||group.items.some(item=>!item||typeof item.id!=='string'||typeof item.name!=='string'||!Number.isFinite(item.count)))throw new Error('材料分组须包含有效的条目编号、名称与数量。');
  for(const key of ['skills','upgrades'])for(const skill of entry.details?.[key]??[]){if(!skill||typeof skill.name!=='string'||typeof skill.description!=='string')throw new Error('技能须包含名称与文字描述。');if(skill.levels!==undefined&&(!Array.isArray(skill.levels)||skill.levels.some(level=>!level||typeof level.description!=='string')))throw new Error('技能等级须为包含描述的数组。');}
  if(entry.banner!==undefined){const b=entry.banner;if(!b||typeof b!=='object'||typeof b.start!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(b.start)||!Number.isFinite(Date.parse(b.start.replace(' ','T')+'+08:00')))throw new Error('卡池开始时间格式须为 YYYY-MM-DD HH:mm:ss。');if(b.end&&(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(b.end)||!Number.isFinite(Date.parse(b.end.replace(' ','T')+'+08:00'))||b.end<b.start))throw new Error('卡池结束时间格式错误或早于开始时间。');if(!Array.isArray(b.groups)||b.groups.some(g=>typeof g.name!=='string'||!Array.isArray(g.items)||g.items.some(i=>typeof i.name!=='string'||i.id!==null&&i.id!==undefined&&typeof i.id!=='string')))throw new Error('卡池内容须包含分类名称与条目数组。');}
  if (entry.releaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.releaseDate) || Number.isNaN(Date.parse(entry.releaseDate)) || new Date(entry.releaseDate).toISOString().slice(0,10) !== entry.releaseDate)) throw new Error('实装日期须为有效的 YYYY-MM-DD。');
  if (new TextEncoder().encode(JSON.stringify(entry)).length > 600000) throw new Error('单个条目过大。');
  return entry;
}
