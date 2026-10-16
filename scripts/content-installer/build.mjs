import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles, writeAtomic } from '../../lib/release-common.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
export function createContentInstaller(directory) {
  const files = ['lib/release-common.mjs', 'lib/release-data.mjs', 'lib/release-install.mjs', 'lib/content-package.mjs', 'lib/content-install.mjs', ...listFiles(path.join(project, 'shared')).filter(name => name.endsWith('.mjs')).map(name => 'shared/' + name)];
  for (const name of files) writeAtomic(path.join(directory, 'installer', name), fs.readFileSync(path.join(project, name)));
  writeAtomic(path.join(directory, 'installer/run.mjs'), fs.readFileSync(path.join(project, 'scripts/content-installer/run.mjs')));
  writeAtomic(path.join(directory, 'installer/launch.vbs'), fs.readFileSync(path.join(project, 'scripts/update-installer/launch.vbs')));
  let wizard = fs.readFileSync(path.join(project, 'scripts/update-installer/wizard.ps1'), 'utf8').replace(/^\uFEFF/, '');
  const replacements = [
    ["'update.json'", "'content.json'"],
    ["$form.Text = 'Wiki 更新向导'", "$form.Text = 'Wiki 资料更新向导'"],
    ["'更新你的 Wiki'", "'更新游戏资料'"],
    [wizard.split(/\r?\n/).find(line => line.startsWith('$packageSummary = ')), '$packageSummary = "资料增量更新 · 基准 Wiki {0} · {1}" -f $manifest.baseline.version, $manifest.revision'],
    ["'当前版本'", "'当前软件 / 资料'"],
    ['("{0} / {1}" -f $manifest.to.version, $manifest.to.releaseId)', '($manifest.revision)'],
    ['$currentVersion.Text = "{0} / {1}" -f $result.current.version, $result.current.releaseId', '$currentVersion.Text = "Wiki {0} · {1}" -f $result.current.version, $result.currentRevision'],
    ["'版本更新详情.txt'", "'资料更新说明.txt'"],
    ["'版本与目录已显示在上方。可以启动 Wiki，或点击“关闭”结束向导。'", "'资料更新不改变软件版本。可以启动 Wiki，或点击“关闭”结束向导。'"],
  ];
  for (const [before, after] of replacements) {
    if (!before || !wizard.includes(before)) throw Error('资料安装器模板缺少预期字段。');
    wizard = wizard.replace(before, after);
  }
  writeAtomic(path.join(directory, 'installer/wizard.ps1'), '\uFEFF' + wizard);
  writeAtomic(path.join(directory, '安装资料更新.cmd'), fs.readFileSync(path.join(project, 'scripts/update-installer/install.cmd')));
  writeAtomic(path.join(directory, '安装资料更新.vbs'), 'Option Explicit\r\nDim fs, shell, command, code\r\nSet fs = CreateObject("Scripting.FileSystemObject")\r\nSet shell = CreateObject("WScript.Shell")\r\ncommand = "wscript.exe " & Chr(34) & fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName), "installer\\launch.vbs") & Chr(34)\r\ncode = shell.Run(command, 0, True)\r\nWScript.Quit code\r\n');
}
