import {rarityLabel, categoryLabel} from '/shared/catalog.mjs';
import {BANNER_ROLES} from '/shared/banner-stats.mjs';
import {rarityClass, elementIcon} from '/shared/appearance.mjs';
import {imageHTML} from '/shared/asset-image.mjs';

export function bannerPeriodHTML(period, {entries, escape: e, href, asOf}) {
  const units = entries instanceof Map ? entries : new Map(entries.map(entry => [`${entry.game}:${entry.id}`, entry]));
  const resolve = item => units.get(`${period.game}:${item.id}`) ?? {...item, game: period.game};
  const roleLabel = role => BANNER_ROLES[role] ?? BANNER_ROLES.unknown;
  function unitHTML(item, featured = false, role = 'up') {
    const target = resolve(item), linked = units.has(`${period.game}:${item.id}`), tag = linked ? 'a' : 'span';
    const element = featured && elementIcon(target);
    return `<${tag} class="banner-unit ${featured ? 'banner-unit-featured' : 'banner-unit-chip'}" ${linked ? `href="${href(target)}"` : ''}>
      <span class="banner-unit-portrait ${rarityClass(target)}">${imageHTML(target, e, {alt: ''}) || `<span class="banner-unit-monogram">${e(target.name?.slice(0, 1))}</span>`}${element ? `<img class="banner-unit-element" src="${e(element)}" alt="${e(target.element)}">` : ''}</span>
      <span class="banner-unit-copy"><strong>${e(target.name)}</strong>${featured ? `<small class="banner-unit-role">${e(rarityLabel(target))} ${role === 'up' ? 'UP' : '· ' + e(roleLabel(role))}</small>` : ''}</span>
    </${tag}>`;
  }
  const prominent = group => ['up', 'selectable'].includes(group.role) && group.items?.length &&
    group.items.every(item => resolve(item).rarity === 5);
  function featuredHTML(groups) {
    const rows = new Map();
    for (const group of groups.filter(prominent)) for (const item of group.items) {
      const kind = resolve(item).category ?? item.id?.split('-')[1] ?? 'unknown';
      if (!rows.has(kind)) rows.set(kind, []);
      rows.get(kind).push({item, role: group.role});
    }
    if (!rows.size) return '';
    const kinds = [...rows.keys()].sort((a, b) =>
      (a === 'characters' ? 0 : a === 'weapons' ? 1 : 2) - (b === 'characters' ? 0 : b === 'weapons' ? 1 : 2));
    return `<div class="banner-featured-rows">${kinds.map(kind => `<div class="banner-featured-items" data-banner-featured-kind="${e(kind)}" aria-label="${e(categoryLabel(period.game, kind))}">${rows.get(kind).map(({item, role}) => unitHTML(item, true, role)).join('')}</div>`).join('')}</div>`;
  }
  function groupHTML(group, shared = false) {
    return `<div class="banner-content-group ${shared ? 'banner-shared-group' : ''}" data-banner-role="${e(group.role ?? 'unknown')}">
      <span class="banner-content-label ${group.role === 'up' ? 'banner-label-up' : ''}">${e(group.name)} <small>${group.role === 'up' ? 'UP' : e(roleLabel(group.role))}</small></span>
      <div class="banner-unit-list">${(group.items ?? []).map(item => unitHTML(item)).join('')}</div>
    </div>`;
  }
  function paneKind(pane) {
    const featured = pane.pools.flatMap(pool => pool.groups.filter(prominent).flatMap(group => group.items));
    const categories = new Set(featured.map(item => resolve(item).category ?? item.id?.split('-')[1]));
    return categories.size === 1 ? [...categories][0] : 'mixed';
  }
  const panes = period.panes.map(pane => ({...pane, kind: paneKind(pane)}));
  panes.sort((a, b) => ['characters', 'weapons', 'mixed'].indexOf(a.kind) - ['characters', 'weapons', 'mixed'].indexOf(b.kind));
  const paired = panes.length === 2 && panes[0].kind === 'characters' && panes[1].kind === 'weapons';
  const day = value => String(value ?? '').slice(0, 10).replaceAll('-', '.');
  const date = period.start ? `${day(period.start)}${period.end ? ' — ' + day(period.end) : ' 起 · 持续开放'}` : '时间未标注';
  const fullDate = `${period.start ?? ''}${period.end ? ' ～ ' + period.end : ' 起 · 持续开放'}${period.timeZone ? '（' + period.timeZone + '）' : ''}`;
  const started = period.start?.slice(0, 10) <= asOf;
  const status = !started ? '未开启' : period.mode === 'standard' ? '常驻' : !period.end || period.end.slice(0, 10) >= asOf ? '进行中' : '';
  return `<article class="banner-period-card" data-banner-period="${e(period.key)}">
    <header class="banner-period-heading"><h2>${e(period.version || '版本未标注')}${period.schedule ? ` <span>· ${e(period.schedule.label)}</span>` : ''}</h2><span class="banner-period-dates" title="${e(fullDate)}">${e(date)}</span><div class="banner-period-meta">${status ? `<span class="tag ${status === '进行中' ? 'current-banner' : ''}">${status}</span>` : ''}<span>${period.entries.length} 个卡池</span></div></header>
    <div class="banner-period-body ${paired ? 'banner-period-paired' : ''}">${panes.map(pane => `<section class="banner-history-pane" data-banner-kind="${e(pane.kind)}">
      <h3>${e(pane.type)}</h3><div class="banner-pane-pools ${pane.pools.length === 1 ? 'banner-single-pool' : ''}">${pane.pools.map(({entry, groups}) => `<article class="banner-history-pool" data-entry-id="${e(entry.id)}">
        <a class="banner-pool-link" href="${href(entry)}" title="${e(entry.name)}" aria-label="查看${e(entry.name)}详情"><strong>${e(entry.name.split(/\s*[·•]\s*/)[0])}</strong><span>详情 ↗</span></a>
        ${featuredHTML(groups)}
        ${groups.filter(group => !prominent(group)).map(group => groupHTML(group)).join('')}
        ${groups.length || pane.sharedGroups.length ? '' : '<p class="table-note">本地暂无卡池内容记录，详情保留原始来源。</p>'}
      </article>`).join('')}</div>${pane.sharedGroups.map(group => groupHTML(group, true)).join('')}
    </section>`).join('')}</div>
  </article>`;
}
