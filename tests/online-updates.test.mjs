import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createOnlineUpdates, publishedSoftware } from '../lib/online-updates.mjs';
import { createUpdateActions, updatePanelHTML, mountOnlineUpdates } from '../public/online-updates.mjs';
import { readJSON, writeJSON, listFiles, PUBLIC_BASE, INSTALLED } from '../lib/release-common.mjs';
import { openLibrary } from '../lib/database.mjs';
import { exportPublic } from '../lib/release-data.mjs';
import { createInstallerBundle } from '../scripts/update-installer/build.mjs';
import { createTestWorkspace, cleanupTestWorkspace, stopTestProcess } from '../scripts/test-resources.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const current = { schemaVersion: 1, version: '1.2.1', releaseId: 'R000007', kind: 'fix', publishedAt: '2026-10-15T00:00:00Z' };
const target = { ...current, version: '1.2.2', releaseId: 'R000008', publishedAt: '2026-10-16T00:00:00Z' };
const put = (name, text) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, text); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const remote = () => ({ id: 123, tag_name: 'v1.2.2', name: 'Wiki 1.2.2', html_url: 'https://github.com/yixi646-lang/miyou-wiki/releases/tag/v1.2.2', body: '修复与功能说明 <script>bad()</script>', assets: [{ id: 456, name: 'Wiki-1.2.2-更新-R000007-至-R000008.zip', state: 'uploaded', size: 9, browser_download_url: 'https://github.com/yixi646-lang/miyou-wiki/releases/download/v1.2.2/update.zip' }] });
async function fixture() {
  const root = await createTestWorkspace('online-updates');
  writeJSON(path.join(root, 'release.json'), current);
  writeJSON(path.join(root, INSTALLED), { schemaVersion: 1, release: current, managedPaths: ['public/old.mjs'] });
  put(path.join(root, 'public/old.mjs'), 'old');
  return root;
}
function fakePackage(directory) {
  fs.mkdirSync(directory, { recursive: true });
  writeJSON(path.join(directory, 'update.json'), { format: 'wiki-local-update', schemaVersion: 1, from: current, to: target, files: [{ path: 'public/old.mjs', size: 3 }], deleted: [] });
  writeJSON(path.join(directory, 'public-changes.json.gz'), []);
  put(path.join(directory, 'payload/public/old.mjs'), 'new');
  for (const name of ['installer/run.mjs', 'installer/lib/release-common.mjs', 'installer/lib/release-install.mjs']) put(path.join(directory, name), '// fixture');
}

test('检查与提醒不下载；关闭启动检查、稍后提醒与同版本处理独立生效', async () => {
  const root = await fixture(); let metadata = 0, downloads = 0, clock = 1000;
  const fetchImpl = async url => { if (url.includes('api.github.com')) { metadata++; return Response.json(remote()); } downloads++; return new Response('123456789'); };
  const updater = createOnlineUpdates({ root, port: 4100, platform: 'win32', fetchImpl, now: () => clock });
  try {
    assert.equal(updater.status().available, false);
    let info = await updater.check({ automatic: true });
    assert.equal(info.available, true); assert.equal(metadata, 1); assert.equal(downloads, 0);
    assert.equal(fs.existsSync(path.join(root, '.updates/online/jobs')), false);
    await updater.check({ automatic: true }); assert.equal(metadata, 1);
    updater.setPreferences({ autoCheck: false }); clock += 86400001;
    await updater.check({ automatic: true }); assert.equal(metadata, 1);
    await updater.check(); assert.equal(metadata, 2); assert.equal(downloads, 0);
    info = updater.setPreferences({ defer: true }); assert.equal(info.preferences.deferredKey, info.latest.key); assert(info.preferences.remindAfter > clock);
    const same = publishedSoftware({ ...remote(), tag_name: 'v1.2.1', assets: [] }, current);
    assert.equal(same.version, current.version);
    assert.equal(publishedSoftware({ ...remote(), tag_name: 'content-20261015' }, current), null);
    const unsafe = remote(); unsafe.assets[0].browser_download_url = 'https://example.com/update.zip';
    assert.equal(publishedSoftware(unsafe, current).asset, null);
    assert.deepEqual(readJSON(path.join(root, 'release.json')), current);
    fs.mkdirSync(path.join(root, '.updates/transaction'));
    assert.equal(updater.status().automaticAllowed, false, '未恢复事务不得开始另一项自动安装');
  } finally { await updater.close(); await cleanupTestWorkspace(root); }
});

test('代表交互：GitHub 手动入口与拒绝确认不下载，确认后才启动自动更新', async () => {
  const root = await fixture(); let downloads = 0, launches = 0, shutdowns = 0, pages = 1, consent = false, confirmations = 0;
  const updater = createOnlineUpdates({ root, port: 4100, platform: 'win32', activePages: () => pages, fetchImpl: async url => url.includes('api.github.com') ? Response.json(remote()) : (downloads++, new Response('123456789')), extractArchive: async (_, directory) => fakePackage(directory), launchRunner: async () => { launches++; }, onInstall: () => { shutdowns++; } });
  let info = await updater.check();
  const actions = createUpdateActions({ api: async (route, options) => { assert.equal(route, 'updates/start'); return updater.start(options.body); }, confirm: () => { confirmations++; return consent; }, changed: next => { info = next; } });
  try {
    const html = updatePanelHTML(info);
    assert.match(html, /自动更新/); assert.match(html, /GitHub 手动下载/); assert.match(html, /启动时检查并提醒更新/);
    assert(!html.includes('<script>bad()')); assert(html.includes('&lt;script&gt;'));
    await actions('github', info); assert.equal(confirmations, 0); assert.equal(downloads, 0);
    await actions('automatic', info); assert.equal(confirmations, 1); assert.equal(downloads, 0); assert.equal(launches, 0);
    await assert.rejects(updater.start({ key: info.latest.key }), /请先确认/);
    pages = 2; await assert.rejects(updater.start({ confirm: true, key: info.latest.key }), /关闭其他/); assert.equal(downloads, 0); pages = 1;
    consent = true; await actions('automatic', info); await updater.wait();
    assert.equal(downloads, 1); assert.equal(launches, 1); assert.equal(shutdowns, 1); assert.equal(updater.status().job.phase, 'installing');
    await assert.rejects(updater.cancel(), /安装过程中不能取消/);
    assert.equal(fs.readFileSync(path.join(root, 'public/old.mjs'), 'utf8'), 'old', '下载和助手交接本身不覆盖程序');
  } finally { await updater.close(); await cleanupTestWorkspace(root); }
});

test('下载取消、内容不完整和不兼容更新包均不安装并清理本轮缓存', async () => {
  for (const mode of ['cancel', 'truncated', 'incompatible']) {
    const root = await fixture(); let launches = 0, bodyStarted;
    const started = new Promise(resolve => { bodyStarted = resolve; });
    const updater = createOnlineUpdates({ root, port: 4100, platform: 'win32', fetchImpl: async (url, options) => {
      if (url.includes('api.github.com')) return Response.json(remote());
      bodyStarted();
      if (mode === 'cancel') return new Response(new ReadableStream({ start(stream) { options.signal.addEventListener('abort', () => stream.error(new DOMException('cancelled', 'AbortError')), { once: true }); } }));
      return new Response(mode === 'truncated' ? '123' : '123456789');
    }, extractArchive: async (_, directory) => { fakePackage(directory); const manifest = readJSON(path.join(directory, 'update.json')); writeJSON(path.join(directory, 'update.json'), { ...manifest, from: { ...current, releaseId: 'R000006' } }); }, launchRunner: async () => { launches++; } });
    try {
      const info = await updater.check(); await updater.start({ confirm: true, key: info.latest.key }); await started;
      if (mode === 'cancel') await updater.cancel();
      await updater.wait(); const state = updater.status().job;
      assert.equal(state.phase, mode === 'cancel' ? 'cancelled' : 'failed'); assert.equal(launches, 0);
      assert.equal(fs.existsSync(path.join(root, '.updates/online/jobs', state.id)), false);
      assert.equal(fs.readFileSync(path.join(root, 'public/old.mjs'), 'utf8'), 'old');
    } finally { await updater.close(); await cleanupTestWorkspace(root); }
  }
});

test('下载很快而页面未读到安装状态时，服务重启仍能恢复当前页面', async () => {
  const element = () => ({ open: false, hidden: false, innerHTML: '', handlers: {}, classList: { toggle() {} }, setAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; }, showModal() { this.open = true; }, focus() {} });
  const trigger = element(), children = [];
  const document = { getElementById: () => trigger, createElement: element, body: { append(child) { children.push(child); } } };
  let tick, calls = 0, reloaded = false;
  const window = { setInterval(handler) { tick = handler; return 1; }, clearInterval() {}, addEventListener() {}, confirm: () => false, location: { reload() { reloaded = true; } }, fetch: async () => Response.json({ app: 'local-wiki', pid: 222 }) };
  const info = { pid: 111, current, latest: publishedSoftware(remote(), current), available: true, automaticAllowed: true, preferences: { autoCheck: false }, github: remote().html_url, job: { id: 'test', phase: 'downloading', percent: 10, message: '下载中', downloaded: 1, total: 9 } };
  await mountOnlineUpdates({ document, window, toast() {}, api: async () => { if (!calls++) return info; throw Error('服务正在重启'); } });
  trigger.handlers.click(); assert.match(children[0].innerHTML, /自动更新/);
  await tick(); assert.equal(reloaded, true);
});

test('真实 ZIP 解压支持中文并拒绝路径越界', async () => {
  const root = await fixture();
  const require = createRequire(import.meta.url), { zipSync, strToU8 } = require(path.join(project, '.release-manager/build-tools/node_modules/fflate'));
  try {
    for (const safe of [true, false]) {
      const directory = path.join(root, safe ? 'safe' : 'unsafe'); fs.mkdirSync(directory);
      const archive = path.join(directory, 'update.zip'), extracted = path.join(directory, 'package');
      fs.writeFileSync(archive, zipSync(safe ? { 'payload/中文.txt': strToU8('中文内容') } : { '../outside.txt': strToU8('bad') }));
      const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', '& ([scriptblock]::Create([IO.File]::ReadAllText($env:WIKI_ONLINE_EXTRACT_SCRIPT,[Text.Encoding]::UTF8)))'], { windowsHide: true, env: { ...process.env, WIKI_ONLINE_ARCHIVE: archive, WIKI_ONLINE_EXTRACT: extracted, WIKI_ONLINE_EXTRACT_SCRIPT: path.join(project, 'scripts/extract-online-update.ps1') }, encoding: 'utf8' });
      assert.equal(result.status, safe ? 0 : 1, result.stderr);
      if (safe) assert.equal(fs.readFileSync(path.join(extracted, 'payload/中文.txt'), 'utf8'), '中文内容');
      else assert.equal(fs.existsSync(path.join(root, 'outside.txt')), false);
    }
  } finally { await cleanupTestWorkspace(root); }
});

test('独立助手实际运行安装器，成功重启；安装失败保留旧版本与个人资料后重启', async () => {
  for (const fail of [false, true]) {
    const root = await fixture(), id = randomUUID(), job = path.join(root, '.updates/online/jobs', id), directory = path.join(job, 'package');
    let runner, parent;
    try {
      const library = openLibrary(path.join(root, 'data/library/wiki.sqlite'));
      try { library.create({ id: 'genshin-a', game: 'genshin', category: 'characters', name: '测试角色', rarity: 5, details: {} }); library.favorite('genshin-a', true); } finally { library.close(); }
      const rows = exportPublic(path.join(root, 'data/library/wiki.sqlite')); writeJSON(path.join(root, PUBLIC_BASE), rows);
      put(path.join(root, 'data/assessment/private.bin'), 'personal-accounts-equipment');
      fakePackage(directory);
      if (fail) writeJSON(path.join(directory, 'public-changes.json.gz'), [{ id: 'genshin-a', before: null, after: null }]);
      createInstallerBundle(directory, name => fs.readFileSync(path.join(project, name)), listFiles(path.join(project, 'shared')).filter(name => name.endsWith('.mjs')).map(name => 'shared/' + name));
      put(path.join(root, 'scripts/launch.mjs'), 'import fs from "node:fs"; fs.writeFileSync(new URL("../relaunched.json",import.meta.url),fs.readFileSync(new URL("../release.json",import.meta.url)));');
      fs.copyFileSync(path.join(project, 'scripts/online-update-runner.mjs'), path.join(job, 'runner.mjs'));
      writeJSON(path.join(root, '.updates/online/state.json'), { id, phase: 'installing', from: current, version: target.version, releaseId: target.releaseId });
      parent = spawn(process.execPath, ['-e', 'setTimeout(()=>{},400)'], { windowsHide: true, stdio: 'ignore' });
      writeJSON(path.join(job, 'runner.json'), { root, jobId: id, parentPid: parent.pid, port: 4100, expectedFrom: current });
      runner = spawn(process.execPath, [path.join(job, 'runner.mjs'), path.join(job, 'runner.json')], { windowsHide: true, stdio: 'pipe' });
      let output = ''; runner.stderr.on('data', chunk => { output += chunk; });
      const [code] = await once(runner, 'exit'); assert.equal(code, fail ? 1 : 0, output);
      for (let attempt = 0; attempt < 60 && !fs.existsSync(path.join(root, 'relaunched.json')); attempt++) await delay(50);
      assert.equal(readJSON(path.join(root, 'relaunched.json')).releaseId, fail ? current.releaseId : target.releaseId);
      assert.equal(readJSON(path.join(root, 'release.json')).releaseId, fail ? current.releaseId : target.releaseId);
      assert.equal(fs.readFileSync(path.join(root, 'public/old.mjs'), 'utf8'), fail ? 'old' : 'new');
      assert.equal(fs.readFileSync(path.join(root, 'data/assessment/private.bin'), 'utf8'), 'personal-accounts-equipment');
      const updated = openLibrary(path.join(root, 'data/library/wiki.sqlite')); try { assert.deepEqual(updated.favorites(), ['genshin-a']); } finally { updated.close(); }
      assert.equal(readJSON(path.join(root, '.updates/online/state.json')).phase, fail ? 'failed' : 'complete');
      assert.equal(fs.existsSync(job), false);
    } finally { await stopTestProcess(runner); await stopTestProcess(parent); await cleanupTestWorkspace(root); }
  }
});

test('真实本地接口保持令牌保护，隔离资料库的更新偏好也写入隔离目录', async () => {
  const root = await createTestWorkspace('online-update-api'); let child;
  try {
    const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening'); const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
    const url = 'http://127.0.0.1:' + port;
    child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(project, 'server.mjs'), '--port=' + port], { cwd: project, windowsHide: true, stdio: 'ignore', env: { ...process.env, WIKI_DB_PATH: path.join(root, 'wiki.sqlite') } });
    let boot;
    for (let attempt = 0; attempt < 100; attempt++) { try { const response = await fetch(url + '/api/bootstrap'); if (response.ok) { boot = await response.json(); break; } } catch {} await delay(70); }
    assert(boot);
    assert.equal((await fetch(url + '/api/updates/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const preferences = await fetch(url + '/api/updates/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Wiki-Token': boot.token }, body: '{"autoCheck":false}' });
    assert.equal(preferences.status, 200); assert.equal((await preferences.json()).automaticAllowed, false);
    assert.equal(readJSON(path.join(root, 'online-updates/preferences.json')).autoCheck, false);
    const denied = await fetch(url + '/api/updates/start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Wiki-Token': boot.token }, body: '{}' });
    assert.equal(denied.status, 400); assert.match((await denied.json()).error, /请先确认/);
  } finally { await stopTestProcess(child); await cleanupTestWorkspace(root); }
});
