import {readFile,writeFile,mkdir,stat,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createTestWorkspace,cleanupTestWorkspace} from './test-resources.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const date='2026-10-03';
const manifestPath=join(root,'data/sources',`character-artwork-${date}.json`);
const gi=await read('data/sources/genshin/characters.json');
const sr=await read('data/sources/starrail/characters.json');
const sourceManifest=await read('data/sources/manifest.json');
const srBase=`https://raw.githubusercontent.com/Mar-7th/StarRailRes/${sourceManifest.repositories['Mar-7th/StarRailRes'].commit}/`;
const ffmpeg=process.env.WIKI_IMAGE_ENCODER;
if(!ffmpeg)throw Error('设置 WIKI_IMAGE_ENCODER 为已有 FFmpeg 路径；不安装额外运行依赖。');
const previous=await readFile(manifestPath,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {records:[]};throw e;});
const saved=new Map(previous.records.filter(r=>r.status==='saved').map(r=>[r.id,r]));
const queue=[];
for(const game of ['genshin','starrail']){
 const catalog=await read(`data/catalog/${game}.json`);
 for(const entry of catalog.entries.filter(e=>e.category==='characters')){
  let candidates=[];
  if(game==='genshin'){
   const key=Object.entries(gi.data.ChineseSimplified.characters).find(([,raw])=>String(raw.id)===entry.sourceId)?.[0];
   const image=gi.image.characters[key];
   const file=image?.filename_gachaSplash??image?.filename_icon?.replace('UI_AvatarIcon_','UI_Gacha_AvatarImg_');
   if(file)candidates.push({url:`https://static.nanoka.cc/assets/gi/${file}.webp`,name:'Nanoka · 游戏角色立绘'});
   if(image?.portrait)candidates.push({url:image.portrait,name:'genshin-db · 角色立绘'});
   if(image?.cover1)candidates.push({url:image.cover1,name:'原神官网 · 角色立绘'});
  }else if(sr[entry.sourceId]?.portrait)candidates.push({url:srBase+sr[entry.sourceId].portrait,name:'StarRailRes · 固定版本角色立绘'});
  queue.push({entry,candidates});
 }
}
const temporary=await createTestWorkspace('artwork-download');
const records=[];let cursor=0,done=0;
const encode=(input,output)=>new Promise((accept,reject)=>{
 const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-threads','1','-i',input,'-vf','scale=1600:1600:force_original_aspect_ratio=decrease','-frames:v','1','-c:v','libwebp','-quality','88','-compression_level','4',output],{windowsHide:true});
 let error='';child.stderr.on('data',b=>{error+=b;});child.once('error',reject);child.once('exit',code=>code===0?accept():reject(Error(error.slice(-1200)||`图片转换失败 ${code}`)));
});
async function download({entry,candidates}){
 const image=`/assets/${entry.game}/artwork/${entry.sourceId}.webp`,path=join(root,image.slice(1));
 const cached=saved.get(entry.id);
 if(cached&&await stat(path).then(s=>s.isFile()).catch(()=>false)){records.push(cached);return;}
 const errors=[];
 for(const source of candidates){
  const input=join(temporary,`${entry.game}-${entry.sourceId}.source`),output=join(temporary,`${entry.game}-${entry.sourceId}.webp`);
  try{
   const response=await fetch(source.url,{signal:AbortSignal.timeout(25000)});
   if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
   const bytes=Buffer.from(await response.arrayBuffer());
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
   if((!png&&!webp)||bytes.length>24*1024*1024)throw Error('来源不是可用的 PNG/WebP 图片');
   await writeFile(input,bytes,{flag:'wx'});
   if(entry.game==='genshin'&&webp)await writeFile(output,bytes,{flag:'wx'});else await encode(input,output);
   const local=await readFile(output);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,local,{flag:'wx'});
   records.push({id:entry.id,name:entry.name,game:entry.game,image,url:source.url,sourceName:source.name,sourceBytes:bytes.length,bytes:local.length,status:'saved'});
   return;
  }catch(error){errors.push({url:source.url,error:error.message});}
  finally{await rm(input,{force:true});await rm(output,{force:true});}
 }
 records.push({id:entry.id,name:entry.name,game:entry.game,status:'unavailable',errors});
}
try{
 const results=await Promise.allSettled(Array.from({length:3},async()=>{while(cursor<queue.length){await download(queue[cursor++]);done++;if(done%20===0)console.log(`立绘 ${done}/${queue.length}`);}}));
 const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
 records.sort((a,b)=>a.id.localeCompare(b.id));
 await writeFile(manifestPath,JSON.stringify({fetchedAt:new Date().toISOString(),records,notes:['立绘仅供详情页加载，列表继续使用头像。','原神采用来源 WebP；星穹铁道立绘保留透明通道，最长边1600像素，WebP质量88。','下载过程的原始PNG和编码临时文件在finally清理。']},null,2));
 console.log(JSON.stringify({total:records.length,saved:records.filter(r=>r.status==='saved').length,unavailable:records.filter(r=>r.status!=='saved'),bytes:records.reduce((n,r)=>n+(r.bytes??0),0)}));
}finally{await cleanupTestWorkspace(temporary);}
