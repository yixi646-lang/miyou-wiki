export function createWorkbenchInventory(readContext) {
  function itemActions(kind, item, index, buttons) {
    const __ctx = readContext();

    return `<div class="ae-item-actions">${buttons}<button class="subtle-action" data-native="copy-inventory-item" data-kind="${kind}" data-index="${index}">复制为自定义</button><label class="ae-lock"><input type="checkbox" data-native-lock="${kind}" data-index="${index}" ${item.lock ? "checked" : ""}>锁定</label><button class="subtle-action ae-remove" data-native="${kind === "artifacts" ? "remove-artifact" : "remove-weapon"}" data-index="${index}">移除</button></div>`;
  }

  function inventoryToolbar(count, total, unit, clear, sort, pages) {
    const __ctx = readContext();

    return `<div class="ae-inventory-toolbar"><div class="ae-inventory-results"><span>显示 ${count} / ${total} ${unit}</span><button class="subtle-action" data-native="${clear}">清空筛选</button></div>${sort}${pages}</div>`;
  }

  function inventoryPages(total) {
    const __ctx = readContext();

    const pages = Math.max(1, Math.ceil(total / __ctx.pageSize));
    __ctx.inventoryPage = Math.max(1, Math.min(__ctx.inventoryPage, pages));
    return `<div class="ae-inventory-pages"><span>第 ${__ctx.inventoryPage} / ${pages} 页</span><button class="subtle-action" data-native="inventory-page" data-direction="-1" ${__ctx.inventoryPage <= 1 ? "disabled" : ""}>上一页</button><button class="subtle-action" data-native="inventory-page" data-direction="1" ${__ctx.inventoryPage >= pages ? "disabled" : ""}>下一页</button><select data-inventory-page-size aria-label="每页装备数量">${[24, 60, 120].map((n) => __ctx.opt(n, "每页 " + n + " 件", __ctx.pageSize)).join("")}</select></div>`;
  }

  function artifactFilterHTML() {
    const __ctx = readContext();

    const f = __ctx.artifactFilter,
      select = (title, k, options) =>
        __ctx.field(
          title,
          `<select data-artifact-filter="${k}">${options.map(([v, n]) => __ctx.opt(v, n, f[k])).join("")}</select>`,
        );
    const mains = [
      ...new Set(
        f.slot
          ? __ctx.MAIN_STATS[f.slot]
          : Object.values(__ctx.MAIN_STATS).flat(),
      ),
    ];
    const limit = (title, k, max = 1e7) =>
      __ctx.field(
        title,
        `<input type="number" data-artifact-filter="${k}" value="${__ctx.esc(f[k])}" min="0" max="${max}" step="any" placeholder="不限">`,
      );
    const advanced =
      [
        "lock",
        "minLevel",
        "maxLevel",
        "subCount",
        "minCV",
        ...(__ctx.artifactReference ? ["minEffective"] : []),
        "minTotal",
      ].filter((k) => f[k] !== "").length + f.subs.length;
    return `<div class="ae-fields ae-filter-fields">${__ctx.originFilter()}${__ctx.field("搜索套装", `<input type="search" data-native-search value="${__ctx.esc(__ctx.inventorySearch)}" placeholder="名称、别名或英文关键词">`)}${select("部位", "slot", [["", "全部部位"], ...__ctx.SLOTS.map((k) => [k, __ctx.SLOT_NAMES[k]])])}${__ctx.catalogChoiceHTML({ label: "套装", kind: "sets", value: f.set, catalog: __ctx.catalog, placeholder: "全部套装", buttonAttributes: 'data-native="choose-artifact-filter-set"', inputAttributes: 'data-artifact-filter="set"' })}${select("星级", "rarity", [["", "全部星级"], ...[5, 4, 3, 2, 1].map((n) => [n, n + " 星"])])}${select("主词条", "main", [["", "全部主词条"], ...mains.map((k) => [k, __ctx.STAT_NAMES[k]])])}${select("装备状态", "status", [["", "全部状态"], ["free", "未装备"], ["equipped", "已装备"], ...(__ctx.current() ? [["current", "当前角色装备"]] : [])])}</div><details class="ae-filter-details" data-disclosure-ignore data-native-disclosure="artifact-filters"><summary>副词条与更多筛选${advanced ? " · " + advanced + " 项已选" : ""}</summary><div class="ae-fields ae-filter-fields">${select(
      "装备锁定",
      "lock",
      [
        ["", "不限"],
        ["locked", "已锁定"],
        ["unlocked", "未锁定"],
      ],
    )}${limit("最低强化等级", "minLevel", 20)}${limit("最高强化等级", "maxLevel", 20)}${select("副词条数量至少", "subCount", [["", "不限"], ...[1, 2, 3, 4].map((n) => [n, n + " 条"])])}${limit("最低双暴值", "minCV")}${__ctx.artifactReference ? limit("最低有效等效", "minEffective") : ""}${limit("最低总等效", "minTotal")}${select(
      "副词条匹配方式",
      "subMode",
      [
        ["all", "满足全部所选"],
        ["any", "满足任一所选"],
      ],
    )}</div><div class="ae-substat-filters">${__ctx.SUBSTATS.map((k) => `<div class="ae-substat-filter ${f.subs.includes(k) ? "active" : ""}"><label><input type="checkbox" data-artifact-sub="${k}" ${f.subs.includes(k) ? "checked" : ""}>${__ctx.STAT_NAMES[k]}</label>${f.subs.includes(k) ? `<input type="number" data-artifact-sub-min="${k}" min="0" max="10000000" step="any" value="${__ctx.esc(f.subMin[k] ?? "")}" placeholder="最低数值，不限" aria-label="${__ctx.STAT_NAMES[k]}副词条最低数值">` : ""}</div>`).join("")}</div><p data-ae-hint="库存副词条筛选说明" class="ae-muted">勾选副词条后可填写最低数值；百分比按游戏显示填写。${__ctx.artifactReference ? "有效等效沿用所选角色的词条权重；" : ""}双暴值 = 暴击率 × 2 + 暴击伤害。</p></details>`;
  }

  function artifactsHTML() {
    const __ctx = readContext();

    const all = __ctx.state().good.artifacts,
      items = __ctx
        .filterArtifacts(
          all,
          __ctx.catalog,
          __ctx.data,
          { ...__ctx.artifactFilter, search: __ctx.inventorySearch },
          __ctx.weights(),
          __ctx.current() ? __ctx.equipmentLocation(__ctx.key()) : "",
        )
        .filter(({ a }) => __ctx.originMatches(a, __ctx.inventoryOrigin)),
      pages = __ctx.inventoryPages(items.length),
      shown = items.slice(
        (__ctx.inventoryPage - 1) * __ctx.pageSize,
        __ctx.inventoryPage * __ctx.pageSize,
      );
    return `<div class="panel ae-section ae-inventory-panel"><div class="ae-result-heading"><h2>圣遗物库存</h2><div class="ae-inline-actions"><button class="subtle-action" data-native="choose-artifact-reference" aria-haspopup="dialog">选择角色显示词条权重评价</button><button class="subtle-action" data-native="new-artifact">添加自定义圣遗物</button></div></div>${__ctx.inventoryContextHTML("artifacts")}${__ctx.artifactFilterHTML()}${__ctx.inventoryToolbar(items.length, all.length, "件", "clear-artifact-filters", `<select class="ae-inventory-sort" data-artifact-filter="sort" aria-label="圣遗物排序">${[...Object.entries(__ctx.ARTIFACT_SORTS).filter(([k]) => __ctx.artifactReference || k !== "effective"), ...__ctx.SUBSTATS.map((k) => ["sub:" + k, __ctx.STAT_NAMES[k] + "从高到低"])].map(([k, n]) => __ctx.opt(k, n, __ctx.artifactFilter.sort)).join("")}</select>`, pages)}</div>${__ctx.customListHTML()}<div class="ae-artifact-inventory-results" data-artifact-inventory-results><div class="ae-inventory-grid">${
      shown
        .map(({ a, i, metrics: r }) => {
          const main =
            (__ctx.data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level] ?? 0) *
            (a.mainStatKey.endsWith("_") ? 100 : 1);
          return `<article class="panel ae-item-card ae-artifact-card ae-rarity-${a.rarity}"><div class="ae-item-head">${__ctx.artifactIconHTML(a, __ctx.catalog)}<div><h3>${__ctx.esc(__ctx.catalog.sets[a.setKey]?.name ?? a.setKey)} ${__ctx.badge(a)}</h3><p class="ae-item-meta"><span class="ae-stars">${a.rarity} 星</span> · ${__ctx.SLOT_NAMES[a.slotKey]} · +${a.level}</p><strong>${__ctx.STAT_NAMES[a.mainStatKey]} ${__ctx.statDisplay(main, a.mainStatKey)}</strong></div></div><div class="ae-item-substats">${a.substats
            .filter((s) => s.key)
            .map(
              (s) =>
                `<span class="${__ctx.weights()[s.key] > 0 ? "ae-stat-effective" : ""}">${__ctx.STAT_NAMES[s.key]} <b>${__ctx.statDisplay(s.value, s.key)}</b></span>`,
            )
            .join(
              "",
            )}</div><p class="ae-item-counts">${__ctx.artifactCountSummary(a, __ctx.data, __ctx.inventoryWeights())}</p><div class="ae-item-metrics">${__ctx.artifactReference ? `<span>有效 <b>${r.effective.toFixed(1)}</b></span>` : ""}<span>总等效 <b>${r.total.toFixed(1)}</b></span><span>双暴 <b>${r.cv.toFixed(1)}</b></span></div><p class="ae-item-owner">${a.location ? "装备：" + __ctx.esc(__ctx.locationName(a.location)) : "未装备"}${r.invalid.length ? ' · <span class="ae-warning">词条档位需核对</span>' : ""}</p>${__ctx.itemActions("artifacts", a, i, `<button class="subtle-action" data-native="view-artifact" data-index="${i}">词条详情</button><button class="subtle-action" data-native="open-potential" data-index="${i}">强化潜力</button><button class="subtle-action" data-native="edit-artifact" data-index="${i}">编辑</button>`)}</article>`;
        })
        .join("") ||
      '<div class="panel ae-empty">没有匹配的圣遗物，可清空或调整筛选。</div>'
    }</div>${items.length > __ctx.pageSize ? pages : ""}</div>`;
  }

  function customListHTML() {
    const __ctx = readContext();

    const list = __ctx.workspace().customArtifacts ?? [];
    if (!list.length) return "";
    return `<details class="panel ae-section" open><summary>已保存的自定义圣遗物</summary><p data-ae-hint="自定义库存说明" class="ae-muted">自定义配置单独保存，包含在工作区备份中；不会自动装备，也不会混入 GOOD 的实际库存。</p><div class="ae-plan-list">${list
      .map((c) => {
        const r = __ctx.inspectDraft(c.draft, __ctx.data);
        return `<div><span><strong>${__ctx.esc(c.name)}</strong><small>${__ctx.SLOT_NAMES[c.draft.slotKey]} · ${c.draft.rarity} 星 +${c.draft.level} · ${r.total} 次 · ${r.realistic ? "正常范围" : "理论配置"}</small></span><button class="subtle-action" data-native="view-custom" data-id="${__ctx.esc(c.id)}">查看分析</button><button class="subtle-action" data-native="edit-custom" data-id="${__ctx.esc(c.id)}">编辑</button><button class="subtle-action ae-remove" data-native="remove-custom" data-id="${__ctx.esc(c.id)}">移除</button></div>`;
      })
      .join("")}</div></details>`;
  }

  function weaponEditorHTML(index) {
    const __ctx = readContext();

    const item = __ctx.state().good.weapons[index];
    if (!item) return "";
    const m = __ctx.catalog.weapons[item.key];
    return `<div class="panel ae-section" data-native-weapon-index="${index}"><h3>编辑武器</h3><div class="ae-selected-weapon">${__ctx.image(m)}<div><strong>${__ctx.esc(m?.name ?? item.key)}</strong><p class="ae-muted">${m?.rarity ?? "?"} 星 · ${__ctx.weaponTypes[m?.weaponType] ?? "未知类型"}</p></div><button class="subtle-action" data-native="replace-weapon" data-index="${index}">搜索并更换武器</button></div><div class="ae-fields">${__ctx.num("等级", item.level, 'data-native-weapon="level"', 1, m?.rarity < 3 ? 70 : 90)}${__ctx.num("突破阶段", item.ascension, 'data-native-weapon="ascension"', 0, m?.rarity < 3 ? 4 : 6)}${__ctx.num("精炼等级", item.refinement, 'data-native-weapon="refinement"', 1, 5)}</div><div class="ae-inline-actions"><button class="subtle-action" data-native="close-editor">完成编辑</button><button class="subtle-action ae-remove" data-native="remove-weapon" data-index="${index}">移除这把武器</button></div></div>`;
  }

  function inventoryContextHTML(kind) {
    const __ctx = readContext();

    if (kind !== "artifacts" || !__ctx.artifactReference) return "";
    return `<div class="ae-inventory-context"><strong>词条评价角色：${__ctx.esc(__ctx.meta(__ctx.artifactReference).name)}</strong><span>有效词条、排序及筛选按该角色的词条权重计算。</span><button class="subtle-action" data-native="clear-artifact-reference">取消角色评价</button></div>`;
  }

  function weaponsHTML() {
    const __ctx = readContext();

    const all = __ctx.state().good.weapons,
      filters = {
        search: __ctx.inventorySearch,
        type: __ctx.weaponFilter,
        rarity: __ctx.weaponRarity,
        stat: __ctx.weaponStat,
      };
    const items = __ctx.sortWeapons(
        all
          .map((item, i) => ({ item, i }))
          .filter(
            ({ item }) =>
              __ctx.weaponMatches(
                item.key,
                __ctx.catalog.weapons[item.key] ?? { name: item.key },
                __ctx.data.weapon.data[item.key],
                filters,
              ) &&
              __ctx.originMatches(item, __ctx.inventoryOrigin) &&
              __ctx.matchesEquipment(
                item,
                __ctx.weaponStatus,
                "",
                __ctx.current() ? __ctx.equipmentLocation(__ctx.key()) : "",
              ),
          ),
        __ctx.catalog,
        __ctx.data,
        __ctx.weaponSort,
      ),
      pages = __ctx.inventoryPages(items.length),
      shown = items.slice(
        (__ctx.inventoryPage - 1) * __ctx.pageSize,
        __ctx.inventoryPage * __ctx.pageSize,
      );
    return `<div class="panel ae-section ae-inventory-panel"><div class="ae-result-heading"><h2>武器库存</h2><button class="subtle-action" data-native="new-weapon">添加自定义武器</button></div>${__ctx.inventoryContextHTML("weapons")}<div class="ae-fields ae-filter-fields">${__ctx.originFilter()}${__ctx.field("搜索库存", `<input type="search" data-native-search value="${__ctx.esc(__ctx.inventorySearch)}" placeholder="名称、别名或英文关键词">`)}${__ctx.field(
      "武器类型",
      `<select data-native-filter="weapon">${__ctx.opt("", "全部类型", __ctx.weaponFilter)}${Object.entries(
        __ctx.weaponTypes,
      )
        .map(([k, n]) => __ctx.opt(k, n, __ctx.weaponFilter))
        .join("")}</select>`,
    )}${__ctx.field("星级", `<select data-native-filter="weapon-rarity">${__ctx.opt("", "全部星级", __ctx.weaponRarity)}${[5, 4, 3, 2, 1].map((k) => __ctx.opt(String(k), k + " 星", __ctx.weaponRarity)).join("")}</select>`)}${__ctx.field(
      "副属性",
      `<select data-native-filter="weapon-stat">${__ctx
        .secondaryOptions()
        .map(([k, n]) => __ctx.opt(k, n, __ctx.weaponStat))
        .join("")}</select>`,
    )}${__ctx.field("装备状态", `<select data-native-filter="weapon-status">${[["", "全部状态"], ["free", "未装备"], ["equipped", "已装备"], ...(__ctx.current() ? [["current", "当前角色装备"]] : [])].map(([k, n]) => __ctx.opt(k, n, __ctx.weaponStatus)).join("")}</select>`)}</div>${__ctx.inventoryToolbar(
      items.length,
      all.length,
      "把",
      "clear-weapon-filters",
      `<select class="ae-inventory-sort" data-weapon-sort aria-label="武器排序">${Object.entries(
        __ctx.WEAPON_SORTS,
      )
        .map(([k, n]) => __ctx.opt(k, n, __ctx.weaponSort))
        .join("")}</select>`,
      pages,
    )}</div>${__ctx.editing?.kind === "weapons" ? __ctx.weaponEditorHTML(__ctx.editing.index) : ""}<div class="ae-inventory-grid">${
      shown
        .map(({ item: a, i }) => {
          const m = __ctx.catalog.weapons[a.key],
            values = __ctx.weaponBaseStats(a, __ctx.data),
            sub = __ctx.data.weapon.data[a.key]?.subStat?.type,
            link = m?.wikiId
              ? "/?game=genshin&entry=" + encodeURIComponent(m.wikiId)
              : "",
            title = __ctx.esc(m?.name ?? a.key);
          return `<article class="panel ae-item-card ae-weapon-card ae-rarity-${m?.rarity ?? 0}"><div class="ae-item-head">${link ? `<a class="ae-item-art-link" href="${link}" aria-label="查看${title}武器资料">${__ctx.image(m)}</a>` : __ctx.image(m)}<div><h3>${link ? `<a href="${link}">${title}</a>` : title} ${__ctx.badge(a)}</h3><p class="ae-item-meta"><span class="ae-stars">${m?.rarity ?? "?"} 星</span> · ${__ctx.weaponTypes[m?.weaponType] ?? "未知类型"} · ${a.refinement} 阶精炼</p><p class="ae-weapon-level">Lv.${a.level} · 突破 ${a.ascension}</p></div></div><div class="ae-item-metrics ae-weapon-stats"><span>基础攻击力 <b>${values?.atk === undefined ? "—" : __ctx.statDisplay(values.atk, "atk")}</b></span><span>${__ctx.STAT_NAMES[sub] ?? "无副属性"} <b>${values?.[sub] === undefined ? "—" : __ctx.statDisplay(values[sub], sub)}</b></span></div><p class="ae-item-owner">${a.location ? "装备：" + __ctx.esc(__ctx.locationName(a.location)) : "未装备"}</p>${__ctx.itemActions("weapons", a, i, `<button class="subtle-action" data-native="edit-weapon" data-index="${i}">编辑</button>`)}</article>`;
        })
        .join("") ||
      `<div class="panel ae-empty">${all.length ? "没有匹配的武器，可清空或调整筛选。" : "库存为空，点击“添加武器”搜索并选择。"}</div>`
    }</div>${items.length > __ctx.pageSize ? pages : ""}`;
  }
  return {
    itemActions,
    inventoryToolbar,
    inventoryPages,
    artifactFilterHTML,
    artifactsHTML,
    customListHTML,
    weaponEditorHTML,
    inventoryContextHTML,
    weaponsHTML,
  };
}
