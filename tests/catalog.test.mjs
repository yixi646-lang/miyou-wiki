import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEntries,buildFacets,validateEntry,normalizePageSize,summarizeEntry} from '../shared/catalog.mjs';
const entry=(id,extra={})=>({id,name:id,game:'genshin',category:'characters',rarity:5,element:'水',type:'单手剑',aliases:[],...extra});
test('同一条件取并集，不同条件取交集；分面计数不排除本条件',()=>{
  const rows=[entry('a'),entry('b',{rarity:4,element:'火'}),entry('c',{element:'火',type:'长柄武器'}),entry('d',{element:'冰'})];
  const q={game:'genshin',category:'characters',filters:{element:['水','火'],rarity:['5']}};
  assert.deepEqual(selectEntries(rows,q).map(e=>e.id),['a','c']);
  const facet=buildFacets(rows,q).find(f=>f.key==='element');
  assert.equal(facet.values.find(v=>v.value==='冰').count,1);
  assert.equal(buildFacets(rows,q).some(f=>f.key==='game'),false);
});
test('版本优先于日期；缺失版本置后，切换方向仍保留缺失值在后',()=>{
  const rows=[entry('a',{releaseVersion:'4.1',releaseDate:'2024-01-01'}),entry('b',{releaseDate:'2026-01-01'}),entry('c',{releaseVersion:'4.2',releaseDate:'2023-11-01'})];
  assert.deepEqual(selectEntries(rows).map(e=>e.id),['c','a','b']);
  assert.deepEqual(selectEntries(rows,{direction:'asc'}).map(e=>e.id),['a','c','b']);
});
test('只显示当前游戏；卡池可以按关联角色筛选，摘要保留列表展示资料',()=>{
  const rows=[entry('a'),entry('b',{game:'starrail'}),entry('c',{category:'banners',banner:{start:'2024-01-01 10:00:00',groups:[{items:[{id:'a',name:'a'}]}]}})];
  assert.deepEqual(selectEntries(rows,{game:'genshin',category:'characters'}).map(e=>e.id),['a']);
  assert.deepEqual(selectEntries(rows,{game:'genshin',category:'banners',featured:'a'}).map(e=>e.id),['c']);
  const s=summarizeEntry(entry('x',{details:{effects:[{name:'2件',description:'效果'}],acquisition:['锻造'],skills:[{name:'隐藏大字段'}],facts:{副属性:'攻击力'}},statsTable:[{level:90}]}));
  assert.equal(s.secondaryName,'攻击力');assert.equal(s.listEffects[0].description,'效果');assert.equal(s.acquisition,undefined);assert.equal(s.details,undefined);assert.equal(s.statsTable,undefined);
  for(const [value,want]of [['20',20],['50',50],['100',100],['all','all'],['0','all'],['NaN','all'],['999999','all'],[undefined,'all']])assert.equal(normalizePageSize(value),want);
});
test('单一游戏缺失日期用已确认版本排序，版本按数字比较',()=>{
  const rows=[entry('a',{releaseVersion:'7.2'}),entry('b',{releaseVersion:'7.10'}),entry('c',{releaseVersion:'7.1',releaseDate:'2026-01-01'})];
  assert.deepEqual(selectEntries(rows,{game:'genshin'}).map(e=>e.id),['b','a','c']);
});
test('数值排序不使用字符串顺序，缺失数值始终在后；别名可搜索',()=>{
  const rows=[entry('a',{stats:{attack:80}}),entry('b',{stats:{attack:200},aliases:['Furina']}),entry('c')];
  assert.deepEqual(selectEntries(rows,{sort:'attack'}).map(e=>e.id),['b','a','c']);
  assert.deepEqual(selectEntries(rows,{sort:'attack',direction:'asc'}).map(e=>e.id),['a','b','c']);
  assert.deepEqual(selectEntries(rows,{search:'furina'}).map(e=>e.id),['b']);
});
test('拒绝不存在的日期与不合法来源',()=>{
  assert.throws(()=>validateEntry(entry('a',{releaseDate:'2026-02-30'})),/日期/);
  assert.throws(()=>validateEntry(entry('a',{sources:[{url:'javascript:alert(1)'}]})),/来源/);
  assert.equal(validateEntry(entry('a',{releaseDate:'2024-02-29'})).id,'a');
  assert.throws(()=>validateEntry(entry('a',{details:{skills:'错误格式'}})),/须为数组/);
});
test('三款游戏分别筛选两件套、四件套效果，摘要和完整条目结果一致',()=>{
 for(const game of ['genshin','starrail','zenless']){
  const rows=[entry('two',{game,category:'sets',details:{effects:[{name:'2 件套',description:'暴击率提高8%。'},{name:'4 件套',description:'攻击力提高20%。'}]}}),entry('four',{game,category:'sets',details:{effects:[{name:'2 件套',description:'速度提高6%。'},{name:'4 件套',description:'暴击率提高18%。'}]}})];
  const query={game,category:'sets',filters:{effect2:['暴击率']}};
  assert.deepEqual(selectEntries(rows,query).map(e=>e.id),['two']);assert.deepEqual(selectEntries(rows.map(summarizeEntry),query).map(e=>e.id),['two']);
  assert.deepEqual(selectEntries(rows,{...query,filters:{effect4:['暴击率']}}).map(e=>e.id),['four']);assert.equal(selectEntries(rows,{...query,filters:{effect2:['暴击率'],effect4:['暴击率']}}).length,0);
  assert.deepEqual(buildFacets(rows,{game,category:'sets'}).filter(f=>f.key.startsWith('effect')).map(f=>f.label),['2 件套效果','4 件套效果']);
 }
});
