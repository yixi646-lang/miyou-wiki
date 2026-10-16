import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { RELEASE_SCHEMA, PUBLIC_CATALOG, INSTALLED, PUBLIC_BASE, inside, publicPath, readJSON, writeJSON, writeAtomic, checkRelease, equal, assertStopped, selectUpdateRoute } from './release-common.mjs';
import { validateRows, planMerge, writeRows, diffRows, mergeValue } from './release-data.mjs';

const transactionName = '.updates/transaction';
const blobName = name => Buffer.from(name).toString('base64url') + '.gz';
function openDatabase(root) {
  const filename = inside(root, 'data/library/wiki.sqlite');
  if (!fs.existsSync(filename)) throw Error('找不到现有 Wiki 资料库。请先正常启动一次完整分享版。');
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}
function officialCatalog(rows) { return { format: 'wiki-public-release', schemaVersion: 1, entries: rows.map(row => row.payload) }; }
function readInstalled(root) {
  const installed = readJSON(inside(root, INSTALLED));
  if (installed.schemaVersion !== RELEASE_SCHEMA || !Array.isArray(installed.managedPaths)) throw Error('此目录没有受支持的安装基准。请使用最新版完整分享包建立新目录。');
  checkRelease(installed.release);
  installed.managedPaths.forEach(publicPath);
  return installed;
}
function saveFile(root, name, directory) {
  const filename = inside(root, name);
  if (!fs.existsSync(filename)) return null;
  const stat = fs.statSync(filename);
  if (!stat.isFile()) throw Error(`需要更新的路径不是普通文件：${name}`);
  const blob = blobName(name);
  writeAtomic(path.join(directory, blob), gzipSync(fs.readFileSync(filename)));
  return { blob, mtime: stat.mtimeMs, atime: stat.atimeMs };
}
function restoreFile(root, name, info, directory) {
  const filename = inside(root, name);
  if (!info) { if (fs.existsSync(filename)) fs.unlinkSync(filename); return; }
  if (!/^[A-Za-z0-9_-]+\.gz$/.test(info.blob)) throw Error('事务备份文件名无效。');
  writeAtomic(filename, gunzipSync(fs.readFileSync(path.join(directory, info.blob))));
  fs.utimesSync(filename, info.atime / 1000, info.mtime / 1000);
}
function recover(root) {
  const directory = inside(root, transactionName), filename = path.join(directory, 'journal.json.gz');
  if (!fs.existsSync(directory)) return false;
  if (!fs.existsSync(filename)) throw Error('更新事务目录缺少恢复记录，请保留该目录并交由维护者检查。');
  const journal = readJSON(filename);
  if (journal.format !== 'wiki-update-transaction' || journal.schemaVersion !== 1) throw Error('更新事务格式无效。');
  if (journal.complete !== true) {
    const db = openDatabase(root);
    try {
      db.exec('BEGIN IMMEDIATE');
      writeRows(db, Object.entries(journal.beforeRows).map(([id, row]) => ({ id, row })));
      for (const [name, info] of Object.entries(journal.files)) restoreFile(root, name, info, directory);
      db.exec('COMMIT');
    } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
    finally { db.close(); }
  }
  fs.rmSync(directory, { recursive: true });
  return journal.complete !== true;
}
export function withOperation(root, fn) {
  root = path.resolve(root);
  assertStopped(root);
  const filename = inside(root, '.updates/operation.lock');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  if (fs.existsSync(filename)) {
    const previous = readJSON(filename);
    try { process.kill(previous.pid, 0); }
    catch (error) { if (error.code !== 'ESRCH') throw error; fs.unlinkSync(filename); }
    if (fs.existsSync(filename)) throw Error('另一个更新 / 回退任务正在运行。');
  }
  const handle = fs.openSync(filename, 'wx');
  fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, format: 'wiki-update-lock' })); fs.closeSync(handle);
  try { const recovered = recover(root); return { ...fn(root), recoveredInterruptedUpdate: recovered }; }
  finally { fs.unlinkSync(filename); }
}
export function runTransaction(root, { db, merge, paths, incomingFiles, fileTimes, publishedRows, installed, conflictName, failAt, report, content, contentRebase }) {
  const directory = inside(root, transactionName);
  fs.mkdirSync(directory, { recursive: true });
  const metadataPaths = content ? ['.updates/content/installed.json', '.updates/content/rows.json.gz', PUBLIC_CATALOG] : [PUBLIC_CATALOG, PUBLIC_BASE, INSTALLED, 'release.json'];
  if (contentRebase) metadataPaths.push('.updates/content/installed.json', '.updates/content/rows.json.gz');
  if (merge.conflicts.length) metadataPaths.push(conflictName);
  let files, journal;
  try {
    report(24, '正在准备更新', '保存本次会改动文件的临时恢复记录');
    files = Object.fromEntries([...new Set([...paths, ...metadataPaths])].map(name => [name, saveFile(root, name, directory)]));
    journal = { format: 'wiki-update-transaction', schemaVersion: 1, complete: false, files, beforeRows: merge.beforeRows };
    writeJSON(path.join(directory, 'journal.json.gz'), journal);
  } catch (error) { fs.rmSync(directory, { recursive: true }); throw error; }
  let began = false;
  try {
    db.exec('BEGIN IMMEDIATE'); began = true;
    report(38, '正在合并百科资料', `处理 ${merge.writes.length} 条资料变化；个人资料保留`);
    writeRows(db, merge.writes);
    for (const [index, name] of paths.entries()) {
      report(40 + Math.round((index + 1) / Math.max(paths.length, 1) * 44), '正在更新文件', `${index + 1} / ${paths.length}：${name}`);
      const filename = inside(root, name), incoming = incomingFiles.get(name);
      if (incoming !== undefined) { writeAtomic(filename, incoming); if (Number.isFinite(fileTimes.get(name))) fs.utimesSync(filename, fileTimes.get(name)/1000, fileTimes.get(name)/1000); }
      else if (fs.existsSync(filename)) fs.unlinkSync(filename);
    }
    if (failAt === 'after-files') throw Error('测试：文件覆盖后中断');
    report(88, '正在保存版本记录', content ? content.record.revision : `${installed.release.version} / ${installed.release.releaseId}`);
    const liveIds = new Set(db.prepare('SELECT id FROM entries').all().map(row => row.id));
    writeJSON(inside(root, PUBLIC_CATALOG), officialCatalog((contentRebase?.rows ?? publishedRows).filter(row => liveIds.has(row.id))));
    if (content) {
      writeJSON(inside(root, '.updates/content/installed.json'), content.record);
      writeJSON(inside(root, '.updates/content/rows.json.gz'), publishedRows);
    } else {
      writeJSON(inside(root, PUBLIC_BASE), publishedRows);
      writeJSON(inside(root, INSTALLED), installed);
      writeJSON(inside(root, 'release.json'), installed.release);
      if (contentRebase) {
        writeJSON(inside(root, '.updates/content/rows.json.gz'), contentRebase.rows);
        writeJSON(inside(root, '.updates/content/installed.json'), contentRebase.record);
      }
    }
    if (merge.conflicts.length) writeJSON(inside(root, conflictName), { format: 'wiki-public-merge-conflicts', release: installed.release, ...(content ? { revision: content.record.revision } : {}), conflicts: merge.conflicts });
    db.exec('COMMIT'); began = false;
    writeJSON(path.join(directory, 'journal.json.gz'), { ...journal, complete: true });
    fs.rmSync(directory, { recursive: true });
    report(95, '公共内容更新完成', '正在整理更新结果');
  } catch (error) {
    report(0, '更新未完成，正在恢复', error.message);
    if (began) db.exec('ROLLBACK');
    db.close();
    try { recover(root); } catch (recoveryError) { throw Error(`${error.message}；恢复未完成：${recoveryError.message}。请保留 .updates/transaction。`); }
    throw error;
  }
  return { release: installed.release, files: paths.length, entries: merge.writes.length, conflicts: merge.conflicts.length, conflictFile: merge.conflicts.length ? conflictName : null };
}
export function applyUpdate(root, updateDirectory, options = {}) {
  const report = (percent, stage, detail) => { try { options.onProgress?.({ percent, stage, detail }); } catch { /* Progress display cannot interrupt the update transaction. */ } };
  return withOperation(root, root => {
    report(5, '正在核对目录与版本', '读取当前安装记录和更新包');
    updateDirectory = path.resolve(updateDirectory);
    const packageManifest = readJSON(inside(updateDirectory, 'update.json'));
    const installed = readInstalled(root);
    const manifest = selectUpdateRoute(packageManifest, installed.release);
    if (!options.localRollback && Number(manifest.to.releaseId.slice(1)) <= Number(installed.release.releaseId.slice(1))) throw Error('更新批次必须晚于当前批次。');
    const contentRecord = readJSON(inside(root, '.updates/content/installed.json'), null);
    const oldPaths = new Set([...installed.managedPaths, ...(contentRecord?.files ?? []).map(file => publicPath(file.path))]), names = new Set(), incomingFiles = new Map(), fileTimes = new Map();
    report(12, '正在检查更新文件', `${manifest.files.length} 个变化文件，${manifest.deleted.length} 个删除项`);
    for (const file of manifest.files) {
      const name = publicPath(file.path), lower = name.toLowerCase();
      if (names.has(lower)) throw Error(`更新文件重复：${name}`); names.add(lower);
      if (name === 'runtime/node.exe') throw Error('Node.js 运行时升级请使用完整包。');
      const target = inside(root, name);
      if (!oldPaths.has(name) && fs.existsSync(target)) throw Error(`新增文件与本地非发布文件重名：${name}`);
      const source = inside(updateDirectory, `payload/${name}`), stat = fs.statSync(source);
      if (!stat.isFile() || stat.size !== file.size) throw Error(`更新文件缺失或长度不符：${name}`);
      incomingFiles.set(name, fs.readFileSync(source));
      if (Number.isFinite(file.mtime)) fileTimes.set(name, file.mtime);
    }
    for (const name of manifest.deleted) {
      publicPath(name);
      if (name === 'runtime/node.exe' || !oldPaths.has(name) || names.has(name.toLowerCase())) throw Error(`删除清单与当前发布范围不符：${name}`);
      names.add(name.toLowerCase());
    }
    const changes = readJSON(inside(updateDirectory, manifest.publicChanges));
    if (!Array.isArray(changes)) throw Error('百科更新记录格式无效。');
    const published = new Map(validateRows(readJSON(inside(root, PUBLIC_BASE))).map(row => [row.id, row]));
    const entryIds = new Set();
    for (const change of changes) {
      if (!change || typeof change.id !== 'string' || entryIds.has(change.id) || !equal(published.get(change.id) ?? null, change.before)) throw Error(`百科起始条目不匹配或重复：${change?.id}`);
      entryIds.add(change.id);
      if (change.after) { validateRows([change.after]); if (change.id !== change.after.id) throw Error('更新条目编号不一致。'); published.set(change.id, change.after); }
      else published.delete(change.id);
    }
    const paths = [...manifest.files.map(file => file.path), ...manifest.deleted];
    const nextPaths = new Set(oldPaths); manifest.files.forEach(file => nextPaths.add(file.path)); manifest.deleted.forEach(name => nextPaths.delete(name));
    let entryChanges = changes, contentRebase;
    if (contentRecord) {
      const rows = validateRows(readJSON(inside(root, '.updates/content/rows.json.gz'))), rebased = new Map(rows.map(row => [row.id, row]));
      for (const change of changes) {
        const local = rebased.get(change.id), base = change.before, incoming = change.after;
        if (!local) { if (!base && incoming) rebased.set(change.id, incoming); }
        else if (!incoming) { if (equal(local.payload, base?.payload)) rebased.delete(change.id); }
        else {
          const payload = mergeValue(base?.payload, local.payload, incoming.payload, []);
          rebased.set(change.id, { ...incoming, payload, revision: Math.max(local.revision, incoming.revision) });
        }
      }
      const next = [...rebased.values()].sort((a, b) => a.id.localeCompare(b.id));
      entryChanges = diffRows(rows, next);
      // Software changes become the next official file baseline; local edits are still compared by the data installer.
      const files = new Map(contentRecord.files.map(file => [file.path, file]));
      for (const name of manifest.deleted) files.delete(name);
      for (const file of manifest.files) if (files.has(file.path)) {
        const bytes = incomingFiles.get(file.path);
        files.set(file.path, { path: file.path, size: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') });
      }
      contentRebase = { rows: next, record: { ...contentRecord, softwareRelease: manifest.to, files: [...files.values()] } };
    }
    const db = openDatabase(root);
    try {
      report(20, '正在比较百科资料', '保留个人编辑；冲突字段采用本地值');
      const merge = planMerge(db, entryChanges);
      return runTransaction(root, { db, merge, paths, incomingFiles, fileTimes, publishedRows: [...published.values()].sort((a, b) => a.id.localeCompare(b.id)), installed: { schemaVersion: 1, release: manifest.to, managedPaths: [...nextPaths].sort() }, contentRebase, conflictName: `.updates/conflicts/update-${manifest.to.releaseId}-${Date.now()}.json.gz`, failAt: options.failAt, report });
    } finally { try { db.close(); } catch {} }
  });
}
