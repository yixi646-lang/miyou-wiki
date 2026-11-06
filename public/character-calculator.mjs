import { imageHTML } from '../shared/asset-image.mjs';
import { categoryLabel, rarityLabel } from '../shared/catalog.mjs';
import { characterGrowthProfile } from '../shared/character-materials.mjs';
import { calculateBatch, defaultGoal, levelPhase } from '../shared/growth.mjs';
import { groupMaterialCosts } from '../shared/planner-view.mjs';
import { calculateSynthesis } from '../shared/synthesis.mjs';

const growthRequests = new Map();
const format = new Intl.NumberFormat('zh-CN').format;
const releaseOrder = new Intl.Collator('zh-CN', { numeric: true });
const loadingHTML = '<p class="table-note" role="status">正在读取养成数据…</p>';

function loadGrowth(game, api) {
  if (!growthRequests.has(game)) {
    growthRequests.set(game, api(`growth/${game}`).catch(error => {
      growthRequests.delete(game);
      throw error;
    }));
  }
  return growthRequests.get(game);
}

export function characterCalculatorHTML() {
  return `<div class="character-calculator" data-character-calculator>${loadingHTML}</div>`;
}

function roleTracks(profile, game) {
  const tracks = profile.tracks.filter(track => track.max > track.min);
  if (game !== 'starrail') return tracks;
  const byId = new Map(tracks.map(track => [String(track.id), track]));
  // 星铁强化形态可附带同一组行迹的镜像编号；仅在逐级消耗完全一致时合并。
  return tracks.filter(track => {
    if (Number(track.id) < 10000000 || !/^\d+$/.test(track.id)) return true;
    const base = byId.get(String(Number(track.id) - 10000000));
    return !base || base.group !== track.group || base.min !== track.min || base.max !== track.max ||
      JSON.stringify(base.steps) !== JSON.stringify(track.steps);
  });
}

function trackGroupsHTML(tracks, goal, escape) {
  const options = (track, value) => Array.from({ length: track.max - track.min + 1 }, (_, i) => {
    const level = i + track.min;
    const label = track.labels?.[level] ?? (track.min === 0 && track.max === 1 ? (level ? '已解锁' : '未解锁') : level);
    return `<option value="${level}"${value === level ? ' selected' : ''}>${escape(label)}</option>`;
  }).join('');
  const groups = [...new Set(tracks.map(track => track.group))];
  return groups.map((group, index) => {
    const rows = tracks.filter(track => track.group === group).map(track => {
      const name = escape(track.name), id = escape(track.id), range = goal.tracks[track.id];
      return `<div class="character-calc-track"><span>${name}</span><select data-track="${id}" data-end="from" aria-label="${name}当前等级">${options(track, range.from)}</select><span aria-hidden="true">→</span><select data-track="${id}" data-end="to" aria-label="${name}目标等级">${options(track, range.to)}</select></div>`;
    }).join('');
    return `<details class="character-calc-tracks"${index === 0 ? ' open' : ''}><summary>${escape(group)}</summary>${rows}</details>`;
  }).join('');
}

function rangeHTML(profile, goal, scope, label) {
  const level = (field, label) => `<label>${label}<input type="number" min="${profile.minLevel}" max="${profile.maxLevel}" step="1" value="${goal[field]}" data-range="${field}"></label>`;
  const phase = (field, label) => `<label>${label}<select data-range="${field}">${profile.caps.map((cap, i) => `<option value="${i}"${i === goal[field] ? ' selected' : ''}>${i} 阶 · 上限 ${cap}</option>`).join('')}</select></label>`;
  return `<fieldset class="character-calc-range" data-calc-range="${scope}" aria-label="${label}">
    ${level('fromLevel', '当前等级')}${level('toLevel', '目标等级')}
    ${phase('fromPhase', '当前阶段')}${phase('toPhase', '目标阶段')}
  </fieldset>`;
}

function settingsHTML(profile, goal, game, synthesis, escape) {
  const skillLabel = { genshin: '天赋', starrail: '技能与行迹', zenless: '技能与核心技' }[game];
  const weaponLabel = categoryLabel(game, 'weapons');
  return `<div class="character-calc-layout">
    <div class="character-calc-card" data-disclosure-ignore>
    <label class="character-calc-toggle"><input type="checkbox" data-include-levels checked>等级与突破</label>
    ${rangeHTML(profile, goal, 'character', '角色等级与突破')}
    ${profile.tracks.length ? `<label class="character-calc-toggle"><input type="checkbox" data-include-tracks checked>${skillLabel}</label><fieldset class="character-calc-skill-fields" aria-label="${skillLabel}">${trackGroupsHTML(profile.tracks, goal, escape)}</fieldset>` : ''}
    <div class="character-calc-weapon">
      <div class="character-calc-weapon-choice"><span>${weaponLabel}</span><button class="button-secondary" type="button" aria-haspopup="dialog" data-calc-weapon-open><span data-calc-weapon-name>选择${weaponLabel}</span><span aria-hidden="true">›</span></button></div>
      <div data-calc-weapon-range></div>
    </div>
    </div>
    <div class="character-calc-card character-calc-results">
    <div class="character-calc-result-heading">
      <h3>所需材料</h3>
      <div class="character-calc-result-actions">
        <label class="character-calc-toggle"><input type="checkbox" data-calc-synthesis${synthesis ? ' checked' : ''}>计入合成</label>
        <button class="button-secondary" type="button" data-calc-inventory-reset aria-label="将本次已有材料数量归零">已有归零</button>
      </div>
    </div>
    <div data-calc-message role="status"></div><div data-calc-costs></div><div data-calc-synthesis-steps></div>
    </div></div>
    <dialog class="editor-dialog character-calc-weapon-dialog" aria-labelledby="character-calc-weapon-title">
      <div class="dialog-header"><h2 id="character-calc-weapon-title">选择${weaponLabel}</h2><button class="dialog-close" type="button" data-close-dialog aria-label="关闭">×</button></div>
      <div class="dialog-body">
        <input type="search" class="list-search-input" data-calc-weapon-search aria-label="搜索${weaponLabel}" placeholder="搜索名称或类型">
        <form class="character-calc-weapon-filters" data-calc-weapon-filters></form>
        <div class="character-calc-weapon-grid" data-calc-weapon-results></div>
      </div>
      <div class="dialog-footer"><button class="button-secondary" type="button" data-calc-weapon-pick="">只计算角色</button></div>
    </dialog>`;
}

function bindWeaponPicker(body, weapons, game, escape, getSelected, onSelect) {
  const trigger = body.querySelector('[data-calc-weapon-open]');
  const dialog = body.querySelector('.character-calc-weapon-dialog');
  const search = dialog.querySelector('[data-calc-weapon-search]');
  const filters = dialog.querySelector('[data-calc-weapon-filters]');
  const results = dialog.querySelector('[data-calc-weapon-results]');
  const types = [...new Set(weapons.map(weapon => weapon.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const rarities = [...new Set(weapons.map(weapon => weapon.rarity).filter(Boolean))].sort((a, b) => b - a);
  const typeLabel = { starrail: '命途', zenless: '特性' }[game] ?? '类型';
  const groups = [
    ['type', typeLabel, types.map(type => [type, type])],
    ['rarity', '稀有度', rarities.map(rarity => [rarity, rarityLabel({ game, rarity })])],
  ];
  filters.innerHTML = groups.map(([field, label, options]) => `<div class="character-calc-weapon-filter" role="group" aria-label="${label}">
    <span aria-hidden="true">${label}</span><div>${[['', '全部'], ...options].map(([value, name]) => `<label>
      <input type="radio" name="${field}" value="${escape(value)}"${value === '' ? ' checked' : ''}><span class="chip">${escape(name)}</span>
    </label>`).join('')}</div>
  </div>`).join('');
  function renderChoices() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const type = filters.elements.namedItem('type').value;
    const rarity = filters.elements.namedItem('rarity').value;
    const selected = getSelected();
    results.innerHTML = weapons.filter(weapon => (!type || weapon.type === type) &&
      (!rarity || String(weapon.rarity) === rarity) && terms.every(term => weapon.searchable.includes(term)))
      .map(weapon => `<button type="button" class="character-calc-weapon-card" aria-pressed="${weapon.id === selected}" data-calc-weapon-pick="${escape(weapon.id)}">
        ${imageHTML(weapon, escape, { alt: '' })}<span><strong>${escape(weapon.name)}</strong><small>${escape([weapon.type, rarityLabel({ game, rarity: weapon.rarity })].filter(Boolean).join(' · '))}</small></span>
      </button>`).join('') || '<p class="table-note">没有符合条件的结果。</p>';
    results.scrollTop = 0;
  }
  trigger.addEventListener('click', () => {
    search.value = '';
    filters.reset();
    renderChoices();
    dialog.showModal();
    search.focus({ preventScroll: true });
  });
  search.addEventListener('input', event => { if (!event.isComposing) renderChoices(); });
  search.addEventListener('compositionend', renderChoices);
  filters.addEventListener('change', renderChoices);
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-calc-weapon-pick]');
    if (!button) return;
    onSelect(button.dataset.calcWeaponPick);
    dialog.close();
  });
  dialog.addEventListener('close', () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); });
}

function renderCalculator(body, profile, game, data, plan, weaponEntries, escape) {
  profile = { ...profile, tracks: roleTracks(profile, game) };
  const goal = defaultGoal(profile);
  const weaponCatalog = new Map(weaponEntries.map(entry => [entry.id, entry]));
  const weapons = Object.values(data.profiles)
    .filter(candidate => candidate.category === 'weapons')
    .map(weapon => {
      const entry = weaponCatalog.get(weapon.entryId);
      const name = entry?.name ?? weapon.name, type = entry?.type ?? weapon.type;
      return { ...weapon, name, type, image: entry?.image, imageFrame: entry?.imageFrame,
        releaseVersion: entry?.releaseVersion ?? '', releaseDate: entry?.releaseDate ?? '',
        searchable: [name, weapon.name, type, ...(entry?.aliases ?? [])].filter(Boolean).join(' ').toLowerCase() };
    })
    .sort((a, b) => releaseOrder.compare(b.releaseVersion, a.releaseVersion) ||
      b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));
  const weaponsById = new Map(weapons.map(weapon => [weapon.id, weapon]));
  let weaponGoal = null;
  let inventory = { ...plan?.inventory };
  let useTracks = true, synthesize = plan?.synthesis !== false;
  body.innerHTML = settingsHTML(profile, goal, game, synthesize, escape);
  const message = body.querySelector('[data-calc-message]');
  const costsHost = body.querySelector('[data-calc-costs]');
  const stepsHost = body.querySelector('[data-calc-synthesis-steps]');
  const weaponRangeHost = body.querySelector('[data-calc-weapon-range]');
  const name = id => data.materials[id]?.name ?? id;
  const displayCost = row => format(row.count) +
    (row.crafted ? `<small>可合成 ${format(row.crafted)}</small>` : '') +
    (row.spent ? `<small>用于合成 ${format(row.spent)}</small>` : '');

  function renderResults(updateInventory = false) {
    try {
      const profiles = { [profile.id]: profile };
      const goals = [{ ...goal, tracks: useTracks ? goal.tracks : {} }];
      if (weaponGoal) {
        profiles[weaponGoal.profileId] = weaponsById.get(weaponGoal.profileId);
        goals.push(weaponGoal);
      }
      const result = calculateBatch(profiles, goals);
      const { costs, steps } = calculateSynthesis(result.costs, inventory, data.recipes, synthesize);
      const notices = result.rows.flatMap(row => [...row.errors, ...row.warnings.filter(text => text !== profile.note)]
        .map(text => goals.length > 1 ? `${row.name}：${text}` : text));
      if (result.errors.length && costs.length) notices.push('材料小计仅含有效项目。');
      message.textContent = notices.join('；') || (costs.length ? '' : '当前范围无需材料。');
      message.classList.toggle('character-calc-warning', notices.length > 0);
      const existing = new Map([...costsHost.querySelectorAll('[data-calc-material]')].map(row => [row.dataset.calcMaterial, row]));
      if (updateInventory && existing.size === costs.length && costs.every(row => existing.has(row.id))) {
        for (const row of costs) {
          const cells = existing.get(row.id).cells;
          cells[1].innerHTML = displayCost(row);
          cells[3].textContent = format(row.missing);
        }
      } else {
        const groups = groupMaterialCosts(costs, data.materials, profiles);
        costsHost.innerHTML = costs.length ? `<div class="data-table-wrap"><table class="data-table character-calc-table"><thead><tr><th>材料</th><th>需要</th><th title="试填的数量仅用于当前计算">已有</th><th>尚缺</th></tr></thead>${groups.map(group => `<tbody><tr class="character-calc-material-group"><th colspan="4">${escape(group.label)}</th></tr>${group.items.map(row => {
          const material = data.materials[row.id];
          return `<tr data-calc-material="${escape(row.id)}"><td><a href="/?game=${game}&entry=${encodeURIComponent(row.id)}">${material ? imageHTML(material, escape, { alt: '' }) : ''}<span>${escape(name(row.id))}</span></a></td><td>${displayCost(row)}</td><td><input type="number" min="0" max="1000000000000" step="1" value="${row.have}" data-calc-inventory="${escape(row.id)}" aria-label="${escape(name(row.id))}已有数量"></td><td>${format(row.missing)}</td></tr>`;
        }).join('')}</tbody>`).join('')}</table></div>` : '';
      }
      const stepsOpen = stepsHost.querySelector('details')?.open;
      stepsHost.innerHTML = steps.length ? `<details class="character-calc-synthesis"${stepsOpen ? ' open' : ''}><summary>合成明细</summary><ul>${steps.map(step => {
        const inputs = step.inputs.map(item => `${escape(name(item.id))} ×${format(item.count)}`).join(' + ');
        const fee = step.currency?.count ? ` · ${escape(name(step.currency.id))} ×${format(step.currency.count)}`
          : step.feeStatus === 'unverified' ? ' · 费用待核实' : '';
        return `<li>${inputs} → ${escape(name(step.id))} ×${format(step.output)}${fee}</li>`;
      }).join('')}</ul></details>` : '';
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('character-calc-warning');
      costsHost.replaceChildren();
      stepsHost.replaceChildren();
    }
  }

  body.addEventListener('change', ({ target }) => {
    const { range, track, end } = target.dataset;
    if (range) {
      const fields = target.closest('[data-calc-range]');
      const selectedGoal = fields.dataset.calcRange === 'weapon' ? weaponGoal : goal;
      selectedGoal[range] = target.type === 'number' ? target.valueAsNumber : Number(target.value);
      if (range.endsWith('Level')) {
        const rangeProfile = selectedGoal === goal ? profile : weaponsById.get(selectedGoal.profileId);
        const phase = levelPhase(rangeProfile, selectedGoal[range]);
        const phaseField = range.replace('Level', 'Phase');
        if (phase >= 0) {
          selectedGoal[phaseField] = phase;
          fields.querySelector(`[data-range="${phaseField}"]`).value = phase;
        }
      }
    } else if (track) goal.tracks[track][end] = Number(target.value);
    else if (target.matches('[data-include-levels]')) {
      goal.levels = target.checked;
      body.querySelector('[data-calc-range="character"]').disabled = !goal.levels;
    } else if (target.matches('[data-include-tracks]')) {
      useTracks = target.checked;
      body.querySelector('.character-calc-skill-fields').disabled = !useTracks;
    } else if (target.matches('[data-calc-synthesis]')) synthesize = target.checked;
    else return;
    renderResults();
  });
  body.addEventListener('input', ({ target }) => {
    const id = target.dataset.calcInventory;
    if (!id || !target.validity.valid) return;
    inventory[id] = target.valueAsNumber || 0;
    renderResults(true);
  });
  body.querySelector('[data-calc-inventory-reset]').addEventListener('click', () => {
    inventory = {};
    renderResults();
  });
  bindWeaponPicker(body, weapons, game, escape, () => weaponGoal?.profileId ?? '', id => {
    if (id === (weaponGoal?.profileId ?? '')) return;
    const weapon = weaponsById.get(id), weaponLabel = categoryLabel(game, 'weapons');
    weaponGoal = weapon ? defaultGoal(weapon) : null;
    body.querySelector('[data-calc-weapon-name]').textContent = weapon?.name ?? `选择${weaponLabel}`;
    weaponRangeHost.innerHTML = weapon ? rangeHTML(weapon, weaponGoal, 'weapon', `${weaponLabel}等级与突破`) : '';
    renderResults();
  });
  renderResults();
}

export async function bindCharacterCalculator(panel, { entry, element, api, escape, renderFallback, weaponEntries = [] }) {
  async function load() {
    panel.innerHTML = loadingHTML;
    try {
      const { game } = entry;
      const [data, plan] = await Promise.all([
        loadGrowth(game, api),
        api(`growth/${game}/plan`).catch(() => null),
      ]);
      if (!panel.isConnected) return;
      const profile = characterGrowthProfile(entry, data, element);
      if (profile) renderCalculator(panel, profile, game, data, plan, weaponEntries, escape);
      else panel.innerHTML = '<p class="table-note">暂未收录该角色的分阶段消耗。</p>' + renderFallback(element);
    } catch (error) {
      if (panel.isConnected) {
        panel.innerHTML = `<p class="table-note" role="status">${escape(error.message)}</p><button type="button" class="button-secondary">重试</button>`;
        panel.querySelector('button').addEventListener('click', load, { once: true });
      }
    }
  }
  await load();
}
