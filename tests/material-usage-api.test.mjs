import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {openLibrary} from '../lib/database.mjs';
import {createTestWorkspace, cleanupTestWorkspace, stopTestProcess} from '../scripts/test-resources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('用途与版本接口读取真实初始化资料，保留库存、计划和收藏', {timeout: 20000}, async () => {
  const directory = await createTestWorkspace('material-usage');
  let child;
  try {
    const growth = JSON.parse(await readFile(join(root, 'data/growth/genshin.json'), 'utf8'));
    const recipe = Object.values(growth.recipes)[0], id = recipe.inputs[0].id;
    const plan = {goals: [], inventory: {[id]: 37}, savedAt: '2026-10-01T00:00:00Z'};
    const library = openLibrary(join(directory, 'wiki.sqlite'));
    try {library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin', JSON.stringify(plan));}
    finally {library.close();}
    const socket = createServer();
    await new Promise((resolve, reject) => {socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve);});
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    let diagnostics = '';
    child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.mjs', `--port=${port}`], {cwd: root, env: {...process.env, WIKI_DB_PATH: join(directory, 'wiki.sqlite'), WIKI_BACKUP_DIR: join(directory, 'backups')}, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc']});
    child.stderr.on('data', data => {diagnostics = (diagnostics + data).slice(-2000);});
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('隔离服务启动超时：' + diagnostics)), 10000);
      const finish = error => {clearTimeout(timer); error ? reject(error) : resolve();};
      child.once('error', finish);
      child.once('exit', code => finish(Error(`隔离服务提前退出 ${code}：${diagnostics}`)));
      child.once('message', message => {if (message.type === 'wiki-ready') finish();});
    });
    const base = `http://127.0.0.1:${port}/api/`;
    const get = async path => {const response = await fetch(base + path); assert.equal(response.status, 200); return response.json();};
    const before = await get('bootstrap');
    const catalog = await get('catalog?game=genshin');
    const usage = await get('material-usage/' + id);
    assert(Array.isArray(usage.acquisition.groups));
    const domainMaterial = await get('material-usage/genshin-materials-104303');
    assert(domainMaterial.acquisition.groups.some(group => group.routes.some(route => route.location === '忘却之峡')));
    assert.deepEqual(usage.inventory, {recorded: true, count: 37});
    assert(usage.recipes.some(row => row.id === recipe.id && row.inputs.some(item => item.id === id)));
    assert(usage.characters.concat(usage.weapons).every(item => catalog.entries.some(entry => entry.id === item.id && entry.game === 'genshin')));
    const status = await get('content-status');
    assert.equal(status.versions.genshin, growth.version);
    assert(Object.values(status.versions).every(version => /^\d+\.\d+(?:\.\d+)?$/.test(version)));
    assert.equal((await fetch(base + 'material-usage/' + Object.values(growth.profiles)[0].entryId)).status, 404);
    assert.deepEqual(await get('growth/genshin/plan'), plan);
    assert.deepEqual((await get('bootstrap')).favorites, before.favorites);
    const response = await fetch(base + 'entries', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Wiki-Token': before.token}, body: JSON.stringify({id: 'genshin-materials-content-status-test', game: 'genshin', category: 'materials', name: '隔离版本验证', releaseVersion: '99.10', details: {}})});
    assert.equal(response.status, 201);
    assert.equal((await get('content-status')).versions.genshin, '99.10');
    assert.deepEqual(await get('growth/genshin/plan'), plan);
  } finally {
    await stopTestProcess(child);
    await cleanupTestWorkspace(directory);
  }
});
