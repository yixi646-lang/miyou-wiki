import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { installDOM } from "./helpers/dom-environment.mjs";
const options = { skip: !process.env.WIKI_TEST_DOM_PACKAGE };
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier.startsWith("/shared/")
        ? new URL("../shared/" + specifier.slice(8), import.meta.url).href
        : specifier,
      context,
    );
  },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const entry = (id, name) => ({
  id,
  name,
  game: "zenless",
  category: "characters",
  rarity: 5,
  type: "强攻",
  element: "火属性",
  revision: 1,
  sources: [],
  statsLevel: 60,
  statsTable: [{ level: 60, attack: id === "a" ? 200 : 300 }],
  details: {
    skills: [{ name: "烈风", description: "提高烈风灼烧伤害。" }],
    upgrades: [],
    facts: { 生日: "1月1日" },
  },
});

test('术语浮层组合筛选、中文输入、选择及离开清理保持正常', options, async () => {
  const dom = await installDOM();
  const { mountMechanisms, disposeMechanisms } = await import('../public/mechanisms.mjs');
  const create = dom.document.createElement.bind(dom.document);
  let active;
  Object.defineProperty(dom.document, 'activeElement', { configurable:true, get:() => active });
  dom.window.HTMLElement.prototype.focus = function () { active = this; };
  dom.document.createElement = tag => {
    const node = create(tag);
    if (tag === 'dialog') {
      Object.defineProperty(node,'open',{get:() => node.hasAttribute('open')});
      node.showModal = () => node.setAttribute('open','');
      node.close = () => { node.removeAttribute('open'); node.dispatchEvent(new dom.window.Event('close')); };
    }
    return node;
  };
  const entries = [
    { ...entry('old','甲'), releaseVersion:'1.0', element:'冰', type:'支援' },
    { ...entry('new','乙'), releaseVersion:'3.3', rarity:4, element:'火', type:'强攻' },
    { ...entry('third','丙'), releaseVersion:'3.2', element:'火', type:'支援' },
  ];
  const term = (id, owner) => ({id,name:id,description:'持续伤害',scope:'角色技能',related:[{id:owner.id,name:owner.name,element:owner.element,href:'/?entry='+owner.id}]});
  const records = [{id:'common',name:'通用伤害',description:'伤害规则',scope:'通用机制',related:[]},...entries.map(item => term(item.id,item))];
  const q = selector => dom.document.querySelector(selector);
  const click = selector => q(selector).dispatchEvent(new dom.window.Event('click',{bubbles:true}));
  const mount = () => mountMechanisms({host:q('main'),game:'zenless',entries,api:async () => ({mechanisms:records})});
  try {
    dom.document.body.style.overflow = 'auto';
    await mount();
    assert.deepEqual([...dom.document.querySelectorAll('.mechanism-record')].map(item => item.id),['common','new','third','old']);
    click('[data-mechanism-element="火"]');
    assert.equal(dom.document.querySelectorAll('.mechanism-record').length,2);
    click('[data-mechanism-reset]');
    q('[data-mechanism-character-open]').focus();
    click('[data-mechanism-character-open]');
    assert.equal(q('dialog').open,true);
    assert.equal(dom.document.body.style.overflow,'hidden');
    click('[data-picker-filter="elements"][data-value="火"]');
    assert.equal(dom.document.querySelectorAll('[data-picker-character]').length,2);
    click('[data-picker-filter="rarities"][data-value="5"]');
    assert.deepEqual([...dom.document.querySelectorAll('[data-picker-character]')].map(item => item.dataset.pickerCharacter),['third']);
    click('[data-picker-reset]');
    click('[data-picker-filter="types"][data-value="支援"]');
    const search = q('[data-picker-search]');
    search.dispatchEvent(new dom.window.Event('compositionstart',{bubbles:true}));
    search.value = '甲'; search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    assert.equal(dom.document.querySelectorAll('[data-picker-character]').length,2);
    search.dispatchEvent(new dom.window.Event('compositionend',{bubbles:true}));
    assert.equal(dom.document.querySelectorAll('[data-picker-character]').length,1);
    click('[data-picker-character="old"]');
    assert.equal(q('dialog'),null);
    assert.equal(dom.document.body.style.overflow,'auto');
    assert.equal(active,q('[data-mechanism-character-open]'));
    assert.equal(q('.mechanism-record').id,'old');
    click('[data-mechanism-reset]');
    q('[data-mechanism-sort]').value = 'name';
    q('[data-mechanism-sort]').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    assert.equal(q('.mechanism-group-heading'),null);
    await mount();
    assert.equal(q('[data-mechanism-sort]').value,'name');
    click('[data-mechanism-character-open]');
    q('dialog').dispatchEvent(new dom.window.Event('cancel',{cancelable:true}));
    assert.equal(q('dialog'),null);
    click('[data-mechanism-character-open]');
    disposeMechanisms();
    assert.equal(q('dialog'),null);
    assert.equal(dom.document.body.style.overflow,'auto');
  } finally { disposeMechanisms(); dom.restore(); }
});

test('版本范围折叠按钮跟随范围标题，仅控制内容', options, async () => {
  const dom = await installDOM('<html><body><main><div class="version-returnee-heading"><h2>6.6 之后 → 7.1</h2><div data-page-fold-target></div></div><details id="content"><summary>版本</summary><p>内容</p></details><div data-disclosure-ignore><details id="filter"><summary>筛选</summary></details></div></main></body></html>');
  const previous = globalThis.MutationObserver;
  globalThis.MutationObserver = class { observe() {} };
  try {
    const { installDisclosureControls } = await import('../public/disclosures.mjs');
    installDisclosureControls(dom.document.querySelector('main'));
    const controls = dom.document.querySelector('[data-page-fold-controls]');
    assert.equal(controls.parentElement,dom.document.querySelector('[data-page-fold-target]'));
    assert.equal(controls.querySelector('span'),null);
    controls.querySelector('[data-fold="expand"]').dispatchEvent(new dom.window.Event('click',{bubbles:true}));
    assert.equal(dom.document.querySelector('#content').open,true);
    assert.equal(Boolean(dom.document.querySelector('#filter').open),false);
    controls.querySelector('[data-fold="collapse"]').dispatchEvent(new dom.window.Event('click',{bubbles:true}));
    assert.equal(dom.document.querySelector('#content').open,false);
  } finally {
    if (previous === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = previous;
    dom.restore();
  }
});

test(
  "搜索正文显示命中片段，直达技能并展开",
  options,
  async () => {
    const dom = await installDOM(
      '<html><head></head><body><main></main></body></html>',
    );
    try {
      const [
        { mountUnifiedSearch },
        { buildResearchIndex },
        { revealSearchTarget },
      ] = await Promise.all([
        import("../public/unified-search.mjs"),
        import("../shared/research-index.mjs"),
        import("../public/search-target.mjs"),
      ]);
      const host = dom.document.querySelector("main"),
        entries = [entry("a", "测试角色")];
      await mountUnifiedSearch({
        host,
        game: "zenless",
        gameName: "绝区零",
        entries,
        query: "烈风灼烧",
        loadCatalog: async () => entries,
        loadResearch: async () => ({
          ...buildResearchIndex(entries, {}, "zenless"),
          signature: "v1",
        }),
        loadVersions: async () => ({ versions: [] }),
        loadArtwork: async () => ({ images: {} }),
        renderEntry: (item) => '<a class="entry-card">' + item.name + "</a>",
      });
      const hit = host.querySelector(".search-hit");
      assert(hit);
      assert.match(hit.href, /#entry-skills-0$/);
      assert.match(hit.textContent, /烈风灼烧/);
      host.innerHTML =
        '<details id="entry-skills-0"><summary>技能</summary><p>烈风灼烧</p></details>';
      assert(revealSearchTarget(host, "#entry-skills-0"));
      assert.equal(host.querySelector("details").open, true);
    } finally {
      dom.restore();
    }
  },
);

test(
  "编辑通知保留草稿，409展示差异，按选择合并后使用最新修订保存",
  options,
  async () => {
    const dom = await installDOM(
      "<html><head></head><body><dialog></dialog></body></html>",
    );
    let editor;
    try {
      const { createEntryEditor } = await import("../public/entry-editor.mjs"),
        dialog = dom.document.querySelector("dialog");
      Object.defineProperty(dialog, "open", {
        get: () => dialog.hasAttribute("open"),
      });
      dialog.showModal = () => dialog.setAttribute("open", "");
      dialog.close = () => dialog.removeAttribute("open");
      let latest = entry("a", "原名"),
        saved;
      const api = async (path, request = {}) => {
        if (request.method === "PATCH") {
          if (request.body.revision !== latest.revision)
            throw Object.assign(Error("发生冲突"), {
              status: 409,
              current: structuredClone(latest),
            });
          latest = { ...request.body.entry, revision: latest.revision + 1 };
          return latest;
        }
        return structuredClone(latest);
      };
      editor = createEntryEditor({
        dialog,
        api,
        state: { game: "zenless", category: "characters" },
        getEntries: () => [latest],
        getGeneration: () => 1,
        toast: (message) => assert.fail(message),
        onSaved: async (result) => {
          saved = result;
        },
      });
      await editor.openEditor("a");
      dialog.querySelector("[name=name]").value = "本页草稿";
      editor.closeEditor();
      await editor.openEditor("a");
      assert.equal(dialog.querySelector("[name=name]").value, "本页草稿");
      latest = { ...latest, name: "远端名称", revision: 2 };
      dom.channels[0].onmessage({
        data: { id: "a", game: "zenless", revision: 2 },
      });
      await tick();
      assert.match(
        dialog.querySelector("[data-editor-update]").textContent,
        /草稿已保留/,
      );
      assert.equal(dialog.querySelector("[name=name]").value, "本页草稿");
      dialog
        .querySelector("form")
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
      await tick();
      assert(
        dialog.querySelector("[data-editor-choice]"),
        dialog.querySelector("#editor-error").textContent,
      );
      assert.equal(dialog.querySelector("[name=name]").value, "本页草稿");
      dialog.querySelector("[data-editor-merge]").click();
      assert.equal(dialog.querySelector("[name=name]").value, "本页草稿");
      dialog
        .querySelector("form")
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
      await tick();
      assert.equal(saved.name, "本页草稿");
      assert.equal(saved.revision, 3);
      assert.equal(dialog.open, false);
    } finally {
      editor?.dispose();
      dom.restore();
    }
  },
);
