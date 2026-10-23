const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) =>
  value === undefined ? undefined : structuredClone(value);
const ignored = new Set(["revision", "updatedAt"]);

export function mergeEntryDraft(base, mine, theirs) {
  const conflicts = [],
    changes = [];
  function merge(a, b, c, path = []) {
    if (path.length === 1 && ignored.has(path[0])) return copy(c);
    if (same(a, b)) return copy(c);
    if (same(a, c) || same(b, c)) return copy(b);
    if (object(a) && object(b) && object(c)) {
      const result = {};
      for (const key of new Set([
        ...Object.keys(a),
        ...Object.keys(b),
        ...Object.keys(c),
      ])) {
        const value = merge(a[key], b[key], c[key], [...path, key]);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    conflicts.push({ path, base: copy(a), mine: copy(b), theirs: copy(c) });
    return copy(b);
  }
  const merged = merge(base, mine, theirs);
  for (const key of new Set([...Object.keys(base), ...Object.keys(theirs)]))
    if (!ignored.has(key) && !same(base[key], theirs[key]))
      changes.push({
        path: [key],
        base: copy(base[key]),
        mine: copy(mine[key]),
        theirs: copy(theirs[key]),
      });
  return { merged, conflicts, changes };
}
export function resolveEntryConflicts(result, choices = {}) {
  const entry = structuredClone(result.merged);
  for (const conflict of result.conflicts) {
    if (choices[JSON.stringify(conflict.path)] !== "theirs") continue;
    let owner = entry;
    for (const key of conflict.path.slice(0, -1)) owner = owner[key];
    const key = conflict.path.at(-1);
    if (conflict.theirs === undefined) delete owner[key];
    else owner[key] = structuredClone(conflict.theirs);
  }
  return entry;
}
