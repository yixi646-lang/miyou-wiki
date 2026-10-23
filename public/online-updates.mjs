import { GAMES } from '../shared/catalog.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const active = job => ['downloading', 'extracting', 'installing'].includes(job?.phase);
const sizeText = size => `${(size / 1024 / 1024).toFixed(1)} MiB`;
export function updatePanelHTML(info, loading = false) {
  const job = info.job, available = info.available, content = info.channel === 'content';
  const manualCooling = info.nextManualCheckAt > Date.now();
  return `<div class="update-heading"><h2 id="online-update-title">Wiki 更新</h2><button type="button" data-update="close" aria-label="关闭更新面板">×</button></div>
    <nav class="update-tabs" aria-label="更新类别"><button type="button" data-update-channel="software" aria-pressed="${!content}">软件更新</button><button type="button" data-update-channel="content" aria-pressed="${content}">游戏资料</button></nav>
    <div class="update-body"><div class="update-versions"><span>${content ? '当前资料' : '当前版本'}${content ? `<strong class="update-content-versions">${Object.entries(GAMES).map(([game, meta]) => `${escape(meta.short)} ${escape(info.contentVersions ? info.contentVersions[game] ?? '未标注' : '未能读取')}`).join('<br>')}</strong>` : `<strong>${escape(info.current.version)}</strong>`}</span><span>${info.checkError ? '上次查到' : available ? (content ? '可用资料' : '可用版本') : '最新发布'}<strong>${escape(info.latest?.version ?? (info.checkError ? '未能确认' : info.checkedAt ? '暂无发布' : '尚未检查'))}</strong></span></div>
    ${info.checkError ? `<p class="update-error" role="status">${escape(info.checkError)}</p>` : ''}
    ${!info.checkError && !available && info.latest ? `<p>${content ? '当前资料已是最新发布批次。' : '当前没有更新的软件版本。'}</p>` : ''}
    ${content && !info.latest && info.checkedAt && !info.checkError ? '<p>尚未发布独立资料包。</p>' : ''}
    ${available && !info.automaticAllowed ? `<p>${escape(info.automaticReason)}</p>` : ''}
    ${available && info.automaticAllowed && info.compatibility?.supported ? '<p>当前软件可直接安装此更新。</p>' : ''}
    ${info.lastResult ? `<section class="update-result ${info.lastResult.status === 'success' ? 'is-success' : 'is-failed'}" role="status"><strong>${info.lastResult.status === 'success' ? (content ? '资料更新完成' : '软件更新完成') : '上次更新未完成'}</strong>
      <div>软件：${escape(info.lastResult.software ? `${info.lastResult.software.version} / ${info.lastResult.software.releaseId}` : '未能确认')} · 资料：${escape(info.lastResult.contentRevision ?? '随软件内置')}</div>
      ${info.lastResult.status === 'success' ? `<div>处理 ${Number(info.lastResult.files) || 0} 个文件、${Number(info.lastResult.entries) || 0} 条资料。</div><div>${info.lastResult.conflicts ? `本地编辑冲突 ${Number(info.lastResult.conflicts)} 处，已保留本地值。记录：${escape(info.lastResult.conflictFile)}` : '未发现本地编辑冲突。'}</div>` : `<div>${escape(info.lastResult.message)}${info.lastResult.recoveryRequired ? ' 请保留恢复记录，使用原安装器处理。' : ''}</div>`}
      <small>${escape(new Date(info.lastResult.completedAt).toLocaleString('zh-CN'))}</small></section>` : ''}
    ${job && ['downloading','extracting','ready','installing','failed'].includes(job.phase) ? `<div class="update-progress" role="status"><strong>${escape(job.message)}</strong>${active(job) ? `<progress max="100" value="${Math.max(0, Math.min(100, Number(job.percent) || 0))}"></progress>` : ''}${job.phase === 'downloading' ? `<small>${sizeText(job.downloaded)} / ${sizeText(job.total)}</small>` : ''}</div>` : ''}
    ${available && info.latest.notes ? `<details class="update-notes" open><summary>更新内容</summary><div>${escape(info.latest.notes)}</div></details>` : ''}
    <label class="update-preference"><input type="checkbox" data-update-preference ${info.preferences.autoCheck ? 'checked' : ''}>启动时检查并提醒更新</label>
    <small class="update-policy">${content ? '资料更新不改变软件版本。' : ''}检查不会下载或安装，确认安装后会短暂重启 Wiki。</small>
    ${info.checkedAt ? `<small class="update-checked">上次成功检查：${escape(new Date(info.checkedAt).toLocaleString('zh-CN'))}</small>` : ''}</div>
    ${manualCooling ? `<small class="update-checked update-cooldown">下次可手动检查：${escape(new Date(info.nextManualCheckAt).toLocaleString('zh-CN'))}</small>` : ''}
    <div class="update-actions"><button type="button" data-update="check" ${loading || active(job) || manualCooling ? 'disabled' : ''}>${loading ? '正在检查…' : '检查更新'}</button><span class="update-action-spacer"></span>
    ${['downloading','extracting','ready'].includes(job?.phase) ? '<button type="button" data-update="cancel">取消更新</button>' : ''}
    <a class="button-secondary" data-update="github" href="${escape(info.github)}" target="_blank" rel="noopener noreferrer">GitHub 手动下载</a>
    ${job?.phase === 'ready' ? `<button type="button" class="button-primary" data-update="install" >安装并重启</button>` : `<button type="button" class="button-primary" data-update="automatic" ${!available || !info.automaticAllowed || active(job) ? 'disabled' : ''}>自动更新${available && info.latest.asset ? ` · ${sizeText(info.latest.asset.size)}` : ''}</button>`}</div>`;
}
export function createUpdateActions({ api, confirm = message => window.confirm(message), changed = () => {} }) {
  return async (action, info) => {
    const post = (action, body = {}) => api((info.channel === 'content' ? 'content-updates/' : 'updates/') + action, { method: 'POST', body });
    if (action === 'github') return null;
    let next;
    if (action === 'check') next = await post('check', { automatic: false });
    else if (action === 'defer') next = await post('preferences', { defer: true });
    else if (action === 'cancel') next = await post('cancel');
    else if (action === 'automatic') {
      if (!confirm(info.channel === 'content' ? '确认下载并安装游戏资料？个人资料保留，完成后将重新启动 Wiki。' : '确认下载并自动安装此版本？请先保存修改并关闭其他 Wiki 页面；安装完成后将自动重启。')) return null;
      next = await post('start', { confirm: true, key: info.latest.key, automatic: true });
    } else if (action === 'install') {
      if (!confirm('确认现在安装并重启 Wiki？请先保存修改并关闭其他 Wiki 页面。')) return null;
      next = await post('install', { confirm: true, jobId: info.job.id });
    }
    if (next) changed(next);
    return next;
  };
}
export async function mountOnlineUpdates({ api, toast, document = globalThis.document, window = globalThis.window }) {
  const trigger = document.getElementById('wiki-updates'); if (!trigger) return;
  const dialog = document.createElement('dialog'); dialog.className = 'online-update-dialog'; dialog.setAttribute('aria-labelledby', 'online-update-title'); document.body.append(dialog);
  const reminder = document.createElement('aside'); reminder.className = 'update-reminder'; reminder.hidden = true; reminder.setAttribute('role', 'status'); document.body.append(reminder);
  const states = { software: await api('updates/status'), content: { channel: 'content', current: { version: '随软件内置' }, preferences: { autoCheck: false }, github: 'https://github.com/yixi646-lang/miyou-wiki/releases/tag/wiki-content', checkError: null } };
  const [contentInfo, contentStatus] = await Promise.allSettled([api('content-updates/status'), api('content-status')]);
  if (contentInfo.status === 'fulfilled') states.content = contentInfo.value; else states.content.checkError = contentInfo.reason.message;
  if (contentStatus.status === 'fulfilled') states.content.contentVersions = contentStatus.value.versions;
  let selected = 'software', reminderChannel = 'software', loading = false, originalPid = states.software.pid, offlineSince = 0, polling = false, stopped = false;
  const shownReminder = state => state.available && state.preferences.autoCheck && !active(state.job) && !(state.preferences.deferredKey === state.latest?.key && state.preferences.remindAfter > Date.now());
  function draw() {
    trigger.classList.toggle('has-update', Object.values(states).some(state => state.available)); trigger.title = '检查软件与游戏资料更新';
    if (dialog.open) dialog.innerHTML = updatePanelHTML(states[selected], loading);
    reminderChannel = Object.keys(states).find(channel => shownReminder(states[channel])) ?? 'software';
    const info = states[reminderChannel]; reminder.hidden = !shownReminder(info);
    if (!reminder.hidden) reminder.innerHTML = `<strong>${reminderChannel === 'content' ? '发现游戏资料更新' : `发现 Wiki ${escape(info.latest.version)}`}</strong><button type="button" data-update="open">查看更新</button><button type="button" data-update="defer">稍后提醒</button>`;
  }
  const changed = next => {
    const { channels, ...info } = next;
    for (const state of Object.values(channels ?? { [info.channel ?? 'software']: info })) {
      const channel = state.channel ?? 'software'; states[channel] = { ...states[channel], ...state };
    }
    if ('nextManualCheckAt' in info) for (const state of Object.values(states)) state.nextManualCheckAt = info.nextManualCheckAt;
    draw();
  };
  const actions = createUpdateActions({ api, confirm: message => window.confirm(message), changed });
  const acknowledge = () => {
    const info = states[selected];
    if (info.lastResult && info.lastResult.id !== info.preferences.acknowledgedResultId) api((selected === 'content' ? 'content-updates/' : 'updates/') + 'preferences', { method: 'POST', body: { acknowledgeResult: true } }).then(changed).catch(() => {});
  };
  const open = () => { dialog.innerHTML = updatePanelHTML(states[selected], loading); dialog.showModal(); draw(); acknowledge(); };
  trigger.addEventListener('click', open);
  const click = async event => {
    const tab = event.target.closest('[data-update-channel]');
    if (tab) { if (['software','content'].includes(tab.dataset.updateChannel)) { selected = tab.dataset.updateChannel; draw(); acknowledge(); } return; }
    const target = event.target.closest('[data-update]'); if (!target) return;
    const action = target.dataset.update;
    if (event.currentTarget === reminder) selected = reminderChannel;
    if (action === 'open') { open(); return; }
    if (action === 'close') { dialog.close(); return; }
    if (action === 'github') return;
    try { if (action === 'check') { loading = true; draw(); } await actions(action, states[selected]); }
    catch (error) { toast(error.message); }
    finally { loading = false; draw(); }
  };
  dialog.addEventListener('click', click); reminder.addEventListener('click', click);
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  dialog.addEventListener('change', async event => {
    if (!event.target.matches('[data-update-preference]')) return;
    try { changed(await api((selected === 'content' ? 'content-updates/' : 'updates/') + 'preferences', { method: 'POST', body: { autoCheck: event.target.checked } })); } catch (error) { toast(error.message); draw(); }
  });
  draw();
  const unread = Object.keys(states).filter(channel => states[channel].lastResult && states[channel].lastResult.id !== states[channel].preferences.acknowledgedResultId).sort((a, b) => states[b].lastResult.completedAt - states[a].lastResult.completedAt);
  if (unread.length) { selected = unread[0]; open(); }
  for (const channel of Object.keys(states)) if (states[channel].preferences.autoCheck) api((channel === 'content' ? 'content-updates/' : 'updates/') + 'check', { method: 'POST', body: { automatic: true } }).then(changed).catch(() => {});
  const timer = window.setInterval(async () => {
    if (Object.values(states).some(info => info.nextManualCheckAt && info.nextManualCheckAt <= Date.now())) { for (const info of Object.values(states)) if (info.nextManualCheckAt <= Date.now()) info.nextManualCheckAt = null; draw(); }
    const channel = Object.keys(states).find(key => active(states[key].job));
    if (stopped || polling || !channel) return;
    polling = true;
    try {
      const next = await api((channel === 'content' ? 'content-updates/' : 'updates/') + 'status');
      if (offlineSince || next.pid !== originalPid) { window.location.reload(); return; }
      changed(next);
    } catch {
      offlineSince ||= Date.now();
      try { const health = await (await window.fetch('/api/health', { cache: 'no-store' })).json(); if (health.app === 'local-wiki' && health.pid !== originalPid) { window.location.reload(); return; } } catch {}
      if (Date.now() - offlineSince > 90000) { const info = states[channel]; states[channel] = { ...info, job: { ...info.job, message: '仍在等待 Wiki 重新启动，恢复连接后会自动刷新。若长时间未恢复，可重新启动 Wiki 查看安装记录。' } }; draw(); }
    } finally { polling = false; }
  }, 1200);
  window.addEventListener('pagehide', () => { stopped = true; window.clearInterval(timer); }, { once: true });
}
