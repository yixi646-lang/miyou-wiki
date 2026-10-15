import {majorVersion, versionLabel} from '/shared/catalog.mjs';

// 三处选择界面共用同一版本层级，细分版本只在用户展开或已有选择时显示。
export function versionFiltersHTML(facets, filters, {escape:e, expanded=false, attribute='data-action', keyAttribute='data-key', select='facet', clear='facet-clear', expand='facet-expand'}={}) {
  const major=facets.find(f=>f.key==='releaseMajor'),minor=facets.find(f=>f.key==='releaseVersion');
  if(!major)return '';
  const active=filters.releaseMajor??[],chosen=filters.releaseVersion??[],open=expanded;
  const chip=(key,v)=>`<button class="chip ${(filters[key]??[]).includes(v.value)?'active':''}" ${attribute}="${select}" ${keyAttribute}="${key}" data-value="${e(v.value)}" aria-pressed="${(filters[key]??[]).includes(v.value)}" ${!v.count&&!(filters[key]??[]).includes(v.value)?'disabled':''}>${e(versionLabel(v.value))}${key==='releaseMajor'&&v.value!=='unknown'?' 系列':''} <span>${v.count}</span></button>`;
  const groups=new Map();for(const v of minor?.values??[]){const k=majorVersion(v.value)||'unknown';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(v);}
  return `<div class="facet-row version-major-row"><span class="facet-label">${e(major.label)}</span><div class="facet-options"><button class="chip ${active.length?'':'active'}" ${attribute}="${clear}" ${keyAttribute}="releaseMajor" aria-pressed="${!active.length}">全部</button>${major.values.map(v=>chip('releaseMajor',v)).join('')}<button class="chip chip-more" ${attribute}="${expand}" ${keyAttribute}="releaseVersion" aria-expanded="${!!open}">${open?'收起细分':'细分版本'+(chosen.length?'（已选 '+chosen.length+'）':'')}</button></div></div>${open?`<div class="version-minor-panel"><div class="facet-row"><span class="facet-label">细分版本</span><div class="facet-options"><button class="chip ${chosen.length?'':'active'}" ${attribute}="${clear}" ${keyAttribute}="releaseVersion" aria-pressed="${!chosen.length}">全部小版本</button></div></div>${[...groups].map(([k,values])=>`<div class="facet-row version-minor-row"><span class="facet-label">${e(versionLabel(k))}${k==='unknown'?'':' 系列'}</span><div class="facet-options">${values.map(v=>chip('releaseVersion',v)).join('')}</div></div>`).join('')}</div>`:''}`;
}
