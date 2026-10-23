import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { loadMediaRegistry, publicMediaRegistry } from '../lib/media-registry.mjs';
import { previewContentUpdate } from '../lib/content-install.mjs';
import { entryChangePreview } from '../shared/entry-changes.mjs';
import { validateEntry, isExcludedEntry } from '../shared/catalog.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
async function readJSON(file) { const bytes = await readFile(file); return JSON.parse((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8').replace(/^\uFEFF/, '')); }
function readEntries(file) {
  if (!existsSync(file)) return [];
  const db = new DatabaseSync(file, { readOnly: true });
  try { return db.prepare('SELECT payload FROM entries ORDER BY id').all().map(row => JSON.parse(row.payload)); }
  finally { db.close(); }
}
const entriesOf = value => Array.isArray(value) ? value : (value.library ?? value).entries;
export async function inspectEntryChanges(file, { rootDirectory = project, databasePath = join(rootDirectory, 'data/library/wiki.sqlite'), baseFile } = {}) {
  const input = await readJSON(resolve(file)), entries = entriesOf(input);
  if (!Array.isArray(entries)) throw Error('文件须包含百科 entries 数组。');
  const local = new Map(readEntries(databasePath).map(entry => [entry.id, entry]));
  const baseline = new Map(baseFile ? entriesOf(await readJSON(resolve(baseFile))).map(entry => [entry.id, entry]) : []);
  return entries.filter(entry => !isExcludedEntry(entry)).map(entry => {
    validateEntry(entry);
    return entryChangePreview({ base: baseline.get(entry.id), local: local.get(entry.id), incoming: entry, sourceBatch: String(input.sourceBatch ?? input.contentRevision ?? input.exportedAt ?? file) });
  }).filter(entry => entry.fields.length);
}
export async function runMaintenanceTools(args = process.argv.slice(2), { rootDirectory = project, write = line => console.log(line) } = {}) {
  const [command, ...rest] = args, positional = rest.filter(arg => !arg.startsWith('--'));
  const option = name => rest.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  const dbPath = resolve(option('db') ?? join(rootDirectory, 'data/library/wiki.sqlite'));
  let data;
  if (command === 'media') {
    const current = readEntries(dbPath).map(entry => ({ id: entry.id, name: entry.name, image: entry.image, artwork: entry.details?.artwork?.image, parts: entry.details?.parts }));
    data = publicMediaRegistry(await loadMediaRegistry({ rootDirectory }), current);
    data.entries = data.entries.filter(entry => (!option('game') || entry.game === option('game')) && (!option('query') || (entry.name + entry.id).includes(option('query'))));
    for (const entry of data.entries) entry.resources = entry.resources.filter(resource => !option('kind') || resource.role.split(':')[0] === option('kind'));
    data.entries = data.entries.filter(entry => entry.resources.length);
    if (!rest.includes('--json')) { for (const entry of data.entries) for (const resource of entry.resources) write(`${entry.name} · ${resource.label}\n当前：${resource.currentImage ?? '未录入'}\n登记：${resource.selected.image}\n优先级 ${resource.selected.priority} · ${resource.selected.registrationPath}${resource.selected.temporary ? ' · 临时替代 / 修正版' : ''}`); return data; }
  } else if (command === 'changes') {
    if (!positional[0]) throw Error('请指定待核对的 JSON 或 JSON.GZ 文件。');
    data = { changes: await inspectEntryChanges(positional[0], { rootDirectory, databasePath: dbPath, baseFile: option('base') }) };
  } else if (command === 'package') {
    if (!positional[0]) throw Error('请指定已解压的资料包目录。');
    data = previewContentUpdate(rootDirectory, resolve(positional[0]));
  } else throw Error('用法：node scripts/maintenance-tools.mjs media [--query=名称] [--kind=avatar] [--json]；changes <资料文件> [--base=基准文件]；package <资料包目录>。全部只读。');
  if (rest.includes('--json')) write(JSON.stringify(data, null, 2));
  else {
    write(`${data.changes.length} 个条目有变化（只读核对）`);
    const short = value => (typeof value === 'string' ? value : JSON.stringify(value) ?? '未设置').replace(/\s+/g, ' ').slice(0, 160);
    for (const entry of data.changes) { write(`${entry.name} · ${entry.id} · 来源批次 ${entry.sourceBatch}`); for (const field of entry.fields) write(`  ${field.label}：${short(field.before)} → ${short(field.after)}（${field.status}）`); }
  }
  return data;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runMaintenanceTools(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
