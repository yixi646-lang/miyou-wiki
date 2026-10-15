import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerLayout,plannerPicker} from '../shared/planner-view.mjs';
import {withBannerSchedules} from '../shared/banner-schedule.mjs';
import {buildFacets,selectEntries} from '../shared/catalog.mjs';
import {buildBannerStatistics} from '../shared/banner-stats.mjs';

test('固定卡宽按真实分组数量收放，剩余空间分配给完整材料列',()=>{
 const one=plannerLayout(1600,4,[1,1]),three=plannerLayout(2200,3,[4,0]);
 assert.equal(one.columns,1);assert.equal(one.planWidth,420);assert.equal(one.materialColumns,3);
 assert.equal(three.cardWidth,420);assert.equal(three.planWidth,1284);assert.equal(three.columns,3);
 assert(plannerLayout(2200,1,[4,0]).materialColumns>three.materialColumns);
 const narrow=plannerLayout(320,4,[4,2]);assert(narrow.stacked);assert.equal(narrow.cardWidth,320);assert.equal(narrow.materialColumns,1);
});

test('三个游戏的计算器最多三项筛选，材料不受旧版本筛选影响',()=>{
 for(const game of ['genshin','starrail','zenless']){
  const profiles=Object.fromEntries([1,2,3].map(i=>['p'+i,{id:'p'+i,entryId:'e'+i,name:'角色'+i,game,category:'characters',rarity:i,element:'属性'+i,type:'类型'+i,region:'地区'+i,releaseVersion:'1.'+i}]));
  assert.deepEqual(plannerPicker(profiles,new Map(),game,'characters').facets.map(f=>f.key),['rarity','element','type']);
  const materials=[{id:'a',name:'a',game,category:'materials',kind:'材料',rarity:3},{id:'b',name:'b',game,category:'materials',kind:'材料',rarity:4,releaseVersion:'1.0'}];
  assert(!buildFacets(materials,{game,category:'materials'}).some(f=>f.key.startsWith('release')));
  assert.equal(selectEntries(materials,{game,category:'materials',filters:{releaseMajor:['unknown']}}).length,2);
 }
});

const pool=(id,start,end,extra={})=>({id,name:id,game:'genshin',category:'banners',releaseVersion:'1.0',type:'角色活动',...extra,banner:{start:start+' 10:00:00',end:end?end+' 18:00:00':null,mode:'event',sourceType:'Character Event',groups:[],...extra.banner}});
test('正常上下半、延长下半和多期跨期按实际记录分开，筛选与统计一致',()=>{
 const entries=[pool('upper','2020-01-01','2020-01-20'),pool('lower','2020-01-21','2020-03-01')];
 const before=JSON.stringify(entries),rows=withBannerSchedules(entries);
 assert.equal(JSON.stringify(entries),before);assert.equal(rows[0].banner.schedule.key,'upper');assert.equal(rows[1].banner.schedule.key,'lower');
 assert.equal(selectEntries(rows,{category:'banners',filters:{bannerPhase:['lower']}})[0].id,'lower');
 assert.equal(buildBannerStatistics(rows,'genshin',{asOf:'2021-01-01',phase:'upper'}).summary.bannerCount,1);
 const multi=withBannerSchedules([pool('a','2020-01-01','2020-01-10'),pool('b','2020-01-11','2020-01-20'),pool('c','2020-01-21','2020-01-31'),pool('weapon','2020-01-01','2020-01-18',{banner:{sourceType:'Weapon Event'}})]);
 assert.equal(multi[2].banner.schedule.label,'特殊安排 · 第 3 期');assert.match(multi[3].banner.schedule.label,/跨期/);
});

test('全版本、自选、联动和常驻不会强套上下半，人工分类可覆盖派生值',()=>{
 const rows=withBannerSchedules([pool('full','2020-01-01','2020-02-10'),pool('select','2020-01-01','2020-01-20',{banner:{mode:'selection'}}),pool('collab','2020-01-01',null,{banner:{sourceType:'Character Collaboration'}}),pool('standard','2020-01-01',null,{banner:{mode:'standard'}}),pool('manual','2020-01-01','2020-01-20',{banner:{schedule:{key:'multi',label:'特别安排'}}})]);
 assert.deepEqual(rows.map(e=>e.banner.schedule.key),['full','selection','collaboration','permanent','multi']);
 assert.equal(rows.at(-1).banner.schedule.label,'特别安排');
});
