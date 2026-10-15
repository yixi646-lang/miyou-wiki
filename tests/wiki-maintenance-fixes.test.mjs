import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
import {runInNewContext} from 'node:vm';
import {openLibrary} from '../lib/database.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createUnifiedBackup,UNIFIED_BACKUP} from '../lib/unified-backup.mjs';
import {GAMES,CATEGORIES} from '../shared/catalog.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';

const hooks=registerHooks({resolve(specifier,context,next){return next(specifier.startsWith('/shared/')?new URL('../shared/'+specifier.slice(8),import.meta.url).href:specifier,context);}});
after(()=>hooks.deregister());
const tick=()=>new Promise(setImmediate),domTest={skip:!process.env.WIKI_TEST_DOM_PACKAGE};
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const until=async check=>{for(let i=0;i<60&&!check();i++)await tick();assert(check());};
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
let moduleId=0;

async function backupFixture(run){
  const root=await createTestWorkspace('wiki-personal-restore'),library=openLibrary(':memory:');let assessment,controller;
  try{
    assessment=createAssessmentRouter({storagePath:':memory:',recommendationPath:join(root,'defaults.json'),json:()=>{},body:async()=>{}});
    controller=createUnifiedBackup({root,backupPath:join(root,'backups'),library,assessment,release:()=>({version:'fixture'})});
    const entry={id:'genshin-test-existing',name:'隔离条目',game:'genshin',category:'characters',details:{}};library.create(entry);
    const seed=()=>{library.favorite(entry.id,true);library.db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run('growth_plan:genshin',JSON.stringify({goals:[],inventory:{fixture:7}}));};
    seed();await run({controller,library,entry,seed});
  }finally{await controller?.close();assessment?.close();library.close();await cleanupTestWorkspace(root);}
}

test('仅含条目的数组、旧 JSON 和统一备份不开放个人恢复，强行勾选也保留现有资料',async()=>{
  await backupFixture(async({controller,library,entry})=>{
    const before=library.export();
    for(const input of [[entry],{entries:[entry]},{format:UNIFIED_BACKUP,schemaVersion:1,library:{entries:[entry]}}]){
      const preview=await controller.preview(input);assert.equal(preview.available.personal,false);
      await controller.restore({id:preview.id,sections:{library:true,personal:true}});
      const saved=library.export();assert.deepEqual(saved.favorites,before.favorites);assert.deepEqual(saved.growthPlans,before.growthPlans);
    }
  });
});

test('只恢复已提供的个人板块，明确的空收藏或空计划仍能正常恢复',async()=>{
  await backupFixture(async({controller,library,entry,seed})=>{
    for(const [fields,favorites,plans] of [[{favorites:[]},0,1],[{growthPlans:{}},1,0],[{favorites:[],growthPlans:{}},0,0]]){
      seed();const preview=await controller.preview({entries:[entry],...fields});assert.equal(preview.available.personal,true);
      await controller.restore({id:preview.id,sections:{personal:true}});const saved=library.export();
      assert.equal(saved.favorites.length,favorites);assert.equal(Object.keys(saved.growthPlans).length,plans);
    }
    seed();await assert.rejects(controller.preview({entries:[entry],growthPlans:null}),/养成计划格式/);
    assert.equal(library.export().growthPlans.genshin.inventory.fixture,7);
  });
});

test('补充索引首次失败后可重新请求，成功后的并发读取继续共用缓存',async()=>{
  const original=globalThis.fetch;
  try{
    const supplement=await import(new URL('../public/catalog-supplements.mjs?fix='+moduleId++,import.meta.url));let calls=0;
    globalThis.fetch=async()=>++calls===1?{ok:false,status:503}:{ok:true,json:async()=>({})};
    await assert.rejects(supplement.supplementSummaries([]),/读取失败/);
    assert.deepEqual(await supplement.supplementSummaries([]),[]);await supplement.supplementSummaries([]);assert.equal(calls,2);
    const held=deferred();globalThis.fetch=async()=>{calls++;return held.promise;};
    const character={id:'genshin-fixture',game:'genshin',category:'characters',details:{}};
    const one=supplement.supplementCharacter(character),two=supplement.supplementCharacter(character);await tick();assert.equal(calls,3);
    held.resolve({ok:true,json:async()=>({})});await Promise.all([one,two]);
  }finally{globalThis.fetch=original;}
});

test('补充索引超时会中止读取，技能和渠道索引都可以再次加载',async()=>{
  const originalFetch=globalThis.fetch,originalTimeout=globalThis.setTimeout;
  globalThis.setTimeout=(callback,ms,...args)=>originalTimeout(callback,ms===20000?15:ms,...args);
  try{
    const supplement=await import(new URL('../public/catalog-supplements.mjs?fix='+moduleId++,import.meta.url));
    for(const load of [()=>supplement.supplementSummaries([]),()=>supplement.supplementCharacter({id:'genshin-fixture',game:'genshin',category:'characters',details:{}})]){
      let signal;globalThis.fetch=async(url,options)=>{signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));};
      await assert.rejects(load(),/加载超时/);assert.equal(signal.aborted,true);
      globalThis.fetch=async()=>({ok:true,json:async()=>({})});await load();
    }
  }finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;}
});

async function previewFixture(){
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main></main></body></html>');
  const originalDocument=globalThis.document,originalFetch=globalThis.fetch,pending=new Map(),posts=[],notices=[],tasks=[];
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(value){value?this.setAttribute('checked',''):this.removeAttribute('checked');},configurable:true});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.querySelectorAll('option')].find(option=>option.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},configurable:true});
  let fileHandler;const add=window.HTMLInputElement.prototype.addEventListener;
  window.HTMLInputElement.prototype.addEventListener=function(type,callback,...options){if(type==='change'&&this.hasAttribute('data-backup-file'))fileHandler=callback;return add.call(this,type,callback,...options);};
  globalThis.document=document;
  globalThis.fetch=async(url,request)=>{
    const body=typeof request.body==='string'?JSON.parse(request.body):{label:request.body.name.replace(/\.(json|zip)$/,'')};posts.push({url,body});
    if(url.endsWith('/backup/preview')||url.endsWith('/backup/upload')){const held=deferred();pending.set(body.label,held);return held.promise;}
    return {ok:true,json:async()=>({recovery:'isolated-fixture'})};
  };
  const {mountManageTools}=await import('../public/manage-tools.mjs');
  mountManageTools({host:document.querySelector('main'),api:async()=>({token:'fixture'}),toast:message=>notices.push(message),onRestored:async()=>{}});
  const q=selector=>document.querySelector(selector),input=q('[data-backup-file]');Object.defineProperty(input,'files',{value:[],writable:true});
  const response=id=>({ok:true,json:async()=>({id,exportedAt:'from-'+id,available:{library:true},counts:{entries:1,added:1,existing:0,changed:0,favorites:0,plans:0,accounts:0},assets:'',missingAssets:[]})});
  return {q,window,pending,posts,notices,response,
    async select(label,extension='json'){input.files=[new File([JSON.stringify({label})],label+'.'+extension)];const task=fileHandler({target:input});tasks.push(task);await until(()=>pending.has(label));return {done:task};},
    async cleanup(){q('[data-manage-tools]')?.remove();for(const [id,held]of pending)held.resolve(response(id));await Promise.allSettled(tasks);await tick();globalThis.fetch=originalFetch;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;window.HTMLInputElement.prototype.addEventListener=add;}
  };
}

test('备份 A 晚于 B 返回时只显示并恢复 B，过时的 ZIP 预览被释放',domTest,async()=>{
  const env=await previewFixture();
  try{
    const a=await env.select('A','zip'),b=await env.select('B');env.pending.get('B').resolve(env.response('B'));await b.done;
    env.pending.get('A').resolve(env.response('A'));await a.done;await tick();
    assert.match(env.q('[data-restore-preview]').textContent,/from-B/);assert(!env.q('[data-restore-preview]').textContent.includes('from-A'));
    assert(env.posts.some(post=>post.url.endsWith('/backup/cancel')&&post.body.id==='A'));
    env.q('[data-manage="restore"]').dispatchEvent(new env.window.Event('click',{bubbles:true}));await until(()=>env.posts.some(post=>post.url.endsWith('/backup/restore')));
    assert.equal(env.posts.find(post=>post.url.endsWith('/backup/restore')).body.id,'B');
  }finally{await env.cleanup();}
});

test('换文件立即撤下旧恢复入口，过时错误不覆盖新状态，失败与离开均不恢复旧预览',domTest,async()=>{
  const env=await previewFixture();
  try{
    const a=await env.select('A'),b=await env.select('B');env.pending.get('A').reject(Error('旧文件错误'));await a.done;assert.deepEqual(env.notices,[]);
    env.pending.get('B').resolve(env.response('B'));await b.done;const oldButton=env.q('[data-manage="restore"]');
    const c=await env.select('C');assert.equal(env.q('[data-manage="restore"]'),null);oldButton.dispatchEvent(new env.window.Event('click',{bubbles:true}));await tick();assert(!env.posts.some(post=>post.url.endsWith('/backup/restore')));
    env.pending.get('C').reject(Error('新文件错误'));await c.done;assert.deepEqual(env.notices,['新文件错误']);assert.equal(env.q('[data-manage="restore"]'),null);
    const d=await env.select('D');env.q('[data-manage-tools]').remove();env.pending.get('D').resolve(env.response('D'));await d.done;await tick();assert(env.posts.some(post=>post.url.endsWith('/backup/cancel')&&post.body.id==='D'));
  }finally{await env.cleanup();}
});

async function editorFixture(){
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document}=parseHTML('<html><body><dialog></dialog></body></html>');
  const dialog=document.querySelector('dialog'),pending=new Map(),notices=[];dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  const context={state:{screen:'detail',game:'genshin',category:'characters'},renderGeneration:1,editorGeneration:0,document,dialog,editorEntry:null,editorInitial:'',GAMES,CATEGORIES,api:path=>{const held=deferred();pending.set(path.split('/').at(-1),held);return held.promise;},toast:message=>notices.push(message),escape:value=>String(value??''),focusNameInput:()=>{},confirm:()=>true,$:selector=>document.querySelector(selector),FormData:class{*[Symbol.iterator](){}}};
  const source=app.slice(app.indexOf('function field('),app.indexOf("dialog.addEventListener('cancel'"));runInNewContext(source,context);
  return {context,dialog,pending,notices,entry:id=>({id,name:id,game:'genshin',category:'characters',details:{}})};
}

test('导航后旧编辑请求的成功和失败均不再弹窗或覆盖当前条目',domTest,async()=>{
  const {context,dialog,pending,notices,entry}=await editorFixture();
  const opening=context.openEditor('old');context.state.game='starrail';context.state.screen='list';context.renderGeneration++;
  pending.get('old').resolve(entry('old'));await opening;assert(!dialog.open);assert.equal(context.editorEntry,null);
  const failing=context.openEditor('failed');context.renderGeneration++;pending.get('failed').reject(Error('旧页面错误'));await failing;assert.deepEqual(notices,[]);
});

test('连续编辑只显示最后选择的条目，关闭后未完成的旧请求不能重新打开',domTest,async()=>{
  const {context,dialog,pending,notices,entry}=await editorFixture();
  const a=context.openEditor('A'),b=context.openEditor('B');pending.get('B').resolve(entry('B'));await b;
  pending.get('A').resolve(entry('A'));await a;assert.equal(context.editorEntry.id,'B');assert(dialog.open);
  const late=context.openEditor('late');context.closeEditor();pending.get('late').resolve(entry('late'));await late;
  assert(!dialog.open);assert.equal(context.editorEntry.id,'B');assert.deepEqual(notices,[]);
});
