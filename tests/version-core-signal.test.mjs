import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildFacets,selectEntries,summarizeEntry,majorVersion,toggleFacet,facetKeys} from '../shared/catalog.mjs';
import {buildCoreStats,formatCoreValue} from '../shared/core-stats.mjs';
import {signalSourceType,pairSignalBanners} from '../lib/signal-channels.mjs';
import {buildBannerStatistics} from '../shared/banner-stats.mjs';
const entry=(id,releaseVersion,extra={})=>({id,name:id,game:'genshin',category:'characters',releaseVersion,...extra});
test('各栏目先按大版本筛选，再按多个小版本细分；分面计数保留父级与兄弟选项',()=>{
 const entries=[entry('a','1.0'),entry('b','1.2'),entry('c','1.10'),entry('d','2.0'),entry('u',null)];
 assert.equal(majorVersion('1.10'),'1.0');assert.equal(majorVersion(null),'');
 const q={game:'genshin',category:'characters',filters:{releaseMajor:['1.0'],releaseVersion:['1.2','1.10']}};
 assert.deepEqual(selectEntries(entries,q).map(e=>e.id),['c','b']);
 const facets=buildFacets(entries,q);assert.equal(facets.find(f=>f.key==='releaseMajor').values.find(v=>v.value==='1.0').count,3);assert.equal(facets.find(f=>f.key==='releaseMajor').values.find(v=>v.value==='2.0').count,1);
 assert.deepEqual(facets.find(f=>f.key==='releaseVersion').values.map(v=>v.value),['1.10','1.2','1.0']);
 assert.deepEqual(toggleFacet(q.filters,'releaseMajor','2.0').releaseVersion,[]);
 for(const game of ['genshin','starrail','zenless'])for(const category of ['characters','weapons','sets','materials','banners'])assert(facetKeys(game,category).includes('releaseMajor'));
 assert.equal(selectEntries(entries,{filters:{releaseMajor:['unknown']}})[0].id,'u');
});
test('原神突破属性在摘要、完整条目和养成条目选择中一致，支持与版本求交集',()=>{
 const entries=[entry('a','1.0',{details:{facts:{突破属性:'暴击率'}}}),entry('b','2.0',{details:{facts:{突破属性:'暴击率'}}}),entry('c','1.0',{details:{facts:{突破属性:'元素精通'}}})];
 const q={game:'genshin',category:'characters',filters:{ascensionStat:['暴击率'],releaseMajor:['1.0']}};
 assert.deepEqual(selectEntries(entries,q).map(e=>e.id),['a']);assert.deepEqual(selectEntries(entries.map(summarizeEntry),q).map(e=>e.id),['a']);
});
test('绝区零核心强化是累计值，准确显示本级差值、暴击百分比及每秒回复单位',()=>{
 const read=id=>JSON.parse(readFileSync(`data/sources/zenless/characters/${id}.json`));
 const anby=buildCoreStats(read(1011));assert.equal(anby.rows.length,7);assert.equal(anby.rows[1].values[12201],6);assert.equal(anby.rows.at(-1).values[12201],18);assert.equal(anby.rows.at(-1).values[12101],75);assert.equal(anby.rows[2].gains[12201],0);assert.equal(anby.rows[2].gains[12101],25);
 const nekomata=buildCoreStats(read(1021));assert.equal(nekomata.rows.at(-1).values[20101],14.4);assert.equal(formatCoreValue(14.4,'%'),'+14.4%');
 const nicole=buildCoreStats(read(1031));assert.equal(nicole.rows.at(-1).values[30501],0.36);assert.equal(formatCoreValue(0.36,'/秒'),'+0.36/秒');
});
test('特殊频道依据明确页面标题修正，角色与音擎分别分类且互相关联，计入可选目标',()=>{
 assert.equal(signalSourceType('Exclusive Rescreening/2026-08-19','Exclusive Channel'),'Exclusive Rescreening');assert.equal(signalSourceType('W-Engine Reverberation/2026-01-21','W-Engine Channel'),'W-Engine Reverberation');assert.equal(signalSourceType('(No Match Found)/2024-09-04','Exclusive Channel'),'Exclusive Channel');
 const zz=JSON.parse(readFileSync('data/catalog/zenless.json')).entries,special=pairSignalBanners(zz);
 assert.equal(special.filter(e=>e.type==='独家重映').length,2);assert.equal(special.filter(e=>e.type==='音擎回响').length,2);
 for(const b of special){const p=zz.find(e=>e.id===b.banner.pairedBannerId);assert(p);assert.equal(p.banner.pairedBannerId,b.id);assert.equal(p.releaseVersion,b.releaseVersion);assert.notEqual(p.type,b.type);assert.equal(b.banner.mode,'selection');assert(b.banner.groups.filter(g=>g.items.some(i=>i.rarity===5)).every(g=>g.role==='selectable'));}
 const stats=buildBannerStatistics(zz,'zenless',{asOf:'2026-10-03',major:'3.0',type:'独家重映'});assert.equal(stats.banners.length,1);assert.equal(stats.summary.selectionCount,1);assert.equal(stats.rows.filter(r=>r.selectableCount===1).length,3);assert.equal(stats.rows.some(r=>r.upCount>0),false);
});
