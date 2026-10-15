import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from '../scripts/test-resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=4185,base=`http://127.0.0.1:${port}`,delay=ms=>new Promise(r=>setTimeout(r,ms));
const control=(op,payload=Buffer.alloc(0))=>{const mask=randomBytes(4),frame=Buffer.concat([Buffer.from([0x80|op,0x80|payload.length]),mask,Buffer.from(payload)]);for(let i=0;i<payload.length;i++)frame[6+i]^=mask[i%4];return frame;};
async function start(auto=true,startup=6000){
 const directory=await createTestWorkspace('page-lifecycle');
 const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server.mjs',`--port=${port}`,...auto?['--auto-close']:[]],{cwd:root,env:{...process.env,WIKI_DB_PATH:join(directory,'wiki.sqlite'),WIKI_PAGE_IDLE_MS:'300',WIKI_PAGE_STARTUP_MS:String(startup)},windowsHide:true,stdio:'ignore'});
 const exited=new Promise(resolve=>child.once('exit',resolve));
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return {child,exited,directory};}catch{}await delay(50);}
 await stopTestProcess(child);await cleanupTestWorkspace(directory);throw Error('页面存活验证服务未启动');
}
async function connect(token,origin=base){return new Promise((resolve,reject)=>{
 const req=http.request(base+`/api/page-session?token=${encodeURIComponent(token)}`,{headers:{Origin:origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64')}});
 req.once('upgrade',(_,socket)=>{socket.on('error',()=>{});resolve(socket);});req.once('response',response=>{response.resume();reject(Object.assign(Error('升级被拒绝'),{status:response.statusCode}));});req.once('error',reject);req.end();
});}
test('页面关闭自动退出：多页共存、刷新重连和控制帧',{timeout:15000},async()=>{
 const {child,exited,directory}=await start(),sockets=[];
 try{
  const {token}=await(await fetch(base+'/api/bootstrap')).json();
  for(let i=0;i<8;i++)sockets.push(await connect(token));
  const health=async()=>await(await fetch(base+'/api/health')).json();assert.equal((await health()).pageLifecycle.activePages,8);
  const first=sockets.shift(),pong=new Promise(r=>first.once('data',r));first.write(control(9,Buffer.from('wiki')));assert.deepEqual([...await pong], [...Buffer.from([0x8a,4,...Buffer.from('wiki')])]);first.write(control(8,Buffer.from([3,232])));first.resume();
  await delay(450);assert.equal((await health()).pageLifecycle.activePages,7);
  for(const socket of sockets.splice(0)){socket.write(control(8));socket.resume();}await delay(100);
  const refreshed=await connect(token);sockets.push(refreshed);await delay(450);assert.equal((await health()).pageLifecycle.activePages,1);
  refreshed.write(control(8));refreshed.resume();assert.equal(await Promise.race([exited,delay(3000).then(()=>{throw Error('最后一页关闭后服务未退出');})]),0);
 }finally{for(const socket of sockets)socket.destroy();await stopTestProcess(child);await exited;await cleanupTestWorkspace(directory);}
});
test('存活连接拒绝错误令牌和外部来源，手动服务按需启用自动退出',{timeout:12000},async()=>{
 const {child,exited,directory}=await start(false,500);
 try{
  const {token}=await(await fetch(base+'/api/bootstrap')).json();await assert.rejects(connect('wrong'),e=>e.status===403);await assert.rejects(connect(token,'https://example.com'),e=>e.status===403);
  await delay(650);assert.equal((await(await fetch(base+'/api/health')).json()).pageLifecycle.enabled,false);
  assert.equal((await fetch(base+'/api/page-session/enable',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/api/page-session/enable',{method:'POST',headers:{'X-Wiki-Token':token}})).status,200);
  assert.equal(await Promise.race([exited,delay(3000).then(()=>{throw Error('空闲服务未退出');})]),0);
 }finally{await stopTestProcess(child);await exited;await cleanupTestWorkspace(directory);}
});
