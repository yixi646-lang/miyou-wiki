import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDesktop } from '../scripts/desktop-launch.mjs';
import { createTestWorkspace, cleanupTestWorkspace, stopTestProcess } from '../scripts/test-resources.mjs';

test('桌面入口在服务就绪后退出，后台停止不再触发启动错误，真正的失败保留日志', { timeout: 15000 }, async () => {
  const workspace = await createTestWorkspace('desktop-launch');
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const env = { ...process.env, WIKI_PORT: String(port), WIKI_DB_PATH: join(workspace, 'wiki.sqlite'), WIKI_NO_OPEN: '1', WIKI_PAGE_STARTUP_MS: '10000' };
  let service, entry;
  try {
    service = await startDesktop({ env, args: ['--no-open'], logFile: join(workspace, 'startup.log') });
    assert.ok((await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()).entries > 0);
    if (process.platform === 'win32') {
      entry = spawn('C:\\Windows\\System32\\cscript.exe', ['//Nologo', fileURLToPath(new URL('../启动百科.vbs', import.meta.url)), '--no-open'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; entry.stdout.on('data', chunk => output += chunk); entry.stderr.on('data', chunk => output += chunk);
      assert.equal(await new Promise((resolve, reject) => { entry.once('error', reject); entry.once('exit', resolve); }), 0, output);
      assert.equal(service.exitCode, null, '入口已退出，后台服务仍在运行');
    }
    await stopTestProcess(service);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
    await assert.rejects(startDesktop({ env: { ...env, WIKI_DB_PATH: 'C:\\wiki-outside-workspace.sqlite' }, args: ['--no-open'], logFile: join(workspace, 'failure.log') }), /资料库须保存在工作区内/);
    assert.match(await readFile(join(workspace, 'failure.log'), 'utf8'), /资料库须保存在工作区内/);
  } finally {
    await stopTestProcess(entry);
    await stopTestProcess(service);
    await cleanupTestWorkspace(workspace);
  }
});
