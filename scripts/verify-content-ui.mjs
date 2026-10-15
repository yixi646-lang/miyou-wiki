// 只检查本轮旅行者详情、星级背景与角色属性角标，所有测试数据在 finally 中回收。
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from './test-resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),wikiPort=4190,chromePort=9348,workspace=await createTestWorkspace('ui-content');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let server,browser,ws;
try{
 server=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server.mjs'],{cwd:root,env:{...process.env,WIKI_PORT:String(wikiPort),WIKI_DB_PATH:join(workspace,'wiki.sqlite')},windowsHide:true,stdio:'ignore'});
 for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${wikiPort}/api/health`)).ok)break;}catch{}await delay(100);}
 browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--disable-extensions',`--user-data-dir=${join(workspace,'browser')}`,`--remote-debugging-port=${chromePort}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json();if(targets.some(t=>t.type==='page'))break;}catch{}await delay(100);}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const pending=new Map(),errors=[];let counter=0;
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter,timer=setTimeout(()=>reject(Error(method+'超时')),12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<70;i++){if(await evaluate(expression))return;await delay(100);}throw Error('页面未出现预期内容：'+expression);};
 const nav=async path=>{await send('Page.navigate',{url:`http://127.0.0.1:${wikiPort}${path}`});await until("document.readyState==='complete'&&(document.querySelector('.entry-card')||document.querySelector('.article')||document.querySelector('.goal-card'))");};
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await nav('/?game=genshin&entry=genshin-characters-10000005');
 assert.equal(await evaluate("document.querySelectorAll('.traveler-tab').length"),7);
 assert.equal(await evaluate("document.querySelector('.traveler-tab.active').dataset.element"),'冰');
 assert.ok(await evaluate("document.querySelector('#skills').textContent.includes('冰雾剑')"));
 await until("[...document.querySelectorAll('.element-badge img,.traveler-tab img')].every(img=>img.complete&&img.naturalWidth>0)");
 await evaluate("document.querySelector('[data-action=traveler-element][data-element=水]').click()");
 await until("document.querySelector('.traveler-tab.active')?.dataset.element==='水'&&document.querySelector('#skills').textContent.includes('水纹剑')");
 await evaluate("var select=document.querySelector('.skill-level-select');select.value='0';select.dispatchEvent(new Event('change',{bubbles:true}))");
 assert.ok(await evaluate("document.querySelector('.skill-value-output').textContent.includes('%')"));
 assert.ok(await evaluate("document.querySelector('.training-link').href.includes(encodeURIComponent('genshin-characters-10000005-水'))"));
 await nav('/?game=genshin&entry=genshin-characters-10000007');assert.equal(await evaluate("document.querySelector('.traveler-tab.active').dataset.element"),'冰');
 await evaluate("document.querySelector('.training-link').click()");await until("document.querySelector('.goal-card')?.textContent.includes('荧（冰）')");
 await nav('/?game=genshin&screen=calculator&add=genshin-characters-10000007-水');assert.ok(await evaluate("document.querySelector('.goal-card:last-child').textContent.includes('荧（水）')&&!document.querySelector('.goal-card:last-child [data-field=levels]').checked"));
 for(const game of ['genshin','starrail','zenless']){
  await nav(`/?game=${game}&category=characters&size=20`);
  assert.ok(await evaluate("[...document.querySelectorAll('.entry-card')].every(card=>card.querySelector('.element-badge'))"));
  await until("[...document.querySelectorAll('.element-badge img')].every(img=>img.complete&&img.naturalWidth>0)");
  assert.ok(await evaluate("(()=>{const b=document.querySelector('.element-badge').getBoundingClientRect(),v=document.querySelector('.entry-visual').getBoundingClientRect();return b.left>=v.left&&b.right<v.left+v.width/2&&b.top>=v.top&&b.bottom<v.top+v.height/2})()"));
  await nav(`/?game=${game}&category=weapons&size=20`);
  assert.ok(await evaluate("[...document.querySelectorAll('.equipment-card')].every(card=>card.className.includes('rarity-')&&getComputedStyle(card.querySelector('.equipment-image')).backgroundImage.includes('gradient'))"));
 }
 await nav('/?game=genshin&category=characters&size=all');assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.rarity-5')).backgroundColor"),await evaluate("getComputedStyle(document.querySelector('.rarity-4')).backgroundColor"));
 await mkdir(join(root,'previews'),{recursive:true});await writeFile(join(root,'previews/rarity-and-element-20261003.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 await nav('/?game=genshin&entry=genshin-characters-10000005');await writeFile(join(root,'previews/traveler-elements-20261003.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
 assert.deepEqual(errors,[]);console.log('旅行者七元素切换、等级数值、元素养成入口、三游戏图鉴背景与角标、窄屏布局检查通过。');
}finally{ws?.close();await stopTestProcess(browser);await stopTestProcess(server);await cleanupTestWorkspace(workspace);}
