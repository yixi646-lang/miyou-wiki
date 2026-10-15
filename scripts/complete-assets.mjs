import {readFile,writeFile} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalog=await read('data/catalog/genshin.json');
const raw=await read('data/sources/genshin/materials.json');
const imageById=new Map(Object.entries(raw.data.ChineseSimplified.materials).map(([key,value])=>[String(value.id),raw.image.materials[key]?.filename_icon]));
let changed=0;
for(const entry of catalog.entries){
  if(entry.image)continue;
  const filename=entry.category==='materials'?imageById.get(entry.sourceId):entry.imageRemote?.split('/').at(-1)?.replace(/\.png$/,'');
  if(!filename)continue;
  entry.imageRemote=`https://static.nanoka.cc/assets/gi/${filename}.webp`;changed++;
}
await writeFile(new URL('../data/catalog/genshin.json',import.meta.url),JSON.stringify(catalog,null,2));
console.log('补充原神图片来源',changed);
