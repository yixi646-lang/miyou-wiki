import { escapeHTML as escape } from './ui-controls.mjs';
import { isLocalImage } from '/shared/asset-image.mjs';
import { MECHANISM_TOPICS, mechanismTopics, filterMechanisms, mechanismCharacters, filterMechanismCharacters, mechanismGroup, sortMechanisms } from '/shared/mechanism-filters.mjs';

let closePicker;
export function disposeMechanisms() { closePicker?.(); }

export async function mountMechanisms({ host, game, api, entries = [], query = '', mechanismId = '' }) {
  disposeMechanisms();
  const root = document.createElement('section');
  root.className = 'mechanisms-page';
  root.innerHTML = '<div class="loading">正在读取机制与术语…</div>';
  host.replaceChildren(root);
  const data = await api('research-index?game=' + encodeURIComponent(game));
  if (!root.isConnected) return;
  const records = data.mechanisms ?? [], key = 'wiki-mechanisms-filters-v1:' + game;
  const characters = mechanismCharacters(records, entries, game);
  const elements = [...new Set(characters.flatMap(character => character.elements))];
  const defaults = () => ({ search:'', scope:'all', topic:'all', element:'all', character:'all', sort:'grouped' });
  let filters = { ...defaults(), search:query }, limit = 40, composing = false;
  try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); filters = { ...filters, ...saved, search:query || saved.search || '' }; } catch {}
  for (const [type, values] of Object.entries({scope:['all','通用机制','角色技能'], topic:['all',...MECHANISM_TOPICS.map(topic => topic.id)], element:['all',...elements], character:['all',...characters.map(item => item.id)], sort:['grouped','name']})) {
    if (!values.includes(filters[type])) filters[type] = defaults()[type];
  }
  if (typeof filters.search !== 'string') filters.search = '';
  if (mechanismId) { const target = records.find(record => record.id === mechanismId); if (target) filters = { ...defaults(), search:target.name }; }
  const button = (value, name, type) => `<button type="button" class="chip" data-mechanism-${type}="${escape(value)}" aria-pressed="${filters[type] === value}">${escape(name)}</button>`;
  root.innerHTML = `<div class="heading mechanisms-heading"><h1>机制与术语</h1><input class="mechanisms-search" type="search" data-mechanism-search aria-label="搜索机制与术语" value="${escape(filters.search)}" placeholder="搜索术语、伤害类型或效果说明"></div>
  <section class="panel mechanisms-panel"><div class="filters mechanism-controls" data-disclosure-ignore>
    <div class="facet-row"><div class="facet-label">范围</div><div class="facet-options">${button('all','全部','scope')}${button('通用机制','通用机制','scope')}${button('角色技能','角色技能','scope')}</div></div>
    <div class="facet-row"><div class="facet-label">主题</div><div class="facet-options">${button('all','全部','topic')}${MECHANISM_TOPICS.map(topic => button(topic.id,topic.name,'topic')).join('')}</div></div>
    <div class="facet-row"><div class="facet-label">元素 / 属性</div><div class="facet-options">${button('all','全部','element')}${elements.map(element => button(element,element,'element')).join('')}</div></div>
    <div class="mechanism-selects"><span>关联角色</span><button class="button-secondary mechanism-character-choice" type="button" data-mechanism-character-open aria-haspopup="dialog"></button><button class="subtle-action" type="button" data-mechanism-reset>清空筛选</button></div>
  </div><div class="result-meta mechanism-results-toolbar"><span data-mechanism-count></span><label>排序 <select data-mechanism-sort aria-label="术语排序"><option value="grouped">分类与角色</option><option value="name">名称顺序</option></select></label></div><div data-mechanism-results></div></section>`;
  root.querySelector('[data-mechanism-sort]').value = filters.sort;
  function save() { try { localStorage.setItem(key,JSON.stringify(filters)); } catch {} }
  function renderResults() {
    const shown = sortMechanisms(filterMechanisms(records, filters), { sort:filters.sort, characters });
    for (const type of ['scope','topic','element']) for (const node of root.querySelectorAll('[data-mechanism-'+type+']')) {
      const active = node.getAttribute('data-mechanism-'+type) === filters[type];
      node.setAttribute('aria-pressed',String(active)); node.classList.toggle('active',active);
    }
    root.querySelector('[data-mechanism-count]').innerHTML = `共 <b>${shown.length}</b> 条解释`;
    const selected = characters.find(character => character.id === filters.character);
    root.querySelector('[data-mechanism-character-open]').innerHTML = `${selected && isLocalImage(selected.image)?`<img src="${escape(selected.image)}" alt="">`:''}<span>${escape(selected?.name ?? '全部角色')}</span><span class="mechanism-choice-label">选择</span>`;
    let groupId;
    root.querySelector('[data-mechanism-results]').innerHTML = '<div class="mechanism-card-grid">' + shown.slice(0,limit).map(record => {
      const group = mechanismGroup(record, characters), newGroup = filters.sort === 'grouped' && group.id !== groupId;
      groupId = group.id;
      const topics = mechanismTopics(record).map(id => MECHANISM_TOPICS.find(topic => topic.id === id).name);
      return `${newGroup?`<h2 class="mechanism-group-heading">${escape(group.name)}</h2>`:''}<article class="panel mechanism-record" id="${escape(record.id)}"><div class="mechanism-record-heading"><h3>${escape(record.name)}</h3><div class="mechanism-meta">${[record.scope,...topics.slice(0,2)].map(label => `<span class="tag">${escape(label)}</span>`).join('')}</div></div><p>${escape(record.description)}</p>${record.related.length?`<div class="mechanism-links"><span>关联</span>${record.related.map(item => `<a href="${escape(item.href)}">${escape(item.name)}${item.skill?' · '+escape(item.skill):''}</a>`).join('')}</div>`:''}</article>`;
    }).join('') + (!shown.length?'<div class="empty">没有符合条件的术语。</div>':'') + '</div>' + (shown.length > limit?'<div class="mechanism-more"><button class="subtle-action" type="button" data-mechanism-more>显示更多</button></div>':'');
  }
  function changed() { limit = 40; save(); renderResults(); }
  function openCharacterPicker() {
    if (closePicker) return;
    const dialog = document.createElement('dialog'), focus = document.activeElement, overflow = document.body.style.overflow;
    let closed = false, pickerComposing = false, page = 1;
    const picker = { search:'', elements:[], rarities:[], types:[] };
    const rarities = [...new Set(characters.map(character => character.rarity).filter(Boolean))].sort((a,b) => b-a);
    const types = [...new Set(characters.map(character => character.type).filter(Boolean))];
    const rarityName = value => game === 'zenless'?({5:'S级',4:'A级',3:'B级'}[value] ?? value+'星'):value+'星';
    dialog.className = 'editor-dialog mechanism-character-dialog';
    dialog.setAttribute('aria-labelledby','mechanism-character-title');
    dialog.setAttribute('data-disclosure-ignore','');
    dialog.innerHTML = `<div class="dialog-header"><h2 id="mechanism-character-title">关联角色</h2><button class="dialog-close" type="button" data-picker-close aria-label="关闭角色选择">×</button></div><div class="dialog-body"><input type="search" class="list-search-input mechanism-picker-search" data-picker-search aria-label="搜索关联角色" placeholder="搜索角色名称或别名"><div class="mechanism-picker-filters" data-picker-filters></div><div data-picker-results></div></div><div class="dialog-footer"><button class="button-secondary" type="button" data-picker-all>全部角色</button><button class="button-secondary" type="button" data-picker-reset>清空筛选</button></div>`;
    function close() {
      if (closed) return; closed = true;
      if (dialog.open) dialog.close(); dialog.remove(); document.body.style.overflow = overflow;
      if (closePicker === close) closePicker = null;
      if (focus?.isConnected) focus.focus({preventScroll:true});
    }
    function refresh() {
      const facet = (label,type,values) => `<div class="facet-row"><div class="facet-label">${label}</div><div class="facet-options">${[['','全部'],...values].map(([value,name]) => `<button type="button" class="chip ${(!value?!picker[type].length:picker[type].includes(value))?'active':''}" data-picker-filter="${type}" data-value="${escape(value)}" aria-pressed="${!value?!picker[type].length:picker[type].includes(value)}">${escape(name)}</button>`).join('')}</div></div>`;
      dialog.querySelector('[data-picker-filters]').innerHTML = facet('元素 / 属性','elements',elements.map(value => [value,value])) + facet('稀有度','rarities',rarities.map(value => [String(value),rarityName(value)])) + facet('类型','types',types.map(value => [value,value]));
      const matches = filterMechanismCharacters(characters,picker), pages = Math.max(1,Math.ceil(matches.length/24));
      page = Math.min(Math.max(1,page),pages);
      dialog.querySelector('[data-picker-results]').innerHTML = `<div class="mechanism-picker-resultbar"><span>${matches.length} 名角色</span><div><button type="button" class="page-button" data-picker-page="-1" ${page===1?'disabled':''}>上一页</button><span>${page} / ${pages}</span><button type="button" class="page-button" data-picker-page="1" ${page===pages?'disabled':''}>下一页</button></div></div><div class="mechanism-character-grid">${matches.slice((page-1)*24,page*24).map(character => `<button type="button" class="mechanism-character-card ${filters.character===character.id?'active':''}" data-picker-character="${escape(character.id)}" aria-pressed="${filters.character===character.id}">${isLocalImage(character.image)?`<img src="${escape(character.image)}" alt="" loading="lazy">`:''}<span><strong>${escape(character.name)}</strong><small>${escape([...character.elements,character.type,character.rarity?rarityName(character.rarity):''].filter(Boolean).join(' · '))}</small></span></button>`).join('') || '<div class="empty">没有符合条件的角色。</div>'}</div>`;
    }
    dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
    dialog.addEventListener('close',close);
    dialog.addEventListener('click',event => {
      event.stopPropagation();
      const control = event.target.closest('button');
      if (event.target === dialog || control?.hasAttribute('data-picker-close')) return close();
      if (!control || control.disabled) return;
      if (control.hasAttribute('data-picker-character') || control.hasAttribute('data-picker-all')) {
        filters.character = control.getAttribute('data-picker-character') ?? 'all'; close(); changed();
      } else if (control.hasAttribute('data-picker-filter')) {
        const type = control.dataset.pickerFilter, value = control.dataset.value;
        picker[type] = !value?[]:picker[type].includes(value)?picker[type].filter(item => item !== value):[...picker[type],value];
        page = 1; refresh();
      } else if (control.hasAttribute('data-picker-page')) { page += Number(control.dataset.pickerPage); refresh(); }
      else if (control.hasAttribute('data-picker-reset')) {
        picker.search = ''; picker.elements = []; picker.rarities = []; picker.types = [];
        dialog.querySelector('[data-picker-search]').value = ''; page = 1; refresh();
      }
    });
    const search = event => { event.stopPropagation(); if (!pickerComposing && !event.isComposing && event.target.hasAttribute('data-picker-search')) { picker.search = event.target.value; page = 1; refresh(); } };
    dialog.addEventListener('input',search);
    dialog.addEventListener('compositionstart',event => { event.stopPropagation(); pickerComposing = true; });
    dialog.addEventListener('compositionend',event => { pickerComposing = false; search(event); });
    root.append(dialog); closePicker = close; document.body.style.overflow = 'hidden';
    refresh();
    try { dialog.showModal(); dialog.querySelector('[data-picker-search]').focus(); } catch (error) { close(); throw error; }
  }
  root.addEventListener('change',event => { if (event.target.hasAttribute('data-mechanism-sort')) { filters.sort = event.target.value; changed(); } });
  const input = event => { if (!composing && !event.isComposing && event.target.hasAttribute('data-mechanism-search')) { filters.search = event.target.value; changed(); } };
  root.addEventListener('compositionstart',() => { composing = true; });
  root.addEventListener('compositionend',event => { composing = false; input(event); });
  root.addEventListener('input',input);
  root.addEventListener('click',event => {
    for (const type of ['scope','topic','element']) {
      const control = event.target.closest('[data-mechanism-'+type+']');
      if (control) { filters[type] = control.getAttribute('data-mechanism-'+type); changed(); return; }
    }
    if (event.target.closest('[data-mechanism-character-open]')) openCharacterPicker();
    else if (event.target.closest('[data-mechanism-more]')) { limit += 40; renderResults(); }
    else if (event.target.closest('[data-mechanism-reset]')) {
      filters = defaults(); root.querySelector('[data-mechanism-search]').value = ''; root.querySelector('[data-mechanism-sort]').value = filters.sort; changed();
    }
  });
  renderResults();
  if (mechanismId) [...root.querySelectorAll('.mechanism-record')].find(record => record.id === mechanismId)?.scrollIntoView({block:'start'});
}
