import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
const cache=new Map();
export async function readVersionArchive(root,game){
 if(!['genshin','starrail','zenless'].includes(game))throw Error('游戏不存在');
 const path=join(root,'data/versions',game+'.json'),info=await stat(path),key=`${info.mtimeMs}:${info.size}`;
 if(cache.get(game)?.key!==key){const data=JSON.parse(await readFile(path,'utf8'));if(data.game!==game||!Array.isArray(data.versions))throw Error('版本档案格式不正确');cache.set(game,{key,data});}
 return cache.get(game).data;
}
