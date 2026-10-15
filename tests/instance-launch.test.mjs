import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDesktop } from '../scripts/desktop-launch.mjs';
import { createTestWorkspace, cleanupTestWorkspace, stopTestProcess } from '../scripts/test-resources.mjs';
import { createAccountStore } from '../modules/character-assessment/accounts-store.mjs';
import { instanceIdentity, resolveLaunchTarget } from '../lib/wiki-instance.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const exited = child => child.exitCode !== null ? Promise.resolve(child.exitCode) : new Promise(resolve => child.once('exit', resolve));

test('Wiki 实例独立：同端口冲突、账号隔离、重复启动、端口记忆及复制目录记录', { timeout: 30000 }, async () => {
  const directory = await createTestWorkspace('instance-launch'), children = [];
  const listener = createServer();
  let port;
  const make = async name => {
    const workspace = join(directory, name);
    await mkdir(workspace);
    const store = createAccountStore(join(workspace, 'assessment.sqlite'));
    try { store.database().prepare('UPDATE assessment_accounts SET name=?').run(name); }
    finally { store.close(); }
    return { workspace, databasePath: join(workspace, 'wiki.sqlite') };
  };
  const start = async (fixture, preferred = port) => {
    const env = { ...process.env, WIKI_DB_PATH: fixture.databasePath, WIKI_NO_OPEN: '1', WIKI_PAGE_STARTUP_MS: '300000' };
    if (preferred === null) delete env.WIKI_PORT;
    else env.WIKI_PORT = String(preferred);
    const child = await startDesktop({ env, args: ['--no-open'], logFile: join(fixture.workspace, 'startup.log') });
    children.push(child);
    const record = JSON.parse(await readFile(fixture.databasePath + '.instance.json', 'utf8'));
    return { child, record, base: `http://127.0.0.1:${record.port}` };
  };
  const health = async service => (await (await fetch(service.base + '/api/health')).json());
  try {
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const a = await make('实例甲'), b = await make('实例乙');
    const first = await start(a), second = await start(b);
    assert.equal(first.record.port, port);
    assert.notEqual(first.record.port, second.record.port);
    assert.notEqual(first.record.instanceId, second.record.instanceId);
    for (const [service, expected] of [[first, '实例甲'], [second, '实例乙']]) {
      assert.equal((await health(service)).pid, service.child.pid);
      const accounts = await (await fetch(service.base + '/api/assessment/accounts')).json();
      assert.deepEqual(accounts.accounts.map(account => account.name), [expected]);
    }
    const duplicate = await start(a);
    assert.equal(await exited(duplicate.child), 0);
    assert.equal(duplicate.base, first.base);
    assert.equal((await health(first)).pid, first.child.pid);

    // 一个目录的页面令牌不能写入另一实例。
    const { token } = await (await fetch(first.base + '/api/bootstrap')).json();
    assert.equal((await fetch(second.base + '/api/page-session/enable', { method: 'POST', headers: { 'X-Wiki-Token': token } })).status, 403);
    await stopTestProcess(second.child);
    assert.equal((await health(first)).ok, true);
    const restarted = await start(b, null);
    assert.equal(restarted.base, second.base);

    const copied = await make('复制实例');
    await copyFile(a.databasePath + '.instance.json', copied.databasePath + '.instance.json');
    await copyFile(a.databasePath + '.service.json', copied.databasePath + '.service.json');
    const third = await start(copied, null);
    assert.notEqual(third.record.instanceId, first.record.instanceId);
    assert.notEqual(third.record.port, first.record.port);
    assert.equal((await health(first)).pid, first.child.pid);

    // 运行记录与端口上的服务不一致时拒绝复用。
    const bad = await make('错误记录');
    await writeFile(bad.databasePath + '.service.json', JSON.stringify({ pid: first.child.pid, instanceId: instanceIdentity(root, bad.databasePath), port: first.record.port }));
    await assert.rejects(resolveLaunchTarget({ root, databasePath: bad.databasePath }), /该端口属于其他服务/);
    await writeFile(bad.databasePath + '.service.json', JSON.stringify({ pid: first.child.pid }));
    await assert.rejects(resolveLaunchTarget({ root, databasePath: bad.databasePath }), /旧版 Wiki 服务仍在运行/);
  } finally {
    if (listener.listening) await new Promise(resolve => listener.close(resolve));
    for (const child of children.reverse()) await stopTestProcess(child);
    await cleanupTestWorkspace(directory);
  }
});
