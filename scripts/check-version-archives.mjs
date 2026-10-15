// 针对性 API 检查；--ui 保持同一隔离服务供交互检查，按回车结束并清理。
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openLibrary} from '../lib/database.mjs';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from './test-resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.includes('--ui')&&!process.stdin.isTTY)throw Error('交互检查请通过 tty=true 启动，以便按回车结束并执行清理');
const directory=await createTestWorkspace('version-archives');let child;
try{
 const lib=openLibrary(join(directory,'wiki.sqlite'));
 const plan={goals:[],inventory:{},savedAt:'2026-10-01T00:00:00Z'};
 try{lib.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin',JSON.stringify(plan));}finally{lib.close();}
 const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 let diagnostics='';
 child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server.mjs',`--port=${port}`],{cwd:root,env:{...process.env,WIKI_DB_PATH:join(directory,'wiki.sqlite'),WIKI_BACKUP_DIR:join(directory,'backups')},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
 child.stderr.on('data',data=>diagnostics=(diagnostics+data).slice(-2000));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('启动超时 '+diagnostics)),12000);const finish=error=>{clearTimeout(timer);error?reject(error):resolve();};child.once('error',finish);child.once('exit',code=>finish(Error('服务提前退出 '+code+' '+diagnostics)));child.once('message',m=>{if(m.type==='wiki-ready')finish();});});
 const base=`http://127.0.0.1:${port}`,get=async path=>{const response=await fetch(base+'/api/'+path);assert.equal(response.status,200,path);return response.json();};
 const initial=await get('bootstrap');
 for(const [game,count] of [['genshin',53],['starrail',31],['zenless',20]]){const archive=await get('versions/'+game);assert.equal(archive.game,game);assert.equal(archive.versions.length,count);assert(archive.versions.every(v=>v.sourceRefs.length));}
 assert.equal((await fetch(base+'/api/versions/../library')).status,404);
 assert.deepEqual(await get('growth/genshin/plan'),plan);
 const status=await get('content-status');assert.deepEqual(status.versions,{genshin:'7.1',starrail:'4.6',zenless:'3.2'});
 assert.deepEqual((await get('bootstrap')).favorites,initial.favorites);
 console.log(JSON.stringify({api:'通过：104 个版本、资料标记、旧计划与收藏保持',port,directory}));
 if(process.argv.includes('--ui')){
  console.log('UI_READY '+base+'/?game=zenless&screen=versions');
  await new Promise(resolve=>{const timer=setTimeout(finish,600000);function finish(){clearTimeout(timer);process.stdin.removeListener('data',finish);process.stdin.removeListener('end',finish);process.stdin.pause();resolve();}process.stdin.once('data',finish);process.stdin.once('end',finish);process.stdin.resume();});
 }
}finally{await stopTestProcess(child);await cleanupTestWorkspace(directory);console.log('隔离服务与本轮测试目录已清理');}
