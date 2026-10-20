import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { openLibrary } from '../lib/database.mjs';
import { exportPublic } from '../lib/release-data.mjs';
import { readJSON, writeJSON, listFiles, PUBLIC_BASE, INSTALLED } from '../lib/release-common.mjs';
import { applyUpdate } from '../lib/release-install.mjs';
import { applyContentUpdate } from '../lib/content-install.mjs';
import { digest, gitDigest, CONTENT_STATE, validateContentPackage } from '../lib/content-package.mjs';
import { createOnlineUpdates, publishedContent } from '../lib/online-updates.mjs';
import { createUpdateActions, updatePanelHTML } from '../public/online-updates.mjs';
import { buildContentRelease } from '../scripts/content-release.mjs';
import { buildArtworkIndex } from '../scripts/build-artwork-index.mjs';
import { metadataForPackage, withPublishedMetadata } from '../lib/update-metadata.mjs';
import { createTestWorkspace, cleanupTestWorkspace, stopTestProcess } from '../scripts/test-resources.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const release = { schemaVersion: 1, version: '1.2.1', releaseId: 'R000007', kind: 'fix', publishedAt: '2026-10-15T00:00:00Z' };
const image = 'assets/genshin/test.png';
const put = (name, bytes) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, bytes); };
const payload = (id, x = '旧值', y = '原值') => ({ id, game: 'genshin', category: 'characters', name: id, rarity: 5, details: { x, y } });
const row = entry => ({ id: entry.id, payload: entry, revision: 2, updatedAt: '2026-10-16T00:00:00Z' });
function edit(root, fn) { const library = openLibrary(path.join(root, 'data/library/wiki.sqlite')); try { return fn(library); } finally { library.close(); } }
async function fixture() {
  const root = await createTestWorkspace('content-updates');
  writeJSON(path.join(root, 'release.json'), release);
  writeJSON(path.join(root, INSTALLED), { schemaVersion: 1, release, managedPaths: [image] });
  put(path.join(root, image), 'old-image');
  edit(root, library => { for (const id of ['genshin-a','genshin-b','genshin-c']) library.create(payload(id)); library.favorite('genshin-b', true); library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin', '{"inventory":{"private":77},"goals":[]}'); });
  const rows = exportPublic(path.join(root, 'data/library/wiki.sqlite')); writeJSON(path.join(root, PUBLIC_BASE), rows);
  put(path.join(root, 'data/assessment/private.bin'), 'accounts-equipment-teams');
  return { root, rows };
}
function pack(directory, rows, revision = 'D20261016010000', software = release) {
  fs.mkdirSync(directory, { recursive: true });
  put(path.join(directory, 'payload', image), 'new-image');
  writeJSON(path.join(directory, 'rows.json.gz'), rows);
  writeJSON(path.join(directory, 'content.json'), { format: 'wiki-content-update', schemaVersion: 1, revision, publishedAt: '2026-10-16T01:00:00Z', softwareBases: [{ release: software, files: { [image]: gitDigest(Buffer.from('old-image')) } }], files: [{ path: image, size: 9, hash: digest(Buffer.from('new-image')) }] });
}
function copyRuntime(root) {
  for (const name of ['lib/release-common.mjs','lib/release-data.mjs','lib/release-install.mjs','lib/content-package.mjs','lib/content-install.mjs','scripts/install-content.mjs','scripts/online-update-runner.mjs','scripts/extract-online-update.ps1', ...listFiles(path.join(project, 'shared')).filter(name => name.endsWith('.mjs')).map(name => 'shared/' + name)]) put(path.join(root, name), fs.readFileSync(path.join(project, name)));
  put(path.join(root, 'scripts/launch.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(path.join(root, 'restarted.txt'))}, 'yes');`);
}
test('资料累计安装保留本地编辑与个人资料；失败恢复；随后软件升级可继续合并', async () => {
  const { root, rows } = await fixture();
  try {
    edit(root, library => { const old = library.get('genshin-a'); library.update(old.id, payload(old.id, '本地编辑'), old.revision); library.db.prepare('DELETE FROM entries WHERE id=?').run('genshin-c'); });
    const directory = path.join(root, 'content-package'), next = [row(payload('genshin-a', '旧值', '新资料')), row(payload('genshin-c')), row(payload('genshin-d'))]; pack(directory, next);
    const softwareBytes = fs.readFileSync(path.join(root, 'release.json')), publicBytes = fs.readFileSync(path.join(root, PUBLIC_BASE));
    assert.throws(() => applyContentUpdate(root, directory, { failAt: 'after-files' }), /中断/);
    assert.equal(fs.readFileSync(path.join(root, image), 'utf8'), 'old-image'); assert.equal(fs.existsSync(path.join(root, CONTENT_STATE)), false);
    const result = applyContentUpdate(root, directory); assert.equal(result.revision, 'D20261016010000'); assert(result.conflicts > 0);
    const notice = readJSON(path.join(root, '.updates/results/content.json')); assert.equal(notice.contentRevision, result.revision); assert.equal(notice.conflicts, result.conflicts);
    assert.deepEqual(fs.readFileSync(path.join(root, 'release.json')), softwareBytes); assert.deepEqual(fs.readFileSync(path.join(root, PUBLIC_BASE)), publicBytes);
    edit(root, library => { assert.equal(library.get('genshin-a').details.x, '本地编辑'); assert.equal(library.get('genshin-a').details.y, '新资料'); assert(library.get('genshin-d')); assert(library.get('genshin-b')); assert.equal(library.get('genshin-c'), undefined); library.seed(path.join(root, 'data/catalog')); assert.equal(library.get('genshin-c'), undefined); assert.deepEqual(library.favorites(), ['genshin-b']); assert.match(library.db.prepare('SELECT value FROM metadata WHERE key=?').get('growth_plan:genshin').value, /77/); });
    assert.equal(fs.readFileSync(path.join(root, 'data/assessment/private.bin'), 'utf8'), 'accounts-equipment-teams');
    assert.throws(() => applyContentUpdate(root, directory), /已安装/);
    put(path.join(root, image), 'local-image');
    pack(directory, next, 'D20261016030000'); applyContentUpdate(root, directory); assert.equal(fs.readFileSync(path.join(root, image), 'utf8'), 'local-image', '跳过中间批次并保留文件编辑');
    const update = path.join(root, 'software-package'), to = { ...release, version: '1.2.2', releaseId: 'R000008' };
    const incoming = { ...rows[0], payload: { ...rows[0].payload, details: { ...rows[0].payload.details, addedBySoftware: true } } };
    writeJSON(path.join(update, 'update.json'), { format: 'wiki-local-update', schemaVersion: 1, from: release, to, files: [], deleted: [] });
    writeJSON(path.join(update, 'public-changes.json.gz'), [{ id: incoming.id, before: rows[0], after: incoming }]);
    applyUpdate(root, update);
    edit(root, library => { assert.equal(library.get('genshin-a').details.y, '新资料'); assert.equal(library.get('genshin-a').details.addedBySoftware, true); });
    const future = next.map(item => item.id === incoming.id ? { ...item, payload: { ...item.payload, details: { ...item.payload.details, y: '下一批', addedBySoftware: true } } } : item);
    pack(directory, future, 'D20261016040000', to); applyContentUpdate(root, directory);
    edit(root, library => { assert.equal(library.get('genshin-a').details.y, '下一批'); assert.equal(library.get('genshin-a').details.x, '本地编辑'); });
    const manifest = readJSON(path.join(directory, 'content.json')); manifest.files[0].path = 'server.mjs'; writeJSON(path.join(directory, 'content.json'), manifest);
    assert.throws(() => validateContentPackage(directory, to), /不能更新程序/);
    assert.equal(fs.existsSync(path.join(root, '.updates/transaction')), false);
  } finally { await cleanupTestWorkspace(root); }
});

test('资料检查仅提醒；代表交互确认后经真实解压、独立助手安装并重启', async () => {
  const { root } = await fixture(); let updater, parent, runner, downloads = 0, consent = false;
  try {
    copyRuntime(root);
    const source = path.join(root, 'pack'); pack(source, [row(payload('genshin-a', '旧值', '联网新资料'))]);
    const require = createRequire(import.meta.url), { zipSync } = require(path.join(project, '.release-manager/build-tools/node_modules/fflate'));
    const bytes = zipSync(Object.fromEntries(listFiles(source).map(name => [name, fs.readFileSync(path.join(source, name))])));
    const remote = { id: 600, tag_name: 'wiki-content', html_url: 'https://github.com/yixi646-lang/miyou-wiki/releases/tag/wiki-content', body: '公共资料 <script>bad</script>', assets: [{ id: 601, name: 'Miyou-Wiki-Data-D20261016010000.zip', state: 'uploaded', size: bytes.length, browser_download_url: 'https://github.com/yixi646-lang/miyou-wiki/releases/download/wiki-content/Miyou-Wiki-Data-D20261016010000.zip' }] };
    remote.body = withPublishedMetadata(remote.body, metadataForPackage(readJSON(path.join(source, 'content.json')), remote.assets[0].name));
    assert.equal(publishedContent({ ...remote, tag_name: 'v1.2.2' }), null);
    parent = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true, stdio: 'ignore' }); await once(parent, 'spawn');
    updater = createOnlineUpdates({ root, port: 4199, channel: 'content', platform: 'win32', fetchImpl: async url => { if (url.includes('api.github.com')) { assert.match(url, /releases\/tags\/wiki-content$/); return Response.json(remote); } downloads++; return new Response(bytes); }, launchRunner: async job => {
      const directory = path.join(root, '.updates/content-online/jobs', job.id), config = path.join(directory, 'runner.json');
      fs.copyFileSync(path.join(project, 'scripts/online-update-runner.mjs'), path.join(directory, 'runner.mjs'));
      writeJSON(config, { root, jobId: job.id, parentPid: parent.pid, port: 4199, expectedFrom: release, channel: 'content' });
      runner = spawn(process.execPath, [path.join(directory, 'runner.mjs'), config], { windowsHide: true, stdio: 'ignore' }); await once(runner, 'spawn');
    }, onInstall: () => parent.kill() });
    let info = await updater.check(); assert(info.available); assert.equal(downloads, 0);
    assert.match(updatePanelHTML(info), /游戏资料/); assert.match(updatePanelHTML(info), /资料更新不改变软件版本/); assert(!updatePanelHTML(info).includes('<script>bad'));
    const actions = createUpdateActions({ api: (route, options) => { assert.equal(route, 'content-updates/start'); return updater.start(options.body); }, confirm: () => consent });
    await actions('github', info); await actions('automatic', info); assert.equal(downloads, 0); await assert.rejects(updater.start({ key: info.latest.key }), /请先确认/);
    consent = true; await actions('automatic', info); await updater.wait(); assert.equal(downloads, 1); assert(runner, updater.status().job?.message);
    if (runner.exitCode === null) await once(runner, 'exit'); assert.equal(runner.exitCode, 0);
    for (let i = 0; i < 80 && !fs.existsSync(path.join(root, 'restarted.txt')); i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(fs.readFileSync(path.join(root, 'restarted.txt'), 'utf8'), 'yes');
    assert.equal(updater.status().job.phase, 'complete'); assert.equal(updater.status().available, false);
    assert.equal(readJSON(path.join(root, 'release.json')).version, '1.2.1');
    edit(root, library => assert.equal(library.get('genshin-a').details.y, '联网新资料'));
    assert.equal(fs.readdirSync(path.join(root, '.updates/content-online/jobs')).length, 0);
  } finally { await updater?.close(); await stopTestProcess(runner); await stopTestProcess(parent); await cleanupTestWorkspace(root); }
});

test('1.2.2基准无变化不出包；累计增量跳批次、恢复旧值，包内窗口安装器独立运行', async () => {
  const { root, rows } = await fixture(); let wizard;
  try {
    const baseline = { ...release, version: '1.2.2', releaseId: 'R000008' };
    writeJSON(path.join(root, 'release.json'), baseline);
    writeJSON(path.join(root, INSTALLED), { schemaVersion: 1, release: baseline, managedPaths: [image] });
    writeJSON(path.join(root, 'data/character-artwork-variants.json'), { variants: {} });
    writeJSON(path.join(root, '.release-data/public.json'), rows);
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    await buildArtworkIndex({ rootDirectory: root, sourceEntries: rows.map(row => row.payload), outputPath: path.join(root, 'public/character-artwork-index.json') });
    writeJSON(path.join(root, 'release-config.json'), { updateBaseline: 'R000007', outputDirectory: '包体', content: { baseline: 'R000008', directories: ['assets'], files: ['data/character-artwork-variants.json'] } });
    const git = process.env.WIKI_GIT ?? 'git', repo = path.join(root, '.release-manager/repository.git');
    const run = args => { const result = spawnSync(git, args, { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' } }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
    run(['init', '--bare', repo]);
    run(['--git-dir=' + repo, '--work-tree=' + root, 'add', '--', 'assets', 'data/character-artwork-variants.json', '.release-data/public.json', 'public/character-artwork-index.json']);
    const tree = run(['--git-dir=' + repo, 'write-tree']), commit = run(['--git-dir=' + repo, 'commit-tree', tree, '-m', 'fixture']);
    const state = { releases: [{ release: baseline, commit }] }; writeJSON(path.join(root, '.release-manager/state.json'), state);
    const idle = await buildContentRelease({ root, revision: 'D20261016080000' }); assert.equal(idle.noChanges, true); assert.equal(idle.archive, null);
    const require = createRequire(import.meta.url), { unzipSync } = require(path.join(project, '.release-manager/build-tools/node_modules/fflate'));
    const extract = (result, directory) => { const entries = unzipSync(fs.readFileSync(result.archive)); for (const [name, bytes] of Object.entries(entries)) put(path.join(directory, name.replaceAll('\\', '/')), bytes); return Object.keys(entries).map(name => name.replaceAll('\\', '/')); };
    const makeFriend = name => {
      const directory = path.join(root, name);
      for (const file of ['release.json', INSTALLED, PUBLIC_BASE, image, 'data/character-artwork-variants.json', 'public/character-artwork-index.json']) put(path.join(directory, file), fs.readFileSync(path.join(root, file)));
      edit(directory, library => { for (const item of rows) library.create(item.payload); library.favorite('genshin-b', true); });
      put(path.join(directory, 'data/assessment/private.bin'), 'private-accounts');
      return directory;
    };
    const friend = makeFriend('friend'), skip = makeFriend('friend-skip'), graphical = makeFriend('friend-gui');
    const addedImage = 'assets/genshin/added.png';
    put(path.join(root, addedImage), 'new-artwork');
    put(path.join(root, image), 'changed-image');
    edit(root, library => library.create(payload('genshin-d', '首批')));
    const first = await buildContentRelease({ root, revision: 'D20261016090000' });
    assert.equal(first.entries, 1); assert.equal(first.files, 2);
    const firstPack = path.join(root, 'first-pack');
    const names = extract(first, firstPack);
    assert(names.includes('content.json')); assert(names.includes('public-changes.json.gz')); assert(!names.includes('rows.json.gz'));
    assert(names.includes('安装资料更新.vbs')); assert(names.includes('installer/wizard.ps1')); assert(names.includes('installer/lib/content-install.mjs'));
    assert(!names.some(name => /assessment|sqlite|public-base|release\.json/.test(name)));
    assert(!names.includes('payload/data/character-artwork-variants.json'), '未变化文件不重复打包');
    assert.equal(readJSON(path.join(firstPack, 'public-changes.json.gz')).length, 1);
    assert.throws(() => applyContentUpdate(friend, firstPack, { failAt: 'after-files' }), /中断/);
    assert.equal(fs.existsSync(path.join(friend, addedImage)), false);
    applyContentUpdate(friend, firstPack);
    assert.equal(fs.readFileSync(path.join(friend, image), 'utf8'), 'changed-image');
    const unchanged = await buildContentRelease({ root, revision: 'D20261016091000' }); assert.equal(unchanged.archive, null);
    // The next cumulative package restores a baseline file and removes a file introduced by the first batch.
    put(path.join(root, image), 'old-image'); fs.unlinkSync(path.join(root, addedImage));
    edit(root, library => { const entry = library.get('genshin-d'); library.update(entry.id, payload(entry.id, '第二批'), entry.revision); });
    const second = await buildContentRelease({ root, revision: 'D20261016093000' });
    const secondPack = path.join(root, 'second-pack'); extract(second, secondPack);
    const manifest = readJSON(path.join(secondPack, 'content.json'));
    assert.deepEqual(manifest.files.map(file => file.path), [image]); assert.deepEqual(manifest.deleted, [addedImage]);
    for (const directory of [friend, skip]) {
      applyContentUpdate(directory, secondPack);
      assert.equal(fs.readFileSync(path.join(directory, image), 'utf8'), 'old-image');
      assert.equal(fs.existsSync(path.join(directory, addedImage)), false);
      edit(directory, library => { assert.equal(library.get('genshin-d').details.x, '第二批'); assert.deepEqual(library.favorites(), ['genshin-b']); });
      assert.equal(fs.readFileSync(path.join(directory, 'data/assessment/private.bin'), 'utf8'), 'private-accounts');
      assert.deepEqual(readJSON(path.join(directory, 'release.json')), baseline);
    }
    // Exercise the real window and its bundled backend against a client containing no updater code.
    const report = path.join(root, 'wizard-result.json');
    wizard = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(secondPack, 'installer/wizard.ps1'), '-SelfTestTarget', graphical, '-SelfTestReport', report], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH } });
    let stderr = ''; wizard.stderr.setEncoding('utf8'); wizard.stderr.on('data', data => { stderr += data; }); wizard.stdout.resume();
    const timeout = setTimeout(() => wizard.kill(), 25000);
    try { const [code] = await once(wizard, 'exit'); assert.equal(code, 0, stderr); } finally { clearTimeout(timeout); }
    const ui = readJSON(report); assert.equal(ui.result.status, 'success', JSON.stringify(ui)); assert.equal(ui.progress, 100); assert.match(ui.stage, /更新完成/);
    edit(graphical, library => assert.equal(library.get('genshin-d').details.x, '第二批'));
    assert.deepEqual(readJSON(path.join(root, '.release-manager/state.json')), state); assert.deepEqual(readJSON(path.join(root, 'release.json')), baseline);
    assert.equal(fs.existsSync(path.join(root, '.codex_tmp/content-build')), false);
  } finally { await stopTestProcess(wizard); await cleanupTestWorkspace(root); }
});
