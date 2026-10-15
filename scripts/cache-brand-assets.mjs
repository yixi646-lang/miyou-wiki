import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath=join(root,'data/sources/brand-assets-2026-10-04.json');
const previous=JSON.parse(await readFile(manifestPath,'utf8'));
// 用户已指定这三张预览图。保留原文件与尺寸，不再搜索或重新选图。
const covers=[
 {game:'genshin',version:'7.0',file:'77085870.jpg',title:'7.0版本前瞻与预约活动壁纸',sourceUrl:'https://www.miyoushe.com/ys/article/77085870',url:'https://upload-bbs.miyoushe.com/upload/2026/07/31/395818810/ba3bf666632826f4a3879a1da5046c8b_3011880675272060575.jpg'},
 {game:'starrail',version:'4.0',file:'73233548.jpg',title:'4.0版本主视觉壁纸',sourceUrl:'https://www.miyoushe.com/sr/article/73233548',url:'https://upload-bbs.miyoushe.com/upload/2026/03/31/291110358/888c455f9c99250cc06236414a7856c1_6593025884467050158.jpg'},
 {game:'zenless',version:'3.0',file:'75918518.png',title:'3.0某个梦游者的自白无字壁纸',sourceUrl:'https://www.miyoushe.com/zzz/article/75918518',url:'https://upload-bbs.miyoushe.com/upload/2026/06/10/160087329/9505f69d76213ea4aba33fc29d5bcd3c_1322179240418771751.png'}
];
const staging=process.env.WIKI_BRAND_STAGING;
if(staging){
 const directory=await realpath(staging),testRoot=await realpath(join(root,'.codex_tmp/tests'));
 const owner=JSON.parse(await readFile(join(directory,'owner.json'),'utf8'));
 if(!directory.startsWith(testRoot+sep)||owner.createdBy!=='visual-assets-20261004')throw Error('临时来源目录不属于本轮');
}
const records=previous.records.filter(r=>r.type==='logo');
for(const cover of covers){
 const image=`/assets/${cover.game}/branding/cover-${cover.version}-hd.${cover.file.split('.').at(-1)}`;
 const path=join(root,image.slice(1));
 await mkdir(dirname(path),{recursive:true});
 let bytes;try{bytes=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!bytes){
  if(staging)bytes=await readFile(join(staging,cover.file));
  else{const response=await fetch(cover.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
  await writeFile(path,bytes,{flag:'wx'});
 }
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const {file,...source}=cover;
 records.push({...source,type:'cover',sourceType:'community-wallpaper',userSelected:true,original:image,image,sourceBytes:bytes.length,bytes:bytes.length,sourceSha256:sha256,sha256});
}
const python="import sys,json\nfrom PIL import Image\nfor r in json.load(sys.stdin):\n im=Image.open(r['path'])\n im.verify()\n if im.width<2560 or im.height<1440: raise ValueError('Cover is below the requested resolution')\n print(json.dumps({'game':r['game'],'dimensions':[im.width,im.height]}))\n";
const child=spawn(process.env.WIKI_PYTHON??'python',['-c',python],{windowsHide:true,stdio:['pipe','pipe','pipe']});
child.stdin.end(JSON.stringify(records.filter(r=>r.type==='cover').map(r=>({game:r.game,path:join(root,r.image.slice(1))}))));
let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);
await new Promise((accept,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?accept():reject(Error(error)));});
for(const row of output.trim().split('\n').map(JSON.parse))Object.assign(records.find(r=>r.game===row.game&&r.type==='cover'),{dimensions:row.dimensions,sourceDimensions:row.dimensions});
await writeFile(manifestPath,JSON.stringify({...previous,updatedAt:new Date().toISOString(),records,notes:['采用用户圈选的三张版本主视觉：原神7.0、星铁4.0、绝区零3.0，来源为米游社壁纸帖子。','首页直接加载所选原文件，保留高清尺寸及全部原始字节，不缩放或重编码。像素尺寸已核对，不宣称社区图片为官方原生4K。']},null,2));
console.log(JSON.stringify(records.filter(r=>r.type==='cover').map(({game,dimensions,bytes})=>({game,dimensions,bytes}))));
