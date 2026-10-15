import {ELEMENTS} from './core/model.mjs';
import {compareCharacterRelease} from './core/artifact-order.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const values=value=>(Array.isArray(value)?value:value?[value]:[]).map(String);
const choices={rarity:[['5','5 星'],['4','4 星']],element:['cryo','dendro','anemo','pyro','electro','hydro','geo'].map(key=>[key,ELEMENTS[key]])};

export function filterTeamCharacters(roster,catalog,filters){
  const search=(filters.search??'').trim().toLowerCase(),elements=values(filters.element),rarities=values(filters.rarity);
  return roster.filter(c=>{const m=catalog.characters[c.key];return m&&(!elements.length||elements.includes(m.element))&&(!rarities.length||rarities.includes(String(m.rarity)))&&(!search||[m.name,c.key,...(m.aliases??[])].join(' ').toLowerCase().includes(search));})
    .sort((a,b)=>compareCharacterRelease(catalog.characters[a.key],catalog.characters[b.key])||a.key.localeCompare(b.key));
}

export function toggleCharacterFilter(filters,key,value){
  if(!Object.hasOwn(choices,key)||value&&!choices[key].some(([v])=>v===value))return false;
  const selected=values(filters[key]);
  filters[key]=value?selected.includes(value)?selected.filter(v=>v!==value):[...selected,value]:[];
  return true;
}

export function characterFilterOptionsHTML(roster,catalog,filters){
  return Object.entries(choices).map(([key,options])=>{
    const selected=values(filters[key]),counts=new Map();
    for(const c of filterTeamCharacters(roster,catalog,{...filters,[key]:[]})){const value=String(catalog.characters[c.key][key]);counts.set(value,(counts.get(value)??0)+1);}
    return `<div class="facet-row"><span class="facet-label">${key==='rarity'?'稀有度':'元素'}</span><div class="facet-options" role="group" aria-label="${key==='rarity'?'角色稀有度筛选':'角色元素筛选'}"><button type="button" class="chip ${selected.length?'':'active'}" data-character-filter="${key}" data-value="" aria-pressed="${!selected.length}">全部</button>${options.map(([value,name])=>{const active=selected.includes(value),count=counts.get(value)??0;return `<button type="button" class="chip ${active?'active':''}" data-character-filter="${key}" data-value="${value}" aria-pressed="${active}" ${!count&&!active?'disabled':''}>${name}<span>${count}</span></button>`;}).join('')}</div></div>`;
  }).join('');
}

export function characterPickerFiltersHTML({roster,catalog,filters,searchAttribute,placeholder='角色名称或关键词'}){
  return `<div class="ae-member-picker-filters"><label class="ae-field"><span>搜索角色</span><input type="search" ${searchAttribute}="search" value="${esc(filters.search)}" placeholder="${esc(placeholder)}"></label><div data-character-filter-options>${characterFilterOptionsHTML(roster,catalog,filters)}</div><small class="ae-muted">同一条件可多选，不同条件同时生效。</small></div>`;
}
