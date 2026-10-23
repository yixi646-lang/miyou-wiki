export function createCatalogCards(readContext) {
  function entryImage(entry, detail = false) {
    const __ctx = readContext();

    return (
      __ctx.imageHTML(entry, __ctx.escape, { detail }) ||
      `<${detail ? "b" : "span"} class="monogram" aria-label="暂未收录图片">${__ctx.escape(entry.name.slice(0, 1))}</${detail ? "b" : "span"}>`
    );
  }

  function elementBadge(entry) {
    const __ctx = readContext();

    const src = __ctx.elementIcon(entry);
    return src
      ? `<span class="element-badge ${entry.game}" title="${__ctx.escape(entry.element)}" aria-label="${__ctx.escape(entry.element)}属性"><img src="${src}" alt="${__ctx.escape(entry.element)}" decoding="async"></span>`
      : "";
  }

  function applicabilityHTML(entry) {
    const __ctx = readContext();

    const a = entry.applicability;
    if (!a) return "";
    return `<div class="material-usage">${a.purposes?.length ? `<div>用途：${__ctx.escape(a.purposes.join(" / "))}</div>` : ""}${a.elements?.length ? `<div>角色属性：${__ctx.escape(a.elements.join(" / "))}</div>` : ""}${a.paths?.length ? `<div>命途：${__ctx.escape(a.paths.join(" / "))}</div>` : ""}${a.specialties?.length ? `<div>特性：${__ctx.escape(a.specialties.join(" / "))}</div>` : ""}</div>`;
  }

  function weaponStats(entry) {
    const __ctx = readContext();

    const secondaryName =
        entry.secondaryName ?? entry.secondary?.[0] ?? "副属性",
      labels = {
        hp: "生命值",
        attack: "基础攻击力",
        defense: "基础防御力",
        speed: "速度",
        secondaryValue: secondaryName,
      };
    return `<div class="weapon-stats">${Object.entries(labels)
      .filter(([key]) => Number.isFinite(entry.stats?.[key]))
      .map(([key, label]) => {
        const value = entry.stats[key];
        return `<span><small>${__ctx.escape(label)}</small><b>${__ctx.escape(key === "secondaryValue" ? (secondaryName.includes("精通") ? Math.round(value) : Number((value * 100).toFixed(1)) + "%") : value)}</b></span>`;
      })
      .join(
        "",
      )}<small class="stats-level">Lv.${__ctx.escape(entry.statsLevel ?? entry.stats?.level ?? "最高等级")}</small></div>`;
  }

  function effectBody(effect) {
    const __ctx = readContext();

    return `<h4>${__ctx.escape(effect?.name ?? "")}</h4><p>${__ctx.escape(effect?.description ?? "")}</p>`;
  }

  function equipmentCard(entry) {
    const __ctx = readContext();

    const effects = entry.listEffects ?? [],
      ranks = effects.filter((e) => e.rank);
    return `<article class="entry-card equipment-card ${__ctx.rarityClass(entry)}" data-entry-id="${entry.id}" style="${__ctx.tile(entry.game)}"><a class="equipment-main" href="${__ctx.entryHref(entry)}" aria-label="查看${__ctx.escape(entry.name)}详情"><div class="equipment-head"><span class="equipment-image">${__ctx.entryImage(entry)}</span><div class="equipment-title"><strong>${__ctx.escape(entry.name)}</strong><div class="entry-tags"><span>${__ctx.escape(__ctx.rarityLabel(entry))}</span><span>${__ctx.escape(entry.type ?? entry.kind ?? "")}</span><span>${__ctx.escape(entry.releaseVersion ?? "待确认")} 版本</span></div></div><span class="equipment-link">查看详情 ↗</span></div>${entry.category === "weapons" ? __ctx.weaponStats(entry) : ""}</a>${entry.category === "sets" ? `<div class="set-effects">${effects.map((e) => `<div class="set-effect">${__ctx.effectBody(e)}</div>`).join("")}</div>` : effects.length ? `<details class="weapon-passive" ${__ctx.listDisclosures.isOpen(entry.id) ? "open" : ""}><summary>被动效果 <span>展开 / 收起</span></summary><div class="passive-body">${ranks.length ? `<label class="list-rank-label">${entry.game === "genshin" ? "精炼" : entry.game === "starrail" ? "叠影" : "星级"} <select class="list-effect-rank" data-id="${entry.id}" aria-label="${__ctx.escape(entry.name)}被动等级">${ranks.map((r, i) => `<option value="${i}">${r.rank}</option>`).join("")}</select></label>` : ""}<div class="list-selected-effect">${__ctx.effectBody(ranks[0] ?? effects[0])}</div></div></details>` : ""}${__ctx.favorites.has(entry.id) ? '<span class="saved-star" aria-label="已收藏">★</span>' : ""}</article>`;
  }

  function bannerGroups(entry) {
    const __ctx = readContext();

    return (entry.banner?.groups ?? [])
      .map(
        (group) =>
          `<div class="banner-group"><span class="banner-group-label">${__ctx.escape(group.name)}${group.role ? `<small class="banner-role role-${group.role}">${__ctx.escape({ up: "概率 UP", selectable: "可选目标", pool: "普通内容" }[group.role] ?? "未标注")}</small>` : ""}</span><div class="banner-items">${group.items
            .map((item) => {
              const target = __ctx.entries.find(
                (e) => e.id === item.id && e.game === entry.game,
              );
              return `<${target ? "a" : "span"} ${target ? `href="${__ctx.entryHref(target)}"` : ""} class="banner-item">${target?.image ? `<img src="${__ctx.escape(target.image)}" alt="" loading="lazy">` : ""}<span>${__ctx.escape(target?.name ?? item.name)}</span></${target ? "a" : "span"}>`;
            })
            .join("")}</div></div>`,
      )
      .join("");
  }

  function pairedBannerHTML(entry) {
    const __ctx = readContext();

    const peer = __ctx.entries.find(
      (e) => e.id === entry.banner?.pairedBannerId && e.game === entry.game,
    );
    return peer
      ? `<div class="paired-banner"><span>对应${__ctx.escape(peer.type)}</span><a href="${__ctx.entryHref(peer)}">${__ctx.escape(peer.name)} ↗</a></div>`
      : "";
  }

  function bannerCard(entry) {
    const __ctx = readContext();

    const b = entry.banner,
      now = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Shanghai",
      }),
      current =
        b.start.slice(0, 10) <= now &&
        (b.end ? b.end.slice(0, 10) >= now : b.mode !== "standard");
    return `<article class="entry-card banner-card" data-entry-id="${entry.id}"><div class="banner-card-head"><a href="${__ctx.entryHref(entry)}"><strong>${__ctx.escape(entry.name)}</strong></a><span class="tag ${current ? "current-banner" : ""}">${current ? "进行中" : b.end ? "历史记录" : "常驻"}</span></div><div class="banner-period">${b.schedule ? `<span class="banner-schedule" title="${__ctx.escape(b.schedule.basis)}">${__ctx.escape(b.schedule.label)}</span> · ` : ""}${__ctx.escape(entry.type)} · ${__ctx.escape(entry.releaseVersion)} 版本 · ${__ctx.escape(b.start)}${b.end ? " ～ " + __ctx.escape(b.end) : "起 · 持续开放"} <small>${__ctx.escape(b.timeZone)}</small></div>${__ctx.bannerGroups(entry)}${__ctx.pairedBannerHTML(entry)}<a class="banner-source-link" href="${__ctx.entryHref(entry)}">卡池详情与来源 ↗</a></article>`;
  }

  function card(entry) {
    const __ctx = readContext();

    if (["weapons", "sets"].includes(entry.category))
      return __ctx.equipmentCard(entry);
    if (entry.category === "banners" && entry.banner)
      return __ctx.bannerCard(entry);
    return `<a class="entry-card ${__ctx.rarityClass(entry)}" href="/?game=${entry.game}&entry=${encodeURIComponent(entry.id)}" style="${__ctx.tile(entry.game)}" title="${__ctx.escape(entry.name)}">
  <div class="entry-visual">${__ctx.entryImage(entry)}${entry.category === "characters" ? __ctx.elementBadge(entry) : `<span class="type">${__ctx.escape(entry.type || entry.kind || __ctx.categoryLabel(entry.game, entry.category))}</span>`}${entry.category === "characters" ? "" : `<span class="entry-star ${entry.game === "zenless" ? "zzz" : ""}">${entry.game === "zenless" ? __ctx.escape(__ctx.rarityLabel(entry).replace(" 级", "")) : "★".repeat(entry.rarity ?? 0)}</span>`}</div>
  <div class="entry-info"><strong>${__ctx.escape(entry.name)}</strong><div class="entry-tags"><span${entry.category === "characters" ? ' class="entry-element"' : ""}>${entry.category === "characters" ? __ctx.elementBadge(entry) : ""}${__ctx.escape(entry.category === "characters" ? [entry.element, entry.type || __ctx.categoryLabel(entry.game, entry.category)].filter(Boolean).join(" · ") : entry.secondary?.[0] || entry.kind || entry.type || __ctx.categoryLabel(entry.game, entry.category))}</span>${entry.category !== "characters" && entry.rarity ? `<span class="tag">${__ctx.escape(__ctx.rarityLabel(entry))}</span>` : ""}</div>${entry.category === "materials" && !entry.releaseVersion ? "" : `<div class="entry-release"><span>${entry.releaseVersion ? __ctx.escape(entry.releaseVersion) + " 版本" : "版本待确认"}</span></div>`}${entry.category === "materials" ? __ctx.applicabilityHTML(entry) : ""}</div>${__ctx.favorites.has(entry.id) ? '<span class="saved-star" aria-label="已收藏">★</span>' : ""}</a>`;
  }
  return {
    entryImage,
    elementBadge,
    applicabilityHTML,
    weaponStats,
    effectBody,
    equipmentCard,
    bannerGroups,
    pairedBannerHTML,
    bannerCard,
    card,
  };
}
