import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inside, publicPath, readJSON, equal, checkRelease } from './release-common.mjs';
import { validateRows } from './release-data.mjs';

export const CONTENT_STATE = '.updates/content/installed.json';
export const CONTENT_ROWS = '.updates/content/rows.json.gz';
export const contentRevision = value => /^D\d{14}$/.test(value ?? '');
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const gitDigest = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function contentPath(name) {
  publicPath(name);
  if (/^assets\/.+\.(?:png|jpe?g|webp|gif|svg|ico|avif|json)$/i.test(name) ||
      /^data\/(?:growth|material-acquisition|sources|versions)\/.+\.(?:json(?:\.gz)?|txt|md|html|png|jpe?g|webp|gif|svg)$/i.test(name) ||
      ['data/character-artwork-variants.json', 'public/character-artwork-index.json'].includes(name)) return name;
  throw Error(`资料包不能更新程序或个人文件：${name}`);
}
export function validateContentPackage(directory, release, { verifyFiles = true } = {}) {
  const manifest = readJSON(inside(directory, 'content.json'));
  if (manifest?.format !== 'wiki-content-update' || ![1, 2].includes(manifest.schemaVersion) || !contentRevision(manifest.revision) || !Array.isArray(manifest.files) || manifest.files.length > 18000 || !Array.isArray(manifest.softwareBases)) throw Error('资料包格式不受支持。');
  checkRelease(release);
  const base = manifest.softwareBases.find(item => equal(item.release, release));
  if (!base || !base.files || typeof base.files !== 'object' || Array.isArray(base.files)) throw Error('此资料包不支持当前软件批次，请更新 Wiki 或下载适用的资料包。');
  const names = new Set(); let total = 0;
  for (const file of manifest.files) {
    contentPath(file.path);
    if (names.has(file.path.toLowerCase()) || !Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.hash ?? '')) throw Error('资料文件清单无效或重复。');
    names.add(file.path.toLowerCase()); total += file.size;
    if (verifyFiles) {
      const filename = inside(directory, 'payload/' + file.path), stat = fs.statSync(filename);
      if (!stat.isFile() || stat.size !== file.size || digest(fs.readFileSync(filename)) !== file.hash) throw Error(`资料文件不完整：${file.path}`);
    }
  }
  if (total > 2 * 1024 ** 3) throw Error('资料包解压体积过大。');
  for (const [name, hash] of Object.entries(base.files)) { contentPath(name); if (!/^[a-f0-9]{40}$/.test(hash)) throw Error('资料文件基准无效。'); }
  if (manifest.schemaVersion === 2) {
    checkRelease(manifest.baseline);
    if (!Array.isArray(manifest.deleted) || manifest.deleted.length > 18000 || base.changes !== (equal(base.release, manifest.baseline) ? 'public-changes.json.gz' : `routes/${base.release.releaseId}.json.gz`)) throw Error('资料增量清单无效。');
    for (const name of manifest.deleted) { contentPath(name); if (names.has(name.toLowerCase())) throw Error('资料增量清单重复。'); names.add(name.toLowerCase()); }
    const changes = readJSON(inside(directory, base.changes));
    if (!Array.isArray(changes) || changes.length > 100000) throw Error('资料条目增量格式无效。');
    const ids = new Set();
    for (const change of changes) {
      if (!change || typeof change.id !== 'string' || ids.has(change.id) || !change.before && !change.after) throw Error('资料条目增量编号无效或重复。');
      for (const row of [change.before, change.after]) if (row) { validateRows([row]); if (row.id !== change.id) throw Error('资料条目编号不一致。'); }
      ids.add(change.id);
    }
    return { manifest, base, changes };
  }
  const rows = validateRows(readJSON(inside(directory, 'rows.json.gz')));
  return { manifest, base, rows };
}
