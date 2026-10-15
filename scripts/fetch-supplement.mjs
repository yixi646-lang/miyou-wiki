import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function fetchJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'XingyeLocalWiki/1.0' } });
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      return await response.json();
    } catch (error) { if (attempt === 2) throw error; }
  }
}
async function cached(path, url) {
  const target = join(root, 'data', 'sources', path);
  try { return JSON.parse(await readFile(target, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const value = await fetchJSON(url);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2), { flag: 'wx' });
  return value;
}
const manifest = await cached('nanoka-manifest.json', 'https://static.nanoka.cc/manifest.json');
const jobs = [];
for (const [game, code] of Object.entries({ genshin: 'ys', starrail: 'sr', zenless: 'zzz' })) {
  const query = '[[实装版本::+]]|?实装日期|?实装版本|limit=500';
  const datedQuery = '[[实装日期::+]]|?实装日期|?实装版本|limit=500';
  jobs.push({ path: `${game}/bwiki-release-version.json`, url: `https://wiki.biligame.com/${code}/api.php?action=ask&query=${encodeURIComponent(query)}&format=json` });
  jobs.push({ path: `${game}/bwiki-release-date.json`, url: `https://wiki.biligame.com/${code}/api.php?action=ask&query=${encodeURIComponent(datedQuery)}&format=json` });
}
for (const [game, code] of Object.entries({ genshin: 'gi', starrail: 'hsr', zenless: 'zzz' })) {
  const version = manifest[code].live;
  const characters = await cached(`${game}/nanoka-character-index.json`, `https://static.nanoka.cc/${code}/${version}/character.json`);
  if (game === 'zenless') {
    const weapons = await cached('zenless/nanoka-weapon-index.json', `https://static.nanoka.cc/zzz/${version}/weapon.json`);
    jobs.push({ path: 'zenless/nanoka-equipment-index.json', url: `https://static.nanoka.cc/zzz/${version}/equipment.json` });
    jobs.push({ path: 'zenless/nanoka-items.json', url: `https://static.nanoka.cc/zzz/${version}/zh/item.json` });
    for (const id of Object.keys(characters)) jobs.push({ path: `zenless/characters/${id}.json`, url: `https://static.nanoka.cc/zzz/${version}/zh/character/${id}.json` });
    for (const id of Object.keys(weapons)) jobs.push({ path: `zenless/weapons/${id}.json`, url: `https://static.nanoka.cc/zzz/${version}/zh/weapon/${id}.json` });
  }
}
let index = 0, completed = 0; const failures = [];
async function worker() {
  while (index < jobs.length) {
    const job = jobs[index++];
    try { await cached(job.path, job.url); } catch (error) { failures.push({ ...job, error: error.message }); }
    completed++;
    if (completed % 20 === 0 || completed === jobs.length) console.log(`补充资料：${completed}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
const output = join(root, 'data', 'sources', 'supplement-manifest.json');
try { await access(output); } catch { await writeFile(output, JSON.stringify({ fetchedAt: new Date().toISOString(), liveVersions: { genshin: manifest.gi.live, starrail: manifest.hsr.live, zenless: manifest.zzz.live }, files: jobs, failures }, null, 2), { flag: 'wx' }); }
console.log(JSON.stringify({ completed, failures }, null, 2));
