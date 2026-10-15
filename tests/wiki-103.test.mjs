import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {openLibrary} from '../lib/database.mjs';
import {createAssessmentRouter} from '../modules/character-assessment/server.mjs';
import {createUnifiedBackup} from '../lib/unified-backup.mjs';
import {auditLibrary} from '../lib/content-audit.mjs';
import {blankState,defaultGoal,SLOTS} from '../modules/character-assessment/core/model.mjs';
import {deletionUndo,restoreDeletion} from '../modules/character-assessment/core/undo.mjs';
import {optimizeInventory,assignedGOOD} from '../modules/character-assessment/core/optimizer.mjs';
import {calculateTeam} from '../modules/character-assessment/core/combat.mjs';
import {createTestWorkspace,cleanupTestWorkspace,stopTestProcess} from '../scripts/test-resources.mjs';
const data=JSON.parse(await readFile(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../modules/character-assessment/core/catalog.json',import.meta.url),'utf8'));
const character={key:'Furina',level:90,ascension:6,constellation:0,talent:{auto:6,skill:10,burst:10}};
const weapon={key:'FavoniusSword',level:90,ascension:6,refinement:5,location:'Furina',lock:false};
const entry=(id='genshin-test-one')=>({id,name:'测试条目',game:'genshin',category:'characters',releaseVersion:'7.1',rarity:5,element:'水',details:{}});
const clean=v=>JSON.parse(JSON.stringify(v,(k,value)=>k==='exportedAt'?undefined:value));

test('启动摘要计数与未变化初始化不重写条目',async()=>{
 const directory=await createTestWorkspace('wiki103-seed'),library=openLibrary(join(directory,'wiki.sqlite'));
 try{const seeds=join(directory,'catalog');await mkdir(seeds);await writeFile(join(seeds,'game.json'),JSON.stringify({entries:[entry()]}));assert.equal(library.seed(seeds),1);const old=library.get(entry().id);library.update(old.id,{...old,name:'保留的编辑'},old.revision);assert.equal(library.seed(seeds),0);assert.equal(library.get(old.id).name,'保留的编辑');assert.equal(library.count(),1);assert.equal(library.counts()[0].count,1);assert.equal(library.all('zenless').length,0);await writeFile(join(seeds,'game.json'),JSON.stringify({entries:[entry(),entry('genshin-test-two')]}));assert.equal(library.seed(seeds),1);assert.equal(library.get(old.id).name,'保留的编辑');}finally{library.close();await cleanupTestWorkspace(directory);}
});

test('统一恢复保留导入快照、锁定和扫描记录；跨板块失败回滚',{timeout:25000},async()=>{
 const root=await createTestWorkspace('wiki103-backup'),library=openLibrary(join(root,'wiki.sqlite'));
 const assessment=createAssessmentRouter({storagePath:join(root,'assessment.sqlite'),recommendationPath:join(root,'defaults.json'),json:()=>{},body:async()=>{}});
 const controller=createUnifiedBackup({root,backupPath:join(root,'backups'),library,assessment,release:()=>({version:'1.0.2',releaseId:'R000003'})});
 try{await mkdir(join(root,'modules/character-assessment/core'),{recursive:true});await writeFile(join(root,'modules/character-assessment/core/catalog.json'),JSON.stringify(catalog));library.create(entry());library.favorite(entry().id,true);
  const state=blankState();state.good.characters=[character];state.good.weapons=[weapon];const imported=assessment.accounts.action({action:'create',name:'测试导入账号',state},data);
  assessment.accounts.database().prepare('INSERT INTO assessment_scan_recovery VALUES(?,?,?,?,?)').run(imported.account.id,JSON.stringify(state),JSON.stringify(state.good),'测试扫描','2026-10-10');
  const backup=await controller.exportAll(),preview=await controller.preview(backup);await controller.restore({id:preview.id,sections:{accounts:true}});const restored=assessment.accounts.read();assert.equal(restored.account.locked,true);assert.deepEqual(restored.state.good,state.good);assert.deepEqual(assessment.accounts.original(restored.account.id).state,state);assert.equal(assessment.accounts.recovery(restored.account.id).source,'测试扫描');assert.equal(assessment.accounts.list().accounts.length,4);
  const p=await controller.preview(backup);library.favorite(entry().id,false);await assert.rejects(controller.restore({id:p.id,sections:{accounts:true}}),/资料发生变化/);
  const stable=clean(await controller.exportAll()),changed=structuredClone(backup);changed.library.entries[0].name='不应保留的失败修改';const store=await assessment.defaults(),originalRestore=store.restore;let rejectOnce=true;store.restore=value=>{if(rejectOnce){rejectOnce=false;throw Error('模拟公共设置失败');}return originalRestore(value);};
  const pp=await controller.preview(changed);await assert.rejects(controller.restore({id:pp.id,sections:{library:true,accounts:true,recommendations:true},entryMode:'replace',confirmReplace:true}),/模拟公共设置失败/);assert.deepEqual(clean(await controller.exportAll()),stable);
  const legacy=await controller.preview({entries:[entry('genshin-legacy')]});await controller.restore({id:legacy.id,sections:{library:true}});assert(library.get('genshin-legacy'));const oldAccount=await controller.preview(state);await controller.restore({id:oldAccount.id,sections:{accounts:true}});assert.equal(assessment.accounts.read().account.locked,true);assert.deepEqual(assessment.accounts.read().state.good,state.good);
  const oldRevision=assessment.accounts.read(imported.account.id).revision;const replacement=await controller.preview(backup);await controller.restore({id:replacement.id,sections:{accounts:true},accountMode:'replace',confirmReplace:true});assert(assessment.accounts.read(imported.account.id).revision>oldRevision);assert.equal(assessment.accounts.list().accounts.length,2);
 }finally{await controller.close();assessment.close();library.close();await cleanupTestWorkspace(root);}
});

test('短时撤销保留无关修改，并阻止过期、跨账号与相关冲突',()=>{
 const before=blankState();before.good.characters=[character];before.good.weapons=[weapon];before.goals.Furina=defaultGoal('hp','hydro');const after=structuredClone(before);after.good.weapons=[];const record=deletionUndo(before,after,'account-a',1000),current=structuredClone(after);current.goals.Furina.notes='后续编辑';const restored=restoreDeletion(current,record,{accountId:'account-a',now:2000});assert.deepEqual(restored.good.weapons,[weapon]);assert.equal(restored.goals.Furina.notes,'后续编辑');assert.throws(()=>restoreDeletion(current,record,{accountId:'other',now:2000}),/原账号/);assert.throws(()=>restoreDeletion(current,record,{accountId:'account-a',now:40000}),/时间/);assert.throws(()=>restoreDeletion(current,record,{accountId:'account-a',locked:true,now:2000}),/锁定/);current.good.weapons=[{...weapon,refinement:1}];assert.throws(()=>restoreDeletion(current,record,{accountId:'account-a',now:2000}),/相关资料已改变/);
});

test('素材备份包可读取恢复，补回缺失文件并保留现有文件',{timeout:25000},async()=>{
 const root=await createTestWorkspace('wiki103-assets'),library=openLibrary(join(root,'wiki.sqlite'));
 const assessment=createAssessmentRouter({storagePath:join(root,'assessment.sqlite'),recommendationPath:join(root,'defaults.json'),json:()=>{},body:async()=>{}}),controller=createUnifiedBackup({root,backupPath:join(root,'backups'),library,assessment,release:()=>({version:'1.0.2'})});
 try{await mkdir(join(root,'modules/character-assessment/core'),{recursive:true});await writeFile(join(root,'modules/character-assessment/core/catalog.json'),JSON.stringify(catalog));await mkdir(join(root,'assets'));await writeFile(join(root,'assets/a.png'),'first');await writeFile(join(root,'assets/b.png'),'second');library.create({...entry(),image:'/assets/a.png',details:{artwork:'/assets/b.png'}});
  const job=await controller.createJob(true);let status;for(let i=0;i<100;i++){await controller.handle({method:'GET'},null,new URL('http://localhost/api/backup/jobs/'+job.id),(_res,_code,value)=>{status=value;});if(status.status!=='running')break;await new Promise(r=>setTimeout(r,100));}assert.equal(status.status,'done',status.error);await writeFile(join(root,'assets/a.png'),'current');await rm(join(root,'assets/b.png'));
  const stream=createReadStream(join(root,'backups',status.filename));stream.method='POST';let preview;await controller.handle(stream,null,new URL('http://localhost/api/backup/upload'),(_res,_code,value)=>{preview=value;});assert(preview.missingAssets.includes('/assets/b.png'));await controller.restore({id:preview.id,sections:{library:true}});assert.equal(await readFile(join(root,'assets/a.png'),'utf8'),'current');assert.equal(await readFile(join(root,'assets/b.png'),'utf8'),'second');
 }finally{await controller.close();assessment.close();library.close();await cleanupTestWorkspace(root);}
});

test('推荐使用实际计算核心、满足面板限制、不改库存，并可取消',{timeout:30000},async()=>{
 const good={format:'GOOD',version:3,characters:[character],weapons:[weapon],artifacts:SLOTS.map((slot,i)=>({setKey:'GoldenTroupe',slotKey:slot,rarity:5,level:20,mainStatKey:{flower:'hp',plume:'atk',sands:'hp_',goblet:'hydro_dmg_',circlet:'critRate_'}[slot],substats:[{key:'critDMG_',value:7.8},{key:'enerRech_',value:5.2}],location:'Furina',lock:false}))};good.artifacts.push({...structuredClone(good.artifacts[0]),location:'',substats:[{key:'critRate_',value:15.6},{key:'critDMG_',value:31.2}]});const original=structuredClone(good),scenario={enemyLevel:100,resistance:10,conditional:{},characters:{},members:[]};const row=calculateTeam(good,'Furina',scenario).rows.find(r=>r.group==='skill'&&r.variant!=='heal'&&r.average>0);assert(row);
 const input={good,key:'Furina',scenario,catalog,data,objective:row.path,goals:{Furina:defaultGoal('hp','hydro')},rules:{borrow:true,includeCustom:true,minimums:{enerRech_:100},setMode:'four',set1:'GoldenTroupe'},budget:80,pool:4};const result=await optimizeInventory(input);assert(result.results.length);assert.deepEqual(good,original);assert(result.results[0].panel.enerRech_>=100);const chosen=assignedGOOD(good,result.results[0].assignment);const actual=calculateTeam(chosen,'Furina',scenario).rows.find(r=>r.path===row.path).average;assert(Math.abs(actual-result.results[0].score)<1e-8);assert(result.results[0].score>=result.baseline);
 let stop=false;const cancelled=await optimizeInventory(input,{progress:()=>{stop=true;},cancelled:()=>stop});assert.equal(cancelled.cancelled,true);
 const impossible=await optimizeInventory({...input,rules:{...input.rules,minimums:{enerRech_:99999}}});assert.equal(impossible.results.length,0);
 assert.throws(()=>assignedGOOD(good,{Furina:{weapon:0,artifacts:{flower:0}},Jean:{weapon:0,artifacts:{flower:0}}}),/重复分配/);
});

test('资料核查兼容 UTF-8 BOM，指出具体字段和关联，保留用户费用并排除邦布',async()=>{
 const root=await createTestWorkspace('wiki103-audit');
 try{
  await mkdir(join(root,'data/growth'),{recursive:true});
  await writeFile(join(root,'data/growth/zenless.json'),'\uFEFF'+JSON.stringify({recipes:[{feeStatus:'user-default',fee:0}]}));
  await mkdir(join(root,'原神库存扫描器/中文界面预览/inventorylists'),{recursive:true});
  await writeFile(join(root,'原神库存扫描器/中文界面预览/界面修改来源.json'),'\uFEFF'+JSON.stringify({build:'wiki-zh-ui.test'}));
  await writeFile(join(root,'原神库存扫描器/中文界面预览/inventorylists/version.txt'),'\uFEFF7.1.0\r\n');
  await mkdir(join(root,'modules/character-assessment'),{recursive:true});
  await writeFile(join(root,'modules/character-assessment/upstream.json'),JSON.stringify({version:'测试计算核心'}));
  const e={...entry(),image:'/assets/missing.png',signatureIds:['missing-character'],details:{materials:[{items:[{id:'missing-material',name:'材料',count:1}]}]}};
  const result=await auditLibrary({root,entries:[e,{id:'zenless-bangboo',game:'zenless',category:'banners',name:'邦布频道',type:'邦布频道'}]});
  assert.equal(result.entries,1);assert(result.issues.some(i=>i.field==='signatureIds'));assert(result.issues.some(i=>i.field==='details.materials'));assert(result.issues.some(i=>i.type==='图片缺失'));assert.equal(result.userDefaults.length,1);assert(!result.issues.some(i=>i.id==='zenless-bangboo'));
  assert.equal(result.coverage.scanner.build,'wiki-zh-ui.test');assert.equal(result.coverage.scanner.version,'7.1.0');assert.equal(result.coverage.core.version,'测试计算核心');
 }finally{await cleanupTestWorkspace(root);}
});

test('资料核查遇到损坏 JSON 时明确指出文件，修正后可重试',async()=>{
 const root=await createTestWorkspace('wiki103-audit-invalid');
 try{
  const file='原神库存扫描器/中文界面预览/界面修改来源.json';
  await mkdir(join(root,'原神库存扫描器/中文界面预览'),{recursive:true});
  await writeFile(join(root,file),'\uFEFF{"build":');
  await assert.rejects(auditLibrary({root,entries:[]}),error=>error.message.includes(file)&&error.message.startsWith('资料文件格式错误：'));
  await writeFile(join(root,file),'\uFEFF'+JSON.stringify({build:'修正后的版本'}));
  assert.equal((await auditLibrary({root,entries:[]})).coverage.scanner.build,'修正后的版本');
 }finally{await cleanupTestWorkspace(root);}
});

test('服务首页只返回摘要、列表按游戏加载且推荐后台资源可用',{timeout:25000},async()=>{
 const directory=await createTestWorkspace('wiki103-http');let child;
 try{child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server.mjs','--port=4287'],{cwd:new URL('../',import.meta.url),env:{...process.env,WIKI_DB_PATH:join(directory,'wiki.sqlite'),WIKI_ASSESSMENT_DB_PATH:join(directory,'assessment.sqlite'),WIKI_BACKUP_DIR:join(directory,'backups')},windowsHide:true,stdio:'ignore'});const base='http://127.0.0.1:4287';let health;for(let i=0;i<100;i++){try{health=await (await fetch(base+'/api/health')).json();if(health.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert(health?.ok);
  const response=await fetch(base+'/api/bootstrap'),text=await response.text(),bootstrap=JSON.parse(text);assert.equal(bootstrap.entries.length,0);assert.equal(bootstrap.counts.reduce((n,r)=>n+r.count,0),health.entries);const list=await(await fetch(base+'/api/catalog?game=genshin')).json();assert(list.entries.length>0);assert(list.entries.every(e=>e.game==='genshin'));for(const path of ['/assessment/optimizer-worker.mjs','/assessment/optimizer-ui.mjs','/assessment/core/optimizer.mjs','/assessment/core/undo.mjs'])assert.equal((await fetch(base+path)).status,200);assert.equal((await fetch(base+'/assessment/accounts-store.mjs')).status,404);console.log('首页摘要大小：'+Buffer.byteLength(text)+' 字节；原神列表：'+list.entries.length+' 条。');
 }finally{await stopTestProcess(child);await cleanupTestWorkspace(directory);}
});
