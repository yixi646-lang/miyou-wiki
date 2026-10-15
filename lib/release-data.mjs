import { DatabaseSync } from 'node:sqlite';
import { equal, stringify } from './release-common.mjs';
import { validateEntry, isExcludedEntry } from '../shared/catalog.mjs';

export function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length > 100000) throw Error('发布条目数据格式不正确。');
  const ids = new Set();
  for (const row of rows) {
    if (!row || row.id !== row.payload?.id || ids.has(row.id)) throw Error(`发布条目编号无效或重复：${row?.id}`);
    validateEntry(row.payload);
    if (isExcludedEntry(row.payload)) throw Error(`发布内容包含不收录条目：${row.id}`);
    if (!Number.isInteger(row.revision) || row.revision < 1 || typeof row.updatedAt !== 'string') throw Error(`发布条目修订信息无效：${row.id}`);
    ids.add(row.id);
  }
  return rows;
}
export function readRows(db) {
  return db.prepare('SELECT id,payload,revision,updated_at FROM entries ORDER BY id').all().map(row => ({ id: row.id, payload: JSON.parse(row.payload), revision: row.revision, updatedAt: row.updated_at }));
}
export function exportPublic(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try { db.exec('BEGIN'); return validateRows(readRows(db).filter(row => !isExcludedEntry(row.payload))); }
  finally { db.close(); }
}
export function diffRows(before, after) {
  const old = new Map(before.map(row => [row.id, row])), next = new Map(after.map(row => [row.id, row]));
  return [...new Set([...old.keys(), ...next.keys()])].sort().filter(id => !equal(old.get(id), next.get(id))).map(id => ({ id, before: old.get(id) ?? null, after: next.get(id) ?? null }));
}
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Arrays are atomic: merging their indexes could combine incompatible skill tables.
export function mergeValue(base, local, incoming, conflicts, field = '') {
  if (equal(local, base)) return incoming;
  if (equal(incoming, base) || equal(local, incoming)) return local;
  if (plain(local) && plain(incoming) && (base === undefined || plain(base))) {
    const result = {};
    for (const key of new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(incoming)])) {
      const value = mergeValue(base?.[key], local[key], incoming[key], conflicts, field ? `${field}.${key}` : key);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  conflicts.push({ field, base, local, incoming });
  return local;
}
export function protectedReferences(db) {
  const result = new Set(db.prepare('SELECT entry_id FROM favorites').all().map(row => row.entry_id));
  for (const row of db.prepare("SELECT value FROM metadata WHERE key LIKE 'growth_plan:%'").all()) {
    // Plans may store profile ids or nested references; avoid deleting a referenced entry.
    function visit(value) {
      if (typeof value === 'string') result.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { result.add(key); visit(item); }
    }
    try { visit(JSON.parse(row.value)); } catch { /* Existing unrelated metadata stays intact. */ }
  }
  return result;
}
export function planMerge(db, changes) {
  const current = new Map(readRows(db).map(row => [row.id, row])), references = protectedReferences(db);
  const writes = [], beforeRows = {}, afterRows = {}, conflicts = [];
  for (const change of changes) {
    const { id } = change, base = change.before, incoming = change.after, local = current.get(id) ?? null;
    beforeRows[id] = local;
    let next = local;
    if (!incoming) {
      if (!local) next = null;
      else if (references.has(id) || !equal(local.payload, base?.payload)) conflicts.push({ id, reason: references.has(id) ? '官方撤回条目仍被收藏或计划引用，保留本地条目。' : '官方撤回条目有本地编辑，保留本地条目。' });
      else next = null;
    } else if (!local) {
      if (base) conflicts.push({ id, reason: '此条目已在本地移除，保留本地状态。' });
      else next = incoming;
    } else if (!base) {
      if (!equal(local.payload, incoming.payload)) conflicts.push({ id, reason: '新增官方编号与本地条目冲突，保留本地条目。', local: local.payload, incoming: incoming.payload });
    } else {
      const fields = [], payload = mergeValue(base.payload, local.payload, incoming.payload, fields);
      if (fields.length) conflicts.push({ id, fields });
      if (!equal(payload, local.payload)) next = { id, payload, revision: Math.max(local.revision + 1, incoming.revision), updatedAt: incoming.updatedAt };
    }
    afterRows[id] = next;
    if (!equal(local, next)) writes.push({ id, row: next });
  }
  return { writes, beforeRows, afterRows, conflicts };
}
export function writeRows(db, writes) {
  const put = db.prepare('INSERT INTO entries(id,game,category,name,payload,revision,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET game=excluded.game,category=excluded.category,name=excluded.name,payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at');
  const remove = db.prepare('DELETE FROM entries WHERE id=?');
  for (const { id, row } of writes) {
    if (!row) remove.run(id);
    else { validateEntry(row.payload); put.run(id, row.payload.game, row.payload.category, row.payload.name, stringify(row.payload), row.revision, row.updatedAt); }
  }
}
