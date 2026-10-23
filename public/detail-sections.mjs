export function createDetailSections(readContext) {
  function section(id, title, body) {
    const __ctx = readContext();

    return `<section id="${id}"><h2>${title}</h2>${body}</section>`;
  }

  function skillTable(level) {
    const __ctx = readContext();

    return level?.specs?.length
      ? `<div class="data-table-wrap skill-stats"><table class="data-table"><tbody>${level.specs.map((row) => `<tr><th>${__ctx.escape(row.name)}</th><td>${__ctx.escape(row.value)}</td></tr>`).join("")}</tbody></table></div>`
      : "";
  }

  function statsHTML(entry) {
    const __ctx = readContext();

    const rows = entry.statsTable?.length
      ? entry.statsTable
      : entry.stats && Object.keys(entry.stats).length
        ? [{ level: entry.statsLevel ?? "—", ...entry.stats }]
        : [];
    if (!rows.length) return "";
    const keys = ["hp", "attack", "defense", "speed", "secondaryValue"].filter(
        (k) => rows.some((r) => Number.isFinite(r[k])),
      ),
      secondaryName =
        entry.details.facts?.副属性 ??
        entry.details.facts?.突破属性 ??
        "附加属性",
      labels = {
        hp: "生命值",
        attack: "攻击力",
        defense: "防御力",
        speed: "速度",
        secondaryValue: secondaryName,
      };
    const displayStat = (key, value) =>
      value === undefined
        ? "—"
        : key === "secondaryValue"
          ? secondaryName.includes("精通")
            ? Math.round(value)
            : `${Number((value * 100).toFixed(1))}%`
          : value;
    return __ctx.section(
      "stats",
      "基础属性",
      `<details class="stats-fold"><summary>展开基础属性与等级表</summary><div class="data-table-wrap"><table class="data-table"><thead><tr><th>等级</th>${keys.map((k) => `<th>${__ctx.escape(labels[k])}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr><td>${__ctx.escape(r.level)}</td>${keys.map((k) => `<td>${__ctx.escape(displayStat(k, r[k]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="table-note">${entry.category === "characters" ? "不含装备、队伍或战斗增益；突破属性列仅显示突破增加的部分。" : ""}${entry.game === "zenless" && entry.category === "characters" ? "不含核心技强化。" : ""}升级属性根据公开成长数据计算，整数化供查阅；中间突破等级列突破前数值。</p></details>`,
    );
  }

  function skillValues(skill, selected) {
    const __ctx = readContext();

    return (
      __ctx.skillTable(skill.levels?.[selected]) ||
      `<p class="table-note">${__ctx.escape(skill.levels?.[selected]?.description ?? "该天赋没有等级数值。")}</p>`
    );
  }

  function coreStatsHTML(entry) {
    const __ctx = readContext();

    const core = entry.details?.coreStats;
    if (
      entry.game !== "zenless" ||
      entry.category !== "characters" ||
      !core?.rows?.length
    )
      return "";
    const last = core.rows.at(-1),
      value = (n, p) => __ctx.escape(__ctx.formatCoreValue(n, p.unit));
    return __ctx.section(
      "core-stats",
      "核心技强化属性",
      `<details class="stats-fold core-stats-fold"><summary>展开 A–F 各级属性增益 <span class="core-stats-summary">F 级累计：${core.properties.map((p) => __ctx.escape(p.name) + " " + value(last.values[p.id], p)).join(" · ")}</span></summary><div class="data-table-wrap"><table class="data-table core-stats-table"><thead><tr><th>核心技阶段</th><th>解锁等级</th>${core.properties.map((p) => `<th>${__ctx.escape(p.name)}</th>`).join("")}</tr></thead><tbody>${core.rows.map((r) => `<tr><td>${__ctx.escape(r.stage)}</td><td>Lv.${__ctx.escape(r.requiredLevel)}</td>${core.properties.map((p) => `<td><b>${value(r.values[p.id], p)}</b>${r.level ? `<small>本级 ${value(r.gains[p.id], p)}</small>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="table-note">各列为强化到该阶段后的累计属性增益；“本级”为相比上一阶段增加的数值。上方等级属性表未计入这些增益。基础能量自动回复以每秒为单位；属性增益与核心被动的技能效果分别展示。</p></details>`,
    );
  }

  function detailLayoutControl(id, title, { folds = false } = {}) {
    const __ctx = readContext();

    const columns = __ctx.detailColumns(id);
    return `<div class="detail-layout-control"><label>每行 <select class="detail-columns" data-section="${id}" aria-label="${title}每行数量" data-layout-key="${__ctx.detailLayoutKey(id)}">${__ctx.columnOptions(__ctx.layoutSetting(__ctx.detailLayoutKey(id)), 4)}</select></label>${folds ? __ctx.foldButtons(id, title) : ""}</div>`;
  }

  function basicHTML(facts) {
    const __ctx = readContext();

    return __ctx.section(
      "basic",
      "基础资料",
      __ctx.detailLayoutControl("basic", "基础资料") +
        `<div class="basic-table" style="--basic-columns:${__ctx.detailColumns("basic")}" ${__ctx.gridLayout(__ctx.detailLayoutKey("basic"), __ctx.detailBase("basic"), { max: 4, reference: "basic", variable: "basic-columns", minCell: 180 })}>${facts.map(([label, value]) => `<div class="basic-field"><label>${__ctx.escape(label)}</label><span>${__ctx.escape(value)}</span></div>`).join("")}</div>`,
    );
  }

  function skillsHTML(skills, id, title, context = skills) {
    const __ctx = readContext();

    if (!skills?.length) return "";
    return __ctx.section(
      id,
      title,
      __ctx.detailLayoutControl(id, title, { folds: true }) +
        `<div class="skill-grid" style="--skill-columns:${__ctx.detailColumns(id)}" ${__ctx.gridLayout(__ctx.detailLayoutKey(id), 2, { max: 4, minCell: 260, reference: "basic", variable: "skill-columns" })}>${skills
          .map((s, i) => {
            const defaultIndex = s.levels?.findIndex(
                (l) => l.level === (s.type === "普攻" ? 6 : 10),
              ),
              selected =
                defaultIndex >= 0 ? defaultIndex : (s.levels?.length ?? 0) - 1;
            return `<details class="skill-card" id="entry-${id}-${i}"><summary><span>${__ctx.escape(s.name)}</span><span class="skill-type">${__ctx.escape(s.type ?? "")}</span></summary><div class="skill-body"><div class="description-text">${__ctx.skillDescriptionHTML(s.levels?.[selected]?.description ?? s.description, __ctx.skillExplanations(context, s, s.levels?.[selected]?.level), __ctx.escape)}</div><div class="skill-explanations">${__ctx.skillTermsHTML(context, s, selected)}</div>${s.levels?.length ? `<details class="skill-values"><summary>详细数值</summary><div class="skill-level-row"><label>等级 <select class="skill-level-select" data-skill="${i}" data-section="${id}" aria-label="${__ctx.escape(s.name)}等级">${s.levels.map((l, j) => `<option value="${j}" ${j === selected ? "selected" : ""}>${__ctx.escape(l.level)}</option>`).join("")}</select></label></div><div class="skill-value-output">${__ctx.skillValues(s, selected)}</div></details>` : ""}</div></details>`;
          })
          .join("")}</div>`,
    );
  }

  function skillTermsHTML(skills, skill, selected) {
    const __ctx = readContext();

    const terms = __ctx.skillExplanations(
      skills,
      skill,
      skill.levels?.[selected]?.level,
    );
    return terms.length
      ? `<details class="skill-terms"><summary>名词解释 <small>${terms.length} 项</small></summary><div class="skill-term-list">${terms
          .map(
            (term) =>
              `<details class="skill-term" data-term-name="${__ctx.escape(term.name)}"><summary>${__ctx.escape(term.name)}</summary><p class="description-text">${__ctx.skillDescriptionHTML(
                term.description,
                terms.filter((t) => t.name !== term.name),
                __ctx.escape,
              )}</p>${term.skill !== skill.name ? `<small class="term-origin">参照：${__ctx.escape(term.skill)}</small>` : ""}</details>`,
          )
          .join("")}</div></details>`
      : "";
  }

  function effectsHTML(entry) {
    const __ctx = readContext();

    const effects = entry.details?.effects;
    if (!effects?.length) return "";
    const ranks = effects.filter((e) => e.rank);
    return __ctx.section(
      "effects",
      entry.category === "sets" ? "套装效果" : "装备效果",
      ranks.length
        ? `<div class="skill-level-row"><label>${entry.game === "starrail" ? "叠影" : entry.game === "zenless" ? "星级" : "精炼"} <select id="effect-rank" aria-label="装备效果等级">${ranks.map((r, i) => `<option value="${i}">${r.rank}</option>`).join("")}</select></label></div><div id="selected-effect" class="effect-box"><h3>${__ctx.escape(ranks[0].name)}</h3><p>${__ctx.escape(ranks[0].description)}</p></div>`
        : effects
            .map(
              (e) =>
                `<div class="effect-box"><h3>${__ctx.escape(e.name)}</h3><p>${__ctx.escape(e.description)}</p></div>`,
            )
            .join(""),
    );
  }

  function materialsHTML(entry) {
    const __ctx = readContext();

    const groups = entry.details?.materials;
    if (!groups?.length) return "";
    return __ctx.section(
      "materials",
      entry.category === "characters" ? "突破 / 晋阶材料" : "升级材料",
      groups
        .map(
          (g) =>
            `<div class="materials-stage"><h3>${__ctx.escape(g.name)}</h3><div class="materials-grid">${g.items
              .map((item) => {
                const e = __ctx.entries.find((e) => e.id === item.id);
                return `<${e ? "a" : "span"} class="material-pill" ${e ? `href="/?game=${e.game}&entry=${e.id}"` : ""}>${e?.image ? `<img src="${__ctx.escape(e.image)}" alt="" loading="lazy">` : ""}<span>${__ctx.escape(item.name)}</span><b>×${__ctx.escape(item.count)}</b></${e ? "a" : "span"}>`;
              })
              .join("")}</div></div>`,
        )
        .join(""),
    );
  }

  function signatureHTML(entry) {
    const __ctx = readContext();

    if (entry.category !== "weapons") return "";
    const characters = (entry.signatureIds ?? [])
      .map((id) =>
        __ctx.entries.find(
          (e) =>
            e.id === id && e.category === "characters" && e.game === entry.game,
        ),
      )
      .filter(Boolean);
    if (!characters.length) return "";
    return __ctx.section(
      "signature",
      "专武对应角色",
      `<div class="signature-grid">${characters.map((e) => `<a class="signature-card" href="/?game=${e.game}&entry=${e.id}">${e.image ? `<img src="${__ctx.escape(e.image)}" alt="">` : ""}<span>${__ctx.escape(e.name)}</span></a>`).join("")}</div>${entry.signatureNote ? `<p class="table-note">${__ctx.escape(entry.signatureNote)}</p>` : ""}`,
    );
  }

  function historyHTML(entry) {
    const __ctx = readContext();

    if (!["characters", "weapons"].includes(entry.category)) return "";
    const stats = __ctx
      .buildBannerStatistics(__ctx.entries, entry.game)
      .rows.find((r) => r.entry.id === entry.id);
    return stats?.history.length
      ? __ctx.section(
          "banner-history",
          "卡池记录",
          `<div class="entry-up-counts"><span>UP <b>${stats.upCount}</b> 期 / ${stats.upPoolCount} 个池</span><span>可选目标 ${stats.selectableCount} 期</span></div><p><a href="/?game=${entry.game}&category=banners&screen=banner-stats&unit=${entry.id}">查看次数、间隔、版本与池子明细 ↗</a></p><p><a href="/?game=${entry.game}&category=banners&featured=${entry.id}">查看包含 ${__ctx.escape(entry.name)} 的 ${stats.history.length} 条卡池记录 ↗</a></p>`,
        )
      : "";
  }

  function bannerHTML(entry) {
    const __ctx = readContext();

    if (!entry.banner) return "";
    const b = entry.banner;
    return (
      __ctx.section(
        "banner-period",
        "卡池时间",
        `${b.schedule ? `<p><span class="banner-schedule" title="${__ctx.escape(b.schedule.basis)}">${__ctx.escape(b.schedule.label)}</span></p>` : ""}<p>${__ctx.escape(b.start)}${b.end ? " ～ " + __ctx.escape(b.end) : "起，持续开放"}（${__ctx.escape(b.timeZone)}）</p><p class="table-note">${__ctx.escape(b.note ?? "记录当期提升概率或可选择的角色与装备；普通卡池内容以当期游戏公告为准。")}</p>`,
      ) +
      __ctx.section(
        "banner-pool",
        "卡池内容",
        __ctx.bannerGroups(entry) + __ctx.pairedBannerHTML(entry),
      )
    );
  }

  function materialUsageDetail(entry, usage) {
    const __ctx = readContext();

    return __ctx.section(
      "material-usage",
      "材料用途反查",
      __ctx.applicabilityHTML(entry) +
        __ctx.materialUsageHTML(entry, usage, __ctx.escape),
    );
  }
  return {
    section,
    skillTable,
    statsHTML,
    skillValues,
    coreStatsHTML,
    detailLayoutControl,
    basicHTML,
    skillsHTML,
    skillTermsHTML,
    effectsHTML,
    materialsHTML,
    signatureHTML,
    historyHTML,
    bannerHTML,
    materialUsageDetail,
  };
}
