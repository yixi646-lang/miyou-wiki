import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
const manifest = await read('data/sources/manifest.json');
const repository = manifest.repositories['theBowja/genshin-db-dist'];
const snapshot = `data/sources/genshin/material-domains-${repository.commit.slice(0, 12)}.json.gz`;
const url = `https://raw.githubusercontent.com/theBowja/genshin-db-dist/${repository.commit}/data/gzips/chinesesimplified-domains.min.json.gzip`;
let bytes;
try { bytes = await readFile(join(root, snapshot)); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(url, {signal:AbortSignal.timeout(25000)});
  if (!response.ok) throw Error(`秘境来源下载失败：HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  JSON.parse(gunzipSync(bytes).toString('utf8'));
  await writeFile(join(root, snapshot), bytes, {flag:'wx'});
}
const domains = Object.values(JSON.parse(gunzipSync(bytes).toString('utf8')).data.ChineseSimplified.domains);
const materials = Object.values((await read('data/sources/genshin/materials.json')).data.ChineseSimplified.materials);
const catalog = await read('data/catalog/genshin.json');
const records = {}, gaps = [];
const challenge = name => name.replace(/\s+[IVX]+$/, '');
for (const entry of catalog.entries.filter(item => item.category === 'materials')) {
  const raw = materials.find(item => String(item.id) === entry.sourceId);
  if (!raw?.dropDomainName) continue;
  // 使用同一固定提交，按挑战名称及奖励物品编号关联，不按材料词名猜地点。
  const matching = domains.filter(domain => challenge(domain.name) === raw.dropDomainName
    && domain.rewardPreview?.some(item => String(item.id) === entry.sourceId));
  if (!matching.length) {
    gaps.push({id:entry.id, name:entry.name, location:raw.dropDomainName, pending:'同版本秘境入口、地区与可获取难度'});
    continue;
  }
  records[entry.id] = {sourceId:entry.sourceId, challenge:raw.dropDomainName, domains:matching.map(domain => ({
    id:domain.id, name:domain.name, entrance:domain.entranceName, region:domain.regionName,
    days:domain.daysOfWeek ?? [], unlockRank:domain.unlockRank, recommendedLevel:domain.recommendedLevel
  }))};
}
const source = {name:'genshin-db · 材料秘境', url:repository.url, commit:repository.commit,
  snapshot, snapshotDate:repository.date.slice(0, 10), fetchedAt:new Date().toISOString(),
  note:'秘境入口、地区与难度条件；按同版本挑战名称及奖励物品编号关联。'};
await mkdir(join(root, 'data/material-acquisition'), {recursive:true});
await writeFile(join(root, 'data/material-acquisition/genshin.json'), JSON.stringify({schemaVersion:1, game:'genshin', source, records, gaps}, null, 2) + '\n');
console.log(JSON.stringify({materials:Object.keys(records).length, gaps, snapshot}));
