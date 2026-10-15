import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {normalizeVersion,compareVersions,selectVersions,returneeChanges,versionAssociations,htmlLines,VERSION_SECTIONS} from '../shared/version-archive.mjs';
import {outsideArchive,curateSections} from '../scripts/version-archive-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const games={genshin:53,starrail:31,zenless:20};
const archives={};
for(const game of Object.keys(games))archives[game]=JSON.parse(await readFile(join(root,'data/versions',game+'.json'),'utf8'));

test('104 个版本的来源、日期和内容全部可追溯，月之系列保持数字编号',async()=>{
 for(const [game,count] of Object.entries(games)){
  const {versions}=archives[game];assert.equal(versions.length,count);assert.equal(new Set(versions.map(v=>v.version)).size,count);
  for(const [index,v] of versions.entries()){
   assert.match(v.version,/^\d+\.\d+$/);assert.match(v.releaseDate,/^20\d{2}-\d{2}-\d{2}$/);assert(v.title&&v.sections.length);assert(v.sourceRefs.length);
   if(index)assert(compareVersions(versions[index-1].version,v.version)>0);
   assert(!/邦布|Bangboo/i.test(JSON.stringify(v.sections)));
   assert(!Object.hasOwn(v.maintenance,'compensation'));
   for(const section of v.sections){
    assert(!['characters','equipment','events','fixes','collection'].includes(section.key));
    for(const item of section.items){
     assert(!outsideArchive(JSON.stringify(item),game),`${game} ${v.version} ${item.name}`);
     assert(!/修复|修正/.test(JSON.stringify(item)),`${game} ${v.version} 修复串入正文`);
     assert.match(item.name,/[\u3400-\u9fff]/);
     if(section.key==='systems')assert(item.explanation?.length>=12||item.facts?.some(t=>t.length>=12),`${game} ${v.version} 空优化 ${item.name}`);
    }
   }
   for(const source of v.sourceRefs){assert.match(source.url,/^https:\/\//);assert(source.snapshot.startsWith('data/sources/version-archive/'));assert((await stat(join(root,source.snapshot))).isFile());}
   for(const section of v.sections){assert(section.key in VERSION_SECTIONS);assert(section.items.length);for(const item of section.items){assert(item.name.length<600);assert(!/^冒险等阶|^完成魔神任务|任务开启条件：/.test(item.name));}}
  }
 }
 const moon=archives.genshin.versions.filter(v=>v.version.startsWith('6.'));assert.equal(moon.length,8);assert(moon.every(v=>v.alias?.startsWith('月之')));
 assert.equal(archives.zenless.versions.find(v=>v.version==='2.2').title,'不要温和地走入那良夜');
});
test('主要变化保留任务条件和具体规则，不收录补偿与限时活动',()=>{
 const g=archives.genshin.versions[0],z=archives.zenless.versions[0];
 const story=g.sections.find(s=>s.key==='story').items;
 assert(story.some(i=>i.name.includes('白夜似梦初醒')&&i.requirements?.length));
 assert(story.some(i=>i.name.includes('往冥府的安魂歌')&&i.times?.some(t=>t.includes('永久开放'))));
 const maps=z.sections.find(s=>s.key==='map').items;assert.equal(maps.length,3);assert(maps.every(i=>i.requirements?.length));
 assert.equal(z.sections.find(s=>s.key==='story').items.length,2);
 assert.equal(archives.starrail.versions[0].maintenance.end,'2026-11-11 06:00');assert.equal(g.maintenance.end,null);
 const g63=archives.genshin.versions.find(v=>v.version==='6.3');
 assert(g63.sections.find(s=>s.key==='story').items.some(i=>i.name.includes('第七幕')));
 assert(JSON.stringify(g63.sections).includes('三枚月笼'));
 const resin=archives.genshin.versions.find(v=>v.version==='4.7').sections.find(s=>s.key==='systems').items.find(i=>i.name.includes('原粹树脂'));
 assert(resin.explanation.includes('160')&&resin.explanation.includes('200'));
 const z12=archives.zenless.versions.find(v=>v.version==='1.2');
 const storage=z12.sections.find(s=>s.key==='systems').items.find(i=>i.name.includes('储蓄电量'));
 assert(storage.facts.some(t=>t.includes('18分钟')&&t.includes('2400')));
 assert(storage.facts.some(t=>t.startsWith('1.2版本')));
 assert(z12.sections.some(s=>s.items.some(i=>i.name.includes('Fairy代行')&&i.facts?.some(t=>t.includes('离线')))));
 const z23=archives.zenless.versions.find(v=>v.version==='2.3');assert(z23.sections.find(s=>s.key==='systems').items.some(i=>i.explanation?.includes('副属性推荐')));
 for(const v of ['3.7','3.8'])assert(archives.starrail.versions.find(x=>x.version===v).sections.some(s=>s.key==='story'));
});
test('检索覆盖条件文本，版本按数字排序，范围不计入起始版本',()=>{
 assert.equal(compareVersions('1.10','1.9'),1);assert.equal(normalizeVersion('3.2版本'),'3.2');
 assert(selectVersions(archives.genshin.versions,{search:'白夜似梦初醒'}).some(v=>v.version==='7.1'));
 assert(selectVersions(archives.zenless.versions,{search:'2400'}).some(v=>v.version==='1.2'));
 assert.deepEqual(selectVersions(archives.zenless.versions,{since:'3.0',until:'3.2'}).map(v=>v.version),['3.2','3.1']);
 assert(selectVersions(archives.genshin.versions,{major:'4',section:'map'}).every(v=>v.version.startsWith('4.')&&v.sections.some(s=>s.key==='map')));
});
test('更新规则排除指定玩法与空优化，保留确切变化且不改写来源对象',()=>{
 const sections=[{key:'characters',items:[{name:'角色'}]},{key:'events',items:[{name:'活动'}]},{key:'fixes',items:[{name:'修复'}]},
 {key:'systems',items:[{name:'调整 · 筛选',explanation:'优化了圣遗物筛选的体验。'},{name:'原粹树脂上限',explanation:'原粹树脂恢复上限由160提升至200。'},{name:'储蓄电量系统',facts:['当电量超过上限时，开始恢复储蓄电量，每18分钟恢复1点，存储上限2400点。']},{name:'七圣更新',explanation:'新增角色牌和牌局记录功能。'}]}];
 const before=JSON.stringify(sections),result=curateSections(sections,'genshin');
 assert.deepEqual(result.map(s=>s.key),['systems']);assert.deepEqual(result[0].items.map(i=>i.name),['原粹树脂上限','储蓄电量系统']);assert.equal(JSON.stringify(sections),before);
 assert(outsideArchive('忘却之庭•混沌回忆','starrail'));assert(outsideArchive('剧变节点快速清剿','zenless'));assert(outsideArchive('壶中洞天','genshin'));
});
test('回坑补课排除限时活动与来源未明确的普通新增项',()=>{
 const versions=[{version:'1.0',sections:[]},{version:'1.1',sections:[{key:'story',items:[{name:'主线',availability:'permanent'},{name:'临时任务',availability:'limited'},{name:'未明示'}]},{key:'events',items:[{name:'活动',availability:'permanent'}]},{key:'systems',items:[{name:'长期调整'},{name:'限时调整',availability:'limited'}]}]}];
 const result=returneeChanges(versions,'1.0','1.1');assert.deepEqual(result[0].sections.map(s=>s.items.map(i=>i.name)),[['主线'],['长期调整']]);
});
test('关联使用当前条目版本和实际卡池起止记录，不改写条目',()=>{
 const entries=[{id:'a',game:'genshin',category:'characters',releaseVersion:'2.1版本'},{id:'b',game:'genshin',category:'banners',releaseVersion:'2.1',name:'第二期',banner:{start:'2021-09-21'}},{id:'c',game:'genshin',category:'banners',releaseVersion:'2.1',name:'第一期',banner:{start:'2021-09-01'}},{id:'d',game:'zenless',category:'characters',releaseVersion:'2.1'}];
 const before=JSON.stringify(entries),result=versionAssociations('2.1',entries,'genshin');assert.deepEqual(result.characters.map(e=>e.id),['a']);assert.deepEqual(result.banners.map(e=>e.id),['c','b']);assert.equal(JSON.stringify(entries),before);
});
test('兼容公告中没有闭合标签的段落，正文作为文本而非 HTML',()=>{
 assert.deepEqual(htmlLines('<h4>新增内容<p>• 第一项<p>• 第二项<br/>时间：09:00'),['新增内容','• 第一项','• 第二项','时间：09:00']);
 assert.deepEqual(htmlLines('<p>&lt;img src=x&gt;&amp;<script>bad()</script></p>'),['<img src=x>&']);
});
