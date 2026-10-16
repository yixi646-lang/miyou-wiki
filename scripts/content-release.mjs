import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inside, listFiles, readJSON, writeJSON, writeAtomic, stringify } from '../lib/release-common.mjs';
import { exportPublic } from '../lib/release-data.mjs';
import { contentPath, contentRevision, digest } from '../lib/content-package.mjs';
import { buildArtworkIndex } from './build-artwork-index.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 ** 2, ...options });
  if (result.error || result.status !== 0) throw Error(result.error?.message ?? result.stderr ?? '资料打包失败。');
  return result.stdout;
}
export async function buildContentRelease({ root = project, revision = 'D' + new Date().toISOString().replace(/\D/g, '').slice(0, 14), outputDirectory, notes = '公共百科资料更新。' } = {}) {
  root = path.resolve(root);
  if (!contentRevision(revision)) throw Error('资料批次格式为 D 加14位UTC时间，例如 D20261016080000。');
  const config = readJSON(inside(root, 'release-config.json'));
  if (!config.content) throw Error('缺少资料发布范围配置。');
  const state = readJSON(inside(root, '.release-manager/state.json'));
  const releases = state.releases.filter(item => item.release.releaseId >= config.updateBaseline);
  if (!releases.length) throw Error('缺少资料兼容的软件发布基准。');
  const softwareBases = releases.map(item => {
    const listing = command(process.env.WIKI_GIT ?? 'git', ['--git-dir=' + path.join(root, '.release-manager/repository.git'), 'ls-tree', '-r', '-z', item.commit]);
    const files = {};
    for (const row of listing.split('\0').filter(Boolean)) {
      const [info, name] = row.split('\t');
      try { contentPath(name); } catch { continue; }
      files[name] = info.split(' ')[2];
    }
    return { release: item.release, files };
  });
  const output = path.resolve(outputDirectory ?? path.join(root, config.outputDirectory));
  if (!output.startsWith(root + path.sep)) throw Error('资料包输出须位于项目内。');
  fs.mkdirSync(output, { recursive: true });
  const archive = path.join(output, `Miyou-Wiki-Data-${revision}.zip`);
  if (fs.existsSync(archive)) throw Error('已有同名资料包，未覆盖。');
  const cache = inside(root, '.codex_tmp/content-build'); fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'batch-'));
  let completed = false;
  try {
    const directory = path.join(temporary, 'package'); fs.mkdirSync(directory);
    const rows = exportPublic(path.join(root, 'data/library/wiki.sqlite'));
    writeJSON(path.join(directory, 'rows.json.gz'), rows);
    const names = new Set(config.content.files);
    for (const dir of config.content.directories) for (const name of listFiles(inside(root, dir))) names.add(dir + '/' + name);
    const files = [];
    for (const name of [...names].sort()) {
      contentPath(name);
      if (name === 'public/character-artwork-index.json') continue;
      const bytes = fs.readFileSync(inside(root, name));
      writeAtomic(inside(directory, 'payload/' + name), bytes);
      files.push({ path: name, size: bytes.length, hash: digest(bytes) });
    }
    const artwork = inside(directory, 'payload/public/character-artwork-index.json'); fs.mkdirSync(path.dirname(artwork), { recursive: true });
    await buildArtworkIndex({ rootDirectory: root, sourceEntries: rows.map(row => row.payload), outputPath: artwork });
    const bytes = fs.readFileSync(artwork); files.push({ path: 'public/character-artwork-index.json', size: bytes.length, hash: digest(bytes) });
    const manifest = { format: 'wiki-content-update', schemaVersion: 1, revision, publishedAt: new Date().toISOString(), notes, softwareBases, files };
    writeJSON(path.join(directory, 'content.json'), manifest);
    const manual = fs.readFileSync(path.join(project, 'scripts/content-install-manual.ps1'));
    writeAtomic(path.join(directory, 'install-content.ps1'), Buffer.concat([Buffer.from([239, 187, 191]), manual]));
    writeAtomic(path.join(directory, '安装资料更新.cmd'), '@echo off\r\nset "WIKI_CONTENT_MANUAL=%~dp0install-content.ps1"\r\npowershell.exe -NoProfile -STA -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText($env:WIKI_CONTENT_MANUAL,[Text.Encoding]::UTF8)))"\r\npause\r\n');
    writeAtomic(path.join(directory, '资料更新说明.txt'), `资料批次：${revision}\r\n${notes}\r\n\r\nWiki 内选择“更新 → 游戏资料”，确认后下载和安装。\r\n手动安装：完整解压资料包，关闭所有 Wiki 页面并等待15秒，双击“安装资料更新.cmd”选择 Wiki 文件夹。\r\n首次须安装包含资料更新功能的 Wiki 软件版。\r\n内容包包含完整公共资料，可跳过中间批次；软件版本号不变。\r\n保留个人账号、收藏、库存和计划；本地百科编辑冲突保留本地值。\r\n请勿把 payload 直接覆盖到 Wiki，也不要替换数据库。\r\n`);
    command('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;[IO.Compression.ZipFile]::CreateFromDirectory($env:WIKI_DATA_SOURCE,$env:WIKI_DATA_ZIP,[IO.Compression.CompressionLevel]::Optimal,$false)"], { timeout: 300000, env: { ...process.env, WIKI_DATA_SOURCE: directory, WIKI_DATA_ZIP: archive } });
    completed = true;
    writeJSON(inside(root, '.release-manager/content/latest-built.json'), { manifest, rowsHash: digest(Buffer.from(stringify(rows))) });
    return { archive, revision, entries: rows.length, files: files.length, bytes: fs.statSync(archive).size, tag: 'wiki-content', notes, softwareBases: softwareBases.map(item => item.release.releaseId) };
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
    const result = await buildContentRelease({ revision: value('revision'), notes });
    console.log(JSON.stringify(result, null, 2));
    if (process.argv.includes('--upload')) { const { publishContent } = await import('./publish-content.mjs'); console.log(JSON.stringify(await publishContent(result), null, 2)); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
