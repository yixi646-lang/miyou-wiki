import { GAMES, CATEGORIES } from "/shared/catalog.mjs";
import { focusNameInput } from "/shared/name-input.mjs";
import {
  mergeEntryDraft,
  resolveEntryConflicts,
} from "/shared/entry-merge.mjs";
import { escapeHTML as escape } from "./ui-controls.mjs";

export function createEntryEditor({
  dialog,
  api,
  state,
  getEntries,
  getGeneration,
  onSaved,
  onExternalChange = () => {},
  toast,
}) {
  const $ = (selector) => dialog.querySelector(selector);
  let editorEntry = null,
    editorInitial = "",
    editorGeneration = 0,
    draftTimer,
    remoteEntry = null,
    mergeResult = null;
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("wiki-entry-updates-v1")
      : null;
  const storageKey = "wiki-entry-change-v1";
  const draftKey = () =>
    "wiki-entry-draft-v1:" +
    (editorEntry?.id ?? "new:" + state.game + ":" + state.category);
  function saveDraft() {
    const form = $("#editor-form");
    if (!dialog.open || !form) return;
    try {
      sessionStorage.setItem(
        draftKey(),
        JSON.stringify({
          base: editorEntry,
          fields: Object.fromEntries(new FormData(form)),
        }),
      );
    } catch {}
  }
  function removeDraft() {
    try {
      sessionStorage.removeItem(draftKey());
    } catch {}
  }
  function restoreDraft(entry) {
    try {
      const data = JSON.parse(sessionStorage.getItem(draftKey()) ?? "null");
      if (!data?.fields) return;
      for (const [name, value] of Object.entries(data.fields)) {
        const field = $("#editor-form").elements.namedItem(name);
        if (field && typeof value === "string") field.value = value;
      }
      editorEntry = data.base ?? entry;
      if (entry && entry.revision !== editorEntry.revision) showUpdate(entry);
      else {
        const notice = $("[data-editor-update]");
        notice.hidden = false;
        notice.textContent = "已恢复本页未保存的草稿。";
      }
    } catch {}
  }
  function publish(entry) {
    const message = {
      id: entry.id,
      game: entry.game,
      revision: entry.revision,
      at: Date.now(),
    };
    channel?.postMessage(message);
    try {
      localStorage.setItem(storageKey, JSON.stringify(message));
    } catch {}
  }
  async function receive(message) {
    if (!message?.id || !Number.isInteger(message.revision)) return;
    onExternalChange(message);
    if (
      dialog.open &&
      editorEntry?.id === message.id &&
      editorEntry.revision < message.revision
    ) {
      try {
        showUpdate(await api("entries/" + encodeURIComponent(message.id)));
      } catch {}
    }
  }
  if (channel)
    channel.onmessage = (event) => {
      void receive(event.data);
    };
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey)
      try {
        void receive(JSON.parse(event.newValue));
      } catch {}
  });
  window.addEventListener("focus", () => {
    if (dialog.open && editorEntry)
      void api("entries/" + encodeURIComponent(editorEntry.id))
        .then((latest) => {
          if (latest.revision > editorEntry.revision) showUpdate(latest);
        })
        .catch(() => {});
  });
  dialog.addEventListener("input", () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 250);
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dialog.open || !$("#editor-form")) return;
    saveDraft();
    if (
      JSON.stringify([...new FormData($("#editor-form"))]) !== editorInitial
    ) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  function showUpdate(latest) {
    remoteEntry = latest;
    const notice = $("[data-editor-update]");
    if (!notice) return;
    notice.hidden = false;
    notice.innerHTML =
      '其他页面已更新此条目，本页草稿已保留。 <button type="button" class="button-secondary" data-editor-review>查看差异</button>';
    saveDraft();
  }
  function readPayload() {
    const entries = getEntries();
    const form = $("#editor-form");
    const f = Object.fromEntries(new FormData(form)),
      details = JSON.parse(f.details || "{}");
    if (!details || typeof details !== "object" || Array.isArray(details))
      throw new Error("详情 JSON 须为对象。");
    const initial = editorEntry?.details ?? {},
      summaryChanged = f.summary !== (initial.summary ?? "");
    if (summaryChanged || !editorEntry) details.summary = f.summary.trim();
    if (
      f.acquisition !== (initial.acquisition ?? []).join("\n") ||
      !editorEntry
    )
      details.acquisition = f.acquisition
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    const split = (value) =>
      value
        .split(/[，,]/)
        .map((v) => v.trim())
        .filter(Boolean);
    const sources = f.sources
      .split("\n")
      .filter((v) => v.trim())
      .map((line) => {
        const index = line.indexOf("|"),
          url = (index < 0 ? line : line.slice(index + 1)).trim(),
          name = index < 0 ? "资料来源" : line.slice(0, index).trim();
        return {
          ...(editorEntry?.sources ?? []).find((source) => source.url === url),
          name,
          url,
        };
      });
    const signatureIds = f.category === "weapons" ? split(f.signatureIds) : [];
    for (const id of signatureIds) {
      const char = entries.find(
        (e) => e.id === id && e.category === "characters" && e.game === f.game,
      );
      if (!char) throw new Error(`专武角色编号不存在或游戏不匹配：${id}`);
    }
    const payload = {
      ...(editorEntry ?? {}),
      game: f.game,
      category: f.category,
      name: f.name.trim(),
      rarity: f.rarity ? Number(f.rarity) : null,
      element: f.element.trim() || null,
      type: f.type.trim() || null,
      region: f.region.trim() || null,
      kind: f.kind.trim() || null,
      releaseVersion: f.releaseVersion.trim() || null,
      releaseDate: f.releaseDate || null,
      secondary: split(f.secondary),
      aliases: split(f.aliases),
      sources,
      details,
      signatureIds,
      origin: editorEntry ? "edited" : "local",
    };
    if (f.category === "banners") {
      payload.banner = JSON.parse(f.banner);
      for (const g of payload.banner.groups ?? [])
        for (const item of g.items ?? [])
          if (
            item.id &&
            !entries.some((e) => e.id === item.id && e.game === f.game)
          )
            throw new Error("卡池关联条目不存在或游戏不匹配：" + item.id);
    } else delete payload.banner;
    if (
      editorEntry &&
      (f.game !== editorEntry.game || f.category !== editorEntry.category)
    ) {
      delete payload.image;
      delete payload.imageRemote;
      delete payload.stats;
      delete payload.statsTable;
      delete payload.statsLevel;
    }

    return payload;
  }
  function field(label, name, value = "", type = "text", full = false) {
    return `<label class="form-field ${full ? "full" : ""}"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${name === "name" ? 'required maxlength="120"' : ""}></label>`;
  }
  function selectField(label, name, options, value) {
    return `<label class="form-field"><span>${label}</span><select name="${name}">${options.map(([key, text]) => `<option value="${escape(key)}" ${String(value) === String(key) ? "selected" : ""}>${escape(text)}</option>`).join("")}</select></label>`;
  }
  async function openEditor(id) {
    const request = ++editorGeneration,
      pageGeneration = getGeneration();
    try {
      const entry = id ? await api(`entries/${id}`) : null;
      if (request !== editorGeneration || pageGeneration !== getGeneration())
        return;
      editorEntry = entry;
      const e = editorEntry ?? {
        game: state.game === "all" ? "genshin" : state.game,
        category: state.category === "all" ? "characters" : state.category,
        details: {},
      };
      dialog.innerHTML = `<form id="editor-form"><div class="dialog-header"><h2 id="editor-title">${id ? "编辑条目" : "新增条目"}</h2><button type="button" data-action="close-editor" aria-label="关闭编辑">×</button></div><div class="dialog-body"><div data-editor-update hidden></div><div data-editor-conflict></div><div class="editor-grid">${field("名称", "name", e.name)}${selectField(
        "游戏",
        "game",
        Object.entries(GAMES).map(([k, v]) => [k, v.name]),
        e.game,
      )}${selectField("资料类别", "category", Object.entries(CATEGORIES), e.category)}${selectField(
        "稀有度 / 等级",
        "rarity",
        [
          ["", "未标注"],
          ["5", "5 星 / S 级"],
          ["4", "4 星 / A 级"],
          ["3", "3 星 / B 级"],
          ["2", "2 星"],
          ["1", "1 星"],
        ],
        e.rarity ?? "",
      )}${field("元素 / 属性", "element", e.element)}${field("武器类型 / 命途 / 特性", "type", e.type)}${field("地区 / 阵营", "region", e.region)}${field("分类", "kind", e.kind)}${field("实装版本", "releaseVersion", e.releaseVersion)}${field("实装日期", "releaseDate", e.releaseDate, "date")}${field("副属性（用逗号分隔）", "secondary", e.secondary?.join("，"))}${field("别名（用逗号分隔）", "aliases", e.aliases?.join("，"))}<label class="form-field full"><span>简介</span><textarea name="summary" rows="3">${escape(e.details?.summary ?? "")}</textarea></label><label class="form-field full"><span>获取渠道（每行一项）</span><textarea name="acquisition" rows="3">${escape((e.details?.acquisition ?? []).join("\n"))}</textarea></label><label class="form-field full"><span>资料来源（每行：来源名称 | 链接）</span><textarea name="sources" rows="3">${escape((e.sources ?? []).map((s) => `${s.name ?? "资料来源"} | ${s.url}`).join("\n"))}</textarea></label></div><p class="form-help">未知的版本与日期可以留空。保存后立即写入本地数据库。</p><details class="editor-advanced"><summary>详细资料与专武关系</summary><label class="form-field full"><span>详情 JSON（技能、套装效果、突破材料等）</span><textarea class="json-field" name="details" rows="10" spellcheck="false">${escape(JSON.stringify(e.details ?? {}, null, 2))}</textarea></label><label class="form-field full"><span>专武对应角色编号（用逗号分隔；仅武器类生效）</span><input name="signatureIds" value="${escape(e.signatureIds?.join(",") ?? "")}"></label><p class="form-help">不填则不显示专武对应角色模块。角色编号可在条目页面地址中找到。</p><label class="form-field full banner-editor" ${e.category !== "banners" ? "hidden" : ""}><span>卡池记录 JSON（起止时间与当期条目）</span><textarea class="json-field" name="banner" rows="8">${escape(JSON.stringify(e.banner ?? { start: e.releaseDate ? e.releaseDate + " 10:00:00" : "", end: null, timeZone: "服务器时间", groups: [] }, null, 2))}</textarea></label></details><p class="form-error" id="editor-error" role="alert"></p></div><div class="dialog-footer"><button type="button" class="button-secondary" data-action="close-editor">取消</button><button class="button-primary" type="submit">保存条目</button></div></form>`;
      dialog.showModal();
      editorInitial = JSON.stringify([...new FormData($("#editor-form"))]);
      restoreDraft(entry);
      focusNameInput(dialog.querySelector("[name=name]"));
    } catch (error) {
      if (request === editorGeneration && pageGeneration === getGeneration())
        toast(error.message);
    }
  }
  function closeEditor() {
    saveDraft();
    const form = $("#editor-form");
    if (
      form &&
      JSON.stringify([...new FormData(form)]) !== editorInitial &&
      !confirm("尚有未保存的修改，确定关闭编辑吗？")
    )
      return;
    ++editorGeneration;
    dialog.close();
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });
  dialog.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target,
      save = form.querySelector("[type=submit]");
    save.disabled = true;
    $("#editor-error").textContent = "";
    try {
      const payload = readPayload();
      const result = editorEntry
        ? await api(`entries/${editorEntry.id}`, {
            method: "PATCH",
            body: { entry: payload, revision: editorEntry.revision },
          })
        : await api("entries", { method: "POST", body: payload });
      removeDraft();
      publish(result);
      dialog.close();
      await onSaved(result);
    } catch (error) {
      $("#editor-error").textContent = error.message;
      if (error.status === 409 && error.current) showMerge(error.current);
    } finally {
      save.disabled = false;
    }
  });

  function showMerge(latest) {
    try {
      const mine = readPayload();
      remoteEntry = latest;
      mergeResult = mergeEntryDraft(editorEntry, mine, latest);
      showUpdate(latest);
      const rows = mergeResult.conflicts.length
        ? mergeResult.conflicts
        : mergeResult.changes;
      $("[data-editor-conflict]").innerHTML =
        '<div class="editor-conflict"><table><thead><tr><th>字段</th><th>打开时</th><th>本页草稿</th><th>最新资料</th><th>选择</th></tr></thead><tbody>' +
        rows
          .map(
            (row, index) =>
              "<tr><th>" +
              escape(row.path.join(".")) +
              "</th>" +
              [row.base, row.mine, row.theirs]
                .map(
                  (value) =>
                    "<td><details><summary>查看内容</summary><pre>" +
                    escape(
                      value === undefined
                        ? "（未设置）"
                        : typeof value === "string"
                          ? value
                          : JSON.stringify(value, null, 2),
                    ) +
                    "</pre></details></td>",
                )
                .join("") +
              "<td>" +
              (mergeResult.conflicts.length
                ? '<select data-editor-choice="' +
                  index +
                  '"><option value="mine">保留草稿</option><option value="theirs">采用最新</option></select>'
                : "自动合并") +
              "</td></tr>",
          )
          .join("") +
        '</tbody></table></div><div class="editor-conflict-actions"><button class="button-secondary" type="button" data-editor-merge>合并到草稿</button><span class="table-note">合并后仍需点击“保存条目”。</span></div>';
    } catch (error) {
      $("#editor-error").textContent =
        "请先修正草稿格式，再比较差异：" + error.message;
    }
  }
  function fillFields(entry) {
    const values = {
      name: entry.name,
      game: entry.game,
      category: entry.category,
      rarity: entry.rarity ?? "",
      element: entry.element ?? "",
      type: entry.type ?? "",
      region: entry.region ?? "",
      kind: entry.kind ?? "",
      releaseVersion: entry.releaseVersion ?? "",
      releaseDate: entry.releaseDate ?? "",
      secondary: (entry.secondary ?? []).join("，"),
      aliases: (entry.aliases ?? []).join("，"),
      summary: entry.details?.summary ?? "",
      acquisition: (entry.details?.acquisition ?? []).join("\n"),
      sources: (entry.sources ?? [])
        .map((source) => source.name + " | " + source.url)
        .join("\n"),
      details: JSON.stringify(entry.details ?? {}, null, 2),
      signatureIds: (entry.signatureIds ?? []).join(","),
      banner: JSON.stringify(entry.banner ?? {}, null, 2),
    };
    for (const [name, value] of Object.entries(values)) {
      const field = $("#editor-form").elements.namedItem(name);
      if (field) field.value = value;
    }
  }
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-editor-review]")) showMerge(remoteEntry);
    if (
      event.target.closest("[data-editor-merge]") &&
      mergeResult &&
      remoteEntry
    ) {
      const choices = {};
      for (const select of dialog.querySelectorAll("[data-editor-choice]"))
        choices[
          JSON.stringify(
            mergeResult.conflicts[Number(select.dataset.editorChoice)].path,
          )
        ] = select.value;
      const merged = resolveEntryConflicts(mergeResult, choices);
      editorEntry = remoteEntry;
      fillFields(remoteEntry);
      editorInitial = JSON.stringify([...new FormData($("#editor-form"))]);
      fillFields(merged);
      $("[data-editor-conflict]").innerHTML = "";
      $("[data-editor-update]").hidden = true;
      $("#editor-error").textContent = "";
      saveDraft();
    }
  });
  return {
    openEditor,
    closeEditor,
    dispose() {
      clearTimeout(draftTimer);
      channel?.close();
    },
  };
}
