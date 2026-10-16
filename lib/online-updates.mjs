import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inside, readJSON, writeJSON, equal, publicPath, selectUpdateRoute } from './release-common.mjs';
import { CONTENT_STATE, validateContentPackage } from './content-package.mjs';

const exec = promisify(execFile);
const repository = 'yixi646-lang/miyou-wiki';
const github = `https://github.com/${repository}/releases`;
const day = 86400000;
const busy = phase => ['downloading', 'extracting', 'installing'].includes(phase);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function compareVersions(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(a ?? '') || !/^\d+\.\d+\.\d+$/.test(b ?? '')) return 0;
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export function publishedSoftware(release, current) {
  if (!release || release.draft || release.prerelease) return null;
  const version = /^v?(\d+\.\d+\.\d+)(?:-R\d{6})?$/.exec(release.tag_name ?? '')?.[1];
  if (!version || !Number.isSafeInteger(release.id) || !release.html_url?.startsWith(github + '/tag/')) return null;
  const assets = (release.assets ?? []).filter(asset => {
    if (!Number.isSafeInteger(asset.id) || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 ** 3 || !/\.zip$/i.test(asset.name ?? '') || !/(?:更新|update|-to-)/i.test(asset.name)) return false;
    try { const url = new URL(asset.browser_download_url); return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && url.pathname.startsWith(`/${repository}/releases/download/`); } catch { return false; }
  }).sort((a, b) => a.size - b.size);
  const asset = assets.find(item => {
    const from = /更新-(R\d{6})-至-/.exec(item.name)?.[1];
    return !from || !current?.releaseId || from <= current.releaseId;
  }) ?? null;
  const releaseId = /-(R\d{6})$/.exec(release.tag_name)?.[1] ?? /-至-(R\d{6})/.exec(asset?.name ?? '')?.[1] ?? null;
  return { key: String(release.id) + ':' + (asset?.id ?? 'manual'), version, releaseId, name: String(release.name || `Wiki ${version}`).slice(0, 200), notes: String(release.body ?? '').slice(0, 20000), url: release.html_url, publishedAt: release.published_at ?? null, asset: asset ? { id: asset.id, name: asset.name, size: asset.size, url: asset.browser_download_url } : null };
}

export function publishedContent(release) {
  if (!release || release.draft || release.prerelease || release.tag_name !== 'wiki-content' || !Number.isSafeInteger(release.id) || release.html_url !== github + '/tag/wiki-content') return null;
  const assets = (release.assets ?? []).filter(asset => {
    if (!Number.isSafeInteger(asset.id) || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 ** 3 || !/^Miyou-Wiki-Data-D\d{14}\.zip$/.test(asset.name ?? '')) return false;
    try { const url = new URL(asset.browser_download_url); return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && url.pathname === `/${repository}/releases/download/wiki-content/${asset.name}`; } catch { return false; }
  }).sort((a, b) => b.name.localeCompare(a.name));
  const asset = assets[0]; if (!asset) return null;
  const revision = /^Miyou-Wiki-Data-(D\d{14})/.exec(asset.name)[1];
  return { key: `${release.id}:${asset.id}`, version: revision, revision, name: '游戏资料 ' + revision, notes: String(release.body ?? '').slice(0, 20000), url: release.html_url, publishedAt: release.published_at, asset: { id: asset.id, name: asset.name, size: asset.size, url: asset.browser_download_url } };
}

export function createOnlineUpdates({ root, databasePath, storageDirectory, port, channel = 'software', activePages = () => 1, otherBusy = () => false, onInstall = () => {}, fetchImpl = fetch, extractArchive, launchRunner, now = Date.now, platform = process.platform } = {}) {
  root = path.resolve(root);
  if (!['software', 'content'].includes(channel)) throw Error('更新频道无效。');
  const content = channel === 'content', apiPrefix = content ? '/api/content-updates/' : '/api/updates/';
  const storage = path.resolve(storageDirectory ?? path.join(root, content ? '.updates/content-online' : '.updates/online'));
  const storageRelative = path.relative(root, storage).split(path.sep).join('/');
  const statePath = inside(root, storageRelative + '/state.json');
  const cachePath = inside(root, storageRelative + '/check.json');
  const preferencesPath = inside(root, storageRelative + '/preferences.json');
  const current = () => readJSON(inside(root, 'release.json'), { version: '本地开发版' });
  let checkTask, pending, controller;
  const jobDirectory = id => {
    if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw Error('更新任务编号无效。');
    return inside(root, `${storageRelative}/jobs/${id}`);
  };
  const saveJob = value => writeJSON(statePath, value);
  const preferences = () => ({ autoCheck: true, deferredKey: null, remindAfter: 0, ...readJSON(preferencesPath, {}) });
  const installation = () => {
    if (platform !== 'win32') return { allowed: false, reason: '自动安装适用于 Windows 便携版，可前往 GitHub 下载。' };
    if (fs.existsSync(path.join(root, '.release-manager/state.json'))) return { allowed: false, reason: '当前为维护项目，源码修改已在本地生效；分享版可使用自动更新。' };
    if (fs.existsSync(path.join(root, '.updates/transaction'))) return { allowed: false, reason: '上次更新尚有恢复记录，请先使用原更新安装程序完成恢复。' };
    if (path.resolve(databasePath ?? path.join(root, 'data/library/wiki.sqlite')) !== path.join(root, 'data/library/wiki.sqlite')) return { allowed: false, reason: '当前目录使用独立资料库，请通过原更新安装程序更新。' };
    const installed = readJSON(inside(root, '.updates/installed.json'), null);
    if (!installed || installed.schemaVersion !== 1 || !Array.isArray(installed.managedPaths) || !equal(installed.release, current())) return { allowed: false, reason: '当前为维护目录或缺少分享版安装记录，请使用完整分享版。' };
    return { allowed: true, installed };
  };
  function status() {
    const cache = readJSON(cachePath, {}), local = current(), latest = cache.latest ?? null, job = readJSON(statePath, null), permission = installation();
    const contentRecord = content ? readJSON(inside(root, CONTENT_STATE), null) : null;
    const available = Boolean(latest && (content ? latest.revision > (contentRecord?.revision ?? '') : compareVersions(latest.version, local.version) > 0 || compareVersions(latest.version, local.version) === 0 && latest.releaseId && local.releaseId && latest.releaseId > local.releaseId));
    let progress;
    if (job?.phase === 'installing') progress = readJSON(path.join(jobDirectory(job.id), 'progress.json'), null);
    return { pid: process.pid, channel, current: content ? { version: contentRecord?.revision ?? '随软件内置' } : local, softwareCurrent: local, latest, available, preferences: preferences(), checkedAt: cache.checkedAt ?? null, checkError: cache.error ?? null, github: latest?.url ?? (content ? github + '/tag/wiki-content' : github), automaticAllowed: permission.allowed && !!latest?.asset, automaticReason: permission.allowed ? (latest?.asset ? null : content ? '尚未发布资料包。' : '该版本尚未提供可在 Wiki 内安装的更新包，请前往 GitHub 下载完整包。') : permission.reason, job: job ? { ...job, ...(progress ? { percent: progress.percent, message: progress.stage } : {}) } : null };
  }
  async function check({ automatic = false } = {}) {
    if (automatic && !preferences().autoCheck) return status();
    if (busy(readJSON(statePath, null)?.phase) || readJSON(statePath, null)?.phase === 'ready') return status();
    const cache = readJSON(cachePath, {});
    if (automatic && cache.attemptedAt !== undefined && now() - cache.attemptedAt < (cache.error ? 3600000 : day)) return status();
    if (checkTask) return checkTask;
    checkTask = (async () => {
      try {
        const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/${content ? 'tags/wiki-content' : 'latest'}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Miyou-Wiki-Update', ...(cache.etag ? { 'If-None-Match': cache.etag } : {}) }, signal: AbortSignal.timeout(15000) });
        if (response.status === 304) writeJSON(cachePath, { ...cache, attemptedAt: now(), checkedAt: now(), error: null });
        else if (response.status === 404) writeJSON(cachePath, { attemptedAt: now(), checkedAt: now(), latest: null, error: null });
        else {
          if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? '检查频率受限，请稍后重试。' : '更新源暂时无法访问。');
          const text = await response.text(); if (text.length > 2 * 1024 * 1024) throw Error('更新信息过大，未读取。');
          const latest = content ? publishedContent(JSON.parse(text)) : publishedSoftware(JSON.parse(text), current());
          if (!latest) throw Error(content ? '资料源未提供可识别的资料包，请前往 GitHub 查看。' : '更新源未提供可识别的软件版本，请前往 GitHub 查看。');
          writeJSON(cachePath, { attemptedAt: now(), checkedAt: now(), latest, error: null, etag: response.headers.get('etag') });
        }
      } catch (error) { writeJSON(cachePath, { ...cache, attemptedAt: now(), error: error.name === 'TimeoutError' ? '检查更新超时，可稍后重试或前往 GitHub。' : error.message }); }
      return status();
    })().finally(() => { checkTask = null; });
    return checkTask;
  }
  function setPreferences(value) {
    const next = preferences();
    if ('autoCheck' in value) { if (typeof value.autoCheck !== 'boolean') throw Error('更新检查设置无效。'); next.autoCheck = value.autoCheck; }
    if (value.defer === true) { next.deferredKey = status().latest?.key ?? null; next.remindAfter = now() + day; }
    writeJSON(preferencesPath, next); return status();
  }
  function removeJob(id) {
    const directory = jobDirectory(id);
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw Error('更新临时目录不能是链接。');
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  function validatePrepared(job) {
    const permission = installation(); if (!permission.allowed) throw Error(permission.reason);
    if (!equal(current(), job.from)) throw Error('本机版本已发生变化，请重新检查更新。');
    const directory = path.join(jobDirectory(job.id), 'package');
    if (content) {
      const { manifest } = validateContentPackage(directory, current(), { verifyFiles: false });
      if (manifest.revision !== job.version) throw Error('资料包批次与发布信息不一致。');
      if ((readJSON(inside(root, CONTENT_STATE), null)?.revision ?? '') >= manifest.revision) throw Error('该资料批次已经安装或过期。');
      return { directory, manifest };
    }
    const manifest = readJSON(inside(directory, 'update.json'));
    const route = selectUpdateRoute(manifest, permission.installed.release);
    if (manifest.to.version !== job.version || job.releaseId && manifest.to.releaseId !== job.releaseId) throw Error('更新包版本与发布信息不一致。');
    if (manifest.to.releaseId <= permission.installed.release.releaseId) throw Error('更新包不晚于本机版本。');
    const names = new Set();
    for (const file of route.files) {
      const name = publicPath(file.path);
      if (name === 'runtime/node.exe' || names.has(name.toLowerCase())) throw Error('更新包包含重复文件或运行时变化，请使用完整包。');
      names.add(name.toLowerCase());
      const info = fs.statSync(inside(directory, 'payload/' + name));
      if (!info.isFile() || info.size !== file.size) throw Error('更新包内容不完整，请重试或手动下载。');
    }
    route.deleted.forEach(publicPath);
    readJSON(inside(directory, route.publicChanges));
    for (const name of ['installer/run.mjs', 'installer/lib/release-common.mjs', 'installer/lib/release-install.mjs']) if (!fs.statSync(inside(directory, name)).isFile()) throw Error('更新安装程序不完整。');
    return { directory, manifest };
  }
  async function startRunner(job) {
    const directory = jobDirectory(job.id), runner = path.join(directory, 'runner.mjs'), config = path.join(directory, 'runner.json');
    fs.copyFileSync(path.join(root, 'scripts/online-update-runner.mjs'), runner);
    writeJSON(config, { root, jobId: job.id, parentPid: process.pid, port, expectedFrom: job.from, channel });
    const child = spawn(process.execPath, [runner, config], { cwd: directory, detached: true, windowsHide: true, stdio: 'ignore' });
    let failed;
    child.once('error', error => { failed = error; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failed || child.exitCode !== null) throw Error('更新助手未能启动，本地服务保持运行。');
      if (readJSON(path.join(directory, 'runner-ready.json'), null)?.pid === child.pid) { child.unref(); return; }
      await delay(50);
    }
    child.kill(); throw Error('更新助手启动超时，本地服务保持运行。');
  }
  async function install({ confirm, jobId } = {}) {
    if (confirm !== true) throw Error('请先确认安装并重启 Wiki。');
    const job = readJSON(statePath, null);
    if (job?.phase !== 'ready' || job.id !== jobId) throw Error('没有已就绪的更新包。');
    if (otherBusy()) throw Error('另一类更新正在进行，请等待完成后重试。');
    if (activePages() > 1) throw Error('请先保存修改并关闭其他 Wiki 页面，再安装更新。');
    validatePrepared(job);
    saveJob({ ...job, phase: 'installing', percent: 0, message: '正在准备安装并重启' });
    try { await (launchRunner ?? startRunner)(job); }
    catch (error) { saveJob({ ...job, phase: 'ready', message: error.message }); throw error; }
    onInstall(); return status();
  }
  async function start({ confirm, key, automatic = true } = {}) {
    if (confirm !== true) throw Error('请先确认下载和更新，Wiki 不会静默安装。');
    if (otherBusy()) throw Error('另一类更新正在进行，请等待完成后重试。');
    const info = status();
    if (!info.available || info.latest?.key !== key || !info.automaticAllowed) throw Error(info.automaticReason ?? '更新信息已变化，请重新检查。');
    if (['ready', 'downloading', 'extracting', 'installing'].includes(info.job?.phase)) throw Error('已有更新任务，请先完成或取消。');
    if (automatic && activePages() > 1) throw Error('请先保存修改并关闭其他 Wiki 页面，再自动更新。');
    const id = randomUUID(), directory = jobDirectory(id), archive = path.join(directory, 'update.zip');
    fs.mkdirSync(directory, { recursive: true }); controller = new AbortController();
    const signal = controller.signal;
    let job = { id, phase: 'downloading', percent: 0, message: content ? '正在下载游戏资料包' : '正在下载更新包', from: current(), version: info.latest.version, releaseId: info.latest.releaseId ?? null, targetKey: key, total: info.latest.asset.size, downloaded: 0, startedAt: now() };
    saveJob(job);
    pending = (async () => {
      try {
        const response = await fetchImpl(info.latest.asset.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(1800000)]), headers: { 'User-Agent': 'Miyou-Wiki-Update' } });
        if (!response.ok || !response.body) throw Error('更新包下载失败，请重试或前往 GitHub。');
        const file = fs.openSync(archive, 'wx'); let downloaded = 0, reported = 0;
        try {
          for await (const chunk of response.body) {
            signal.throwIfAborted(); downloaded += chunk.length;
            if (downloaded > job.total) throw Error('下载长度超过发布信息，已中止。');
            fs.writeSync(file, chunk);
            if (now() - reported > 500) { job = { ...job, downloaded, percent: Math.round(downloaded / job.total * 100) }; saveJob(job); reported = now(); }
          }
        } finally { fs.closeSync(file); }
        if (downloaded !== job.total) throw Error('更新包未下载完整，请重试。');
        signal.throwIfAborted(); job = { ...job, phase: 'extracting', downloaded, percent: 100, message: '正在检查更新包' }; saveJob(job);
        const extracted = path.join(directory, 'package');
        if (extractArchive) await extractArchive(archive, extracted);
        else await exec('powershell.exe', ['-NoProfile', '-Command', '& ([scriptblock]::Create([IO.File]::ReadAllText($env:WIKI_ONLINE_EXTRACT_SCRIPT,[Text.Encoding]::UTF8)))'], { windowsHide: true, timeout: 120000, env: { ...process.env, WIKI_ONLINE_ARCHIVE: archive, WIKI_ONLINE_EXTRACT: extracted, WIKI_ONLINE_EXTRACT_SCRIPT: path.join(root, 'scripts/extract-online-update.ps1') } });
        signal.throwIfAborted(); const prepared = validatePrepared(job);
        job = { ...job, phase: 'ready', releaseId: content ? null : prepared.manifest.to.releaseId, message: '更新包已就绪，安装后将重启 Wiki' }; saveJob(job);
        if (automatic) {
          try { await install({ confirm: true, jobId: id }); }
          catch (error) { if (readJSON(statePath, null)?.phase === 'ready') saveJob({ ...job, message: error.message }); else throw error; }
        }
      } catch (error) {
        saveJob({ ...job, phase: signal.aborted ? 'cancelled' : 'failed', message: signal.aborted ? '已取消更新' : error.message });
        removeJob(id);
      } finally { controller = null; }
    })();
    return status();
  }
  async function cancel() {
    const job = readJSON(statePath, null);
    if (!job || job.phase === 'installing') throw Error('安装过程中不能取消，请等待完成。');
    if (controller) { controller.abort(); await pending; }
    else { removeJob(job.id); saveJob({ ...job, phase: 'cancelled', message: '已取消更新' }); }
    return status();
  }
  return { status, check, setPreferences, start, install, cancel, wait: () => pending, async close() { if (controller && readJSON(statePath, null)?.phase !== 'installing') controller.abort(); await pending; }, async handle(req, res, url, json, body) {
    if (!url.pathname.startsWith(apiPrefix)) return false;
    const action = url.pathname.slice(apiPrefix.length);
    if (action === 'status' && req.method === 'GET') json(res, 200, status());
    else if (req.method !== 'POST') json(res, 405, { error: '请从更新面板发起操作。' });
    else if (action === 'check') json(res, 200, await check(await body(req)));
    else if (action === 'preferences') json(res, 200, setPreferences(await body(req)));
    else if (action === 'start') json(res, 200, await start(await body(req)));
    else if (action === 'install') json(res, 200, await install(await body(req)));
    else if (action === 'cancel') json(res, 200, await cancel());
    else json(res, 404, { error: '更新操作不存在。' });
    return true;
  } };
}
