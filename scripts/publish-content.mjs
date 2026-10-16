import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = 'yixi646-lang/miyou-wiki';
export async function publishContent({ archive, notes = '公共百科资料更新。', fetchImpl = fetch } = {}) {
  const name = path.basename(archive ?? '');
  const revision = /^Miyou-Wiki-Data-(D\d{14})\.zip$/.exec(name)?.[1];
  if (!revision || !fs.statSync(archive).isFile()) throw Error('请选择 content-release.mjs 生成的资料 ZIP。');
  const credential = spawnSync(process.env.WIKI_GIT ?? 'git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\nusername=yixi646-lang\n\n', encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, maxBuffer: 1024 * 1024 });
  const token = credential.status === 0 && /^password=(.+)$/m.exec(credential.stdout ?? '')?.[1].trim();
  if (!token) throw Error('未取得 GitHub 登录授权，请先使用 Git Credential Manager 登录；凭据不会写入资料包。');
  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'User-Agent': 'Miyou-Wiki-Content-Publisher' };
  const request = async (endpoint, options = {}) => {
    const response = await fetchImpl('https://api.github.com/repos/' + repository + endpoint, { ...options, headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(30000) });
    if (!response.ok && response.status !== 404) throw Error(`GitHub 资料发布失败（HTTP ${response.status}）。`);
    return response.status === 404 ? null : response.json();
  };
  let release = await request('/releases/tags/wiki-content');
  if (!release) release = await request('/releases', { method: 'POST', body: JSON.stringify({ tag_name: 'wiki-content', target_commitish: 'main', name: '游戏资料更新', draft: true, prerelease: false, make_latest: 'false', body: notes }) });
  if (!release || release.immutable) throw Error('资料发布记录不可编辑，请检查 GitHub 发布设置。');
  if ((release.assets ?? []).some(asset => asset.name === name)) throw Error('该资料批次已上传，未覆盖。请使用新的批次。');
  if ((release.assets ?? []).some(asset => /^Miyou-Wiki-Data-(D\d{14})\.zip$/.exec(asset.name)?.[1] >= revision)) throw Error('GitHub 上已有相同或更晚资料批次，未上传旧包。');
  const size = fs.statSync(archive).size;
  if (size <= 0 || size > 1024 ** 3) throw Error('资料 ZIP 须不超过 1 GiB。');
  const upload = await fetchImpl(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Length': String(size) }, body: fs.createReadStream(archive), duplex: 'half', signal: AbortSignal.timeout(1800000) });
  if (!upload.ok) throw Error(`资料包上传失败（HTTP ${upload.status}）；现有发布保持可用。`);
  const asset = await upload.json();
  if (asset.state !== 'uploaded' || asset.size !== size) throw Error('GitHub 尚未确认资料包上传完成，请在发布页面检查。');
  const body = `资料批次：${revision}\n\n${notes}\n\n以 Wiki 1.2.2 为基准的累计资料增量包，仅更新新增、变更及必要恢复的公共资料和素材，不改变软件版本。\n完整解压 ZIP 后运行“安装资料更新.vbs”，选择现有 Wiki 并确认安装；窗口显示进度、结果及日志。安装器随包附带。\n原已发布 1.2.2 使用包内安装器；支持增量格式的软件版也可在顶栏“更新 → 游戏资料”中确认自动安装。\n保留个人账号、收藏、库存、计划及本地编辑；无需逐个安装中间资料批次。`;
  const published = await request('/releases/' + release.id, { method: 'PATCH', body: JSON.stringify({ tag_name: 'wiki-content', name: '游戏资料更新', body, draft: false, prerelease: false, make_latest: 'false' }) });
  return { revision, url: published.html_url, download: asset.browser_download_url, bytes: size };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const notesArg = process.argv.find(arg => arg.startsWith('--notes-file='));
    const notes = notesArg ? fs.readFileSync(path.resolve(notesArg.slice(13)), 'utf8') : undefined;
    console.log(JSON.stringify(await publishContent({ archive: path.resolve(process.argv[2]), notes }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
