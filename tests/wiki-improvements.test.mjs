import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { openLibrary } from "../lib/database.mjs";
import {
  createPublicJSONCache,
  staticCacheHeaders,
  notModified,
} from "../lib/http-cache.mjs";
import {
  buildResearchIndex,
  fullTextSections,
} from "../shared/research-index.mjs";
import {
  buildSearchDocuments,
  searchDocuments,
  createSearchDocumentCache,
  prepareSearchDocuments,
} from "../shared/unified-search.mjs";
import {
  mergeEntryDraft,
  resolveEntryConflicts,
} from "../shared/entry-merge.mjs";

const source = {
  name: "正式版技能",
  url: "https://static.nanoka.cc/zzz/3.3/zh/character/1641.json",
};
const character = (id = "a", extra = {}) => ({
  id,
  game: "zenless",
  category: "characters",
  name: id,
  rarity: 5,
  releaseVersion: "3.3",
  sources: [source],
  details: {
    skills: [
      {
        name: "灼光",
        description: "触发火属性异常并提高灼烧伤害。",
        terms: [
          { name: "灼烧", description: "满足条件后持续造成火伤害。", source },
        ],
      },
    ],
    upgrades: [{ name: "余烬", description: "技能持续时间延长。" }],
  },
  ...extra,
});

test("全文命中技能、影画与解释，结果定位并保留旅行者元素方案", () => {
  const entry = character(),
    research = buildResearchIndex(
      [entry],
      {
        common: {
          zenless: [{ name: "灼烧", description: "持续造成火伤害。", source }],
        },
        characters: {},
      },
      "zenless",
    );
  const documents = buildSearchDocuments({
    game: "zenless",
    entries: [entry],
    research,
  });
  const skill = searchDocuments(documents, "火属性异常", {
    type: "characters",
  })[0];
  assert.equal(skill.id, "a");
  assert.match(skill.href, /#entry-skills-0$/);
  assert.equal(skill.matchedSection, "灼光");
  assert.match(skill.excerpt, /火属性异常/);
  assert.match(
    searchDocuments(documents, "持续时间延长", { type: "characters" })[0].href,
    /#entry-upgrades-0$/,
  );
  assert(
    searchDocuments(documents, "持续造成火伤害", { type: "mechanisms" }).length,
  );
  assert(
    research.mechanisms.every(
      (item) =>
        item.game === "zenless" && item.sources.length && item.description,
    ),
  );
  const traveler = character("t", {
    game: "genshin",
    details: {
      traveler: {
        elements: {
          冰: {
            skills: [{ name: "冰潮", description: "冻结波纹" }],
            upgrades: [],
          },
        },
      },
    },
  });
  const sections = fullTextSections(traveler);
  assert.equal(sections[0].element, "冰");
  const result = searchDocuments(
    buildSearchDocuments({
      game: "genshin",
      entries: [traveler],
      research: { entries: [{ id: "t", sections }] },
    }),
    "冻结波纹",
  )[0];
  assert.match(result.href, /element=/);
  assert.match(result.href, /#entry-skills-0$/);
});

test("索引复用规范化结果，资料修订后重新构建，不跨版本复用旧文档", () => {
  const cache = createSearchDocumentCache({ capacity: 2 });
  let calls = 0;
  const build = () => {
    calls++;
    return buildSearchDocuments({ game: "zenless", entries: [character()] });
  };
  const first = cache.get("zenless:1", build);
  assert.equal(cache.get("zenless:1", build), first);
  assert.equal(calls, 1);
  assert.equal(prepareSearchDocuments(first), prepareSearchDocuments(first));
  assert.notEqual(cache.get("zenless:2", build), first);
  assert.equal(calls, 2);
  cache.get("genshin:1", build);
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("公共响应支持 ETag 与 Last-Modified，条件命中不发送正文", () => {
  const respond = createPublicJSONCache(),
    response = () => ({
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        this.body = body;
      },
    });
  let res = response();
  respond({ headers: {}, method: "GET" }, res, "catalog", "1", { entries: [] });
  assert.equal(res.status, 200);
  const etag = res.headers.ETag;
  res = response();
  respond(
    { headers: { "if-none-match": etag }, method: "GET" },
    res,
    "catalog",
    "1",
    () => {
      throw Error("不应重复构建");
    },
  );
  assert.equal(res.status, 304);
  assert.equal(res.body, undefined);
  res = response();
  respond(
    { headers: { "if-none-match": etag }, method: "GET" },
    res,
    "catalog",
    "2",
    { entries: [1] },
  );
  assert.equal(res.status, 200);
  assert.notEqual(res.headers.ETag, etag);
  const info = { size: 12, mtimeMs: 1000, mtime: new Date(1000) },
    headers = staticCacheHeaders(info);
  assert(
    notModified(
      { headers: { "if-modified-since": headers["Last-Modified"] } },
      headers.ETag,
      info.mtime,
    ),
  );
  assert(
    !notModified(
      {
        headers: {
          "if-none-match": '"different"',
          "if-modified-since": new Date(999999).toUTCString(),
        },
      },
      headers.ETag,
      info.mtime,
    ),
  );
});

test("初始化清单跳过无变化读取，新批次只新增且保留本地编辑与收藏", async () => {
  const base = resolve(".codex_tmp");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, "wiki-improvement-tests-")),
    db = openLibrary(":memory:");
  try {
    await writeFile(
      join(directory, "batch.json"),
      JSON.stringify({ entries: [character()] }),
    );
    assert.equal(db.seed(directory), 1);
    assert.equal(db.seedReport.filesRead, 1);
    const entry = db.get("a");
    db.update("a", { ...entry, name: "本地编辑" }, entry.revision);
    db.favorite("a", true);
    assert.equal(db.seed(directory), 0);
    assert.equal(db.seedReport.mode, "manifest-hit");
    assert.equal(db.seedReport.bytesRead, 0);
    await writeFile(
      join(directory, "extra.json"),
      JSON.stringify({ entries: [character("b")] }),
    );
    assert.equal(db.seed(directory), 1);
    assert.equal(db.get("a").name, "本地编辑");
    assert.deepEqual(db.favorites(), ["a"]);
    await writeFile(join(directory, "bad.json"), "invalid json");
    assert.throws(() => db.seed(directory));
    assert.equal(db.get("a").name, "本地编辑");
  } finally {
    db.close();
    assert(directory.startsWith(base + sep));
    await rm(directory, { recursive: true, force: true });
  }
});

test("并发编辑三方合并保留草稿、远端新增字段与逐字段选择", () => {
  const base = {
    id: "a",
    name: "原名",
    revision: 1,
    details: { summary: "原文", facts: { 生日: "1月1日" } },
    sources: [],
  };
  const mine = {
      ...structuredClone(base),
      name: "本页名称",
      details: { ...base.details, summary: "本页文字" },
    },
    theirs = {
      ...structuredClone(base),
      revision: 2,
      details: {
        summary: "远端文字",
        facts: { 生日: "2月2日" },
        extension: { keep: true },
      },
      newField: 3,
    };
  const result = mergeEntryDraft(base, mine, theirs);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].path, ["details", "summary"]);
  assert.equal(result.merged.name, "本页名称");
  assert.equal(result.merged.details.facts.生日, "2月2日");
  assert.equal(result.merged.newField, 3);
  const resolved = resolveEntryConflicts(result, {
    [JSON.stringify(["details", "summary"])]: "theirs",
  });
  assert.equal(resolved.details.summary, "远端文字");
  assert.equal(resolved.details.extension.keep, true);
  assert.equal(resolved.revision, 2);
  assert.equal(mine.details.summary, "本页文字");
});

test("清单完成记录只应用一次，保留已有勾选和手动取消", async () => {
  const { runInNewContext } = await import("node:vm");
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(
      new URL("../docs/Wiki改进候选清单.html", import.meta.url),
      "utf8",
    ),
    DATA = JSON.parse(
      html.match(
        /<script id="checklist-data" type="application\/json">([\s\S]*?)<\/script>/,
      )[1],
    ),
    code = html.slice(
      html.indexOf("function applyCompletionUpdates(){"),
      html.indexOf("function filteredItems(){"),
    );
  const state = { completed: { 34: true }, appliedUpdates: [] };
  let saved = 0;
  const context = {
    DATA,
    state,
    ALL_IDS: new Set(DATA.items.map((item) => item.id)),
    save: () => saved++,
  };
  runInNewContext(code + ";applyCompletionUpdates();", context);
  assert.equal(Object.keys(state.completed).length, 13);
  assert.equal(state.completed["34"], true);
  delete state.completed["01"];
  runInNewContext("applyCompletionUpdates();", context);
  assert.equal(state.completed["01"], undefined);
  assert.equal(saved, 1);
});
