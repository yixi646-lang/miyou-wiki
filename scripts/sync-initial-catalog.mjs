import{readFile,readdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import{join}from'node:path';
import{openLibrary}from'../lib/database.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv.includes('--apply'))throw new Error('该脚本仅用于初始化修订，须显式指定 --apply。');
const library=openLibrary(join(root,'data/library/wiki.sqlite'));
let updated=0,skipped=0;
try{for(const file of await readdir(join(root,'data/catalog'))){if(!file.endsWith('.json'))continue;const data=JSON.parse(await readFile(join(root,'data/catalog',file),'utf8'));for(const entry of data.entries){const current=library.get(entry.id);if(!current){library.create(entry);updated++;continue;}if(current.origin!=='snapshot'||current.revision!==1){skipped++;continue;}library.update(entry.id,entry,current.revision);updated++;}}console.log({updated,skipped});}finally{library.close();}
