import http from 'node:http';
import { readFile, stat, mkdir, appendFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openLibrary } from './lib/database.mjs';
import { GAMES, CATEGORIES, summarizeEntry } from './shared/catalog.mjs';
import { openBrowser } from './lib/open-browser.mjs';
import { calculateBatch } from './shared/growth.mjs';
import { createPageLifecycle } from './lib/page-lifecycle.mjs';
import { writeCompressedBackup } from './lib/backup.mjs';
import {attachSkillTerms} from './shared/skill-terms.mjs';
import {buildMaterialUsageIndex, materialUsage} from './shared/material-usage.mjs';
import {materialAcquisition, withMaterialAcquisitionSource} from './shared/material-acquisition.mjs';
import {characterMaterialGroups} from './shared/character-materials.mjs';
import {readContentStatus} from './lib/content-status.mjs';
import {readVersionArchive} from './lib/version-archives.mjs';
import {createAssessmentRouter} from './modules/character-assessment/server.mjs';
import {readReleaseInfo} from './lib/release-info.mjs';
import {serviceLock} from './lib/service-lock.mjs';
import {instanceIdentity,rememberInstance} from './lib/wiki-instance.mjs';
import {createUnifiedBackup} from './lib/unified-backup.mjs';
import {createOnlineUpdates,createUpdateCheckGroup} from './lib/online-updates.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
let skillTermData={characters:{}};
try{skillTermData=JSON.parse(await readFile(join(root,'shared/skill-term-data.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] ?? process.env.WIKI_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口须为 1024–65535。');
const libraryPath=process.env.WIKI_DB_PATH?resolve(process.env.WIKI_DB_PATH):join(root,'data','library','wiki.sqlite');
if(!libraryPath.startsWith(resolve(root)+sep))throw new Error('资料库须保存在工作区内。');
const backupPath=process.env.WIKI_BACKUP_DIR?resolve(process.env.WIKI_BACKUP_DIR):join(root,'data','backups');
if(!backupPath.startsWith(resolve(root)+sep))throw new Error('备份须保存在工作区内。');
const instanceId=instanceIdentity(root,libraryPath);
serviceLock(libraryPath,root,{instanceId,port});
const library = openLibrary(libraryPath);
const seeded = library.seed(join(root, 'data', 'catalog'));
const sessionToken = randomUUID();
const materialUsageCache = new Map();
let materialAcquisitionSupplement = null;
try { materialAcquisitionSupplement = JSON.parse(await readFile(join(root, 'data/material-acquisition/genshin.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const characterMaterialsCache = new Map();
async function characterMaterials(entry, element) {
  const path = join(root, 'data', 'growth', `${entry.game}.json`);
  const info = await stat(path), key = `${info.mtimeMs}:${info.size}`;
  if (characterMaterialsCache.get(entry.game)?.key !== key) {
    characterMaterialsCache.set(entry.game, {key, data:JSON.parse(await readFile(path, 'utf8'))});
  }
  return characterMaterialGroups(entry, characterMaterialsCache.get(entry.game).data, element, id => library.get(id));
}
async function usageIndex(game) {
  const path = join(root, 'data', 'growth', `${game}.json`);
  const info = await stat(path), key = `${info.mtimeMs}:${info.size}`;
  if (materialUsageCache.get(game)?.key !== key) {
    const data = JSON.parse(await readFile(path, 'utf8'));
    materialUsageCache.set(game, {key, index: buildMaterialUsageIndex(data), data});
  }
  return materialUsageCache.get(game);
}
const summary = entry=>summarizeEntry(attachSkillTerms(withMaterialAcquisitionSource(entry,materialAcquisitionSupplement),skillTermData));
const summaries=new Map();
const gameSummaries=game=>{const key=library.signature(game);if(summaries.get(game)?.key!==key)summaries.set(game,{key,entries:library.all(game).map(summary)});return summaries.get(game).entries;};
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw Object.assign(new Error('请使用 JSON 数据。'), { status: 415 });
  const parts = []; let size = 0;
  const limit=req.url.startsWith('/api/backup/')?256*1024*1024:32*1024*1024;
  for await (const part of req) { size += part.length; if (size > limit) throw Object.assign(new Error(`导入文件超过 ${limit/1024/1024} MB。`), { status: 413 }); parts.push(part); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error('JSON 格式不正确。'); }
}
const mimes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const assessmentPath=resolve(process.env.WIKI_ASSESSMENT_DB_PATH??(process.env.WIKI_DB_PATH?join(libraryPath,'..','assessment.sqlite'):join(root,'data','assessment','assessment.sqlite')));
if(!assessmentPath.startsWith(resolve(root)+sep))throw Error('养成评估资料库须保存在工作区内。');
const recommendationPath=resolve(process.env.WIKI_RECOMMENDATION_PATH??(process.env.WIKI_DB_PATH?join(libraryPath,'..','recommendation-overrides.json'):join(root,'modules/character-assessment/core/recommendation-overrides.json')));
if(!recommendationPath.startsWith(resolve(root)+sep))throw Error('评价默认设置须保存在工作区内。');
const assessment=createAssessmentRouter({storagePath:assessmentPath,recommendationPath,json,body});
const completeBackup=createUnifiedBackup({root,backupPath,library,assessment,release:()=>readReleaseInfo(root)});
let auditCache;
const pages=createPageLifecycle({port,token:sessionToken,onIdle:()=>{console.log('Wiki 页面已全部关闭，停止本地服务。');close();},enabled:process.argv.includes('--auto-close'),idleMs:process.env.WIKI_PAGE_IDLE_MS,startupMs:process.env.WIKI_PAGE_STARTUP_MS});
const updateBusy=service=>['downloading','extracting','ready','installing'].includes(service.status().job?.phase);
const onlineUpdates=createOnlineUpdates({root,databasePath:libraryPath,port,storageDirectory:process.env.WIKI_DB_PATH?join(libraryPath,'..','online-updates'):undefined,activePages:()=>pages.info().activePages,otherBusy:()=>updateBusy(contentUpdates),onInstall:()=>setTimeout(()=>close(),350)});
const contentUpdates=createOnlineUpdates({root,databasePath:libraryPath,port,channel:'content',storageDirectory:process.env.WIKI_DB_PATH?join(libraryPath,'..','content-updates'):undefined,activePages:()=>pages.info().activePages,otherBusy:()=>updateBusy(onlineUpdates),onInstall:()=>setTimeout(()=>close(),350)});
const checkUpdateChannels=createUpdateCheckGroup({software:onlineUpdates,content:contentUpdates});

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
  try {
    const allowedHost = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHost.includes(req.headers.host)) return json(res, 403, { error: '只接受本机访问。' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(req.method)) return json(res, 405, { error: '不支持的请求方法。' });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.headers['x-wiki-token'] !== sessionToken) return json(res, 403, { error: '请从本地百科页面发起操作。' });
      const origin = req.headers.origin;
      if (origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(origin)) return json(res, 403, { error: '来源不匹配。' });
    }
    if(await onlineUpdates.handle(req,res,url,json,body,checkUpdateChannels))return;
    if(await contentUpdates.handle(req,res,url,json,body,checkUpdateChannels))return;
    if(await assessment.handle(req,res,url))return;
    if(await completeBackup.handle(req,res,url,json,body))return;
    if(url.pathname==='/api/audit'&&req.method==='GET'){
      const key=library.signature();if(!auditCache||auditCache.key!==key||url.searchParams.has('refresh')){const {auditLibrary}=await import('./lib/content-audit.mjs');auditCache={key,value:await auditLibrary({root,entries:library.all()})};}
      return json(res,200,auditCache.value);
    }
    if (url.pathname === '/api/health') return json(res, 200, { app: 'local-wiki', ok: true, instanceId, pid:process.pid, entries: library.count(),pageLifecycle:pages.info(),release:readReleaseInfo(root) });
    if(url.pathname==='/api/catalog'&&req.method==='GET'){const game=url.searchParams.get('game');if(!Object.hasOwn(GAMES,game))throw Error('请选择有效的游戏。');return json(res,200,{entries:gameSummaries(game)});}
    if (url.pathname === '/api/content-status' && req.method === 'GET') return json(res, 200, await readContentStatus(library.db, root));
    const archiveMatch=url.pathname.match(/^\/api\/versions\/(genshin|starrail|zenless)$/);
    if(archiveMatch&&req.method==='GET')return json(res,200,await readVersionArchive(root,archiveMatch[1]));
    const usageMatch = url.pathname.match(/^\/api\/material-usage\/([a-z0-9_-]{1,100})$/i);
    if (usageMatch && req.method === 'GET') {
      const entry = library.get(usageMatch[1]);
      if (!entry || entry.category !== 'materials') return json(res, 404, {error: '材料不存在。'});
      const saved = library.db.prepare('SELECT value FROM metadata WHERE key=?').get(`growth_plan:${entry.game}`);
      const plan = saved ? JSON.parse(saved.value) : null;
      const {index, data} = await usageIndex(entry.game), lookup = id => library.get(id);
      return json(res, 200, {...materialUsage(entry, index, lookup, plan?.inventory ?? {}),
        acquisition:materialAcquisition(entry, {supplement:materialAcquisitionSupplement, recipe:data.recipes?.[entry.id], lookup})});
    }
    if (url.pathname === '/api/page-session/enable' && req.method === 'POST') {pages.enable();return json(res,200,{ok:true,pageLifecycle:pages.info()});}
    const characterMaterialsMatch=url.pathname.match(/^\/api\/character-materials\/([a-z0-9_-]{1,100})$/i);
    if(characterMaterialsMatch&&req.method==='GET'){
      const entry=library.get(characterMaterialsMatch[1]);
      if(entry?.category!=='characters')return json(res,404,{error:'角色不存在。'});
      return json(res,200,{groups:await characterMaterials(entry,url.searchParams.get('element')??'冰')});
    }
    const growthMatch=url.pathname.match(/^\/api\/growth\/(genshin|starrail|zenless)$/);
    if(growthMatch&&req.method==='GET'){
      const data=JSON.parse(await readFile(join(root,'data','growth',`${growthMatch[1]}.json`),'utf8'));
      for(const material of Object.values(data.materials)){const live=library.get(material.id);if(live){material.name=live.name;material.image=live.image??null;material.imageFrame=live.imageFrame;}}
      return json(res,200,data);
    }
    const planMatch=url.pathname.match(/^\/api\/growth\/(genshin|starrail|zenless)\/plan$/);
    if(planMatch){
      const key=`growth_plan:${planMatch[1]}`;
      if(req.method==='GET'){const row=library.db.prepare('SELECT value FROM metadata WHERE key=?').get(key);return json(res,200,row?JSON.parse(row.value):null);}
      if(req.method==='POST'){
        const plan=await body(req),data=JSON.parse(await readFile(join(root,'data','growth',`${planMatch[1]}.json`),'utf8'));
        if(!Array.isArray(plan.goals)||plan.goals.length>1000||plan.goals.some(g=>!g||!data.profiles[g.profileId]||typeof g.key!=='string'||g.key.length>80))throw Error('养成计划条目不正确或超过 1000 项。');
        if(!plan.inventory||typeof plan.inventory!=='object'||Array.isArray(plan.inventory)||Object.entries(plan.inventory).some(([id,n])=>!data.materials[id]||!Number.isFinite(n)||n<0||n>1e12))throw Error('已有材料数量不正确。');
        // Save editable drafts too, so changing one end of a range does not lose work.
        calculateBatch(data.profiles,plan.goals,plan.inventory);
        const saved={schemaVersion:1,game:planMatch[1],goals:plan.goals,inventory:plan.inventory,synthesis:plan.synthesis!==false,savedAt:typeof plan.savedAt==='string'?plan.savedAt:new Date().toISOString()};
        library.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(saved));
        return json(res,200,{ok:true,savedAt:saved.savedAt});
      }
    }
    if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
      let sourceManifest = null;
      try { sourceManifest = JSON.parse(await readFile(join(root, 'data', 'sources', 'manifest.json'), 'utf8')); } catch {}
      return json(res, 200, { entries: [], counts:library.counts(), favoriteCounts:library.db.prepare('SELECT e.game,COUNT(*) AS count FROM favorites f JOIN entries e ON e.id=f.entry_id GROUP BY e.game').all(), favorites: library.favorites(), games: GAMES, categories: CATEGORIES, token: sessionToken, sourceManifest, release:readReleaseInfo(root) });
    }
    const entryMatch = url.pathname.match(/^\/api\/entries\/([a-z0-9_-]{1,100})$/i);
    if (entryMatch && req.method === 'GET') {
      const entry = library.get(entryMatch[1]);
      return entry ? json(res, 200, attachSkillTerms(entry,skillTermData)) : json(res, 404, { error: '条目不存在。' });
    }
    if (entryMatch && req.method === 'PATCH') {
      const payload = await body(req);
      return json(res, 200, library.update(entryMatch[1], payload.entry, payload.revision));
    }
    if (url.pathname === '/api/entries' && req.method === 'POST') {
      const payload = await body(req);
      const id = `${payload.game}-${payload.category}-local-${randomUUID().slice(0,8)}`;
      return json(res, 201, library.create({ ...payload, id, fetchedAt: new Date().toISOString(), origin: 'local' }));
    }
    const favoriteMatch = url.pathname.match(/^\/api\/favorites\/([a-z0-9_-]{1,100})$/i);
    if (favoriteMatch && req.method === 'POST') {
      const payload = await body(req);
      if (typeof payload.favorite !== 'boolean') throw new Error('收藏状态不正确。');
      return json(res, 200, { favorites: library.favorite(favoriteMatch[1], payload.favorite) });
    }
    if (url.pathname === '/api/import/preview' && req.method === 'POST') return json(res, 200, library.previewImport(await body(req)));
    if (url.pathname === '/api/import' && req.method === 'POST') return json(res, 200, library.importAdditions(await body(req)));
    if (url.pathname === '/api/export' && req.method === 'GET') return json(res, 200, library.export(), { 'Content-Disposition': 'attachment; filename="wiki-backup.json"' });
    if (url.pathname === '/api/backup' && req.method === 'POST') {
      await mkdir(backupPath, { recursive: true });
      const filename = `wiki-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0,6)}.json.gz`;
      await writeCompressedBackup(join(backupPath, filename), library.export());
      return json(res, 201, { filename, path: `${backupPath.slice(resolve(root).length+1).replaceAll('\\','/')}/${filename}` });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: '接口不存在。' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '不支持的请求方法。' });
    let directory, relative;
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.startsWith('/assets/')) { directory = join(root, 'assets'); relative = decoded.slice(8); }
    else if (decoded.startsWith('/shared/')) { directory = join(root, 'shared'); relative = decoded.slice(8); }
    else { directory = join(root, 'public'); relative = decoded === '/' ? 'index.html' : decoded.slice(1); }
    const path = resolve(directory, relative);
    if (!path.startsWith(resolve(directory) + sep) || relative.includes('\0')) return json(res, 403, { error: '路径不合法。' });
    let info;
    try { info = await stat(path); } catch { return json(res, 404, { error: '文件不存在。' }); }
    if (!info.isFile()) return json(res, 404, { error: '文件不存在。' });
    res.writeHead(200, { 'Content-Type': mimes[extname(path)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': decoded.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch (error) { console.error(error.message); if (!res.headersSent) json(res, error.status ?? 400, { error: error.message || '操作失败。' }); else res.destroy(); }
});
server.on('upgrade',pages.upgrade);
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') console.error(`端口 ${port} 已被使用。若百科已经启动，请打开 http://127.0.0.1:${port}；也可运行 node server.mjs --port=4174。`);
  else console.error(error);
  pages.stop();await onlineUpdates.close();await contentUpdates.close();await completeBackup.close();library.close();assessment.close(); process.exitCode = 1;
  try{const directory=join(root,'data','logs');await mkdir(directory,{recursive:true});await appendFile(join(directory,'startup.log'),`${new Date().toISOString()} Wiki 服务启动失败：${error.message}\n`);}catch{}
});
server.listen(port, '127.0.0.1', () => {
  rememberInstance(libraryPath,instanceId,port);
  console.log(`Wiki 已启动：http://127.0.0.1:${port}`);
  console.log(`本地条目：${library.count()}，本次新增：${seeded}；${pages.info().enabled?'关闭最后一个百科页面后自动退出。':'按 Ctrl+C 停止。'}`);
  if(process.connected)process.send({type:'wiki-ready'});
  if (process.argv.includes('--open')) {
    const url = `http://127.0.0.1:${port}`;
    openBrowser(url).catch(error => console.log(`${error.message} 请在浏览器打开：${url}`));
  }
});
let closing=false;
const close = () => {if(closing)return;closing=true;pages.stop();server.close(async () => {await onlineUpdates.close();await contentUpdates.close();await completeBackup.close();library.close();assessment.close();process.exit(0);});server.closeIdleConnections();const force=setTimeout(()=>{server.closeAllConnections();},5000);force.unref();};
process.on('SIGINT', close); process.on('SIGTERM', close);
