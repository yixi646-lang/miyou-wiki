import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from './test-resources.mjs';
const workspace=await createTestWorkspace('hidden-entry');let child;
try{
const env={...process.env,WIKI_PORT:'4187',WIKI_DB_PATH:join(workspace,'wiki.sqlite'),WIKI_PAGE_STARTUP_MS:'2000',WIKI_NO_OPEN:'1'};
const delay=ms=>new Promise(r=>setTimeout(r,ms)),base='http://127.0.0.1:4187';
const command='"'+fileURLToPath(new URL('../启动百科.cmd',import.meta.url))+'"';
child=spawn(fileURLToPath(new URL('file:///C:/Windows/System32/cmd.exe')),['/d','/s','/c',command],{windowsHide:true,windowsVerbatimArguments:true,env,stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
assert.equal(await new Promise((r,j)=>{child.once('exit',r);child.once('error',j);}),0,output);
let health;for(let i=0;i<30;i++){try{health=await(await fetch(base+'/api/health')).json();break;}catch{}await delay(100);}
assert.equal(health?.pageLifecycle.enabled,true);
await delay(2500);await assert.rejects(fetch(base+'/api/health'));
console.log('原 CMD 入口的中文路径和隐藏转交启动检查通过。');
}finally{await stopTestProcess(child);await cleanupTestWorkspace(workspace);}
