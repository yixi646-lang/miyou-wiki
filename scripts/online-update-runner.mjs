import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const read = name => JSON.parse(fs.readFileSync(name, 'utf8').replace(/^\uFEFF/, ''));
const write = (name, value) => { const temporary = name + '.tmp'; fs.writeFileSync(temporary, JSON.stringify(value, null, 2)); fs.renameSync(temporary, name); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const directory = path.dirname(fileURLToPath(import.meta.url));
const config = read(process.argv[2]);
if (config.channel && !['software', 'content'].includes(config.channel)) throw Error('更新助手频道无效。');
const content = config.channel === 'content';
const root = path.resolve(config.root), storage = path.join(root, content ? '.updates/content-online' : '.updates/online'), jobs = path.join(storage, 'jobs');
if (!/^[a-f0-9-]{36}$/.test(config.jobId ?? '') || directory !== path.join(jobs, config.jobId) || !Number.isSafeInteger(config.parentPid) || config.parentPid <= 0 || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw Error('更新助手任务范围无效。');
for (let current = directory; current.startsWith(root + path.sep); current = path.dirname(current)) if (fs.lstatSync(current).isSymbolicLink()) throw Error('更新任务路径不能经过链接。');
const statePath = path.join(storage, 'state.json');
let state = read(statePath), parentStopped = false, completed = false, recoveryRequired = false;
if (state.id !== config.jobId || state.phase !== 'installing') throw Error('更新任务状态不匹配。');
write(path.join(directory, 'runner-ready.json'), { pid: process.pid });
try {
  for (let attempt = 0; attempt < 300; attempt++) {
    try { process.kill(config.parentPid, 0); } catch (error) { if (error.code === 'ESRCH') { parentStopped = true; break; } throw error; }
    await delay(100);
  }
  if (!parentStopped) throw Error('Wiki 尚未退出，未安装更新。请关闭其他页面后重试。');
  const actual = read(path.join(root, 'release.json'));
  if (Object.keys(actual).length !== Object.keys(config.expectedFrom).length || Object.keys(actual).some(key => actual[key] !== config.expectedFrom[key])) throw Error('本机版本已变化，未覆盖文件。');
  const resultPath = path.join(directory, 'result.json');
  const installer = content ? [path.join(root, 'scripts/install-content.mjs'), root, path.join(directory, 'package')] : [path.join(directory, 'package/installer/run.mjs'), root];
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', ...installer, '--result=' + resultPath, '--status=' + path.join(directory, 'progress.json')], { windowsHide: true, stdio: 'ignore', timeout: 600000 });
  const installed = fs.existsSync(resultPath) ? read(resultPath) : null;
  if (result.error || result.status !== 0 || installed?.status !== 'success') throw Error(installed?.message ?? result.error?.message ?? '更新未完成，请使用手动更新程序查看原因。');
  const release = read(path.join(root, content ? '.updates/content/installed.json' : 'release.json'));
  if (content ? release.revision !== state.version : release.version !== state.version || release.releaseId !== state.releaseId) throw Error('安装后的版本记录与目标不一致。');
  completed = true;
  state = { ...state, phase: 'complete', percent: 100, message: '更新完成，正在重新启动 Wiki', completedAt: Date.now() };
} catch (error) {
  recoveryRequired = fs.existsSync(path.join(root, '.updates/transaction'));
  state = { ...state, phase: 'failed', message: error.message, recoveryRequired, completedAt: Date.now() };
  try {
    const resultDirectory = path.join(root, '.updates/results'); fs.mkdirSync(resultDirectory, { recursive: true });
    const optional = name => { try { return read(path.join(root, name)); } catch { return null; } };
    write(path.join(resultDirectory, content ? 'content.json' : 'software.json'), { id: config.jobId, channel: content ? 'content' : 'software', status: 'failed', completedAt: state.completedAt, software: optional('release.json'), contentRevision: optional('.updates/content/installed.json')?.revision ?? null, message: error.message, recoveryRequired });
  } catch { /* Preserve the installation failure even if the result directory is not writable. */ }
} finally {
  write(statePath, state);
  if (parentStopped && !recoveryRequired) {
    const child = spawn(process.execPath, [path.join(root, 'scripts/launch.mjs'), '--no-open', '--port=' + config.port], { cwd: root, detached: true, windowsHide: true, stdio: 'ignore', env: { ...process.env, WIKI_NO_OPEN: '1' } });
    child.on('error', () => {}); child.unref();
  }
  if (!recoveryRequired && directory === path.join(jobs, config.jobId) && !fs.lstatSync(directory).isSymbolicLink()) fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
process.exitCode = completed ? 0 : 1;
