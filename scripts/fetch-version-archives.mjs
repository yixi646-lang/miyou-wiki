// 仅下载公开版本资料到新的来源批次，不修改正式条目和个人资料。
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const batch = `${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})}-${randomUUID().slice(0,8)}`;
const directory = join(root, 'data', 'sources', 'version-archive', batch);
await mkdir(directory, {recursive: true});
const sites = {
  genshin: {wiki: 'genshin-impact', key: 'a1b1f9d3315447cc', channel: 397, lang: 'zh-tw', site: 'https://genshin.hoyoverse.com'},
  starrail: {wiki: 'honkai-star-rail', key: '113fe6d3b4514cdd', channel: 250, lang: 'zh-cn', site: 'https://hsr.hoyoverse.com'},
  zenless: {wiki: 'zenless-zone-zero', key: '3e9196a4b9274bd7', channel: 296, lang: 'zh-cn', site: 'https://zenless.hoyoverse.com'}
};
const get = async url => {
  const response = await fetch(url, {signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'LocalWikiVersionArchive/1.0'}});
  if (!response.ok) throw Error(`公开资料请求失败 ${response.status}: ${url}`);
  const data = await response.json();
  if (data.error || data.retcode) throw Error(`来源返回错误: ${data.error?.info ?? data.message}`);
  return data;
};
const save = async (filename, data) => writeFile(join(directory, filename), gzipSync(JSON.stringify(data)), {flag: 'wx'});
const manifest = {schemaVersion: 1, batch, fetchedAt: new Date().toISOString(), games: {}};
for (const [game, config] of Object.entries(sites)) {
  const archives = [], notices = [];
  let lang = config.lang;
  const endpoint = `https://sg-public-api-static.hoyoverse.com/content_v2_user/app/${config.key}/getContentList`;
  const listURL = page => `${endpoint}?iChanId=${config.channel}&iPageSize=100&iPage=${page}&sLangKey=${lang}`;
  let first = await get(listURL(1));
  if (!first.data.iTotal && game === 'genshin') {lang = 'en-us'; first = await get(listURL(1));}
  const pages = Math.ceil(first.data.iTotal / 100);
  for (let page = 1; page <= pages; page++) {
    const items = (page === 1 ? first : await get(listURL(page))).data.list;
    for (const item of items) {
      if (/(?:云|雲)[·・](?:原神|绝区零|絕區零|星穹)/.test(item.sTitle)) continue;
      if (!/更新(?:说明|公告|說明|通知|概览)|Update Details|Update Announcement|Update Notice/i.test(item.sTitle)) continue;
      if (!/\d+\.\d+|Luna [IVX]+|月之/.test(item.sTitle)) continue;
      const record = {...item, language: lang, sourceURL: `${config.site}/${lang}/${game === 'genshin' ? 'news/detail' : 'news'}/${item.iInfoId}`};
      if (/更新修复|已知问题|问题|launcher|pre-download|maintenance notice/i.test(item.sTitle)) notices.push(record);
      else archives.push(record);
    }
    console.log(`${game}: 官方目录 ${page}/${pages}，版本公告 ${archives.length}`);
  }
  const catalog = JSON.parse(await readFile(join(root, 'data/catalog', `${game}.json`), 'utf8'));
  const versions = [...new Set(catalog.entries.map(e => e.releaseVersion?.match(/^\d+\.\d+/)?.[0]).filter(Boolean))];
  for (let offset = 0; offset < versions.length; offset += 35) {
    const url = new URL(`https://${config.wiki}.fandom.com/api.php`);
    url.search = new URLSearchParams({action: 'query', format: 'json', formatversion: '2', titles: versions.slice(offset, offset+35).map(v => `Version/${v}`).join('|'), prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', redirects: '1'});
    const data = await get(url);
    await save(`${game}-wiki-${offset}.json.gz`, {fetchedAt: manifest.fetchedAt, url: String(url), ...data});
    console.log(`${game}: 历史版本 ${Math.min(offset+35,versions.length)}/${versions.length}`);
  }
  await save(`${game}-official.json.gz`, {fetchedAt: manifest.fetchedAt, endpoint, language: lang, archives, notices});
  manifest.games[game] = {versions: versions.length, official: archives.length, language: lang};
}
manifest.dictionaries=[];
for(const filename of ['TSCharacters.txt','TSPhrases.txt','LICENSE']){
  const url=`https://raw.githubusercontent.com/BYVoid/OpenCC/master/${filename==='LICENSE'?'LICENSE':'data/dictionary/'+filename}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('繁简转换字典下载失败');
  await writeFile(join(directory,filename==='LICENSE'?'OpenCC-LICENSE.txt':filename),await response.text(),{flag:'wx'});
  manifest.dictionaries.push({name:'OpenCC',url,file:filename==='LICENSE'?'OpenCC-LICENSE.txt':filename});
}
await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), {flag: 'wx'});
console.log(JSON.stringify({batch, directory, games: manifest.games}));
