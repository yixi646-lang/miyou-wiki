import {categoryLabel} from '../shared/catalog.mjs';

export function materialRecipeHTML(game, recipe, escape) {
  const count = value => Number(value).toLocaleString('zh-CN');
  const link = item => item.category ? `<a href="/?game=${game}&entry=${encodeURIComponent(item.id)}">${escape(item.name)}</a>` : escape(item.name);
  const fee = recipe.currency ? `${count(recipe.currency.count)} ${escape(recipe.currency.name)}${recipe.feeStatus === 'user-default' ? '（用户暂设，未核实免费）' : recipe.feeStatus === 'unknown' ? '（待核实）' : ''}` : '未提供货币费用';
  return `<div class="material-recipe"><div>${link(recipe.output)} ×${count(recipe.outputCount)}</div><p>${recipe.inputs.map(item => `${link(item)} ×${count(item.count)}`).join(' ＋ ')}</p><small>货币费用：${fee}</small></div>`;
}

export function materialUsageHTML(entry, usage, escape) {
  if (!usage || usage.error) return `<p class="table-note">${escape(usage?.error ?? '用途反查暂时无法读取，请稍后刷新。')}</p>`;
  const href = item => `/?game=${entry.game}&entry=${encodeURIComponent(item.id)}`;
  const users = (items, label) => `<details class="material-users"><summary>${label}（${items.length}）</summary>${items.length ? `<div class="material-consumer-grid">${items.map(item => `<div class="material-consumer"><a href="${href(item)}">${escape(item.name)}</a><small>${escape(item.purposes.join(' / '))}${item.elements.length ? ` · ${escape(item.elements.join(' / '))}元素` : ''}</small></div>`).join('')}</div>` : '<p class="table-note">暂无已收录的适用对象。</p>'}</details>`;
  const recipeHTML = recipe => materialRecipeHTML(entry.game, recipe, escape);
  return `${users(usage.characters, entry.game === 'zenless' ? '代理人养成' : '角色养成')}${users(usage.weapons, `${categoryLabel(entry.game, 'weapons')}养成`)}<details class="material-users"><summary>合成 / 制作（${usage.recipes.length}）</summary>${usage.recipes.length ? `<div class="material-recipe-grid">${usage.recipes.map(recipeHTML).join('')}</div>` : '<p class="table-note">暂无消耗该材料的已收录配方。</p>'}</details><p class="table-note">反查范围为已收录的养成用途与材料合成配方；料理、锻造等其他制作配方尚未收录。</p>`;
}
