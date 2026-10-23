import { skillExplanations } from "./skill-terms.mjs";
import { isExcludedEntry } from "./catalog.mjs";

const clean = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const text = (value) =>
  Array.isArray(value)
    ? value.map(text).join(" ")
    : value && typeof value === "object"
      ? Object.values(value).map(text).join(" ")
      : clean(value);
const hash = (value) => {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const sourcesOf = (term) =>
  [...(term.sources ?? []), ...(term.source ? [term.source] : [])].filter(
    (s) => s?.url,
  );

export function fullTextSections(entry) {
  const sections = [];
  const add = (details, element = "") => {
    const context = [...(details.skills ?? []), ...(details.upgrades ?? [])];
    for (const kind of ["skills", "upgrades", "effects"])
      for (const [index, item] of (details[kind] ?? []).entries()) {
        const definitions =
          kind === "effects"
            ? []
            : skillExplanations(context, item, item.levels?.at(-1)?.level);
        const body = text([
          item.name,
          item.type,
          item.description,
          item.levels?.map((level) => [level.description, level.specs]),
          definitions.map((term) => [term.name, term.description]),
        ]);
        if (body)
          sections.push({
            key: kind + "-" + index,
            anchor: kind === "effects" ? "effects" : `entry-${kind}-${index}`,
            name: clean(item.name),
            text: body,
            element,
            rank: item.rank ?? null,
          });
      }
  };
  add(entry.details ?? {});
  for (const [element, variant] of Object.entries(
    entry.details?.traveler?.elements ?? {},
  ))
    add(variant, element);
  return sections;
}

export function buildResearchIndex(
  entries,
  terms = { common: {}, characters: {} },
  game,
) {
  const catalog = entries.filter(
    (entry) => entry.game === game && !isExcludedEntry(entry),
  );
  const records = new Map();
  function add(term, { entry, skill, element = entry?.element ?? '', scope = "通用机制", source } = {}) {
    const name = clean(term.name),
      description = clean(term.description);
    if (!name || !description) return;
    const key = name + "\n" + description,
      id = "term-" + hash(game + "\n" + key);
    let record = records.get(key);
    if (!record) {
      record = {
        id,
        game,
        name,
        description,
        scope: entry ? "角色技能" : scope,
        versions: [],
        sources: [],
        related: [],
      };
      records.set(key, record);
    }
    if (entry) {
      if (!record.related.some((r) => r.id === entry.id && r.skill === skill && r.element === element))
        record.related.push({
          id: entry.id,
          name: entry.name,
          skill: skill ?? "",
          element,
          href: "/?" + new URLSearchParams({ game, entry: entry.id }),
        });
    }
    for (const item of [...sourcesOf(term), ...(source ? [source] : [])])
      if (item?.url && !record.sources.some((s) => s.url === item.url))
        record.sources.push(item);
    for (const item of record.sources) {
      const version = item.url?.match(/\/(?:zzz|hsr)\/(\d+\.\d+)\//)?.[1];
      if (version && !record.versions.includes(version))
        record.versions.push(version);
    }
  }
  for (const term of terms.common?.[game] ?? []) add(term);
  for (const entry of catalog) {
    const record = terms.characters?.[entry.id];
    for (const [skill, definitions] of Object.entries(record?.skills ?? {}))
      for (const term of definitions ?? [])
        add(term, { entry, skill, source: record.source });
    const collect = (details, element = entry.element) => {
      const context = [...(details.skills ?? []), ...(details.upgrades ?? [])];
      for (const skill of context)
        for (const term of skillExplanations(
          context,
          skill,
          skill.levels?.at(-1)?.level,
        ))
          add(term, {
            entry,
            skill: skill.name,
            element,
            source: record?.source ?? entry.sources?.[0],
          });
    };
    collect(entry.details ?? {});
    for (const [element, variant] of Object.entries(
      entry.details?.traveler?.elements ?? {},
    ))
      collect(variant, element);
  }
  return {
    entries: catalog.map((entry) => ({
      id: entry.id,
      sections: fullTextSections(entry),
    })),
    mechanisms: [...records.values()]
      .filter((record) => record.sources.length)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
  };
}
