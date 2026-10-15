import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {join} from 'node:path';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';

test('养成页面与搜索 Worker 的模块依赖均可通过静态路由加载，私人资源仍不可访问',async()=>{
 const directory=await createTestWorkspace('assessment-module-loading');let router,server;
 try{
  router=createAssessmentRouter({storagePath:join(directory,'assessment.sqlite'),recommendationPath:join(directory,'recommendations.json'),json:(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));},body:async()=>assert.fail('只读检查不得提交资料')});
  server=createServer((req,res)=>{router.handle(req,res,new URL(req.url,'http://127.0.0.1')).then(handled=>{if(!handled){res.writeHead(404);res.end();}}).catch(error=>res.destroy(error));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port,visited=new Set(),pending=['/assessment/ui.mjs','/assessment/optimizer-worker.mjs','/assessment/artifact-research-worker.mjs'];
  while(pending.length){
   const path=pending.pop();if(visited.has(path))continue;visited.add(path);
   const response=await fetch(base+path,{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/^text\/javascript/,path);
   const source=await response.text(),dependencies=[...source.matchAll(/(?:\b(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"]([^'"\n]+)['"]|\bimport\(\s*['"]([^'"\n]+)['"]\s*\))/g)];
   for(const dependency of dependencies){const target=dependency[1]??dependency[2];if(target.startsWith('.'))pending.push(new URL(target,base+path).pathname);}
  }
  assert(visited.has('/assessment/core/artifact-order.mjs'));assert(visited.has('/assessment/core/calculator.mjs'));
  for(const path of ['/assessment/core/catalog.json','/assessment/core/game-stats.json','/assessment/ui.css'])assert.equal((await fetch(base+path)).status,200,path);
  for(const path of ['/assessment/server.mjs','/assessment/accounts-store.mjs','/assessment/core/recommendation-overrides.json'])assert.equal((await fetch(base+path)).status,404,path);
 }finally{
  if(server?.listening)await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});
  router?.close();await cleanupTestWorkspace(directory);
 }
});
