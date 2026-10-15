import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readJSON, writeJSON, writeAtomic, equal } from '../../lib/release-common.mjs';

const templates = fileURLToPath(new URL('./', import.meta.url));
export function createInstallerBundle(directory, read, sharedPaths, readTemplate = name => fs.readFileSync(path.join(templates, name))) {
  for (const name of ['lib/release-common.mjs', 'lib/release-data.mjs', 'lib/release-install.mjs', ...sharedPaths]) writeAtomic(path.join(directory, 'installer', name), read(name));
  for (const name of ['run.mjs', 'wizard.ps1', 'launch.vbs']) {
    const bytes = readTemplate(name);
    writeAtomic(path.join(directory, 'installer', name), name.endsWith('.ps1') && !bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? Buffer.concat([Buffer.from([239, 187, 191]), bytes]) : bytes);
  }
  writeAtomic(path.join(directory, '安装更新.cmd'), readTemplate('install.cmd').toString('utf8').replace(/\r?\n/g, '\r\n'));
  const launcher = 'Option Explicit\r\nDim fs, shell, command, code\r\nSet fs = CreateObject("Scripting.FileSystemObject")\r\nSet shell = CreateObject("WScript.Shell")\r\ncommand = "wscript.exe " & Chr(34) & fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "installer\\launch.vbs") & Chr(34)\r\ncode = shell.Run(command, 0, True)\r\nWScript.Quit code\r\n';
  writeAtomic(path.join(directory, '安装更新.vbs'), launcher);
}
function command(args, env) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', args], { windowsHide: true, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 60000 });
  if (result.error || result.status !== 0) throw Error(result.error?.message || result.stderr || result.stdout);
}
export function repackInstaller(root, filename) {
  root = path.resolve(root);
  const source = path.resolve(root, filename);
  if (path.dirname(source) !== root || !source.endsWith('.zip')) throw Error('只能重新制作 Wiki 根目录中的更新 ZIP。');
  const temporary = fs.mkdtempSync(path.join(root, '.codex_tmp/installer-repack-'));
  let output;
  try {
    const directory = path.join(temporary, 'update');
    command("Add-Type -AssemblyName System.IO.Compression.FileSystem;$ErrorActionPreference='Stop';[IO.Compression.ZipFile]::ExtractToDirectory($env:WIKI_REPACK_SOURCE,$env:WIKI_REPACK_DIRECTORY)", { WIKI_REPACK_SOURCE: source, WIKI_REPACK_DIRECTORY: directory });
    const manifestBytes = fs.readFileSync(path.join(directory, 'update.json'));
    const manifest = JSON.parse(manifestBytes);
    const state = readJSON(path.join(root, '.release-manager/state.json'));
    const record = state.releases.find(value => equal(value.release, manifest.to));
    if (manifest.format !== 'wiki-local-update' || !record) throw Error('更新包与已登记发布不匹配。');
    // Only the installer and package-level help are reissued; published payload and release metadata are untouched.
    const oldInstaller = path.join(directory, 'installer');
    if (path.dirname(oldInstaller) !== directory || !oldInstaller.startsWith(root + path.sep)) throw Error('临时目录范围无效。');
    fs.rmSync(oldInstaller, { recursive: true });
    const shared = fs.readdirSync(path.join(root, 'shared')).filter(name => name.endsWith('.mjs')).map(name => 'shared/' + name);
    createInstallerBundle(directory, name => fs.readFileSync(path.join(root, name)), shared);
    const help = `Wiki ${manifest.from.version} / ${manifest.from.releaseId} → ${manifest.to.version} / ${manifest.to.releaseId}\r\n\r\n关闭所有 Wiki 页面，等待约15秒，也关闭扫描器。\r\n双击“安装更新.vbs”打开窗口式更新向导；“安装更新.cmd”也打开同一窗口。\r\n选择包含“启动百科.vbs”的原 Wiki 文件夹；也可用“选择启动文件”直接选启动入口。外层目录内只有一份 Wiki 时会自动定位。\r\n向导显示当前版本、目标版本和目录检查结果；点击“开始更新”后显示实时进度。\r\n成功后明确显示“更新完成”并停留，可直接启动 Wiki、打开目录或查看日志。失败显示原因和处理提示，不把窗口关闭当作完成。\r\n文件 ${manifest.files.length} 个，删除 ${manifest.deleted.length} 个；个人收藏、库存、计划和评估账号保留。\r\n本次仅重新制作安装器，Wiki 仍是 ${manifest.to.version} / ${manifest.to.releaseId}；已经安装该批次无需再更新。\r\n详细功能变化见“版本更新详情.txt”，完整教程见“Wiki使用说明.txt”。\r\n`;
    writeAtomic(path.join(directory, '更新说明.txt'), help);
    if (fs.existsSync(path.join(root, 'Wiki使用说明.txt'))) writeAtomic(path.join(directory, 'Wiki使用说明.txt'), fs.readFileSync(path.join(root, 'Wiki使用说明.txt')));
    if (!manifestBytes.equals(fs.readFileSync(path.join(directory, 'update.json')))) throw Error('发布清单发生变化。');
    const label = `Wiki-${manifest.to.version}-更新包-窗口安装版`;
    output = path.join(root, label + '.zip');
    if (fs.existsSync(output)) output = path.join(root, label + '-' + randomUUID().slice(0, 6) + '.zip');
    command("Add-Type -AssemblyName System.IO.Compression.FileSystem;$ErrorActionPreference='Stop';[IO.Compression.ZipFile]::CreateFromDirectory($env:WIKI_REPACK_DIRECTORY,$env:WIKI_REPACK_OUTPUT,[IO.Compression.CompressionLevel]::Optimal,$false)", { WIKI_REPACK_DIRECTORY: directory, WIKI_REPACK_OUTPUT: output });
    writeJSON(path.join(root, '.release-manager/installer-reissues', path.basename(output) + '.json'), { release: manifest.to, source, output, createdAt: new Date().toISOString(), installer: 'window-v1' });
    return output;
  } catch (error) { if (output && fs.existsSync(output)) fs.unlinkSync(output); throw error; }
  finally { if (!temporary.startsWith(path.join(root, '.codex_tmp') + path.sep)) throw Error('临时清理范围无效。'); fs.rmSync(temporary, { recursive: true }); }
}
