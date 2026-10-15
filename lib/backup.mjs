import {writeFile} from 'node:fs/promises';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip);
export async function writeCompressedBackup(path,payload){
 const data=await compress(JSON.stringify(payload,null,2));
 await writeFile(path,data,{flag:'wx'});
 return data.length;
}
