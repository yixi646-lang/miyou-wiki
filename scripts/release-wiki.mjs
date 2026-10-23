import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { readJSON, writeJSON, writeAtomic, inside, publicPath, listFiles, equal, stringify, PUBLIC_CATALOG, PUBLIC_BASE, INSTALLED, assertStopped } from '../lib/release-common.mjs';
import { exportPublic, diffRows, writeRows } from '../lib/release-data.mjs';
import { openLibrary } from '../lib/database.mjs';
import { applyUpdate } from '../lib/release-install.mjs';
import { buildArtworkIndex } from './build-artwork-index.mjs';
import { syncNativeData } from '../modules/character-assessment/vendor/sync-native-data.mjs';
import { createInstallerBundle, repackInstaller } from './update-installer/build.mjs';
import { buildContentRelease } from './content-release.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const GENERATED = ['public/character-artwork-index.json', 'modules/character-assessment/core/calculator.mjs', 'modules/character-assessment/core/catalog.json', 'modules/character-assessment/core/game-stats.json', 'modules/character-assessment/core/zh.json'];
const PRIVATE = '.release-data/';
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { windowsHide: true, maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw Error(result.error?.message ?? `${executable} 执行失败：${result.stderr?.toString() || result.stdout?.toString()}`);
  return result.stdout;
}
function git(root, args, workTree, input) {
  return command(process.env.WIKI_GIT ?? 'git', ['--git-dir=' + path.join(root, '.release-manager/repository.git'), ...(workTree ? ['--work-tree=' + workTree] : []), ...args], { cwd: root, input });
}
function initialize(root) {
  const repository = path.join(root, '.release-manager/repository.git');
  if (!fs.existsSync(repository)) {
    fs.mkdirSync(path.dirname(repository), { recursive: true });
    command(process.env.WIKI_GIT ?? 'git', ['init', '--bare', repository], { cwd: root });
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['config', 'core.safecrlf', 'false']);
  }
}
function publisherOperation(root, fn) {
  initialize(root);
  const filename = path.join(root, '.release-manager/publisher.lock');
  if (fs.existsSync(filename)) {
    const previous = readJSON(filename);
    try { process.kill(previous.pid, 0); }
    catch (error) { if (error.code !== 'ESRCH') throw error; fs.unlinkSync(filename); }
    if (fs.existsSync(filename)) throw Error('另一项发布任务正在运行。');
  }
  const handle = fs.openSync(filename, 'wx'); fs.writeFileSync(handle, JSON.stringify({ pid: process.pid })); fs.closeSync(handle);
  return Promise.resolve().then(fn).finally(() => fs.unlinkSync(filename));
}
function stateOf(root) { return readJSON(path.join(root, '.release-manager/state.json'), { schemaVersion: 1, releases: [] }); }
function copyFile(source, destination) { const info=fs.statSync(source); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination); fs.utimesSync(destination, info.atime, info.mtime); }
function ignored(name, config, privateSource = false) {
  if (/(?:^|\/)(?:node_modules|logging|GenshinData|\.build|\.git|\.codex_tmp)(?:\/|$)/i.test(name) || /\.(?:sqlite|db)(?:-(?:wal|shm))?$|\.pdb$/i.test(name)) return true;
  if(!privateSource&&name.startsWith('原神库存扫描器/中文界面预览/')&&!/^(?:原神库存扫描器\/中文界面预览\/(?:inventorylists|tessdata|x64|x86)\/|原神库存扫描器\/中文界面预览\/(?:[^/]+\.dll(?:\.config)?|InventoryKamera\.zh\.exe(?:\.config)?|LICENSE[^/]*\.txt|启动中文扫描器\.vbs|界面修改来源\.json)$)/i.test(name))return true;
  return !privateSource && (config.excludeFiles.includes(name) || config.excludePrefixes.some(prefix => name.startsWith(prefix)));
}
function checkScope(root, config) {
  const knownFiles = new Set([...config.files, ...config.sourceFiles, ...(config.knownRootFiles ?? []), 'AGENTS.md', 'release.json', 'release-config.json']);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !config.knownRootDirectories.includes(entry.name)) throw Error(`发现未分类的顶层目录：${entry.name}。请先更新 release-config.json。`);
    if (entry.isFile() && !knownFiles.has(entry.name) && !/^(?:Wiki|米游Wiki).*\.zip$/i.test(entry.name)) throw Error(`发现未分类的根目录文件：${entry.name}。请先更新发布配置。`);
  }
  for (const entry of fs.readdirSync(path.join(root, 'data'), { withFileTypes: true })) {
    if (entry.isDirectory() && !config.knownDataDirectories.includes(entry.name)) throw Error(`发现未分类的资料目录：data/${entry.name}。请先更新发布配置。`);
    if (entry.isFile() && !config.files.includes('data/' + entry.name)) throw Error(`发现未分类的资料文件：data/${entry.name}。请先更新发布配置。`);
  }
}
function gather(root, snapshot, config) {
  checkScope(root, config);
  const sourceMap = {}, seen = new Set();
  function capture(name, target, isPublic) {
    if (seen.has(name) && Object.hasOwn(sourceMap, name)) return;
    const source = inside(root, name);
    if (!fs.existsSync(source)) throw Error(`发布配置中的文件缺失：${name}`);
    copyFile(source, inside(snapshot, target)); sourceMap[name] = target; seen.add(name);
    if (isPublic && (GENERATED.includes(name) || name === '启动百科.vbs' || name === '原神库存扫描器.lnk')) {
      const original = `${PRIVATE}source-files/${name}`;
      copyFile(source, inside(snapshot, original)); sourceMap[name] = original;
    }
  }
  for (const directory of config.directories) {
    for (const name of listFiles(inside(root, directory))) {
      const relative = `${directory}/${name}`;
      if (!ignored(relative, config)) capture(relative, relative, true);
    }
  }
  for (const name of [...config.files, ...config.runtimeScripts]) capture(name, name, true);
  for (const directory of config.sourceDirectories) {
    for (const name of listFiles(inside(root, directory))) {
      const relative = `${directory}/${name}`;
      if (!ignored(relative, config, true) && !Object.hasOwn(sourceMap, relative)) capture(relative, `${PRIVATE}source-files/${relative}`, false);
    }
  }
  for (const name of config.sourceFiles) if (!Object.hasOwn(sourceMap, name)) capture(name, `${PRIVATE}source-files/${name}`, false);
  writeJSON(inside(snapshot, PRIVATE + 'source-map.json'), sourceMap);
  return sourceMap;
}
function verifySources(root, snapshot, sourceMap, rows, config) {
  checkScope(root, config);
  const inputs = new Set([...config.files, ...config.runtimeScripts, ...config.sourceFiles]);
  for (const directory of config.directories) for (const name of listFiles(inside(root, directory))) if (!ignored(`${directory}/${name}`, config)) inputs.add(`${directory}/${name}`);
  for (const directory of config.sourceDirectories) for (const name of listFiles(inside(root, directory))) if (!ignored(`${directory}/${name}`, config, true)) inputs.add(`${directory}/${name}`);
  if (!equal([...inputs].sort(), Object.keys(sourceMap).sort())) throw Error('采集期间发布范围新增或移除了文件，未推进发布基准。');
  for (const [name, captured] of Object.entries(sourceMap)) {
    const source = inside(root, name);
    if (!fs.existsSync(source) || !fs.readFileSync(source).equals(fs.readFileSync(inside(snapshot, captured)))) throw Error(`采集期间文件发生变化：${name}。未推进发布基准，请停止并行编辑后重试。`);
  }
  if (!equal(exportPublic(path.join(root, 'data/library/wiki.sqlite')), rows)) throw Error('采集期间正式条目发生变化，未推进发布基准。');
}
function show(root, commit, name) { return git(root, ['show', `${commit}:${name}`]); }
function pathsAt(root, commit) { return git(root, ['ls-tree', '-r', '--name-only', '-z', commit]).toString('utf8').split('\0').filter(Boolean); }
function publicPaths(root, commit) { return pathsAt(root, commit).filter(name => !name.startsWith(PRIVATE)).map(publicPath); }
function changedPaths(root, before, after) {
  const parts = git(root, ['diff', '--no-renames', '--name-status', '-z', before, after]).toString('utf8').split('\0').filter(Boolean);
  const files = [], deleted = [];
  for (let index = 0; index < parts.length; index += 2) {
    const status = parts[index], name = parts[index + 1];
    if (name.startsWith(PRIVATE)) continue;
    publicPath(name); (status === 'D' ? deleted : files).push(name);
  }
  return { files, deleted };
}
function zipDirectory(directory, output) {
  if (fs.existsSync(output)) throw Error(`已有同名压缩包，未覆盖：${output}`);
  command('powershell.exe', ['-NoProfile', '-Command', "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:WIKI_ZIP_SOURCE,$env:WIKI_ZIP_OUTPUT,[IO.Compression.CompressionLevel]::Optimal,$false)"], { env: { ...process.env, WIKI_ZIP_SOURCE: directory, WIKI_ZIP_OUTPUT: output }, timeout: 180000 });
}
function createInstaller(root, commit, directory) {
  const names = pathsAt(root, commit);
  const shared = names.filter(name => name.startsWith('shared/') && name.endsWith('.mjs'));
  const read = name => show(root, commit, names.includes(name) ? name : PRIVATE + 'source-files/' + name);
  const allTemplates = ['run.mjs', 'wizard.ps1', 'launch.vbs', 'install.cmd'].every(name => names.includes(PRIVATE + 'source-files/scripts/update-installer/' + name));
  createInstallerBundle(directory, read, shared, allTemplates ? name => show(root, commit, PRIVATE + 'source-files/scripts/update-installer/' + name) : undefined);
}

function createPatch(root, from, to, directory, snapshot, routeSources) {
  fs.mkdirSync(directory, { recursive: true });
  const times = JSON.parse(show(root, to.commit, PRIVATE + 'file-times.json'));
  const after = JSON.parse(show(root, to.commit, PRIVATE + 'public.json'));
  const payload = new Map(), removed = new Set(), entryIds = new Set(), routes = [], details = [];
  for (const source of routeSources ?? [from]) {
    const differences = changedPaths(root, source.commit, to.commit), files = [];
    if (differences.files.includes('runtime/node.exe') || differences.deleted.includes('runtime/node.exe')) throw Error(`从 ${source.release.version} / ${source.release.releaseId} 更新涉及 Node.js 运行时变化，请使用完整包发布。`);
    for (const name of differences.files) {
      if (!payload.has(name)) {
        const bytes = snapshot ? fs.readFileSync(inside(snapshot, name)) : show(root, to.commit, name);
        writeAtomic(inside(directory, 'payload/' + name), bytes);
        payload.set(name, { path: name, size: bytes.length, mtime: times[name] });
      }
      files.push(payload.get(name));
    }
    const before = JSON.parse(show(root, source.commit, PRIVATE + 'public.json'));
    const changes = diffRows(before, after);
    const publicChanges = source.release.releaseId === from.release.releaseId ? 'public-changes.json.gz' : `routes/${source.release.releaseId}.json.gz`;
    writeJSON(inside(directory, publicChanges), changes);
    const route = { from: source.release, files, deleted: differences.deleted, publicChanges };
    routes.push(route); details.push({ route, changes, oldPaths: new Set(publicPaths(root, source.commit)) });
    differences.deleted.forEach(name => removed.add(name)); changes.forEach(change => entryIds.add(change.id));
  }
  const base = details.find(detail => detail.route.from.releaseId === from.release.releaseId);
  if (!base) throw Error('跨版本更新缺少最低基准。');
  const { files, deleted } = base.route;
  writeJSON(path.join(directory, 'update.json'), { format: 'wiki-local-update', schemaVersion: 1, from: from.release, to: to.release, files, deleted, ...(routeSources ? { routes } : {}) });
  const fileList = [
    `Wiki ${from.release.version} / ${from.release.releaseId} → ${to.release.version} / ${to.release.releaseId}`,
    ...(routeSources ? [`支持直接更新的起点：${routes.map(route => `${route.from.version} / ${route.from.releaseId}`).join('、')}`, '按本机已安装批次选择对应记录，无需逐个安装中间版本。'] : []),
    `包内共享文件 ${payload.size} 个，按起点分别记录删除项和公共条目变化。`,
    '文件路径相对于所选Wiki目录。',
    ...details.flatMap(({ route, changes, oldPaths }) => [
      '', `起点 ${route.from.version} / ${route.from.releaseId}：`,
      `新增文件 ${route.files.filter(file => !oldPaths.has(file.path)).length} 个，修改文件 ${route.files.filter(file => oldPaths.has(file.path)).length} 个，删除公共文件 ${route.deleted.length} 个，公共条目变化 ${changes.length} 条。`,
      '', '文件变化：',
      ...route.files.map(file => `[${oldPaths.has(file.path) ? '修改' : '新增'}] ${file.path}`), ...route.deleted.map(name => `[删除] ${name}`),
      '', '公共条目变化：',
      ...changes.map(change => `[${!change.before ? '新增' : !change.after ? '删除' : '修改'}] ${change.id} ${change.after?.payload.name ?? change.before?.payload.name ?? ''}`),
    ]),
  ];
  writeAtomic(path.join(directory, '更新文件清单.txt'), fileList.join('\r\n') + '\r\n');
  createInstaller(root, to.commit, directory);
  writeAtomic(path.join(directory, '更新说明.txt'), `Wiki ${from.release.version} / ${from.release.releaseId} → ${to.release.version} / ${to.release.releaseId}\r\n${routeSources ? `支持上述最低版本起的 ${routes.length} 个已收录正式批次直接更新，无需安装中间版本。` : '仅适用于上述起始批次。'}\r\n关闭所有 Wiki 页面并等待约 15 秒，关闭扫描器。\r\n将更新包完整解压到独立目录，双击本包“安装更新.vbs”；“安装更新.cmd”也打开同一向导。\r\n选择现有 Wiki 文件夹，或选择其中的“启动百科.vbs”，核对当前与目标版本，再点击“开始更新”。\r\n窗口显示进度与明确的完成 / 失败结果；完成后可直接启动 Wiki。不要手动覆盖数据库或 payload。\r\n个人收藏、库存、计划和评估账号保留；百科编辑冲突保留本地值并输出记录。\r\n已经是目标批次无需重复安装；早于最低基准、未收录批次或运行时不兼容时使用完整包。此包不含版本回退功能。\r\n各起点的文件与条目变化见“更新文件清单.txt”；功能变化见“版本更新详情.txt”，完整教程见“Wiki使用说明.txt”。\r\n`);
  const notesPath = `${PRIVATE}source-files/docs/releases/${to.release.version}-${to.release.releaseId}.txt`;
  const allPaths = pathsAt(root, to.commit);
  if (allPaths.includes(notesPath)) writeAtomic(path.join(directory, '版本更新详情.txt'), show(root, to.commit, notesPath));
  if (allPaths.includes('Wiki使用说明.txt')) writeAtomic(path.join(directory, 'Wiki使用说明.txt'), show(root, to.commit, 'Wiki使用说明.txt'));
  return { files: payload.size, deleted: removed.size, entries: entryIds.size, supportedFrom: routes.map(route => route.from.releaseId), usefulChanges: [...payload.keys()].filter(name => name !== 'release.json').length + removed.size + entryIds.size };
}
function createFull(root, record, directory, snapshot, rows) {
  const wiki = path.join(directory, 'Wiki'); fs.mkdirSync(wiki, { recursive: true });
  const names = publicPaths(root, record.commit);
  for (const name of names) copyFile(inside(snapshot, name), inside(wiki, name));
  writeJSON(inside(wiki, PUBLIC_CATALOG), { format: 'wiki-public-release', schemaVersion: 1, entries: rows.map(row => row.payload) });
  writeJSON(inside(wiki, PUBLIC_BASE), rows);
  writeJSON(inside(wiki, INSTALLED), { schemaVersion: 1, release: record.release, managedPaths: [...names, PUBLIC_CATALOG].sort() });
  const content = readJSON(inside(root, '.release-manager/content/latest-built.json'), null);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const contentFiles = content?.targetFiles ?? content?.manifest.files;
  if (content && content.rowsHash === hash(Buffer.from(stringify(rows))) && contentFiles.every(file => fs.existsSync(inside(wiki, file.path)) && hash(fs.readFileSync(inside(wiki, file.path))) === file.hash)) {
    writeJSON(inside(wiki, '.updates/content/rows.json.gz'), rows);
    writeJSON(inside(wiki, '.updates/content/installed.json'), { format: 'wiki-installed-content', schemaVersion: 1, revision: content.manifest.revision, publishedAt: content.manifest.publishedAt, installedAt: record.release.publishedAt, softwareRelease: record.release, files: contentFiles });
  }
  const library = openLibrary(inside(wiki, 'data/library/wiki.sqlite'));
  try { library.db.exec('BEGIN'); writeRows(library.db, rows.map(row => ({ id: row.id, row }))); library.db.exec('COMMIT'); }
  finally { library.close(); }
  const notesPath = `${PRIVATE}source-files/docs/releases/${record.release.version}-${record.release.releaseId}.txt`;
  if (pathsAt(root, record.commit).includes(notesPath)) writeAtomic(path.join(directory, '版本更新详情.txt'), show(root, record.commit, notesPath));
  return { files: listFiles(wiki).length, entries: rows.length };
}
async function generate(root, snapshot, rows, config, previous, options) {
  const runtime = path.join(root, '.release-manager/runtime');
  for (const name of ['node.exe', 'LICENSE']) copyFile(path.join(runtime, name), path.join(snapshot, 'runtime', name));
  const vbs = path.join(snapshot, '启动百科.vbs');
  if (fs.existsSync(vbs)) {
    let contents = fs.readFileSync(vbs, 'utf8').replace('node = "D:\\soft\\nodejs\\node.exe"', 'node = fs.BuildPath(root, "runtime\\node.exe")');
    writeAtomic(vbs, contents);
  }
  if (fs.existsSync(path.join(snapshot, '原神库存扫描器'))) copyFile(path.join(root, '.release-manager/InventoryKamera-LICENSE.txt'), path.join(snapshot, '原神库存扫描器/LICENSE.txt'));
  if (options.testFixture) return;
  console.log('生成立绘索引及计算资料…');
  await buildArtworkIndex({ rootDirectory: snapshot, sourceEntries: rows.map(row => row.payload) });
  const core = path.join(snapshot, 'modules/character-assessment/core');
  git(root, ['add', '--all', '--', '.'], snapshot);
  const changed = previous ? git(root, ['diff', '--cached', '--name-only', '-z', previous.commit], snapshot).toString('utf8').split('\0') : [];
  const rebuild = !previous || changed.some(name => /(?:vendor\/(?:source\/|build-core|engine-patches|jsx-metadata|sync-native-data|zh-patches)|core\/go-adapter\.ts|upstream\.json)/.test(name));
  const source = path.join(snapshot, PRIVATE, 'source-files/modules/character-assessment/vendor/source');
  if (rebuild) {
    console.log('重建固定版本计算核心…');
    const esbuild = process.env.WIKI_ESBUILD ?? path.join(root, '.release-manager/build-tools/node_modules/esbuild/lib/main.js');
    if (!fs.existsSync(esbuild)) throw Error('计算源码变化，但缺少固定构建依赖。请按版本更新管理指南安装 esbuild 0.25.10 与 fflate 0.8.3。');
    const output = command(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(root, 'modules/character-assessment/vendor/build-core.mjs'), '--source-dir=' + source, '--output-dir=' + core], { env: { ...process.env, WIKI_ESBUILD: esbuild }, timeout: 120000 });
    console.log(output.toString('utf8').trim());
  }
  syncNativeData({ sourceDirectory: source, outputDirectory: core, wikiEntries: rows.map(row => row.payload).filter(entry => entry.game === 'genshin') });
}
export async function buildRelease({ root = projectRoot, kind = 'content', version, from, full = false, publish = false, testFixture = false, withContent = false, contentNotes = '公共百科资料更新。' } = {}) {
  root = path.resolve(root);
  return publisherOperation(root, async () => {
    if (!['full', 'fix', 'content', 'feature'].includes(kind)) throw Error('发布类别须为 full、fix、content 或 feature。');
    const config = readJSON(path.join(root, 'release-config.json'));
    const state = stateOf(root), previous = state.releases.at(-1);
    const baselineId = from ?? (kind !== 'full' && previous ? config.updateBaseline : undefined);
    const baseline = baselineId ? state.releases.find(record => record.release.releaseId === baselineId) : previous;
    if (baselineId && !baseline) throw Error(`不存在正式发布基准：${baselineId}`);
    if (!previous && kind !== 'full') throw Error('首次发布必须使用 --kind=full。');
    version ??= previous?.release.version ?? '1.0.0';
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('版本号格式应为 1.0.0。');
    if (previous && kind !== 'feature' && version !== previous.release.version) {
      const [oldMajor, oldMinor, oldPatch] = previous.release.version.split('.').map(Number);
      const [major, minor, patch] = version.split('.').map(Number);
      if (major !== oldMajor || minor !== oldMinor || patch <= oldPatch) throw Error('修复和资料发布默认保持版本；显式升修订号须保持主、次版本且修订号递增，新增功能请使用 --kind=feature。');
    }
    if (kind === 'feature' && (!previous || version.localeCompare(previous.release.version, 'en', { numeric: true }) <= 0)) throw Error('新增功能的版本号须高于上次功能版本。');
    const id = `R${String((previous ? Number(previous.release.releaseId.slice(1)) : 0) + 1).padStart(6, '0')}`;
    const draftId = `${id}-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const release = { schemaVersion: 1, version, releaseId: id, kind, publishedAt: new Date().toISOString() };
    const temporary = path.join(root, '.codex_tmp', 'release-' + draftId), snapshot = path.join(temporary, 'snapshot');
    fs.mkdirSync(snapshot, { recursive: true });
    const outputs = [];
    const contentLatest = path.join(root, '.release-manager/content/latest-built.json');
    const previousContent = withContent && fs.existsSync(contentLatest) ? fs.readFileSync(contentLatest) : null;
    let contentBuild;
    try {
      const rows = exportPublic(path.join(root, 'data/library/wiki.sqlite'));
      console.log(`采集当前公共内容：${rows.length} 条；发布 ${version} / ${id}。`);
      const sourceMap = gather(root, snapshot, config);
      await generate(root, snapshot, rows, config, previous, { testFixture });
      for (const name of GENERATED) {
        if (!sourceMap[name] || !fs.existsSync(inside(snapshot, name))) continue;
        const captured = inside(snapshot, sourceMap[name]), output = inside(snapshot, name);
        const original = fs.readFileSync(captured), generated = fs.readFileSync(output);
        if (original.equals(generated) || name.endsWith('.json') && equal(JSON.parse(original), JSON.parse(generated))) copyFile(captured, output);
        else if (name === 'public/character-artwork-index.json') {
          const realDates = [fs.statSync(captured).mtimeMs, fs.statSync(inside(root, 'data/character-artwork-variants.json')).mtimeMs, ...rows.filter(row => row.payload.category === 'characters').map(row => Date.parse(row.updatedAt))].filter(Number.isFinite);
          const date = new Date(Math.max(...realDates)); fs.utimesSync(output, date, date);
        }
      }
      verifySources(root, snapshot, sourceMap, rows, config);
      writeJSON(path.join(snapshot, 'release.json'), release);
      writeJSON(inside(snapshot, PRIVATE + 'public.json'), rows);
      writeJSON(inside(snapshot, PRIVATE + 'file-times.json'), Object.fromEntries(listFiles(snapshot).filter(name => !name.startsWith(PRIVATE)).map(name => [name,fs.statSync(inside(snapshot,name)).mtimeMs])));
      git(root, ['add', '--all', '--', '.'], snapshot);
      const tree = git(root, ['write-tree'], snapshot).toString().trim();
      const commit = git(root, ['-c', 'user.name=Wiki local publisher', '-c', 'user.email=publisher@wiki.local', 'commit-tree', tree, ...(previous ? ['-p', previous.commit] : [])], undefined, `Wiki ${version} / ${id} (${kind})\n`).toString().trim();
      git(root, ['update-ref', 'refs/drafts/' + draftId, commit]);
      const record = { release, commit }, summary = {};
      if (withContent) {
        console.log('生成独立资料更新，并登记本次软件草稿兼容基准…');
        contentBuild = summary.content = await buildContentRelease({ root, pendingRelease: record, notes: contentNotes });
        if (contentBuild.archive) outputs.push(contentBuild.archive);
        verifySources(root, snapshot, sourceMap, rows, config);
      }
      function outputName(label) {
        const proposed = config.outputDirectory ? inside(root, `${config.outputDirectory}/${label}.zip`) : path.join(root, label + '.zip');
        fs.mkdirSync(path.dirname(proposed), { recursive: true });
        return fs.existsSync(proposed) ? path.join(path.dirname(proposed), label + '-' + draftId + '.zip') : proposed;
      }
      if (!previous || full || kind === 'full') {
        const directory = path.join(temporary, 'full'); summary.full = createFull(root, record, directory, snapshot, rows);
        const output = outputName(`Wiki-${version}-${id}-Windows-x64`); outputs.push(output); zipDirectory(directory, output);
      }
      if (baseline && kind !== 'full') {
        const sources = state.releases.slice(state.releases.indexOf(baseline));
        const directory = path.join(temporary, 'update'); summary.update = createPatch(root, baseline, record, directory, snapshot, sources);
        if (!summary.update.usefulChanges && kind !== 'feature') throw Error('没有上次发布以来的有效变化，不生成空更新。');
        const output = outputName(`Wiki-${version}-更新-${baseline.release.releaseId}-至-${id}`); outputs.push(output); zipDirectory(directory, output);
      }
      const draft = { schemaVersion: 1, draftId, expectedPrevious: previous?.release.releaseId ?? null, record, outputs, summary };
      writeJSON(path.join(root, '.release-manager/drafts', draftId + '.json'), draft);
      console.log('草稿生成成功：' + draftId);
      outputs.forEach(output => console.log(output));
      if (publish) publishDraft(root, draftId);
      return draft;
    } catch (error) {
      for (const output of outputs) if (fs.existsSync(output)) fs.unlinkSync(output);
      if (contentBuild?.archive) {
        if (previousContent) writeAtomic(contentLatest, previousContent);
        else if (fs.existsSync(contentLatest)) fs.unlinkSync(contentLatest);
        const history = path.join(root, '.release-manager/content/history', contentBuild.revision + '.json');
        if (fs.existsSync(history)) fs.unlinkSync(history);
      }
      throw error;
    } finally { fs.rmSync(temporary, { recursive: true }); }
  });
}
export function publishDraft(root, draftId) {
  if (!/^R\d{6}-\d+-[a-f0-9]+$/.test(draftId)) throw Error('草稿编号无效。');
  const filename = path.join(root, '.release-manager/drafts', draftId + '.json'), draft = readJSON(filename), state = stateOf(root);
  if ((state.releases.at(-1)?.release.releaseId ?? null) !== draft.expectedPrevious) throw Error('草稿起点已过期，请重新生成。');
  if (!draft.outputs.every(output => fs.existsSync(output) && fs.statSync(output).size > 0)) throw Error('草稿压缩包不存在或不完整，未正式登记。');
  const previous = state.releases.at(-1), record = draft.record;
  if (previous && record.release.kind === 'feature' && record.release.version !== previous.release.version) writeJSON(path.join(root, '.release-manager/local-rollback.json'), { schemaVersion: 1, base: previous, createdFor: record.release, available: true });
  git(root, ['update-ref', 'refs/releases/' + record.release.releaseId, record.commit]);
  const next = { ...state, releases: [...state.releases, { ...record, outputs: draft.outputs, summary: draft.summary }] };
  writeJSON(path.join(root, '.release-manager/state.json'), next);
  writeJSON(path.join(root, 'release.json'), record.release);
  writeJSON(path.join(root, '.release-manager/installed-source.json'), { record });
  writeJSON(filename, { ...draft, published: true });
  // Object maintenance does not decide whether a release is already published.
  try { git(root, ['repack', '-d']); } catch (error) { console.log('发布已完成；本地对象压缩暂未完成：' + error.message); }
  console.log(`正式登记完成：Wiki ${record.release.version} / ${record.release.releaseId}`);
  return record;
}
export async function localRollback(root = projectRoot, { confirm = false } = {}) {
  if (!confirm) throw Error('本机回退会覆盖公共代码及资料，确认后使用 rollback --confirm，或双击回退Wiki.cmd。');
  return publisherOperation(root, async () => {
    assertStopped(root);
    const point = readJSON(path.join(root, '.release-manager/local-rollback.json'), null);
    if (!point?.available) throw Error('当前没有功能升级回退点。首次 1.0.0 不需要回退点。');
    const current = readJSON(path.join(root, '.release-manager/installed-source.json')).record, target = point.base;
    const temporary = path.join(root, '.codex_tmp', 'local-rollback-' + randomUUID()); fs.mkdirSync(temporary, { recursive: true });
    try {
      const directory = path.join(temporary, 'update');
      createPatch(root, current, target, directory);
      const sourceMap = JSON.parse(show(root, target.commit, PRIVATE + 'source-map.json'));
      const nowMap = JSON.parse(show(root, current.commit, PRIVATE + 'source-map.json'));
      // Restore maintainer sources as well as runtime files. Personal stores are excluded.
      const sourceNames = [...new Set([...Object.keys(sourceMap), ...Object.keys(nowMap)])].filter(name => !GENERATED.includes(name));
      const manifest = readJSON(path.join(directory, 'update.json'));
      const fileMap = new Map(manifest.files.map(file => [file.path, file]));
      const deleted = new Set(manifest.deleted);
      for (const name of sourceNames) {
        if (name.startsWith('tests/') || name === 'release-config.json' || name.startsWith('docs/')) continue;
        publicPath(name);
        if (sourceMap[name]) {
          const bytes = show(root, target.commit, sourceMap[name]);
          if (fs.existsSync(inside(root, name)) && fs.readFileSync(inside(root, name)).equals(bytes)) { fileMap.delete(name); deleted.delete(name); continue; }
          writeAtomic(inside(directory, 'payload/' + name), bytes); fileMap.set(name, { path: name, size: bytes.length }); deleted.delete(name);
        } else if (fs.existsSync(inside(root, name))) { fileMap.delete(name); deleted.add(name); }
      }
      const managed = [...new Set([...publicPaths(root, current.commit), ...sourceNames.filter(name => { try { publicPath(name); return true; } catch { return false; } }), PUBLIC_CATALOG])];
      writeJSON(path.join(root, INSTALLED), { schemaVersion: 1, release: current.release, managedPaths: managed });
      writeJSON(path.join(root, PUBLIC_BASE), JSON.parse(show(root, current.commit, PRIVATE + 'public.json')));
      writeJSON(path.join(directory, 'update.json'), { ...manifest, files: [...fileMap.values()], deleted: [...deleted] });
      const result = applyUpdate(root, directory, { localRollback: true });
      writeJSON(path.join(root, '.release-manager/installed-source.json'), { record: target });
      writeJSON(path.join(root, '.release-manager/local-rollback.json'), { ...point, available: false, rolledBackAt: new Date().toISOString() });
      console.log(`本机回退完成：Wiki ${result.release.version} / ${result.release.releaseId}。正式发布历史保留，朋友的安装不受影响。`);
      return result;
    } finally { fs.rmSync(temporary, { recursive: true }); }
  });
}
async function main() {
  const [action, ...arguments_] = process.argv.slice(2);
  const value = name => arguments_.find(argument => argument.startsWith('--' + name + '='))?.slice(name.length + 3);
  if (action === 'build') await buildRelease({ kind: value('kind'), version: value('version'), from: value('from'), full: arguments_.includes('--full'), publish: arguments_.includes('--publish'), withContent: arguments_.includes('--with-content'), contentNotes: value('content-notes-file') ? fs.readFileSync(path.resolve(value('content-notes-file')), 'utf8') : undefined });
  else if (action === 'publish') await publisherOperation(projectRoot, () => publishDraft(projectRoot, value('draft')));
  else if (action === 'repack-installer') console.log(await publisherOperation(projectRoot, () => repackInstaller(projectRoot, value('package'))));
  else if (action === 'list') console.log(JSON.stringify(stateOf(projectRoot).releases.map(record => ({ ...record.release, packages: record.outputs })), null, 2));
  else if (action === 'rollback') await localRollback(projectRoot, { confirm: arguments_.includes('--confirm') });
  else throw Error('命令：build --kind=full|fix|content|feature；publish --draft=编号；list；repack-installer --package=根目录ZIP文件名；rollback --confirm');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error('发布操作未完成：' + error.message); process.exitCode = 1; }
}
