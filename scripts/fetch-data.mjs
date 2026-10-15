import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const fetchedAt = new Date().toISOString();
let manifest;
try { manifest=JSON.parse(await readFile(join(root,'data','sources','manifest.json'),'utf8')); }
catch(error) { if(error.code!=='ENOENT')throw error;manifest={fetchedAt,repositories:{},files:[]}; }
const jobs = [
  ...['characters', 'weapons', 'artifacts', 'talents', 'constellations', 'materials'].map(name => ({ game: 'genshin', repo: 'theBowja/genshin-db-dist', branch: 'main', file: `data/gzips/chinesesimplified-${name}.min.json.gzip`, name })),
  ...['characters', 'character_skills', 'character_ranks', 'character_promotions', 'character_skill_trees', 'light_cones', 'light_cone_ranks', 'light_cone_promotions', 'relic_sets', 'relics', 'items', 'elements', 'paths', 'properties'].map(name => ({ game: 'starrail', repo: 'Mar-7th/StarRailRes', branch: 'master', file: `index_new/cn/${name}.json`, name })),
  ...['avatars', 'weapons', 'equipments', 'locs', 'property'].map(name => ({ game: 'zenless', repo: 'EnkaNetwork/API-docs', branch: 'master', file: `store/zzz/${name}.json`, name }))
];

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'XingyeLocalWiki/1.0' } });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { if (attempt === 2) throw error; }
  }
}

await mkdir(join(root, 'data', 'sources'), { recursive: true });
for (const { repo, branch } of jobs.filter((job, index, arr) => arr.findIndex(x => x.repo === job.repo) === index)) {
  if(manifest.repositories[repo])continue;
  const commit = JSON.parse((await get(`https://api.github.com/repos/${repo}/commits/${branch}`)).toString());
  manifest.repositories[repo] = { commit: commit.sha, date: commit.commit.committer.date, url: `https://github.com/${repo}/tree/${commit.sha}` };
}

let index = 0;
async function worker() {
  while (index < jobs.length) {
    const job = jobs[index++];
    const path = join(root, 'data', 'sources', job.game, `${job.name}.json`);
    try {
      await access(path);
      console.log(`保留已有快照：${job.game}/${job.name}`);
      continue;
    } catch {}
    const commit = manifest.repositories[job.repo].commit;
    const url = `https://raw.githubusercontent.com/${job.repo}/${commit}/${job.file}`;
    const buffer = await get(url);
    const text = job.file.endsWith('.gzip') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
    const data = JSON.parse(text);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2), { flag: 'wx' });
    manifest.files.push({ game: job.game, name: job.name, url, bytes: buffer.length });
    console.log(`已下载：${job.game}/${job.name} (${buffer.length} bytes)`);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
const manifestPath = join(root, 'data', 'sources', 'manifest.json');
try { await access(manifestPath); console.log('已有来源清单保持原样。'); }
catch { await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' }); }
const licenseUrl = 'https://raw.githubusercontent.com/theBowja/genshin-db-dist/main/LICENSE';
const licensePath = join(root, 'data', 'sources', 'genshin', 'LICENSE.txt');
try { await access(licensePath); } catch { await writeFile(licensePath, await get(licenseUrl), { flag: 'wx' }); }
console.log('本地来源快照下载完成；重复运行不会覆盖已有文件。');
