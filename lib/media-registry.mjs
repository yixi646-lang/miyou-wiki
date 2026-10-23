import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLocalImage } from '../shared/asset-image.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
export const mediaRegistryPath = 'data/sources/media-registry.json';
async function read(root, name) {
  const path = resolve(root, name);
  if (!path.startsWith(resolve(root) + sep)) throw Error('图片登记路径超出工作区。');
  return JSON.parse(await readFile(path, 'utf8'));
}
const clean = candidate => Object.fromEntries(Object.entries(candidate).filter(([key]) => !['raw', 'registration', 'registrationName', 'registrationPath', 'priority'].includes(key)));

export async function loadMediaRegistry({ rootDirectory = defaultRoot } = {}) {
  const config = await read(rootDirectory, mediaRegistryPath);
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources)) throw Error('图片登记格式不受支持。');
  const entries = new Map(), sources = [], sourceIds = new Set();
  function add(record, role, label, image, source) {
    if (!record.id || !isLocalImage(image.image) || image.image.split('/').includes('..')) return;
    if (!entries.has(record.id)) entries.set(record.id, { id: record.id, name: record.name ?? record.id, game: record.game ?? record.id.split('-')[0], resources: new Map() });
    const entry = entries.get(record.id);
    if (!entry.resources.has(role)) entry.resources.set(role, { role, label, candidates: [] });
    const metadata = Object.fromEntries(Object.entries(image).filter(([key]) => !['avatar', 'parts', 'previousAvatar', 'referenceAvatar', 'id', 'game'].includes(key)));
    entry.resources.get(role).candidates.push({ ...metadata, registration: source.id, registrationName: source.name, registrationPath: source.path, priority: source.priority, raw: record });
  }
  for (const source of config.sources) {
    if (!source.id || sourceIds.has(source.id) || !Number.isFinite(source.priority)) throw Error('图片登记来源编号或优先级无效。');
    sourceIds.add(source.id);
    let data;
    try { data = await read(rootDirectory, source.path); }
    catch (error) { if (error.code === 'ENOENT' && source.optional === true) { sources.push({ ...source, missing: true, count: 0 }); continue; } throw error; }
    const records = data.records ?? [];
    sources.push({ ...source, count: source.kind === 'variants' ? Object.keys(data.variants ?? {}).length : records.length });
    if (source.kind === 'variants') {
      const gallery = new Map((data.galleryEntries ?? []).map(entry => [entry.id, entry]));
      for (const [id, choices] of Object.entries(data.variants ?? {})) for (const choice of choices) add({ id, ...gallery.get(id) }, 'variant:' + choice.key, choice.label, choice, source);
      continue;
    }
    for (const record of records) {
      const category = record.id?.split('-')[1];
      if (record.image) add(record, category === 'characters' ? 'artwork' : 'icon', category === 'characters' ? '主立绘' : '图标', record, source);
      if (record.avatar) add(record, 'avatar', '角色头像', record.avatar, source);
      for (const part of record.parts ?? []) add(record, 'part:' + part.type + ':' + part.name, part.type + ' · ' + part.name, part, source);
    }
  }
  for (const entry of entries.values()) {
    entry.resources = [...entry.resources.values()];
    for (const resource of entry.resources) {
      resource.candidates.sort((a, b) => b.priority - a.priority || a.registration.localeCompare(b.registration));
      if (resource.candidates.length > 1 && resource.candidates[0].priority === resource.candidates[1].priority && resource.candidates[0].image !== resource.candidates[1].image) throw Error('同一图片用途存在相同优先级：' + entry.id + ' / ' + resource.role);
      resource.selected = resource.candidates[0];
    }
  }
  return { schemaVersion: 1, path: mediaRegistryPath, sources, entries: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

export function registeredMediaIndex(registry) {
  const index = new Map();
  for (const entry of registry.entries) {
    const get = role => entry.resources.find(resource => resource.role === role)?.selected;
    const image = get('artwork') ?? get('icon'), avatar = get('avatar');
    if (!image && !avatar) continue;
    const record = { ...(image?.raw ?? {}), id: entry.id, name: entry.name };
    if (avatar) record.avatar = clean(avatar);
    const parts = entry.resources.filter(resource => resource.role.startsWith('part:')).map(resource => clean(resource.selected));
    if (parts.length) record.parts = parts;
    index.set(entry.id, record);
  }
  return index;
}

export function publicMediaRegistry(registry, currentEntries = []) {
  const current = new Map(currentEntries.map(entry => [entry.id, entry]));
  return { ...registry, entries: registry.entries.map(entry => {
    const live = current.get(entry.id);
    return { ...entry, name: live?.name ?? entry.name, resources: entry.resources.map(resource => {
      const strip = candidate => { const { raw, ...value } = candidate; return value; };
      const currentImage = resource.role === 'avatar' || resource.role === 'icon' ? live?.image : resource.role === 'artwork' ? live?.artwork : resource.role.startsWith('part:') ? live?.parts?.find(part => resource.role === 'part:' + part.type + ':' + part.name)?.image : resource.selected.image;
      return { ...resource, currentImage: currentImage ?? null, selected: strip(resource.selected), candidates: resource.candidates.map(strip) };
    }) };
  }) };
}
