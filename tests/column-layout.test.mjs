import test from 'node:test';
import assert from 'node:assert/strict';
import {preferredColumns,normalizeColumnSetting} from '../shared/column-layout.mjs';
import {rarityLabel} from '../shared/catalog.mjs';

test('全屏达到各板块目标列数，缩窄窗口时按卡片空间逐步减少',()=>{
 for(const [base,minCell] of [[5,190],[4,260],[3,260]]){
  const policy={base,minCell,reference:1370};
  assert.equal(preferredColumns(1370,policy),base);
  let previous=6;
  for(const width of [1370,1100,850,600,350]){
   const n=preferredColumns(width,policy);
   assert(n<=previous&&n>=1);previous=n;
   assert(n===1||n*minCell+(n-1)*14<=width);
  }
 }
 assert.equal(preferredColumns(1100,{base:4,reference:1100,max:4}),4);
 assert.equal(preferredColumns(320,{base:4,reference:1100,max:4}),1);
});

test('手动选择直接生效，缩窄窗口不被自动最小卡宽改写',()=>{
 const policy={base:5,reference:1370,preferred:'3'};
 assert.equal(preferredColumns(1370,policy),3);
 assert.equal(preferredColumns(350,policy),3);
 assert.equal(preferredColumns(1370,policy),3);
 assert.equal(preferredColumns(1370,{...policy,preferred:'auto'}),5);
 for(const count of [1,2,3,4,5,6])assert.equal(preferredColumns(850,{base:4,reference:1370,minCell:260,preferred:String(count)}),count);
 assert.equal(preferredColumns(320,{...policy,preferred:'auto'}),1);
 assert.equal(normalizeColumnSetting('"4"'),'4');assert.equal(normalizeColumnSetting('"auto"'),'auto');assert.equal(normalizeColumnSetting('invalid'),'auto');
});

test('绝区零绿色材料显示C级，其他游戏星级与S/A/B不变',()=>{
 assert.equal(rarityLabel({game:'zenless',category:'materials',rarity:2}),'C 级');
 assert.deepEqual([5,4,3].map(rarity=>rarityLabel({game:'zenless',rarity})),['S 级','A 级','B 级']);
 assert.equal(rarityLabel({game:'genshin',rarity:2}),'2 星');
});
