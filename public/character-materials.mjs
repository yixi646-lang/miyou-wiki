import {imageHTML} from '../shared/asset-image.mjs';

export function characterMaterialsHTML(groups, escape) {
  if (!groups?.length) return '<p class="table-note">暂未收录该角色的养成材料。</p>';
  return `<div class="character-materials">${groups.map(group => `<div class="materials-stage"><h3>${escape(group.name)}</h3><div class="materials-grid">${group.items.map(item => `<a class="material-pill" href="/?game=${encodeURIComponent(item.game)}&entry=${encodeURIComponent(item.id)}">${imageHTML(item, escape, {alt:''})}<span>${escape(item.name)}</span></a>`).join('')}</div></div>`).join('')}</div>`;
}
