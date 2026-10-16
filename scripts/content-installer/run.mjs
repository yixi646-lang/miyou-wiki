import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyContentUpdate, inspectContentUpdate } from './lib/content-install.mjs';
import { readJSON, writeJSON } from './lib/release-common.mjs';
import { CONTENT_STATE } from './lib/content-package.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = name => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = args.find(value => !value.startsWith('--'));
const inspecting = args.includes('--inspect');
const resultFile = option('result'), statusFile = option('status'), log = [];
function output(event) {
  const item = { time: new Date().toISOString(), ...event };
  log.push(`${item.time} ${item.stage}: ${item.detail ?? ''}`);
  if (statusFile) writeJSON(statusFile, { ...item, log });
  console.log(`${item.stage}：${item.detail ?? ''}`);
}
function finish(result) {
  if (resultFile) writeJSON(resultFile, { ...result, log }); else console.log(JSON.stringify({ ...result, log }));
}
try {
  if (!target) throw Error('请先选择现有 Wiki 文件夹。');
  if (Number(process.versions.node.split('.')[0]) < 24) throw Error('需要 Node.js 24 或更新版本，请使用完整分享版内的运行时。');
  const root = path.resolve(target), manifest = readJSON(path.join(packageRoot, 'content.json'));
  const current = readJSON(path.join(root, 'release.json'), null);
  if (!current || !fs.existsSync(path.join(root, '.updates/installed.json'))) throw Error('请选择已解压的 Wiki 完整分享版；该目录缺少版本或安装记录。');
  if (fs.existsSync(path.join(root, '.release-manager/state.json'))) throw Error('这是维护项目，原始资料已经直接生效；请选择用户实际使用的分享版。');
  const previous = readJSON(path.join(root, CONTENT_STATE), null);
  if (previous && previous.revision >= manifest.revision) {
    finish({ status: 'current', current, currentRevision: previous.revision, message: '当前资料已包含此批次，无需重复安装。', action: '可以直接启动 Wiki。' });
  } else {
    output({ percent: 2, stage: '正在检查目录与资料', detail: '核对适用版本、公共资料差异与本地编辑' });
    const checked = inspectContentUpdate(root, packageRoot);
    if (inspecting) {
      finish({ ...checked, status: 'ready', message: '目录检查通过，可以安装资料更新。', action: checked.conflicts ? `有 ${checked.conflicts} 处本地编辑将保留，可在完成后查看冲突记录。` : '只更新公共资料，个人收藏、库存、计划与评估账号保留。' });
    } else {
      const result = applyContentUpdate(root, packageRoot, { onProgress: output });
      output({ percent: 100, stage: '资料更新完成', detail: `${result.revision}；软件版本仍为 ${current.version}` });
      finish({ ...result, status: 'success', current, currentRevision: result.revision, message: '资料更新已完成，可以启动 Wiki。' });
    }
  }
} catch (error) {
  output({ percent: 0, stage: inspecting ? '目录检查未通过' : '资料更新未完成', detail: error.message });
  finish({ status: inspecting ? 'blocked' : 'error', message: error.message, action: '关闭 Wiki 后重试，确认选择完整分享版目录；缺少包内文件时请重新完整解压。详情可查看安装日志。' });
  process.exitCode = 1;
}
