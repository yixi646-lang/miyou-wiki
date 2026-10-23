import {stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildContentStatus} from '../shared/content-status.mjs';

// 资料文件变化计入更新时间；界面代码、收藏与个人计划不计入。
const files = [
  'data/sources/manifest.json',
  ...['genshin', 'starrail', 'zenless'].flatMap(game => [`data/growth/${game}.json`, `data/catalog/${game}.json`, `data/versions/${game}.json`]),
  'shared/skill-term-data.json', 'shared/weapon-channel-data.json',
  'public/character-artwork-index.json'
];

export async function readContentStatus(db, root) {
  const rows = db.prepare("SELECT game, json_extract(payload,'$.releaseVersion') AS version, updated_at AS updatedAt FROM entries").all();
  for(const game of ['genshin','starrail','zenless']){
    try{const archive=JSON.parse(await readFile(join(root,'data/versions',game+'.json'),'utf8'));for(const version of archive.versions)rows.push({game,version:version.version,updatedAt:archive.updatedAt});}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const dates = await Promise.all(files.map(async file => {
    try {return (await stat(join(root, file))).mtime.toISOString();}
    catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  }));
  return buildContentStatus(rows, dates);
}
