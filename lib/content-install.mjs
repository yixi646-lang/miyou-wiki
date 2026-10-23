import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inside, readJSON, equal, PUBLIC_BASE, assertStopped } from './release-common.mjs';
import { validateRows, diffRows, planMerge } from './release-data.mjs';
import { withOperation, runTransaction } from './release-install.mjs';
import { CONTENT_STATE, CONTENT_ROWS, contentPath, digest, gitDigest, validateContentPackage } from './content-package.mjs';
import { entryChangePreview } from '../shared/entry-changes.mjs';

function prepare(root, directory, readOnly = true) {
  if (fs.existsSync(path.join(root, '.release-manager/state.json'))) throw Error('维护项目请直接维护原始资料；资料安装用于分享版。');
  const release = readJSON(inside(root, 'release.json'));
  const installed = readJSON(inside(root, '.updates/installed.json'));
  if (installed.schemaVersion !== 1 || !equal(installed.release, release)) throw Error('分享版安装记录与当前软件版本不一致。');
  const validated = validateContentPackage(directory, release), { manifest, base } = validated;
  const previous = readJSON(inside(root, CONTENT_STATE), null);
  if (previous && previous.revision >= manifest.revision) throw Error('此资料批次已安装或早于当前资料。');
  const softwareRows = validateRows(readJSON(inside(root, PUBLIC_BASE)));
  const oldRows = validateRows(readJSON(inside(root, CONTENT_ROWS), softwareRows));
  let rows = validated.rows;
  if (manifest.schemaVersion === 2) {
    const target = new Map(softwareRows.map(row => [row.id, row]));
    for (const change of validated.changes) {
      if (!equal(target.get(change.id) ?? null, change.before)) throw Error(`资料条目基准不匹配：${change.id}。请使用适用的资料包。`);
      if (change.after) target.set(change.id, change.after); else target.delete(change.id);
    }
    rows = [...target.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  const previousFiles = new Map((previous?.files ?? []).map(file => [contentPath(file.path), file]));
  const targets = new Map(manifest.files.map(file => [file.path, file]));
  const targetFiles = manifest.schemaVersion === 2 ? new Map(Object.entries(base.files).map(([name, hash]) => [name, { path: name, gitHash: hash }])) : new Map();
  for (const file of manifest.files) targetFiles.set(file.path, file);
  for (const name of manifest.deleted ?? []) targetFiles.delete(name);
  const candidates = manifest.schemaVersion === 2 ? new Set([...targets.keys(), ...manifest.deleted]) : new Set([...Object.keys(base.files), ...previousFiles.keys(), ...targets.keys()]);
  const paths = [], incomingFiles = new Map(), fileTimes = new Map(), fileConflicts = [];
  for (const name of candidates) {
    contentPath(name);
    const filename = inside(root, name), target = targets.get(name);
    const local = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
    const localHash = local && digest(local);
    if (target && localHash === target.hash || !target && !local) continue;
    const old = previousFiles.get(name);
    const existedBefore = previous ? previousFiles.has(name) : Object.hasOwn(base.files, name);
    const unchanged = old ? Boolean(local && (old.hash ? localHash === old.hash : gitDigest(local) === old.gitHash)) : local && base.files[name] === gitDigest(local);
    if (local && !unchanged || !local && existedBefore) {
      fileConflicts.push({ path: name, reason: '资料文件已在本地修改或移除，保留本地状态。' }); continue;
    }
    paths.push(name);
    if (target) incomingFiles.set(name, fs.readFileSync(inside(directory, 'payload/' + name)));
  }
  const database = inside(root, 'data/library/wiki.sqlite');
  if (!fs.existsSync(database)) throw Error('未找到Wiki资料库，请先正常启动一次完整分享版。');
  const db = new DatabaseSync(database, { readOnly });
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const changes = diffRows(oldRows, rows), merge = planMerge(db, changes); merge.conflicts.push(...fileConflicts);
    return { db, manifest, release, installed, previous, rows, changes, fileConflicts, targetFiles: [...targetFiles.values()].sort((a, b) => a.path.localeCompare(b.path)), merge, paths, incomingFiles, fileTimes };
  } catch (error) { db.close(); throw error; }
}
export function inspectContentUpdate(root, directory) {
  root = path.resolve(root); assertStopped(root);
  return previewContentUpdate(root, directory);
}
export function previewContentUpdate(root, directory) {
  root = path.resolve(root);
  const plan = prepare(root, directory);
  try {
    return { current: plan.release, currentRevision: plan.previous?.revision ?? '随软件内置', revision: plan.manifest.revision, files: plan.paths.filter(name => plan.incomingFiles.has(name)).length, deleted: plan.paths.filter(name => !plan.incomingFiles.has(name)).length, entries: plan.merge.writes.length, conflicts: plan.merge.conflicts.length, summary: plan.manifest.summary ?? null, fileConflicts: plan.fileConflicts,
      changes: plan.changes.map(change => entryChangePreview({ base: change.before?.payload ?? null, local: plan.merge.beforeRows[change.id]?.payload, incoming: change.after?.payload, result: plan.merge.afterRows[change.id]?.payload ?? null, sourceBatch: plan.manifest.revision })) };
  } finally { plan.db.close(); }
}
export function applyContentUpdate(root, directory, options = {}) {
  const report = (percent, stage, detail) => { try { options.onProgress?.({ percent, stage, detail }); } catch {} };
  return withOperation(root, root => {
    report(8, '正在检查资料包');
    const plan = prepare(root, directory, false);
    const { db, manifest, release, installed, rows, merge, paths, incomingFiles, fileTimes, targetFiles } = plan;
    try {
      const result = runTransaction(root, { db, merge, paths, incomingFiles, fileTimes, publishedRows: rows, installed, report, failAt: options.failAt, conflictName: `.updates/conflicts/content-${manifest.revision}.json.gz`, content: { record: { format: 'wiki-installed-content', schemaVersion: 1, revision: manifest.revision, publishedAt: manifest.publishedAt, installedAt: new Date().toISOString(), softwareRelease: release, files: targetFiles } } });
      return { ...result, revision: manifest.revision };
    } finally { try { db.close(); } catch {} }
  });
}
