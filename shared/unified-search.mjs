import { categoryLabel, isExcludedEntry } from "./catalog.mjs";
import { isLocalImage } from "./asset-image.mjs";

export const SEARCH_TYPES = {
  all: "全部",
  characters: "角色",
  weapons: "武器类装备",
  sets: "套装类装备",
  materials: "材料",
  banners: "历史卡池",
  versions: "版本档案",
  artwork: "立绘",
  mechanisms: "机制与术语",
};
export const SEARCH_SORTS = {
  relevance: "相关度",
  name: "名称",
  release: "登场时间",
  rarity: "稀有度",
};
const collator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase();
const textOf = (value) =>
  Array.isArray(value)
    ? value.map(textOf).join(" ")
    : value && typeof value === "object"
      ? Object.values(value).map(textOf).join(" ")
      : String(value ?? "");
const link = (game, params) => "/?" + new URLSearchParams({ game, ...params });
const versionText = (v) =>
  textOf([
    v.version,
    v.title,
    v.alias,
    v.releaseDate,
    v.sections?.map((s) => [s.label, s.items]),
    v.maintenance,
  ]);

export function buildSearchDocuments({
  game,
  entries = [],
  versions = [],
  artwork = {},
  research = {},
}) {
  const documents = entries
    .filter((e) => e.game === game && !isExcludedEntry(e))
    .map((e) => ({
      type: "entries",
      category: e.category,
      game,
      id: e.id,
      title: e.name,
      aliases: e.aliases ?? [],
      rarity: e.rarity ?? null,
      label: categoryLabel(game, e.category),
      href: link(game, { entry: e.id }),
      description: textOf([
        e.element,
        e.type,
        e.region,
        e.kind,
        e.secondary,
        e.releaseVersion,
        e.tags,
        e.acquisitionChannels,
        e.banner?.groups?.map((group) => group.items?.map((item) => item.name)),
      ]),
      sections:
        research.entries?.find((item) => item.id === e.id)?.sections ?? [],
      date: e.banner?.start ?? e.releaseDate ?? "",
    }));
  for (const v of versions) {
    documents.push({
      type: "versions",
      category: "versions",
      game,
      id: v.version,
      title: [v.alias ?? v.version, v.title].filter(Boolean).join(" · "),
      aliases: [v.version, v.alias].filter(Boolean),
      label: "版本档案",
      href: link(game, { screen: "versions", version: v.version }),
      description: versionText(v),
      sections: v.sections ?? [],
      date: v.releaseDate ?? "",
      rarity: null,
    });
  }
  const characters = new Map(
    [...entries, ...(artwork.entries ?? artwork.galleryEntries ?? [])]
      .filter(
        (e) =>
          e.game === game && e.category === "characters" && !isExcludedEntry(e),
      )
      .map((e) => [e.id, e]),
  );
  for (const e of characters.values()) {
    const image = artwork.images?.[e.id],
      choices = [],
      seenImages = new Set(),
      seenKeys = new Set();
    if (isLocalImage(image))
      choices.push(
        artwork.variants?.[e.id]?.find((c) => c.image === image) ?? {
          key: "main",
          label: "主立绘",
          image,
        },
      );
    choices.push(...(artwork.variants?.[e.id] ?? []));
    for (const c of choices) {
      if (
        !isLocalImage(c.image) ||
        seenImages.has(c.image) ||
        seenKeys.has(c.key)
      )
        continue;
      seenImages.add(c.image);
      seenKeys.add(c.key);
      documents.push({
        type: "artwork",
        category: "artwork",
        game,
        id: e.id + ":" + c.key,
        entryId: e.id,
        variantKey: c.key,
        title: e.name + " · " + c.label,
        aliases: [e.name, ...(e.aliases ?? []), c.label],
        label: c.type === "skin" ? "皮肤立绘" : "角色立绘",
        href: link(game, {
          screen: "artwork",
          q: e.name,
          artwork: e.id,
          variant: c.key,
        }),
        description: textOf([e.element, e.rarity, c.label]),
        date: e.releaseDate ?? "",
        rarity: e.rarity ?? null,
      });
    }
  }
  for (const record of research.mechanisms ?? [])
    documents.push({
      type: "mechanisms",
      category: "mechanisms",
      game,
      id: record.id,
      title: record.name,
      aliases: record.related.map((item) => item.name),
      label: "机制与术语",
      href: link(game, { screen: "mechanisms", mechanism: record.id }),
      description: record.description,
      rarity: null,
      date: "",
      record,
    });
  return documents;
}
const prepared = new WeakMap();
export function prepareSearchDocuments(documents) {
  if (!prepared.has(documents))
    prepared.set(
      documents,
      documents.map((doc) => ({
        doc,
        name: normalize(doc.title),
        aliases: (doc.aliases ?? []).map(normalize),
        text: normalize(
          [
            doc.title,
            ...(doc.aliases ?? []),
            doc.label,
            doc.description,
            ...(doc.sections?.map(
              (section) =>
                section.text ?? textOf([section.label, section.items]),
            ) ?? []),
          ].join(" "),
        ),
        sections: (doc.sections ?? []).map((section) => ({
          section,
          text: normalize(
            section.text ?? textOf([section.label, section.items]),
          ),
        })),
      })),
    );
  return prepared.get(documents);
}
export function createSearchDocumentCache({ capacity = 6 } = {}) {
  const values = new Map();
  return {
    get(key, build) {
      if (values.has(key)) {
        const value = values.get(key);
        values.delete(key);
        values.set(key, value);
        return value;
      }
      const value = build();
      prepareSearchDocuments(value);
      values.set(key, value);
      while (values.size > capacity) values.delete(values.keys().next().value);
      return value;
    },
    clear() {
      values.clear();
    },
    get size() {
      return values.size;
    },
  };
}
export function searchDocuments(
  documents,
  query,
  { type = "all", sort = "relevance", direction = "desc" } = {},
) {
  const needle = normalize(query).trim(),
    terms = needle.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return prepareSearchDocuments(documents)
    .flatMap((index) => {
      const { doc, name, aliases, text } = index;
      if (type !== "all" && doc.type !== type && doc.category !== type)
        return [];
      if (!terms.every((term) => text.includes(term))) return [];
      const score =
        name === needle || aliases.includes(needle)
          ? 100
          : name.startsWith(needle)
            ? 80
            : name.includes(needle)
              ? 60
              : terms.every((term) =>
                    [name, ...aliases].some((alias) => alias.includes(term)),
                  )
                ? 40
                : 10;
      const matches = index.sections
          .map((item) => ({
            ...item,
            hits: terms.filter((term) => item.text.includes(term)).length,
          }))
          .filter((item) => item.hits)
          .sort((a, b) => b.hits - a.hits),
        section = matches[0]?.section;
      const source = section
        ? (section.text ?? textOf([section.label, section.items]))
        : doc.description;
      const positions = terms
          .map((term) => normalize(source).indexOf(term))
          .filter((n) => n >= 0),
        pos = positions.length ? Math.min(...positions) : 0,
        start = Math.max(0, pos - 30);
      const excerpt =
        (start ? "…" : "") +
        source.slice(start, start + 150) +
        (source.length > start + 150 ? "…" : "");
      let href = doc.href;
      if (section) {
        const url = new URL(href, "http://wiki.local");
        if (section.element) url.searchParams.set("element", section.element);
        if (section.rank)
          url.searchParams.set("effectRank", String(section.rank));
        url.hash = section.anchor ?? "version-" + section.key;
        href = url.pathname + url.search + url.hash;
      }
      return [
        {
          ...doc,
          score,
          excerpt,
          href,
          matchedSection: section?.name ?? section?.label ?? "",
        },
      ];
    })
    .sort((a, b) => {
      const factor = direction === "asc" ? 1 : -1;
      const compare = (av, bv) => {
        const missing = (value) =>
          value === undefined || value === null || value === "";
        if (missing(av) !== missing(bv)) return missing(av) ? 1 : -1;
        return (
          (typeof av === "number" && typeof bv === "number"
            ? av - bv
            : collator.compare(String(av ?? ""), String(bv ?? ""))) * factor
        );
      };
      const primary =
        sort === "name"
          ? compare(a.title, b.title)
          : sort === "release"
            ? compare(a.date, b.date)
            : sort === "rarity"
              ? compare(a.rarity, b.rarity)
              : compare(a.score, b.score);
      return (
        primary ||
        Boolean(b.date) - Boolean(a.date) ||
        collator.compare(b.date, a.date) ||
        collator.compare(a.title, b.title) ||
        collator.compare(a.game, b.game) ||
        collator.compare(a.id, b.id)
      );
    });
}

export function groupSearchResults(results) {
  const groups = [];
  for (const category of Object.keys(SEARCH_TYPES).filter(
    (key) => key !== "all",
  )) {
    for (const game of ["genshin", "starrail", "zenless"]) {
      const matches = results.filter(
        (r) => r.category === category && r.game === game,
      );
      if (!matches.length) continue;
      if (category === "artwork") {
        const entries = new Map();
        for (const match of matches) {
          if (!entries.has(match.entryId))
            entries.set(match.entryId, { ...match, matches: [] });
          entries.get(match.entryId).matches.push(match);
        }
        groups.push({ category, game, matches, items: [...entries.values()] });
      } else groups.push({ category, game, matches, items: matches });
    }
  }
  return groups;
}
