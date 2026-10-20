import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inside, readJSON, writeJSON, equal, publicPath, selectUpdateRoute } from './release-common.mjs';
import { CONTENT_STATE, validateContentPackage } from './content-package.mjs';
import { publishedMetadata, compatibilityFor } from './update-metadata.mjs';

const exec = promisify(execFile);
const repository = 'yixi646-lang/miyou-wiki';
const github = `https://github.com/${repository}/releases`;
const day = 86400000;
const hour = 3600000;
const minute = 60000;
const manualHourlyLimit = 10;
const manualCheckRounds = new WeakSet();
const localDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' });
const sameDay = (a, b) => Number.isFinite(a) && localDay.format(a) === localDay.format(b);
const busy = phase => ['downloading', 'extracting', 'installing'].includes(phase);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function manualCheckLimit(limits, at) {
  const attempts = [...new Set([
    ...(Array.isArray(limits.manualAttempts) ? limits.manualAttempts : []),
    limits.manualAttemptedAt
  ])].filter(time => Number.isFinite(time) && time > at - hour).sort((a, b) => a - b);
  const next = Math.max(
    attempts.length ? attempts.at(-1) + minute : 0,
    attempts.length >= manualHourlyLimit ? attempts[attempts.length - manualHourlyLimit] + hour : 0
  );
  return { attempts, next: next > at ? next : null };
}
function metadataAsset(release, revision) {
  const name = `Wiki-Update-${revision}.json`;
  const asset = (release.assets ?? []).find(item => item.name === name && item.state === 'uploaded' && Number.isSafeInteger(item.size) && item.size > 0 && item.size <= 64000 && item.browser_download_url === `${github}/download/${release.tag_name}/${name}`);
  return asset ? { url: asset.browser_download_url, size: asset.size } : null;
}
function compareVersions(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(a ?? '') || !/^\d+\.\d+\.\d+$/.test(b ?? '')) return 0;
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export function createUpdateCheckGroup(channels) {
  const services = Object.entries(channels);
  let task;
  return async channel => {
    if (!Object.hasOwn(channels, channel)) throw Error('更新频道无效。');
    if (!task) {
      const round = new Map(); manualCheckRounds.add(round);
      task = Promise.allSettled(services.map(([, service]) => service.check({}, round))).then(results =>
        Object.fromEntries(services.map(([name, service], index) => [name, {
          ...service.status(),
          ...(results[index].status === 'rejected' ? { checkError: results[index].reason.message } : {})
        }]))
      ).finally(() => { manualCheckRounds.delete(round); task = null; });
    }
    const states = await task;
    return { ...states[channel], channels: states };
  };
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
  const releaseId = /-(R\d{6})$/.exec(release.tag_name)?.[1] ?? /(?:-至-|-to-)(R\d{6})/.exec(asset?.name ?? '')?.[1] ?? null;
  const metadata = publishedMetadata(release.body, 'software', asset?.name);
  return { key: String(release.id) + ':' + (asset?.id ?? 'manual'), version, releaseId, name: String(release.name || `Wiki ${version}`).slice(0, 200), notes: metadata.notes.slice(0, 20000), compatibility: metadata.compatibility, metadataAsset: metadataAsset(release, releaseId), url: release.html_url, publishedAt: release.published_at ?? null, asset: asset ? { id: asset.id, name: asset.name, size: asset.size, url: asset.browser_download_url } : null };
}

export function publishedContent(release) {
  if (!release || release.draft || release.prerelease || release.tag_name !== 'wiki-content' || !Number.isSafeInteger(release.id) || release.html_url !== github + '/tag/wiki-content') return null;
  const assets = (release.assets ?? []).filter(asset => {
    if (!Number.isSafeInteger(asset.id) || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 ** 3 || !/^Miyou-Wiki-Data-D\d{14}\.zip$/.test(asset.name ?? '')) return false;
    try { const url = new URL(asset.browser_download_url); return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && url.pathname === `/${repository}/releases/download/wiki-content/${asset.name}`; } catch { return false; }
  }).sort((a, b) => b.name.localeCompare(a.name));
  const asset = assets[0]; if (!asset) return null;
  const revision = /^Miyou-Wiki-Data-(D\d{14})/.exec(asset.name)[1];
  const metadata = publishedMetadata(release.body, 'content', asset.name);
  return { key: `${release.id}:${asset.id}`, version: revision, revision, name: '游戏资料 ' + revision, notes: metadata.notes.slice(0, 20000), compatibility: metadata.compatibility, metadataAsset: metadataAsset(release, revision), url: release.html_url, publishedAt: release.published_at, asset: { id: asset.id, name: asset.name, size: asset.size, url: asset.browser_download_url } };
}

export function createOnlineUpdates({ root, databasePath, storageDirectory, port, channel = 'software', activePages = () => 1, otherBusy = () => false, onInstall = () => {}, fetchImpl = fetch, extractArchive, launchRunner, retryWait = delay, now = Date.now, platform = process.platform } = {}) {
  root = path.resolve(root);
  if (!['software', 'content'].includes(channel)) throw Error('更新频道无效。');
  const content = channel === 'content', apiPrefix = content ? '/api/content-updates/' : '/api/updates/';
  const storage = path.resolve(storageDirectory ?? path.join(root, content ? '.updates/content-online' : '.updates/online'));
  const storageRelative = path.relative(root, storage).split(path.sep).join('/');
  const statePath = inside(root, storageRelative + '/state.json');
  const cachePath = inside(root, storageRelative + '/check.json');
  const preferencesPath = inside(root, storageRelative + '/preferences.json');
  const throttlePath = inside(root, path.relative(root, path.join(path.dirname(storage), 'check-throttle.json')).split(path.sep).join('/'));
  const throttle = () => readJSON(throttlePath, {});
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
    const compatibility = compatibilityFor(latest, local, channel);
    const lastResult = readJSON(inside(root, `.updates/results/${channel}.json`), null);
    const limits = throttle(), nextManual = manualCheckLimit(limits, now()).next;
    const sharedError = sameDay(limits.quotaExhaustedAt, now()) && !(cache.checkedAt >= limits.quotaExhaustedAt) ? limits.quotaError : null;
    return { pid: process.pid, channel, current: content ? { version: contentRecord?.revision ?? '随软件内置' } : local, softwareCurrent: local, latest, available, compatibility, lastResult, preferences: preferences(), checkedAt: cache.checkedAt ?? null, checkError: cache.error ?? sharedError ?? null, nextManualCheckAt: nextManual > now() ? nextManual : null, github: latest?.url ?? github, automaticAllowed: permission.allowed && compatibility.supported, automaticReason: permission.allowed ? compatibility.reason : permission.reason, job: job ? { ...job, ...(progress ? { percent: progress.percent, message: progress.stage } : {}) } : null };
  }
  async function check({ automatic = false } = {}, round) {
    if (automatic && !preferences().autoCheck) return status();
    if (busy(readJSON(statePath, null)?.phase) || readJSON(statePath, null)?.phase === 'ready') return status();
    if (checkTask) return checkTask;
    const cache = readJSON(cachePath, {}), limits = throttle(), attemptedAt = now();
    const manualRound = manualCheckRounds.has(round) ? round : null, reserved = manualRound?.has(throttlePath);
    const manualLimit = manualCheckLimit(limits, attemptedAt);
    if (automatic && (sameDay(cache.automaticAttemptedAt ?? cache.attemptedAt, attemptedAt) || sameDay(limits.quotaExhaustedAt, attemptedAt))) return status();
    if (!automatic && !reserved && manualLimit.next) return status();
    // 在请求之前同步占用本轮额度，其他页面和另一更新频道共用手动冷却。
    const checking = { ...cache, attemptedAt, ...(automatic ? { automaticAttemptedAt: attemptedAt } : { manualAttemptedAt: attemptedAt }) };
    if (!automatic && !reserved) { writeJSON(throttlePath, { ...limits, manualAttemptedAt: attemptedAt, manualAttempts: [...manualLimit.attempts, attemptedAt] }); manualRound?.set(throttlePath, attemptedAt); }
    writeJSON(cachePath, checking);
    function quotaReached() {
      writeJSON(throttlePath, { ...throttle(), quotaExhaustedAt: now(), quotaError: 'GitHub 接口访问额度已用完，今天不再自动检查；可稍后手动检查。' });
    }
    async function requestRelease() {
      for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try { response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/${content ? 'tags/wiki-content' : 'latest'}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Miyou-Wiki-Update', ...(cache.etag ? { 'If-None-Match': cache.etag } : {}) }, signal: AbortSignal.timeout(15000) }); }
        catch (error) { if (attempt === 2) throw error; await retryWait(1000 * (attempt + 1)); continue; }
        if (response.headers.get('x-ratelimit-remaining') === '0') quotaReached();
        if (response.status === 403 || response.status === 429) {
          const message = (await response.text()).slice(0, 20000);
          if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' || /rate.?limit|secondary.{0,20}limit/i.test(message)) { quotaReached(); throw Error('GitHub 接口访问额度已用完，今天不再自动检查；可稍后手动检查。'); }
          throw Error('GitHub 拒绝访问更新源，请稍后重试或前往 GitHub 查看。');
        }
        if (response.status >= 500 && attempt < 2) { await response.body?.cancel(); await retryWait(1000 * (attempt + 1)); continue; }
        return response;
      }
    }
    checkTask = (async () => {
      try {
        const response = await requestRelease();
        if (response.status === 304) writeJSON(cachePath, { ...checking, checkedAt: now(), error: null });
        else if (response.status === 404) writeJSON(cachePath, { ...checking, checkedAt: now(), latest: null, error: null, etag: null });
        else {
          if (!response.ok) throw Error('更新源暂时无法访问。');
          const text = await response.text(); if (text.length > 2 * 1024 * 1024) throw Error('更新信息过大，未读取。');
          const latest = content ? publishedContent(JSON.parse(text)) : publishedSoftware(JSON.parse(text), current());
          if (!latest) throw Error(content ? '资料源未提供可识别的资料包，请前往 GitHub 查看。' : '更新源未提供可识别的软件版本，请前往 GitHub 查看。');
          if (latest.metadataAsset) {
            try {
              const metadataResponse = await fetchImpl(latest.metadataAsset.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Miyou-Wiki-Update' } });
              if (!metadataResponse.ok) throw Error('未能读取兼容信息。');
              const metadataText = await metadataResponse.text();
              if (Buffer.byteLength(metadataText) > 64000) throw Error('兼容信息过大。');
              latest.compatibility = publishedMetadata('', channel, latest.asset?.name, JSON.parse(metadataText)).compatibility;
            } catch { latest.compatibility = null; }
          }
          writeJSON(cachePath, { ...checking, checkedAt: now(), latest, error: null, etag: response.headers.get('etag') });
        }
      } catch (error) { writeJSON(cachePath, { ...checking, error: error.name === 'TimeoutError' ? '检查更新超时，可稍后重试或前往 GitHub。' : error.message }); }
      return status();
    })().finally(() => { checkTask = null; });
    return checkTask;
  }
  function setPreferences(value) {
    const next = preferences();
    if ('autoCheck' in value) { if (typeof value.autoCheck !== 'boolean') throw Error('更新检查设置无效。'); next.autoCheck = value.autoCheck; }
    if (value.defer === true) { next.deferredKey = status().latest?.key ?? null; next.remindAfter = now() + day; }
    if (value.acknowledgeResult === true) next.acknowledgedResultId = status().lastResult?.id ?? null;
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
  return { status, check, setPreferences, start, install, cancel, wait: () => pending, async close() { if (controller && readJSON(statePath, null)?.phase !== 'installing') controller.abort(); await pending; }, async handle(req, res, url, json, body, checkChannels) {
    if (!url.pathname.startsWith(apiPrefix)) return false;
    const action = url.pathname.slice(apiPrefix.length);
    if (action === 'status' && req.method === 'GET') json(res, 200, status());
    else if (req.method !== 'POST') json(res, 405, { error: '请从更新面板发起操作。' });
    else if (action === 'check') { const options = await body(req); json(res, 200, await (checkChannels && !options.automatic ? checkChannels(channel) : check(options))); }
    else if (action === 'preferences') json(res, 200, setPreferences(await body(req)));
    else if (action === 'start') json(res, 200, await start(await body(req)));
    else if (action === 'install') json(res, 200, await install(await body(req)));
    else if (action === 'cancel') json(res, 200, await cancel());
    else json(res, 404, { error: '更新操作不存在。' });
    return true;
  } };
}
