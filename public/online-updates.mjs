const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const active = job => ['downloading', 'extracting', 'installing'].includes(job?.phase);
const sizeText = size => `${(size / 1024 / 1024).toFixed(1)} MiB`;
export function updatePanelHTML(info, loading = false) {
  const job = info.job, available = info.available, content = info.channel === 'content';
  return `<div class="update-heading"><h2 id="online-update-title">Wiki 更新</h2><button type="button" data-update="close" aria-label="关闭更新面板">×</button></div>
    <nav class="update-tabs" aria-label="更新类别"><button type="button" data-update-channel="software" aria-pressed="${!content}">软件更新</button><button type="button" data-update-channel="content" aria-pressed="${content}">游戏资料</button></nav>
    <div class="update-body"><div class="update-versions"><span>${content ? '当前资料' : '当前版本'}<strong>${escape(info.current.version)}</strong></span><span>${available ? (content ? '可用资料' : '可用版本') : '最新发布'}<strong>${escape(info.latest?.version ?? (info.checkedAt ? '暂无发布' : '尚未检查'))}</strong></span></div>
    ${info.checkError ? `<p class="update-error" role="status">${escape(info.checkError)}</p>` : ''}
    ${!available && info.latest ? `<p>${content ? '当前资料已是最新发布批次。' : '当前没有更新的软件版本。'}</p>` : ''}
    ${content && !info.latest && info.checkedAt && !info.checkError ? '<p>尚未发布独立资料包。</p>' : ''}
    ${available && !info.automaticAllowed ? `<p>${escape(info.automaticReason)}</p>` : ''}
    ${job && ['downloading','extracting','ready','installing','failed'].includes(job.phase) ? `<div class="update-progress" role="status"><strong>${escape(job.message)}</strong>${active(job) ? `<progress max="100" value="${Math.max(0, Math.min(100, Number(job.percent) || 0))}"></progress>` : ''}${job.phase === 'downloading' ? `<small>${sizeText(job.downloaded)} / ${sizeText(job.total)}</small>` : ''}</div>` : ''}
    ${available && info.latest.notes ? `<details class="update-notes" open><summary>更新内容</summary><div>${escape(info.latest.notes)}</div></details>` : ''}
    <label class="update-preference"><input type="checkbox" data-update-preference ${info.preferences.autoCheck ? 'checked' : ''}>启动时检查并提醒更新</label>
    <small class="update-policy">${content ? '资料更新不改变软件版本。' : ''}检查不会下载或安装，确认安装后会短暂重启 Wiki。</small>
    ${info.checkedAt ? `<small class="update-checked">上次检查：${escape(new Date(info.checkedAt).toLocaleString('zh-CN'))}</small>` : ''}</div>
    <div class="update-actions"><button type="button" data-update="check" ${loading || active(job) ? 'disabled' : ''}>${loading ? '正在检查…' : '检查更新'}</button><span class="update-action-spacer"></span>
    ${['downloading','extracting','ready'].includes(job?.phase) ? '<button type="button" data-update="cancel">取消更新</button>' : ''}
    <a class="button-secondary" data-update="github" href="${escape(info.github)}" target="_blank" rel="noopener noreferrer">GitHub 手动下载</a>
    ${job?.phase === 'ready' ? '<button type="button" class="button-primary" data-update="install">安装并重启</button>' : `<button type="button" class="button-primary" data-update="automatic" ${!available || !info.automaticAllowed || active(job) ? 'disabled' : ''}>自动更新${available && info.latest.asset ? ` · ${sizeText(info.latest.asset.size)}` : ''}</button>`}</div>`;
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
      if (!confirm(info.channel === 'content' ? '确认下载并安装游戏资料？软件版本不变，个人资料保留。请先保存修改并关闭其他 Wiki 页面；完成后将自动重启。' : '确认下载并自动安装此版本？请先保存修改并关闭其他 Wiki 页面；安装完成后将自动重启。')) return null;
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
  try { states.content = await api('content-updates/status'); } catch (error) { states.content.checkError = error.message; }
  let selected = 'software', reminderChannel = 'software', loading = false, originalPid = states.software.pid, offlineSince = 0, polling = false, stopped = false;
  const shownReminder = state => state.available && state.preferences.autoCheck && !active(state.job) && !(state.preferences.deferredKey === state.latest?.key && state.preferences.remindAfter > Date.now());
  function draw() {
    trigger.classList.toggle('has-update', Object.values(states).some(state => state.available)); trigger.title = '检查软件与游戏资料更新';
    if (dialog.open) dialog.innerHTML = updatePanelHTML(states[selected], loading);
    reminderChannel = Object.keys(states).find(channel => shownReminder(states[channel])) ?? 'software';
    const info = states[reminderChannel]; reminder.hidden = !shownReminder(info);
    if (!reminder.hidden) reminder.innerHTML = `<strong>${reminderChannel === 'content' ? '发现游戏资料更新' : `发现 Wiki ${escape(info.latest.version)}`}</strong><button type="button" data-update="open">查看更新</button><button type="button" data-update="defer">稍后提醒</button>`;
  }
  const changed = next => { states[next.channel ?? 'software'] = next; draw(); };
  const actions = createUpdateActions({ api, confirm: message => window.confirm(message), changed });
  const open = () => { dialog.innerHTML = updatePanelHTML(states[selected], loading); dialog.showModal(); };
  trigger.addEventListener('click', open);
  const click = async event => {
    const tab = event.target.closest('[data-update-channel]');
    if (tab) { if (['software','content'].includes(tab.dataset.updateChannel)) { selected = tab.dataset.updateChannel; draw(); } return; }
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
  for (const channel of Object.keys(states)) if (states[channel].preferences.autoCheck) api((channel === 'content' ? 'content-updates/' : 'updates/') + 'check', { method: 'POST', body: { automatic: true } }).then(changed).catch(() => {});
  const timer = window.setInterval(async () => {
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
