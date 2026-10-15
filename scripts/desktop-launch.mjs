import { spawn } from 'node:child_process';
import { mkdir, appendFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 桌面入口只等待服务就绪，不把后台服务日后的退出当作启动失败。
export async function startDesktop({ env = process.env, args = process.argv.slice(2), logFile = fileURLToPath(new URL('../data/logs/startup.log', import.meta.url)) } = {}) {
  await mkdir(dirname(logFile), { recursive: true });
  const logHandle = openSync(logFile, 'a');
  let child;
  try {
    child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('./launch.mjs', import.meta.url)), ...args], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env, detached: true,
      windowsHide: true, stdio: ['ignore', logHandle, logHandle, 'ipc'],
    });
  } finally { closeSync(logHandle); }
  try {
    await new Promise((accept, reject) => {
      const timer = setTimeout(() => finish(new Error('等待 Wiki 启动超时。')), 20000);
      const onError = error => finish(error);
      const onExit = code => finish(new Error(`Wiki 启动进程提前结束（${code}），详情见启动日志。`));
      const onMessage = message => {
        if (message?.type === 'wiki-ready') finish();
        if (message?.type === 'wiki-error') finish(new Error(message.message));
      };
      function finish(error) {
        clearTimeout(timer);
        child.off('error', onError); child.off('exit', onExit); child.off('message', onMessage);
        error ? reject(error) : accept();
      }
      child.once('error', onError); child.once('exit', onExit); child.on('message', onMessage);
    });
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await appendFile(logFile, `${new Date().toISOString()} 桌面启动失败：${error.message}\n`);
    throw error;
  } finally {
    if (child.connected) child.disconnect();
    child.unref();
  }
  return child;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startDesktop(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
