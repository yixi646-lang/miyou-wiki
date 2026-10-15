import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyUpdate } from './lib/release-install.mjs';
import { readJSON, writeJSON, inside, equal, publicPath, assertStopped } from './lib/release-common.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = name => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = args.find(value => !value.startsWith('--'));
const inspecting = args.includes('--inspect');
const resultFile = option('result');
const statusFile = option('status');
const log = [];
function output(event) {
  const item = { time: new Date().toISOString(), ...event };
  log.push(`${item.time} ${item.stage}: ${item.detail ?? ''}`);
  if (statusFile) writeJSON(statusFile, { ...item, log });
  console.log(`${item.stage}：${item.detail ?? ''}`);
}
function finish(value) {
  const result = { ...value, log };
  if (resultFile) writeJSON(resultFile, result);
  if (!resultFile) console.log(JSON.stringify(result));
  return result;
}
function fail(code, message, action, extra = {}) { return { status: 'blocked', code, message, action, ...extra }; }
function inspect(directory) {
  const manifest = readJSON(path.join(packageRoot, 'update.json'));
  if (manifest.format !== 'wiki-local-update' || manifest.schemaVersion !== 1) throw Error('更新包信息不受支持，请重新解压完整更新包。');
  const releases = { required: manifest.from, to: manifest.to };
  if (fs.existsSync(path.join(directory, 'update.json')) && fs.existsSync(path.join(directory, 'payload'))) return fail('package-folder', '选到的是更新包目录。', '请选择之前用来启动 Wiki 的文件夹，里面应有“启动百科.vbs”。', releases);
  const current = readJSON(path.join(directory, 'release.json'), null);
  if (!current) return fail('not-wiki', '这个目录没有 Wiki 的版本记录。', '选择包含“启动百科.vbs”、“data”和“runtime”的 Wiki 文件夹；不要选择 ZIP 文件。', releases);
  if (equal(current, manifest.to)) return { status: 'current', current, ...releases, message: '本目录已经是目标版本，无需重复更新。', action: '可以直接启动 Wiki。维护者本机的改动已经应用，也不需要安装分享更新包。' };
  const installed = readJSON(path.join(directory, '.updates/installed.json'), null);
  if (!installed) return fail('no-baseline', '这个目录没有分享版的安装记录。', '若是维护者项目目录，平时修改已直接生效；给朋友更新请选择已解压的完整分享版。', { current, ...releases });
  if (!equal(current, installed.release)) return fail('inconsistent-release', '版本记录与安装记录不一致。', '请保留该目录及个人备份，联系发布者处理；不要手动覆盖数据库。', { current, ...releases });
  if (!equal(installed.release, manifest.from)) return fail('wrong-release', `当前 ${current.version} / ${current.releaseId} 不符合本包起点。`, `本包要求 ${manifest.from.version} / ${manifest.from.releaseId}，请向发布者索取对应更新包。`, { current, ...releases });
  if (!fs.existsSync(path.join(directory, 'data/library/wiki.sqlite'))) return fail('no-database', '没有找到 Wiki 资料库。', '请先正常启动一次完整分享版，关闭后再检查此目录。', { current, ...releases });
  try { assertStopped(directory); } catch (error) { return fail('running', error.message, '关闭所有 Wiki 页面并等待约15秒，也关闭扫描器，然后点击“重新检查”。', { current, ...releases }); }
  const names = new Set();
  for (const file of manifest.files) {
    publicPath(file.path);
    if (names.has(file.path.toLowerCase())) throw Error('更新包含重复文件。');
    names.add(file.path.toLowerCase());
    const filename = inside(packageRoot, 'payload/' + file.path);
    if (!fs.existsSync(filename) || fs.statSync(filename).size !== file.size) return fail('incomplete-package', '更新包内容不完整。', '重新完整解压下载的 ZIP，再运行本包的更新向导。', { current, ...releases });
  }
  return { status: 'ready', current, ...releases, files: manifest.files.length, deleted: manifest.deleted.length, entries: readJSON(path.join(packageRoot, 'public-changes.json.gz')).length, message: '目录和版本正确，可以开始更新。', action: '收藏、材料库存、计划与评估账号会保留；更新时请保持此窗口打开。' };
}
function retargetScanner(directory) {
  const link = path.join(directory, '原神库存扫描器.lnk');
  const relative = ['原神库存扫描器/v1.4.5/InventoryKamera.exe', '原神库存扫描器/中文界面预览/InventoryKamera.zh.exe', 'InventoryKamera/v1.4.5/InventoryKamera.exe', 'InventoryKamera/中文界面预览/InventoryKamera.zh.exe'].find(name => fs.existsSync(path.join(directory, name)));
  if (!fs.existsSync(link) || !relative) return null;
  const exe = path.join(directory, relative);
  const command = "$ErrorActionPreference='Stop';$s=New-Object -ComObject WScript.Shell;$l=$s.CreateShortcut($env:WIKI_SCANNER_LINK);$l.TargetPath=$env:WIKI_SCANNER_EXE;$l.WorkingDirectory=[IO.Path]::GetDirectoryName($env:WIKI_SCANNER_EXE);$l.IconLocation=$env:WIKI_SCANNER_EXE;$l.Save()";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 15000, env: { ...process.env, WIKI_SCANNER_LINK: link, WIKI_SCANNER_EXE: exe } });
  return result.error || result.status !== 0 ? `Wiki 已更新；扫描器快捷方式未能设置，可直接运行 ${relative}。` : null;
}
try {
  if (!target) throw Error('请先在更新向导中选择 Wiki 文件夹。');
  const directory = path.resolve(target);
  if (Number(process.versions.node.split('.')[0]) < 24) throw Error('需要 Node.js 24 或更新版本，请使用完整分享版内的运行时。');
  const checked = inspect(directory);
  if (inspecting || checked.status !== 'ready') {
    finish(checked);
    if (checked.status === 'blocked') process.exitCode = 2;
  } else {
    output({ percent: 0, stage: '开始更新', detail: `${checked.current.version} → ${checked.to.version}` });
    const result = applyUpdate(directory, packageRoot, { onProgress: output });
    output({ percent: 97, stage: '正在设置扫描器入口', detail: '按当前 Wiki 目录设置快捷方式' });
    const warning = retargetScanner(directory);
    if (warning) output({ percent: 98, stage: '提示', detail: warning });
    output({ percent: 100, stage: '更新完成', detail: `Wiki ${result.release.version} / ${result.release.releaseId}；个人资料保留` });
    finish({ status: 'success', message: '更新已完成，可以照常使用 Wiki。', target: directory, current: result.release, to: result.release, files: result.files, entries: result.entries, conflicts: result.conflicts, conflictFile: result.conflictFile, warning });
  }
} catch (error) {
  output({ percent: 0, stage: '更新未完成', detail: error.message });
  finish({ status: 'error', message: error.message, action: '按此提示处理后重新检查目录；错误详情已保存在本包的安装日志。' });
  process.exitCode = 1;
}
