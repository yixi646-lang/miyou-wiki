import {readFile,writeFile,mkdir,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createTestWorkspace,cleanupTestWorkspace} from './test-resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const cat=await read('data/catalog/zenless.json');
const entries=cat.entries.filter(e=>e.kind==='核心技强化材料');
if(entries.length!==27)throw Error('本轮仅修正27张核心技强化材料图标。');
const query=new URL('https://wiki.biligame.com/zzz/api.php');
query.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|size',titles:entries.map(e=>'文件:养成材料-'+e.name+'.png').join('|')});
const research=await (await fetch(query,{signal:AbortSignal.timeout(20000)})).json();
const pages=Object.values(research.query.pages);
const ffmpeg=process.env.WIKI_IMAGE_ENCODER;
if(!ffmpeg)throw Error('设置 WIKI_IMAGE_ENCODER 为已有 FFmpeg 路径。');
const temporary=await createTestWorkspace('core-icon-download');
const previous=await readFile(join(root,'data/sources/zenless/core-material-icons-2026-10-03.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {records:[]};throw e;});
const cached=new Map(previous.records.map(r=>[r.id,r]));
const records=[];let cursor=0;
const firstFrame=(input,output)=>new Promise((accept,reject)=>{
 const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-threads','1','-i',input,'-frames:v','1','-c:v','libwebp','-lossless','1',output],{windowsHide:true});
 let error='';child.stderr.on('data',b=>{error+=b;});child.once('error',reject);child.once('exit',code=>code===0?accept():reject(Error(error.slice(-1200))));
});
try{
 const results=await Promise.allSettled(Array.from({length:3},async()=>{while(cursor<entries.length){
  const entry=entries[cursor++],saved=cached.get(entry.id);
  if(saved&&await stat(join(root,saved.image.slice(1))).then(s=>s.isFile()).catch(()=>false)){records.push(saved);continue;}
  const page=pages.find(p=>p.title==='文件:养成材料-'+entry.name+'.png'),info=page?.imageinfo?.[0];
  if(!info){
   const bytes=await readFile(join(root,entry.image.slice(1)));
   if(bytes.subarray(12,16).toString()!=='VP8X')throw Error('未知贴图尺寸 '+entry.id);
   const atlasWidth=bytes.readUIntLE(24,3)+1,atlasHeight=bytes.readUIntLE(27,3)+1;
   records.push({id:entry.id,name:entry.name,url:entry.imageRemote,sourceUrl:'https://wiki.biligame.com/zzz/'+encodeURIComponent(entry.name),image:entry.image,imageFrame:{x:0,y:0,width:160,height:160,atlasWidth,atlasHeight},status:'sprite-first-frame',bytes:bytes.length});
   continue;
  }
  const input=join(temporary,entry.sourceId+'.source'),output=join(temporary,entry.sourceId+'.webp');
  try{
   const response=await fetch(info.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(entry.id+' HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(!['GIF8','RIFF'].includes(bytes.subarray(0,4).toString())&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('无效图标 '+entry.id);
   await writeFile(input,bytes,{flag:'wx'});await firstFrame(input,output);
   const image='/assets/zenless/materials/core/'+entry.sourceId+'.webp',local=await readFile(output);
   await mkdir(join(root,'assets/zenless/materials/core'),{recursive:true});await writeFile(join(root,image.slice(1)),local,{flag:'wx'});
   records.push({id:entry.id,name:entry.name,url:info.url,sourceUrl:'https://wiki.biligame.com/zzz/'+encodeURIComponent(page.title),image,status:'standalone',bytes:local.length,sourceBytes:bytes.length,width:info.width,height:info.height});
  }finally{await rm(input,{force:true});await rm(output,{force:true});}
 }}));
 const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
 records.sort((a,b)=>a.id.localeCompare(b.id));
 await writeFile(join(root,'data/sources/zenless/core-material-icons-2026-10-03.json'),JSON.stringify({fetchedAt:new Date().toISOString(),records,notes:['24张独立图标按BWIKI文件名匹配。来源文件虽名为.png，实际包含GIF动画；离线图标仅解码首帧并无损保存为WebP，避免同时播放24个动画。','BWIKI缺少的3张独立图标保留Nanoka原始贴图，使用160×160首帧显示区域，不改变源文件。']},null,2));
 console.log(JSON.stringify({total:records.length,standalone:records.filter(r=>r.status==='standalone').length,sprite:records.filter(r=>r.imageFrame).map(r=>[r.id,r.imageFrame]),bytes:records.reduce((n,r)=>n+(r.status==='standalone'?r.bytes:0),0)}));
}finally{await cleanupTestWorkspace(temporary);}
