import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createServer } from 'node:net';

const validPort = port => Number.isInteger(port) && port >= 1024 && port <= 65535;
const readRecord = filename => {
  try { return JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
export function instanceIdentity(root, databasePath) {
  const normalize = filename => process.platform === 'win32' ? resolve(filename).toLowerCase() : resolve(filename);
  return createHash('sha256').update(normalize(root)).update('\0').update(normalize(databasePath)).digest('hex');
}
export function rememberInstance(databasePath, instanceId, port) {
  const filename = databasePath + '.instance.json', temporary = filename + '.' + randomUUID() + '.tmp';
  mkdirSync(dirname(filename), { recursive: true });
  try {
    writeFileSync(temporary, JSON.stringify({ instanceId, port }) + '\n');
    renameSync(temporary, filename);
  } finally {
    try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
async function available(port) {
  return new Promise((accept, reject) => {
    const listener = createServer();
    listener.once('error', error => ['EADDRINUSE', 'EACCES'].includes(error.code) ? accept(false) : reject(error));
    listener.listen(port, '127.0.0.1', () => listener.close(error => error ? reject(error) : accept(true)));
  });
}
export async function resolveLaunchTarget({ root, databasePath, requestedPort }) {
  if (!resolve(databasePath).startsWith(resolve(root) + sep)) throw Error('资料库须保存在工作区内。');
  const instanceId = instanceIdentity(root, databasePath), saved = readRecord(databasePath + '.instance.json');
  const preferred = Number(requestedPort ?? (saved?.instanceId === instanceId ? saved.port : 20000 + parseInt(instanceId.slice(0, 8), 16) % 40000));
  if (!validPort(preferred)) throw Error('端口须为 1024–65535。');
  const lock = readRecord(databasePath + '.service.json');
  let running = false;
  if ((!lock?.instanceId || lock.instanceId === instanceId) && Number.isInteger(lock?.pid) && lock.pid > 0) {
    try { process.kill(lock.pid, 0); running = true; }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (running) {
    if (lock.instanceId !== instanceId || !validPort(lock.port)) throw Error('此目录的旧版 Wiki 服务仍在运行，请关闭其全部页面，等待约 15 秒后重新启动。');
    const url = `http://127.0.0.1:${lock.port}`;
    // 同一目录重复启动时，短暂等待首个进程完成资料加载。
    for (let attempt = 0; attempt < 30; attempt++) {
      let health;
      try {
        const response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1200) });
        if (response.ok) health = await response.json();
      } catch {}
      if (health) {
        if (health.app !== 'local-wiki' || health.instanceId !== instanceId || health.pid !== lock.pid) throw Error('该端口属于其他服务，未打开其他目录的 Wiki。');
        return { instanceId, port: lock.port, reuse: true };
      }
      await new Promise(accept => setTimeout(accept, 100));
    }
    throw Error('此目录的 Wiki 服务未响应，请关闭其页面后重新启动。');
  }
  // 各目录有稳定的首选端口；占用时另选端口，成功启动后保存。
  for (let offset = 0; offset < 100; offset++) {
    const port = 1024 + (preferred - 1024 + offset) % (65536 - 1024);
    if (await available(port)) return { instanceId, port, reuse: false };
  }
  throw Error('未找到可用的 Wiki 端口。');
}
