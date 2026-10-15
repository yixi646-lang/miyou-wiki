import {materialAcquisition} from '../shared/material-acquisition.mjs';
import {materialRecipeHTML} from './material-usage.mjs';

export function materialAcquisitionHTML(entry, acquisition, escape) {
  const data = acquisition ?? materialAcquisition(entry);
  const row = (label, value) => value ? `<div class="material-route-field"><span>${label}</span><strong>${escape(value)}</strong></div>` : '';
  const route = item => `<div class="material-route"><h4>${escape(item.name)}</h4>${row('地点', item.location)}${row('地区', item.region)}${row('开放日', item.days.join(' / '))}${row('掉落条件', item.condition)}${item.difficulties.length ? `<details class="material-route-levels"><summary>查看秘境难度与解锁条件</summary><div class="data-table-wrap"><table class="data-table"><thead><tr><th>挑战难度</th><th>冒险等阶要求</th><th>推荐队伍等级</th></tr></thead><tbody>${item.difficulties.map(level => `<tr><td>${escape(level.name)}</td><td>${Number.isFinite(level.unlockRank) ? escape(level.unlockRank) : '未收录'}</td><td>${Number.isFinite(level.recommendedLevel) ? escape(level.recommendedLevel) : '未收录'}</td></tr>`).join('')}</tbody></table></div><p class="table-note">仅列来源奖励预览包含本材料的难度；推荐等级不等于解锁条件，也不表示必定掉落。</p></details>` : ''}</div>`;
  return `${data.groups.map(group => `<div class="material-route-group"><h3>${escape(group.name)}</h3><div class="material-route-grid">${group.routes.map(route).join('')}</div></div>`).join('')}${data.production ? `<div class="material-route-group"><h3>已收录合成配方</h3>${materialRecipeHTML(entry.game, data.production, escape)}</div>` : ''}${!data.groups.length && !data.production ? '<p class="table-note">尚未收录该材料的获取途径。</p>' : '<p class="table-note">地点、开放日与条件按已收录资料展示；未列出不代表没有限制。来源可在“资料与备份”中按材料名称查询。</p>'}`;
}
