import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { inside, readJSON, equal, PUBLIC_BASE } from './release-common.mjs';
import { validateRows, diffRows, planMerge } from './release-data.mjs';
import { withOperation, runTransaction } from './release-install.mjs';
import { CONTENT_STATE, CONTENT_ROWS, contentPath, digest, gitDigest, validateContentPackage } from './content-package.mjs';

export function applyContentUpdate(root, directory, options = {}) {
  const report = (percent, stage, detail) => { try { options.onProgress?.({ percent, stage, detail }); } catch {} };
  return withOperation(root, root => {
    if (fs.existsSync(path.join(root, '.release-manager/state.json'))) throw Error('维护项目请直接维护原始资料；资料安装用于分享版。');
    const release = readJSON(inside(root, 'release.json'));
    const installed = readJSON(inside(root, '.updates/installed.json'));
    if (!equal(installed.release, release)) throw Error('分享版安装记录与当前软件版本不一致。');
    report(8, '正在检查资料包');
    const { manifest, base, rows } = validateContentPackage(directory, release);
    const previous = readJSON(inside(root, CONTENT_STATE), null);
    if (previous && previous.revision >= manifest.revision) throw Error('此资料批次已安装或早于当前资料。');
    const oldRows = validateRows(readJSON(inside(root, CONTENT_ROWS), readJSON(inside(root, PUBLIC_BASE))));
    const previousFiles = new Map((previous?.files ?? []).map(file => [contentPath(file.path), file.hash]));
    const targets = new Map(manifest.files.map(file => [file.path, file]));
    const paths = [], incomingFiles = new Map(), fileTimes = new Map(), fileConflicts = [];
    for (const name of new Set([...Object.keys(base.files), ...previousFiles.keys(), ...targets.keys()])) {
      contentPath(name);
      const filename = inside(root, name), target = targets.get(name);
      const local = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
      const localHash = local && digest(local);
      if (target && localHash === target.hash || !target && !local) continue;
      const unchanged = previousFiles.has(name) ? localHash === previousFiles.get(name) : local && base.files[name] === gitDigest(local);
      if (local && !unchanged || !local && (previousFiles.has(name) || Object.hasOwn(base.files, name))) {
        fileConflicts.push({ path: name, reason: '资料文件已在本地修改或移除，保留本地状态。' }); continue;
      }
      paths.push(name);
      if (target) incomingFiles.set(name, fs.readFileSync(inside(directory, 'payload/' + name)));
    }
    const db = new DatabaseSync(inside(root, 'data/library/wiki.sqlite'));
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    try {
      const merge = planMerge(db, diffRows(oldRows, rows)); merge.conflicts.push(...fileConflicts);
      const result = runTransaction(root, { db, merge, paths, incomingFiles, fileTimes, publishedRows: rows, installed, report, failAt: options.failAt, conflictName: `.updates/conflicts/content-${manifest.revision}.json.gz`, content: { record: { format: 'wiki-installed-content', schemaVersion: 1, revision: manifest.revision, publishedAt: manifest.publishedAt, installedAt: new Date().toISOString(), softwareRelease: release, files: manifest.files } } });
      return { ...result, revision: manifest.revision };
    } finally { try { db.close(); } catch {} }
  });
}
