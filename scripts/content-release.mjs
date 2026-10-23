import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inside, listFiles, readJSON, writeJSON, writeAtomic, stringify, equal } from '../lib/release-common.mjs';
import { exportPublic, diffRows, validateRows } from '../lib/release-data.mjs';
import { contentPath, contentRevision, digest, gitDigest } from '../lib/content-package.mjs';
import { buildArtworkIndex } from './build-artwork-index.mjs';
import { createContentInstaller } from './content-installer/build.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { windowsHide: true, maxBuffer: 64 * 1024 ** 2, ...options });
  if (result.error || result.status !== 0) throw Error(result.error?.message ?? result.stderr?.toString() ?? '资料打包失败。');
  return result.stdout;
}
export async function buildContentRelease({ root = project, revision = 'D' + new Date().toISOString().replace(/\D/g, '').slice(0, 14), outputDirectory, notes = '公共百科资料更新。', pendingRelease } = {}) {
  root = path.resolve(root);
  if (!contentRevision(revision)) throw Error('资料批次格式为 D 加14位UTC时间。');
  const config = readJSON(inside(root, 'release-config.json'));
  if (!config.content) throw Error('缺少资料发布范围配置。');
  const state = readJSON(inside(root, '.release-manager/state.json'));
  const baselineId = config.content.baseline ?? 'R000008';
  const releases = state.releases.filter(item => item.release.releaseId >= baselineId);
  if (pendingRelease) {
    const expected = 'R' + String(Number(state.releases.at(-1).release.releaseId.slice(1)) + 1).padStart(6, '0');
    if (pendingRelease.release.releaseId !== expected || !/^[a-f0-9]{40}$/.test(pendingRelease.commit)) throw Error('联合发布的软件草稿基准无效。');
    releases.push(pendingRelease);
  }
  const baseline = releases[0];
  if (!baseline || baseline.release.releaseId !== baselineId) throw Error('缺少1.2.2资料发布基准。');
  const git = args => command(process.env.WIKI_GIT ?? 'git', ['--git-dir=' + path.join(root, '.release-manager/repository.git'), ...args]);
  const sourceBases = releases.map(item => {
    const listing = git(['ls-tree', '-r', '-z', item.commit]).toString('utf8'), files = {};
    for (const row of listing.split('\0').filter(Boolean)) {
      const [info, name] = row.split('\t');
      try { contentPath(name); } catch { continue; }
      files[name] = info.split(' ')[2];
    }
    return { release: item.release, files, rows: validateRows(JSON.parse(git(['show', `${item.commit}:.release-data/public.json`]).toString('utf8'))) };
  });
  const output = path.resolve(outputDirectory ?? path.join(root, config.outputDirectory));
  if (!output.startsWith(root + path.sep)) throw Error('资料包输出须位于项目内。');
  const archive = path.join(output, `Miyou-Wiki-Data-${revision}.zip`);
  if (fs.existsSync(archive)) throw Error('已有同名资料包，未覆盖。');
  const cache = inside(root, '.codex_tmp/content-build'); fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'batch-'));
  let completed = false;
  try {
    const directory = path.join(temporary, 'package'); fs.mkdirSync(directory);
    const rows = exportPublic(path.join(root, 'data/library/wiki.sqlite'));
    const meaningful = source => diffRows(source, rows).filter(change => !equal(change.before?.payload, change.after?.payload));
    const routes = sourceBases.map(base => ({ ...base, differences: meaningful(base.rows) }));
    const previous = readJSON(inside(root, '.release-manager/content/latest-built.json'), null);
    const historyPath = inside(root, '.release-manager/content/history');
    const history = fs.existsSync(historyPath) ? fs.readdirSync(historyPath).filter(name => /^D\d{14}\.json$/.test(name)).map(name => readJSON(path.join(historyPath, name))) : [];
    if (previous) history.push(previous);
    const historicalFiles = new Map();
    for (const record of history) for (const file of record.targetFiles ?? record.manifest.files) {
      contentPath(file.path);
      if (!historicalFiles.has(file.path)) historicalFiles.set(file.path, new Set());
      historicalFiles.get(file.path).add(file.hash);
    }
    const names = new Set(config.content.files);
    for (const dir of config.content.directories) for (const name of listFiles(inside(root, dir))) names.add(dir + '/' + name);
    const artwork = path.join(temporary, 'artwork.json');
    await buildArtworkIndex({ rootDirectory: root, sourceEntries: rows.map(row => row.payload), outputPath: artwork });
    names.add('public/character-artwork-index.json');
    const files = [], targetFiles = [];
    for (const name of [...names].sort()) {
      contentPath(name);
      const bytes = fs.readFileSync(name === 'public/character-artwork-index.json' ? artwork : inside(root, name));
      const file = { path: name, size: bytes.length, hash: digest(bytes) }; targetFiles.push(file);
      const gitHash = gitDigest(bytes);
      if (sourceBases.some(base => base.files[name] !== gitHash) || [...(historicalFiles.get(name) ?? [])].some(hash => hash !== file.hash)) {
        writeAtomic(inside(directory, 'payload/' + name), bytes); files.push(file);
      }
    }
    const deleted = [...new Set([...sourceBases.flatMap(base => Object.keys(base.files)), ...historicalFiles.keys()])].filter(name => !names.has(name)).sort();
    const baselineChanges = routes[0].differences;
    const rowsHash = digest(Buffer.from(stringify(rows)));
    const previousRowsSame = previous?.rowsHash === rowsHash;
    const previousFilesSame = previous && equal(previous.targetFiles ?? previous.manifest.files, targetFiles);
    const noChanges = !files.length && !deleted.length && routes.every(route => !route.differences.length) || previousRowsSame && previousFilesSame;
    if (noChanges) return { noChanges: true, archive: null, baseline: baseline.release, entries: 0, files: 0, bytes: 0, message: '当前公共资料无新增或修改，不生成资料更新包。' };
    const softwareBases = routes.map(base => {
      const changes = equal(base.release, baseline.release) ? 'public-changes.json.gz' : `routes/${base.release.releaseId}.json.gz`;
      writeJSON(inside(directory, changes), base.differences);
      return { release: base.release, files: base.files, changes };
    });
    const summary = { added: baselineChanges.filter(change => !change.before).length, modified: baselineChanges.filter(change => change.before && change.after).length, removed: baselineChanges.filter(change => !change.after).length, files: files.length, deleted: deleted.length };
    const manifest = { format: 'wiki-content-update', schemaVersion: 2, revision, baseline: baseline.release, publishedAt: new Date().toISOString(), notes, softwareBases, files, deleted, summary };
    writeJSON(path.join(directory, 'content.json'), manifest);
    createContentInstaller(directory);
    writeAtomic(path.join(directory, '资料更新说明.txt'), `资料批次：${revision}\r\n${notes}\r\n\r\n以Wiki 1.2.2为资料基准，仅携带新增、变更与必要恢复的文件及条目差异。支持跳过中间资料批次，软件版本不变。\r\n完整解压后双击“安装资料更新.vbs”，选择现有Wiki并检查，再开始安装。安装结果与进度在窗口显示，可查看日志。\r\n个人账号、收藏、库存与计划保留；本地百科编辑冲突保留本地值。不要把payload手动覆盖到Wiki。\r\nWiki内自动安装需支持增量资料格式的软件版，早期1.2.2可先更新软件，或使用包内独立安装器。\r\n`);
    fs.mkdirSync(output, { recursive: true });
    command('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;[IO.Compression.ZipFile]::CreateFromDirectory($env:WIKI_DATA_SOURCE,$env:WIKI_DATA_ZIP,[IO.Compression.CompressionLevel]::Optimal,$false)"], { timeout: 300000, env: { ...process.env, WIKI_DATA_SOURCE: directory, WIKI_DATA_ZIP: archive } });
    const record = { manifest, targetFiles, rowsHash };
    writeJSON(inside(root, '.release-manager/content/latest-built.json'), record);
    writeJSON(inside(root, `.release-manager/content/history/${revision}.json`), record);
    completed = true;
    return { noChanges: false, archive, revision, entries: baselineChanges.length, files: files.length, bytes: fs.statSync(archive).size, tag: 'wiki-content', notes, summary, softwareBases: softwareBases.map(item => item.release.releaseId) };
  } finally {
    if (!completed && fs.existsSync(archive)) fs.unlinkSync(archive);
    if (temporary.startsWith(cache + path.sep) && !fs.lstatSync(temporary).isSymbolicLink()) fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    try { fs.rmdirSync(cache); } catch (error) { if (!['ENOTEMPTY', 'ENOENT'].includes(error.code)) throw error; }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const value = name => process.argv.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  try {
    const notes = value('notes-file') ? fs.readFileSync(path.resolve(value('notes-file')), 'utf8') : undefined;
    const result = await buildContentRelease({ revision: value('revision'), notes }); console.log(JSON.stringify(result, null, 2));
    if (process.argv.includes('--upload') && result.archive) { const { publishContent } = await import('./publish-content.mjs'); console.log(JSON.stringify(await publishContent(result), null, 2)); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
