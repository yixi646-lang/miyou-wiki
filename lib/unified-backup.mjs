import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {mkdir,cp,rm,readFile} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {createWriteStream} from 'node:fs';
import {validateState,assertSafeJSON,FORMAT} from '../modules/character-assessment/core/model.mjs';
import {ACCOUNT_BACKUP} from '../modules/character-assessment/accounts-store.mjs';
import {validateEntry,isExcludedEntry} from '../shared/catalog.mjs';
import {migrateRecommendationSettings} from '../modules/character-assessment/core/recommendation-settings.mjs';

export const UNIFIED_BACKUP='WIKI_COMPLETE_BACKUP';
const maxJSON=256*1024*1024;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value,(key,v)=>key==='exportedAt'?undefined:v)).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const transaction=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
const ps=(script,env)=>new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,...env},stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',v=>{error+=v;});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(error.slice(-1200)||'素材压缩包处理失败。')));});
const accountTables=['assessment_accounts','assessment_account_settings','assessment_scan_recovery','assessment_account_modes'];

export function createUnifiedBackup({root,backupPath,library,assessment,release}){
 const previews=new Map(),jobs=new Map(),uploads=new Map();let busy=false;
 const defaults=async()=>assessment.defaults();
 async function exportAll(){const store=await defaults();return{format:UNIFIED_BACKUP,schemaVersion:1,exportedAt:new Date().toISOString(),release:release(),library:library.export(),assessment:assessment.accounts.export(),recommendations:store.read(),assets:{included:false,directories:['assets','data/sources']}};}
 function normalize(input){
  if(input?.format===UNIFIED_BACKUP){if(input.schemaVersion!==1)fail('统一备份版本不兼容。');return input;}
  if(input?.format===ACCOUNT_BACKUP)return{format:UNIFIED_BACKUP,schemaVersion:1,assessment:input};
  if(input?.format===FORMAT)return{format:UNIFIED_BACKUP,schemaVersion:1,assessment:{format:ACCOUNT_BACKUP,version:1,game:'genshin',accounts:[{name:input.accountName??'恢复的养成方案',state:input,original:input,locked:true,kind:['local','copy','imported'].includes(input.accountKind)?input.accountKind:'imported'}]}};
  if(Array.isArray(input)||Array.isArray(input?.entries))return{format:UNIFIED_BACKUP,schemaVersion:1,library:Array.isArray(input)?{entries:input}:input};
  fail('请选择统一、百科或养成账号备份。');
 }
 async function validate(input){
  assertSafeJSON(input,{maxNodes:8000000});const value=normalize(input);
  if(value.library){const p=library.previewImport(value.library);if(p.errors.length)fail(p.errors.slice(0,3).map(e=>e.message).join('；'));if(value.library.favorites!==undefined&&(!Array.isArray(value.library.favorites)||value.library.favorites.some(id=>typeof id!=='string')))fail('收藏资料格式不正确。');
   if(value.library.growthPlans!==undefined&&(!value.library.growthPlans||typeof value.library.growthPlans!=='object'||Array.isArray(value.library.growthPlans)))fail('养成计划格式不正确。');
   for(const [game,plan]of Object.entries(value.library.growthPlans??{}))if(!['genshin','starrail','zenless'].includes(game)||!Array.isArray(plan?.goals)||plan.goals.length>1000||!plan.inventory||typeof plan.inventory!=='object'||Object.values(plan.inventory).some(n=>!Number.isFinite(n)||n<0))fail('养成计划格式不正确。');}
  if(value.assessment){const a=value.assessment;if(a.format!==ACCOUNT_BACKUP||a.version!==1||a.game!=='genshin'||!Array.isArray(a.accounts)||!a.accounts.length||a.accounts.length>50)fail('评估账号备份格式不正确。');const data=await assessment.data(),ids=new Set();for(const account of a.accounts){if(typeof account.name!=='string'||!account.name.trim()||account.name.length>100)fail('备份账号名称不正确。');if(account.id&&ids.has(account.id))fail('备份账号编号重复。');ids.add(account.id);validateState(account.state,data);if(account.original)validateState(account.original,data);if(account.scanRecovery){validateState(account.scanRecovery.previousState,data);const scan=account.scanRecovery.scan;if(!scan||scan.format!=='GOOD')fail('扫描恢复记录不正确。');const {scanState}=await import('../modules/character-assessment/core/import-sync.mjs');scanState(scan,data);}}}
  if(value.recommendations){const catalog=JSON.parse(await readFile(join(root,'modules/character-assessment/core/catalog.json'),'utf8'));migrateRecommendationSettings(value.recommendations,catalog);}
  return value;
 }
 async function preview(input,uploadId){
  const bundle=await validate(input);const current=await exportAll(),p=bundle.library?library.previewImport(bundle.library):null;
  let changed=0;if(bundle.library)for(const entry of bundle.library.entries){if(isExcludedEntry(entry))continue;const old=library.get(entry.id);if(old){const clean=({revision,updatedAt,...e})=>e;if(hash(clean(old))!==hash(clean(entry)))changed++;}}
  const id=randomUUID();previews.set(id,{bundle,fingerprint:fingerprint(current),expires:Date.now()+600000,uploadId});
  return{id,format:input.format??'旧百科备份',exportedAt:bundle.exportedAt??null,release:bundle.release??null,available:{library:!!bundle.library,personal:bundle.library?.favorites!==undefined||bundle.library?.growthPlans!==undefined,accounts:!!bundle.assessment,recommendations:!!bundle.recommendations},counts:{entries:bundle.library?.entries?.length??0,added:p?.additions.length??0,existing:p?.conflicts.length??0,changed,excluded:p?.excluded.length??0,favorites:bundle.library?.favorites?.length??0,plans:Object.keys(bundle.library?.growthPlans??{}).length,accounts:bundle.assessment?.accounts?.length??0,currentAccounts:current.assessment.accounts.length},assets:uploadId?'包含素材；仅补回缺失文件，现有素材保留。':'素材使用现有本地文件，缺失路径会列出。',missingAssets:missingAssets(bundle)};
 }
 function missingAssets(bundle){const refs=new Set();const walk=value=>{if(typeof value==='string'&&value.startsWith('/assets/'))refs.add(value);else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk);};walk(bundle.library?.entries);return [...refs].filter(p=>!existsSync(resolve(root,'.'+p))).slice(0,100);}
 const rawSnapshot=()=>({entries:library.db.prepare('SELECT * FROM entries').all(),favorites:library.db.prepare('SELECT * FROM favorites').all(),metadata:library.db.prepare('SELECT * FROM metadata').all(),accounts:Object.fromEntries(accountTables.map(t=>[t,assessment.accounts.database().prepare(`SELECT * FROM ${t}`).all()]))});
 function insertRows(db,table,rows){for(const row of rows){const keys=Object.keys(row);db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));}}
 function rollback(before){transaction(library.db,()=>{library.db.exec('DELETE FROM favorites;DELETE FROM entries;DELETE FROM metadata;');insertRows(library.db,'entries',before.entries);insertRows(library.db,'favorites',before.favorites);insertRows(library.db,'metadata',before.metadata);});transaction(assessment.accounts.database(),()=>{for(const t of accountTables)assessment.accounts.database().exec(`DELETE FROM ${t}`);for(const t of accountTables)insertRows(assessment.accounts.database(),t,before.accounts[t]);});}
 function restoreAccounts(bundle,mode){
  const db=assessment.accounts.database(),now=new Date().toISOString(),existing=assessment.accounts.list().accounts,revisions=new Map(existing.map(a=>[a.id,a.revision])),names=new Set(mode==='replace'?[]:existing.map(a=>a.name));let active;
  if(mode!=='replace'&&assessment.accounts.list().accounts.length+bundle.accounts.length>50)fail('恢复后超过 50 个账号，请减少账号或明确选择替换账号。');
  transaction(db,()=>{if(mode==='replace')for(const t of accountTables)db.exec(`DELETE FROM ${t}`);
   for(const a of bundle.accounts){const id=mode==='replace'&&typeof a.id==='string'?a.id:randomUUID();let name=a.name,n=2;while(names.has(name))name=a.name.slice(0,90)+` (${n++})`;names.add(name);
    db.prepare('INSERT INTO assessment_accounts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,name,Number(!!a.locked),mode==='replace'?(revisions.get(id)??-1)+1:0,JSON.stringify(a.state),a.original?JSON.stringify(a.original):null,String(a.source??''),a.importedAt??null,a.createdAt??now,a.updatedAt??now);
    db.prepare('INSERT INTO assessment_account_modes VALUES(?,?)').run(id,['local','copy','imported'].includes(a.kind)?a.kind:'imported');
    if(a.scanRecovery){const r=a.scanRecovery;db.prepare('INSERT INTO assessment_scan_recovery VALUES(?,?,?,?,?)').run(id,JSON.stringify(r.previousState),JSON.stringify(r.scan),String(r.source??''),String(r.importedAt??''));}
    if(!active||a.id===bundle.activeId)active=id;
   }db.prepare('INSERT OR REPLACE INTO assessment_account_settings VALUES(1,?)').run(active);
  });
 }
 async function restore({id,sections={},entryMode='keep',accountMode='copy',confirmReplace=false}){
  if(busy)fail('另一项恢复正在执行。',409);const item=previews.get(id);if(!item||Date.now()>item.expires)fail('预览已过期，请重新选择备份。');if(!Object.values(sections).some(Boolean))fail('请至少选择一个恢复板块。');if(!['keep','replace'].includes(entryMode)||!['copy','replace'].includes(accountMode))fail('恢复方式不正确。');if((sections.library&&entryMode==='replace'||sections.accounts&&accountMode==='replace')&&!confirmReplace)fail('请确认替换范围。');
  busy=true;try{
   if(item.uploadId){const upload=uploads.get(item.uploadId);if(!upload)fail('素材预览已过期，请重新选择。');for(const dir of ['assets','data/sources'])if(existsSync(join(upload.directory,dir)))await cp(join(upload.directory,dir),join(root,dir),{recursive:true,force:false,errorOnExist:false});}
   const current=await exportAll();if(fingerprint(current)!==item.fingerprint)fail('预览后资料发生变化，请重新预览再恢复。',409);
   if(sections.accounts&&item.bundle.assessment&&accountMode==='copy'&&current.assessment.accounts.length+item.bundle.assessment.accounts.length>50)fail('恢复后超过 50 个账号，请减少恢复范围或明确选择替换账号。');
   await mkdir(backupPath,{recursive:true});const filename=`before-restore-${Date.now()}-${randomUUID().slice(0,6)}.json.gz`;writeFileSync(join(backupPath,filename),gzipSync(JSON.stringify(current)),{flag:'wx'});
   const before=rawSnapshot(),store=await defaults(),oldDefaults=store.read(),bundle=item.bundle;
   // All database writes below are synchronous; requests cannot interleave with this coordinated restore.
   try{
    if(sections.library&&bundle.library)transaction(library.db,()=>{for(const e of bundle.library.entries){if(isExcludedEntry(e))continue;validateEntry(e);const old=library.get(e.id);if(!old)library.create(e);else if(entryMode==='replace')library.update(e.id,e,old.revision);}});
    if(sections.personal&&bundle.library)transaction(library.db,()=>{
     if(bundle.library.favorites!==undefined){library.db.exec('DELETE FROM favorites;');for(const id of bundle.library.favorites)if(library.get(id))library.favorite(id,true);}
     if(bundle.library.growthPlans!==undefined){library.db.prepare("DELETE FROM metadata WHERE key LIKE 'growth_plan:%'").run();for(const [game,plan]of Object.entries(bundle.library.growthPlans))library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:'+game,JSON.stringify(plan));}
    });
    if(sections.accounts&&bundle.assessment)restoreAccounts(bundle.assessment,accountMode);
    if(sections.recommendations&&bundle.recommendations)store.restore(bundle.recommendations);
   }catch(error){rollback(before);store.restore(oldDefaults);throw error;}
   previews.delete(id);const upload=uploads.get(item.uploadId);if(upload){uploads.delete(item.uploadId);await rm(upload.directory,{recursive:true,force:true});}return{ok:true,recovery:filename,accounts:assessment.accounts.list().accounts.length};
  }finally{busy=false;}
 }
 async function createJob(includeAssets){
  if(busy)fail('正在恢复，请稍后备份。',409);const value=await exportAll(),id=randomUUID(),job={id,status:'running',stage:'压缩业务数据',filename:null,error:null};jobs.set(id,job);
  const folder=join(backupPath,'.bundle-'+id),filename=`wiki-complete-${new Date().toISOString().replace(/[:.]/g,'-')}-${id.slice(0,6)}${includeAssets?'.zip':'.json.gz'}`;
  void (async()=>{try{await mkdir(backupPath,{recursive:true});if(!includeAssets){writeFileSync(join(backupPath,filename),gzipSync(JSON.stringify(value)),{flag:'wx'});}else{await mkdir(folder);value.assets.included=true;writeFileSync(join(folder,'backup.json.gz'),gzipSync(JSON.stringify(value)));for(const dir of ['assets','data/sources']){job.stage='复制本地素材：'+dir;if(existsSync(join(root,dir)))await cp(join(root,dir),join(folder,dir),{recursive:true});}job.stage='压缩素材包';await ps("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:WIKI_BUNDLE_SOURCE,$env:WIKI_BUNDLE_OUTPUT,[IO.Compression.CompressionLevel]::Optimal,$false)",{WIKI_BUNDLE_SOURCE:folder,WIKI_BUNDLE_OUTPUT:join(backupPath,filename)});}job.filename=filename;job.status='done';job.stage='备份完成';}catch(error){job.status='error';job.error=error.message;}finally{await rm(folder,{recursive:true,force:true});}})();return{id};
 }
 async function upload(req){
  const id=randomUUID(),directory=join(backupPath,'.upload-'+id),filename=join(directory,'upload.zip');await mkdir(directory,{recursive:true});let size=0;
  try{await pipeline(req,async function*(source){for await(const chunk of source){size+=chunk.length;if(size>4*1024**3)fail('素材包超过 4 GB。',413);yield chunk;}},createWriteStream(filename,{flags:'wx'}));
   await ps("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($env:WIKI_UPLOAD_FILE); try {$total=0; foreach($e in $z.Entries){$n=$e.FullName.Replace('\\','/'); if($n -match '(^/|^[A-Za-z]:|(^|/)\\.\\.(/|$))' -or $n -notmatch '^(backup\\.json\\.gz|assets/|data/sources/)'){throw '压缩包含不支持的路径'}; $total+=$e.Length; if($total -gt 8589934592){throw '素材解压后超过 8 GB'}}; foreach($e in $z.Entries){if($e.FullName.EndsWith('/')){continue};$target=Join-Path $env:WIKI_UPLOAD_DIR $e.FullName;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null;[IO.Compression.ZipFileExtensions]::ExtractToFile($e,$target,$false)}} finally {$z.Dispose()}",{WIKI_UPLOAD_FILE:filename,WIKI_UPLOAD_DIR:directory});
   const bytes=gunzipSync(readFileSync(join(directory,'backup.json.gz')),{maxOutputLength:maxJSON}),bundle=JSON.parse(bytes);await rm(filename);uploads.set(id,{directory,expires:Date.now()+600000});return await preview(bundle,id);
  }catch(error){await rm(directory,{recursive:true,force:true});throw error;}
 }
 const timer=setInterval(()=>{for(const [id,u]of uploads)if(u.expires<Date.now()){uploads.delete(id);void rm(u.directory,{recursive:true,force:true});}for(const [id,p]of previews)if(p.expires<Date.now())previews.delete(id);},30000);timer.unref();
 return{exportAll,preview,restore,createJob,
  async handle(req,res,url,json,body){
   if(url.pathname==='/api/backup/complete'&&req.method==='GET'){json(res,200,await exportAll());return true;}
   if(url.pathname==='/api/backup/complete'&&req.method==='POST'){json(res,202,await createJob((await body(req)).includeAssets===true));return true;}
   if(url.pathname==='/api/backup/preview'&&req.method==='POST'){json(res,200,await preview(await body(req)));return true;}
   if(url.pathname==='/api/backup/restore'&&req.method==='POST'){json(res,200,await restore(await body(req)));return true;}
   if(url.pathname==='/api/backup/cancel'&&req.method==='POST'){const {id}=await body(req),p=previews.get(id);previews.delete(id);const u=uploads.get(p?.uploadId);if(u){uploads.delete(p.uploadId);await rm(u.directory,{recursive:true,force:true});}json(res,200,{ok:true});return true;}
   if(url.pathname==='/api/backup/upload'&&req.method==='POST'){json(res,200,await upload(req));return true;}
   const match=url.pathname.match(/^\/api\/backup\/jobs\/([a-f0-9-]+)(\/download)?$/);if(match&&req.method==='GET'){const job=jobs.get(match[1]);if(!job)fail('备份任务不存在。',404);if(!match[2])json(res,200,job);else{if(job.status!=='done')fail('备份尚未完成。');const {createReadStream,statSync}=await import('node:fs');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':statSync(join(backupPath,job.filename)).size,'Content-Disposition':`attachment; filename="${job.filename}"`});createReadStream(join(backupPath,job.filename)).on('error',()=>res.destroy()).pipe(res);}return true;}return false;
  },async close(){clearInterval(timer);await Promise.all([...uploads.values()].map(u=>rm(u.directory,{recursive:true,force:true})));uploads.clear();}
 };
}
