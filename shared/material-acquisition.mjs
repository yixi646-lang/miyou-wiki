const groupNames = ['副本与挑战', '敌人掉落', '采集与探索', '商店与兑换', '合成与置换', '任务与活动', '其他途径'];
const weekdays = text => [...new Set(String(text ?? '').match(/(?:周|星期)[一二三四五六日天]/g) ?? [])];
const text = value => typeof value === 'string' ? value.trim() : '';

function category(value) {
  if (/掉落/.test(value)) return '敌人掉落';
  if (/秘境|花萼|凝滞虚影|历战余响|模拟室|专业挑战|恶名狩猎|特训/.test(value)) return '副本与挑战';
  if (/兑换|商店|商城|购买|城募/.test(value)) return '商店与兑换';
  if (/合成|转化|置换|加工|制作|锻造/.test(value)) return '合成与置换';
  if (/采集|采挖|钓鱼|探索|宝箱|野外|捕捉/.test(value)) return '采集与探索';
  if (/任务|活动|奖励|委托|纪行/.test(value)) return '任务与活动';
  return '其他途径';
}

export function matchingDomainRecord(entry, supplement) {
  const record = supplement?.records?.[entry.id];
  if (!record || record.sourceId !== entry.sourceId || !record.challenge) return null;
  // 本地编辑删除或更换获取渠道后，不重新塞入旧快照里的渠道。
  return entry.details?.acquisition?.some(value => text(value).includes(record.challenge))
    || !Array.isArray(entry.details?.acquisition) && entry.details?.facts?.获取秘境 === record.challenge ? record : null;
}

export function withMaterialAcquisitionSource(entry, supplement) {
  if (entry.category !== 'materials' || !matchingDomainRecord(entry, supplement) || !supplement.source) return entry;
  const source = supplement.source;
  if (entry.sources?.some(item => item.name === source.name && item.url === source.url)) return entry;
  return {...entry, sources:[...(entry.sources ?? []), {name:source.name, url:source.url, note:source.note}]};
}

export function materialAcquisition(entry, {supplement, recipe, lookup = () => null} = {}) {
  const groups = new Map(), domain = matchingDomainRecord(entry, supplement);
  const facts = entry.details?.facts ?? {};
  const original = [...new Set((entry.details?.acquisition ?? []).map(text).filter(Boolean))];
  if (text(facts.获取秘境) && !original.some(value => value.includes(facts.获取秘境))) original.unshift(facts.获取秘境);
  for (const raw of original) {
    const kind = category(raw), days = weekdays(raw), route = {name:raw, original:raw, days, location:'', region:'', condition:'', difficulties:[]};
    const matched = domain && raw.includes(domain.challenge);
    if (matched) {
      const rows = domain.domains ?? [];
      route.location = [...new Set(rows.map(row => row.entrance).filter(Boolean))].join(' / ');
      route.region = [...new Set(rows.map(row => row.region).filter(Boolean))].join(' / ');
      route.days = days.length ? days : weekdays(facts.开放日期).length ? weekdays(facts.开放日期) : [...new Set(rows.flatMap(row => row.days ?? []))];
      route.difficulties = rows.map(row => ({name:row.name, unlockRank:row.unlockRank, recommendedLevel:row.recommendedLevel}));
    } else {
      route.location = raw.match(/【([^】]+)】/)?.[1] ?? raw.match(/^推荐[：:]\s*(.+?)(?:采集|采挖)$/)?.[1] ?? '';
    }
    const condition = raw.match(/^(\d+级以上)(.+掉落)$/) ?? raw.match(/^(突破至均衡等级\d+后)[，,](.+)$/);
    if (condition) {route.condition = condition[1];route.name = condition[2];}
    if (kind === '副本与挑战' && days.length) route.name = route.name.replace(/[（(][^）)]*(?:周|星期)[一二三四五六日天][^）)]*[）)]$/, '').trim();
    const rows = groups.get(kind) ?? [];rows.push(route);groups.set(kind, rows);
  }
  const material = id => {
    const live = lookup(id);
    return live?.game === entry.game ? {id, name:live.name, category:live.category} : {id, name:id, category:null};
  };
  const production = recipe && (recipe.id ?? entry.id) === entry.id ? {
    output:material(entry.id), outputCount:recipe.outputCount ?? 1,
    inputs:(recipe.inputs ?? []).map(item => ({...material(item.id), count:item.count})),
    currency:recipe.currency ? {...material(recipe.currency.id), count:recipe.currency.count} : null,
    feeStatus:recipe.feeStatus
  } : null;
  return {groups:groupNames.filter(name => groups.has(name)).map(name => ({name, routes:groups.get(name)})), production};
}
