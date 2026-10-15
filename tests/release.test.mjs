import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openLibrary } from '../lib/database.mjs';
import { buildRelease, publishDraft, localRollback } from '../scripts/release-wiki.mjs';
import { applyUpdate } from '../lib/release-install.mjs';
import { readJSON, writeJSON, listFiles, PUBLIC_BASE, INSTALLED } from '../lib/release-common.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
function put(filename, text) { fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, text); }
function run(executable, args, env = {}) {
  const result = spawnSync(executable, args, { windowsHide: true, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 10 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout;
}
function extract(zip, directory) {
  run('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:WIKI_TEST_ZIP,$env:WIKI_TEST_OUTPUT)'], { WIKI_TEST_ZIP: zip, WIKI_TEST_OUTPUT: directory });
}
const entry = (id, name, x = '旧值', y = '原值') => ({ id, game: 'genshin', category: 'characters', name, rarity: 5, details: { facts: { x, y } } });
function fixture() {
  const directory = path.join(project, '.codex_tmp/tests/release-' + randomUUID()), root = path.join(directory, '维护端');
  fs.mkdirSync(root, { recursive: true });
  const config = { schemaVersion: 1, directories: ['public', 'lib', 'shared'], files: ['package.json', 'server.mjs'], excludePrefixes: [], excludeFiles: ['lib/release-common.mjs', 'lib/release-data.mjs', 'lib/release-install.mjs'], runtimeScripts: [], sourceDirectories: ['data/catalog'], sourceFiles: ['release-config.json', 'lib/release-common.mjs', 'lib/release-data.mjs', 'lib/release-install.mjs'], knownRootDirectories: ['public', 'lib', 'shared', 'data', '.release-manager', '.updates', '.codex_tmp'], knownDataDirectories: ['library', 'catalog', 'assessment'], nodeVersion: 'v24.18.0' };
  writeJSON(path.join(root, 'release-config.json'), config);
  put(path.join(root, 'package.json'), '{"type":"module"}'); put(path.join(root, 'server.mjs'), '// fixture\n');
  put(path.join(root, 'public/old.css'), 'old'); put(path.join(root, 'public/keep.css'), 'keep');
  for (const name of ['release-common.mjs', 'release-data.mjs', 'release-install.mjs', 'database.mjs']) put(path.join(root, 'lib', name), fs.readFileSync(path.join(project, 'lib', name)));
  for (const name of listFiles(path.join(project, 'shared')).filter(name => name.endsWith('.mjs'))) put(path.join(root, 'shared', name), fs.readFileSync(path.join(project, 'shared', name)));
  put(path.join(root, '.release-manager/runtime/node.exe'), 'fixture-runtime'); put(path.join(root, '.release-manager/runtime/LICENSE'), 'fixture-license');
  const library = openLibrary(path.join(root, 'data/library/wiki.sqlite'));
  library.create(entry('genshin-a', '角色甲')); library.create(entry('genshin-b', '角色乙'));
  library.favorite('genshin-a', true);
  library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin', '{"inventory":{"private":77},"goals":[]}'); library.close();
  writeJSON(path.join(root, 'data/catalog/genshin.json'), { entries: [entry('genshin-a', '角色甲'), entry('genshin-b', '角色乙')] });
  return { root, directory, build: options => buildRelease({ root, testFixture: true, ...options }), cleanup: () => fs.rmSync(directory, { recursive: true }) };
}
function edit(root, fn) { const library = openLibrary(path.join(root, 'data/library/wiki.sqlite')); try { return fn(library); } finally { library.close(); } }
function addPersonalStore(root) {
  fs.mkdirSync(path.join(root, 'data/assessment'), { recursive: true });
  const filename = path.join(root, 'data/assessment/assessment.sqlite'), db = new DatabaseSync(filename);
  db.exec("CREATE TABLE personal(value TEXT); INSERT INTO personal VALUES('accounts-weapons-teams-original-scans');"); db.close(); return fs.readFileSync(filename);
}

test('完整包清空个人资料；后续自动收齐新文件、删除和数据库条目，并独立合并', async () => {
  const f = fixture();
  try {
    const initial = await f.build({ kind: 'full', publish: true });
    const unpacked = path.join(f.directory, '朋友 有空格'); extract(initial.outputs[0], unpacked);
    const friend = path.join(unpacked, 'Wiki');
    edit(friend, library => { assert.equal(library.favorites().length, 0); assert.equal(library.db.prepare('SELECT COUNT(*) AS n FROM metadata').get().n, 0); library.favorite('genshin-b', true); library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin', '{"inventory":{"private":99},"goals":[]}'); const old = library.get('genshin-a'); library.update(old.id, { ...old, details: { facts: { x: '朋友自定义', y: '原值' } } }, old.revision); library.create(entry('genshin-local', '自建角色')); });
    const personal = addPersonalStore(friend), keepTime = fs.statSync(path.join(friend, 'public/keep.css')).mtimeMs;
    assert.equal(fs.existsSync(path.join(friend, '回退Wiki.cmd')), false);
    put(path.join(f.root, 'public/new.mjs'), 'export const added=true;'); fs.unlinkSync(path.join(f.root, 'public/old.css'));
    edit(f.root, library => { const old = library.get('genshin-a'); library.update(old.id, { ...old, details: { facts: { x: '新官方值', y: '新字段值' } } }, old.revision); library.create(entry('genshin-c', '新增角色')); library.db.prepare('DELETE FROM entries WHERE id=?').run('genshin-b'); });
    const draft = await f.build({ kind: 'content' });
    assert.equal(readJSON(path.join(f.root, '.release-manager/state.json')).releases.length, 1, '草稿不推进基准');
    publishDraft(f.root, draft.draftId);
    const update = path.join(f.directory, '更新包'); extract(draft.outputs[0], update);
    const manifest = readJSON(path.join(update, 'update.json'));
    assert(manifest.files.some(file => file.path === 'public/new.mjs')); assert(manifest.deleted.includes('public/old.css'));
    assert(fs.existsSync(path.join(update, '安装更新.cmd'))); assert(fs.existsSync(path.join(update, 'installer/run.mjs')));
    run(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(update, 'installer/run.mjs'), friend]);
    assert.equal(fs.existsSync(path.join(friend, 'public/old.css')), false); assert.equal(fs.statSync(path.join(friend, 'public/keep.css')).mtimeMs, keepTime);
    edit(friend, library => { assert.equal(library.get('genshin-a').details.facts.x, '朋友自定义'); assert.equal(library.get('genshin-a').details.facts.y, '新字段值'); assert(library.get('genshin-c')); assert(library.get('genshin-local')); assert(library.get('genshin-b')); assert.deepEqual(library.favorites(), ['genshin-b']); assert.equal(JSON.parse(library.db.prepare('SELECT value FROM metadata').get().value).inventory.private, 99); library.seed(path.join(friend, 'data/catalog')); assert(library.get('genshin-local')); });
    assert.deepEqual(fs.readFileSync(path.join(friend, 'data/assessment/assessment.sqlite')), personal);
    assert.equal(fs.existsSync(path.join(friend, '.updates/rollback')), false, '分享更新不建立功能备份');
    assert.equal(readJSON(path.join(friend, INSTALLED)).release.releaseId, 'R000002');
    assert(!readJSON(path.join(friend, 'data/catalog/release-public.json')).entries.some(item => item.id === 'genshin-b'));
    assert.equal(fs.existsSync(path.join(friend, '.updates/transaction')), false);
    assert.throws(() => applyUpdate(friend, update), /起始批次不匹配/);
  } finally { f.cleanup(); }
});

test('失败恢复、基准和路径校验；当前个人账号原字节保留', async () => {
  const f = fixture();
  try {
    const initial = await f.build({ kind: 'full', publish: true }), unpacked = path.join(f.directory, '朋友'); extract(initial.outputs[0], unpacked);
    const friend = path.join(unpacked, 'Wiki'), personal = addPersonalStore(friend), before = readJSON(path.join(friend, PUBLIC_BASE));
    put(path.join(f.root, 'public/new.css'), 'new'); edit(f.root, library => library.create(entry('genshin-c', '新增')));
    const next = await f.build({ kind: 'fix', publish: true }), update = path.join(f.directory, '更新'); extract(next.outputs[0], update);
    assert.throws(() => applyUpdate(friend, update, { failAt: 'after-files' }), /测试：文件覆盖后中断/);
    assert.equal(fs.existsSync(path.join(friend, 'public/new.css')), false); assert.deepEqual(readJSON(path.join(friend, PUBLIC_BASE)), before);
    assert.equal(readJSON(path.join(friend, INSTALLED)).release.releaseId, 'R000001'); edit(friend, library => assert.equal(library.get('genshin-c'), undefined));
    assert.equal(fs.existsSync(path.join(friend, '.updates/transaction')), false); assert.deepEqual(fs.readFileSync(path.join(friend, 'data/assessment/assessment.sqlite')), personal);
    const original = readJSON(path.join(update, 'update.json'));
    writeJSON(path.join(update, 'update.json'), { ...original, files: [{ path: '../outside.txt', size: 0 }] }); assert.throws(() => applyUpdate(friend, update), /路径不合法/);
    writeJSON(path.join(update, 'update.json'), { ...original, files: [{ path: 'data/assessment/assessment.sqlite', size: personal.length }] }); assert.throws(() => applyUpdate(friend, update), /数据库|受保护/);
    writeJSON(path.join(update, 'update.json'), original);
    writeJSON(path.join(friend, 'data/library/wiki.sqlite.service.json'), { pid: process.pid }); assert.throws(() => applyUpdate(friend, update), /服务仍在运行/); fs.unlinkSync(path.join(friend, 'data/library/wiki.sqlite.service.json'));
    applyUpdate(friend, update); assert.equal(readJSON(path.join(friend, INSTALLED)).release.releaseId, 'R000002');
  } finally { f.cleanup(); }
});

test('功能回退只在本机；之后修复和资料发布不移动回退目标，累计包覆盖全部变化', async () => {
  const f = fixture();
  try {
    await f.build({ kind: 'full', publish: true });
    const personal = addPersonalStore(f.root);
    put(path.join(f.root, 'public/feature.mjs'), 'feature'); edit(f.root, library => library.create(entry('genshin-c', '功能新增资料')));
    await f.build({ kind: 'feature', version: '1.1.0', publish: true });
    assert.equal(readJSON(path.join(f.root, '.release-manager/local-rollback.json')).base.release.releaseId, 'R000001');
    put(path.join(f.root, 'public/keep.css'), 'fixed-after-feature');
    const cumulative = await f.build({ kind: 'content', from: 'R000001', publish: true });
    const update = path.join(f.directory, '累计'); extract(cumulative.outputs[0], update);
    const manifest = readJSON(path.join(update, 'update.json'));
    assert.equal(manifest.from.releaseId, 'R000001'); assert.equal(manifest.to.releaseId, 'R000003');
    assert(manifest.files.some(file => file.path === 'public/feature.mjs')); assert(manifest.files.some(file => file.path === 'public/keep.css'));
    assert.equal(readJSON(path.join(f.root, '.release-manager/local-rollback.json')).base.release.releaseId, 'R000001');
    await localRollback(f.root, { confirm: true });
    assert.equal(fs.existsSync(path.join(f.root, 'public/feature.mjs')), false); assert.equal(fs.readFileSync(path.join(f.root, 'public/keep.css'), 'utf8'), 'keep');
    assert.equal(readJSON(path.join(f.root, 'release.json')).version, '1.0.0');
    edit(f.root, library => { assert.equal(library.get('genshin-c'), undefined); assert.deepEqual(library.favorites(), ['genshin-a']); assert.equal(JSON.parse(library.db.prepare('SELECT value FROM metadata').get().value).inventory.private, 77); });
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'data/assessment/assessment.sqlite')), personal);
    assert.equal(readJSON(path.join(f.root, '.release-manager/state.json')).releases.length, 3, '本机回退不清理正式历史');
    fs.mkdirSync(path.join(f.root, '未分类新功能'));
    await assert.rejects(f.build({ kind: 'fix' }), /未分类的顶层目录/);
    assert.equal(readJSON(path.join(f.root, '.release-manager/state.json')).releases.length, 3, '失败不推进发布基准');
  } finally { f.cleanup(); }
});
