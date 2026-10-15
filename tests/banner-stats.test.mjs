import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBannerStatistics} from '../shared/banner-stats.mjs';
const unit=(id,category='characters')=>({id,game:'genshin',category,name:id,rarity:5});
const banner=(id,start,end,role='up',version='1.0',ids=['a'],mode='event')=>({id,game:'genshin',category:'banners',name:id,type:'角色活动祈愿',releaseVersion:version,banner:{start:start+' 10:00:00',end:end?end+' 18:00:00':null,mode,groups:[{role,items:ids.map(id=>({id,name:id}))}]}});
test('并行池按期去重，UP、可选目标、普通内容与未知标记分别统计',()=>{
 const result=buildBannerStatistics([unit('a'),unit('b','weapons'),banner('p1','2024-01-01','2024-01-20'),banner('p2','2024-01-01','2024-01-20'),banner('p3','2024-02-01','2024-02-20','up','1.1'),banner('selection','2024-03-01','2024-03-20','selectable','1.2',['a','b'],'selection'),banner('ordinary','2023-01-01',null,'pool','1.0',['a'],'standard')],'genshin',{asOf:'2024-04-10'});
 // 将默认 fixture 标记去掉，未知分类不得推断为 UP。
 const unknown=banner('unknown','2024-04-01','2024-04-20');delete unknown.banner.groups[0].role;
 const unknownResult=buildBannerStatistics([unit('a'),unknown],'genshin',{asOf:'2024-04-10'}).rows[0];assert.equal(unknownResult.upCount,0);assert.equal(unknownResult.unknownCount,1);
 const row=result.rows.find(r=>r.entry.id==='a');assert.equal(row.upPoolCount,3);assert.equal(row.upCount,2);assert.equal(row.selectableCount,1);assert.equal(row.poolCount,1);assert.equal(row.first.version,'1.0');assert.equal(row.last.version,'1.1');assert.equal(result.rows.find(r=>r.entry.id==='b').upCount,0);
});
test('截止日期与版本范围影响计数和间隔；持续开放的联动 UP 不按常驻池处理',()=>{
 const entries=[unit('a'),banner('first','2024-01-01','2024-01-20'),banner('second','2024-02-01','2024-02-20','up','1.1'),banner('collab','2024-03-01',null,'up','1.2'),banner('future','2024-05-01','2024-05-20')];
 const row=buildBannerStatistics(entries,'genshin',{asOf:'2024-04-01'}).rows[0];assert.equal(row.upCount,3);assert.equal(row.repeatCount,2);assert.equal(row.maxGap,31);assert.equal(row.averageGap,30);assert.equal(row.lastGap,29);assert.equal(row.daysSince,31);
 const scoped=buildBannerStatistics(entries,'genshin',{asOf:'2024-04-01',version:'1.1'}).rows[0];assert.equal(scoped.upCount,1);assert.equal(scoped.maxGap,null);assert.equal(scoped.first.version,'1.1');
});
test('一个池中重复列出的条目只计一次，游戏之间隔离',()=>{
 const p=banner('one','2024-01-01','2024-01-20');p.banner.groups.push({role:'pool',items:[{id:'a',name:'a'}]});
 const rows=buildBannerStatistics([unit('a'),{...unit('other'),game:'starrail'},p],'genshin',{asOf:'2024-04-01'}).rows;assert.equal(rows.length,1);assert.equal(rows[0].upCount,1);assert.equal(rows[0].history.length,1);assert.equal(rows[0].poolCount,0);
});
