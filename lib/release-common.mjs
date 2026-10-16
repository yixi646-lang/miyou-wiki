import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';

export const RELEASE_SCHEMA = 1;
export const PUBLIC_CATALOG = 'data/catalog/release-public.json';
export const INSTALLED = '.updates/installed.json';
export const PUBLIC_BASE = '.updates/public.json.gz';
export const LATEST_ROLLBACK = '.updates/rollback/latest.json';

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const stringify = value => JSON.stringify(canonical(value));
export const equal = (a, b) => stringify(a) === stringify(b);
export function readJSON(filename, fallback) {
  if (!fs.existsSync(filename)) {
    if (arguments.length > 1) return fallback;
    throw Error(`缺少文件：${filename}`);
  }
  const bytes = fs.readFileSync(filename);
  return JSON.parse((filename.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8').replace(/^\uFEFF/, ''));
}
export function writeJSON(filename, value) {
  const bytes = Buffer.from(JSON.stringify(canonical(value), null, 2) + '\n');
  writeAtomic(filename, filename.endsWith('.gz') ? gzipSync(bytes) : bytes);
}
export function writeAtomic(filename, bytes) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, bytes); fs.renameSync(temporary, filename); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function relativeName(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || name.includes(':') || path.posix.isAbsolute(name)) throw Error(`路径不合法：${name}`);
  if (name.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part))) throw Error(`路径不合法：${name}`);
  return name;
}
export function inside(root, name) {
  relativeName(name);
  const absolute = path.resolve(root, ...name.split('/'));
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw Error(`路径超出 Wiki：${name}`);
  // Junctions and symlinks cannot redirect an update outside the installation.
  let current = path.resolve(root);
  if (fs.lstatSync(current).isSymbolicLink()) throw Error('Wiki 根目录不能是符号链接或目录联接。');
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(`更新路径不能经过符号链接：${name}`);
  }
  return absolute;
}
export function publicPath(name) {
  relativeName(name);
  const normalized = name.toLowerCase();
  if (/\.(?:sqlite|db)(?:-(?:wal|shm))?$/.test(normalized)) throw Error(`更新包不得携带数据库：${name}`);
  const allowedRoot = /^(?:assets|public|lib|shared|modules|scripts|runtime|原神库存扫描器|inventorykamera|data)\//.test(normalized);
  const allowedFile = /^(?:server\.mjs|package\.json|readme\.md|release\.json|原神库存扫描器\.lnk|[^/]+\.(?:txt|cmd|vbs))$/.test(normalized);
  if (!allowedRoot && !allowedFile) throw Error(`不属于发布范围：${name}`);
  if (/^(?:data\/(?:assessment|library|backups|logs)|(?:原神库存扫描器|inventorykamera)\/(?:genshindata|logging))\//.test(normalized) || /(?:^|\/)(?:node_modules|logging|\.git|\.codex_tmp|\.updates)(?:\/|$)/.test(normalized)) throw Error(`受保护的个人或运行目录：${name}`);
  return name;
}
export function checkRelease(release) {
  if (release?.schemaVersion !== RELEASE_SCHEMA || !/^\d+\.\d+\.\d+$/.test(release.version ?? '') || !/^R\d{6}$/.test(release.releaseId ?? '')) throw Error('发布信息格式不受支持。');
  return release;
}
export function selectUpdateRoute(manifest, release) {
  if (manifest?.format !== 'wiki-local-update' || manifest.schemaVersion !== RELEASE_SCHEMA || !Array.isArray(manifest.files) || !Array.isArray(manifest.deleted)) throw Error('这不是受支持的 Wiki 更新包。');
  checkRelease(manifest.from); checkRelease(manifest.to); checkRelease(release);
  if (manifest.routes === undefined) {
    if (equal(release, manifest.from)) return { ...manifest, publicChanges: 'public-changes.json.gz' };
  } else {
    if (!Array.isArray(manifest.routes) || !manifest.routes.length) throw Error('跨版本更新起点清单无效。');
    const ids = new Set();
    for (const route of manifest.routes) {
      checkRelease(route?.from);
      const id = route.from.releaseId;
      if (ids.has(id) || id < manifest.from.releaseId || id >= manifest.to.releaseId || !Array.isArray(route.files) || !Array.isArray(route.deleted) || route.publicChanges !== (equal(route.from, manifest.from) ? 'public-changes.json.gz' : `routes/${id}.json.gz`)) throw Error('跨版本更新记录无效或重复。');
      ids.add(id);
    }
    const base = manifest.routes.find(route => equal(route.from, manifest.from));
    if (!base || !equal(base.files, manifest.files) || !equal(base.deleted, manifest.deleted)) throw Error('跨版本更新基准与主清单不一致。');
    const route = manifest.routes.find(route => equal(route.from, release));
    if (route) return { ...manifest, ...route };
  }
  throw Error(`起始批次不匹配：本机 ${release.version} / ${release.releaseId}，本包${manifest.routes ? '支持从 ' : '要求 '}${manifest.from.version} / ${manifest.from.releaseId}${manifest.routes ? ' 起的已收录正式批次' : ''}。请使用包含当前批次的更新包或最新版完整包。`);
}
export function listFiles(directory) {
  const result = [];
  if (!fs.existsSync(directory)) return result;
  function visit(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + entry.name, filename = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error(`发布范围内不允许符号链接：${filename}`);
      if (entry.isDirectory()) visit(filename, name + '/');
      else if (entry.isFile()) result.push(name);
    }
  }
  visit(directory);
  return result;
}
export function assertStopped(root) {
  const lock = readJSON(inside(root, 'data/library/wiki.sqlite.service.json'), null);
  if (lock?.pid) {
    try { process.kill(lock.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw Error('无法确认 Wiki 服务已停止。'); }
    throw Error('Wiki 服务仍在运行。请关闭全部 Wiki 页面，等待约 15 秒后再更新或回退。');
  }
}
