// 仅验证本次新增功能，使用独立浏览器配置和隔离资料库。
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from './test-resources.mjs';
const port=9346,wikiPort=Number(process.env.WIKI_UI_PORT??4186);if(wikiPort===4173)throw Error('界面验证须连接隔离资料库');
const workspace=await createTestWorkspace('ui-page-lifecycle'),profile=join(workspace,'browser');await mkdir(profile,{recursive:true});
let hidden,child;
try{

const wikiEnv={...process.env,WIKI_PORT:String(wikiPort),WIKI_DB_PATH:join(workspace,'wiki.sqlite'),WIKI_PAGE_IDLE_MS:'1200',WIKI_PAGE_STARTUP_MS:'20000'};
const launchHidden=()=>{const child=spawn('C:/Windows/System32/wscript.exe',['D:/Wiki/启动百科.vbs','--no-open'],{windowsHide:true,stdio:'ignore',env:wikiEnv});return {child,exited:new Promise((r,j)=>{child.once('exit',r);child.once('error',j);})};};
hidden=launchHidden();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const health=async()=>await(await fetch('http://127.0.0.1:'+wikiPort+'/api/health',{signal:AbortSignal.timeout(1200)})).json();
for(let i=0;i<100;i++){try{if((await health()).pageLifecycle?.enabled)break;}catch{}await pause(100);}
assert.equal((await health()).pageLifecycle.enabled,true);

child=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--disable-extensions',`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let targets;for(let i=0;i<50;i++){try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(t=>t.type==='page'))break;}catch{}await delay(100);}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});let counter=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter,timer=setTimeout(()=>reject(Error(method+' timeout')),12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('页面未就绪 '+expression);};
 const nav=async url=>{await send('Page.navigate',{url:`http://127.0.0.1:${wikiPort}`+url});await until("document.readyState==='complete'&&(document.querySelector('.entry-card')||document.querySelector('.banner-stat-root')||document.querySelector('.planner-picker')||document.querySelector('.article'))");};
 const change=async(selector,value)=>evaluate(`var el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing '+${JSON.stringify(selector)});el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('change',{bubbles:true}));`);
 const click=async selector=>evaluate(`var el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing '+${JSON.stringify(selector)});el.click()`);
 const screenshot=async name=>{await delay(250);const d=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('previews/'+name,Buffer.from(d.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});


 const waitPages=async n=>{for(let i=0;i<100;i++){if((await health()).pageLifecycle.activePages===n)return;await delay(100);}throw Error('页面连接数不正确 '+n);};
 await nav('/?game=genshin');await waitPages(1);assert.equal(await evaluate("document.querySelector('.brand-name').textContent"),'Wiki');assert(await evaluate("document.title.endsWith(' · Wiki')"));assert.equal(await evaluate("document.body.textContent.includes('星页')"),false);await screenshot('wiki-hidden-launch.png');
 const token=(await(await fetch('http://127.0.0.1:'+wikiPort+'/api/bootstrap')).json()).token;
 const duplicate=launchHidden();assert.equal(await Promise.race([duplicate.exited,delay(5000).then(()=>{throw Error('重复启动没有退出');})]),0);assert.equal((await(await fetch('http://127.0.0.1:'+wikiPort+'/api/bootstrap')).json()).token,token);
 await send('Page.reload');await until("document.readyState==='complete'&&document.querySelector('.entry-card')");await waitPages(1);await delay(1500);assert.equal((await health()).pageLifecycle.activePages,1);
 const other=await send('Target.createTarget',{url:'http://127.0.0.1:'+wikiPort+'/?game=zenless'});await waitPages(2);
 await send('Page.navigate',{url:'about:blank'});await waitPages(1);await delay(1500);assert.equal((await health()).pageLifecycle.activePages,1);
 await send('Target.closeTarget',{targetId:other.targetId});assert.equal(await Promise.race([hidden.exited,delay(8000).then(()=>{throw Error('隐藏服务未随最后一页退出');})]),0);
 await assert.rejects(health);assert.deepEqual(errors,[]);
 console.log('实际启动检查通过：VBS 隐藏启动、Wiki 名称、重复启动复用服务、刷新、多个页面和最后一页关闭后后台进程退出。');
}finally{if(ws?.readyState===1)ws.close();}
}finally{await stopTestProcess(child);await stopTestProcess(hidden?.child);await cleanupTestWorkspace(workspace);}
