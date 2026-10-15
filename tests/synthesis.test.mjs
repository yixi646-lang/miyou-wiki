import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSynthesis} from '../shared/synthesis.mjs';
import {groupMaterialCosts,plannerPicker} from '../shared/planner-view.mjs';
import {readFileSync} from 'node:fs';
const recipes={mid:{id:'mid',outputCount:1,inputs:[{id:'low',count:3}],currency:{id:'money',count:100}},high:{id:'high',outputCount:1,inputs:[{id:'mid',count:3}],currency:{id:'money',count:300}}};
test('预留直接需求后连续合成，加入费用，库存只扣一次且不改写用户数量',()=>{
 const costs=[{id:'low',count:4},{id:'mid',count:2},{id:'high',count:3},{id:'money',count:1000}],inventory={low:37,mid:0,high:1,money:2000},before=structuredClone(inventory);
 const result=calculateSynthesis(costs,inventory,recipes),map=new Map(result.costs.map(i=>[i.id,i]));
 assert.equal(map.get('high').crafted,2);assert.equal(map.get('mid').crafted,8);assert.equal(map.get('low').spent,24);for(const id of ['low','mid','high'])assert.equal(map.get(id).missing,0);
 assert.equal(map.get('money').fee,1400);assert.equal(map.get('money').count,2400);assert.equal(map.get('money').missing,400);assert.deepEqual(inventory,before);
});
test('不能为了合成高阶材料挪用低阶自身需求，整除余数不会虚增产出',()=>{
 const result=calculateSynthesis([{id:'low',count:4},{id:'mid',count:2},{id:'high',count:3}],{low:12,mid:0,high:0},recipes),map=new Map(result.costs.map(i=>[i.id,i]));assert.equal(map.get('mid').crafted,2);assert.equal(map.get('mid').missing,0);assert.equal(map.get('high').crafted,0);assert.equal(map.get('high').missing,3);assert.equal(map.get('low').spent,6);
});
test('当前范围不需要低阶材料时仍列出合成原料；关闭合成恢复直接缺口',()=>{
 const result=calculateSynthesis([{id:'high',count:2}],{low:18},recipes),map=new Map(result.costs.map(i=>[i.id,i]));assert.equal(map.get('high').missing,0);assert.equal(map.get('low').auxiliary,true);assert.equal(map.get('mid').crafted,6);assert.equal(map.get('low').spent,18);
 const off=calculateSynthesis([{id:'high',count:2}],{low:18},recipes,false);assert.equal(off.costs.length,1);assert.equal(off.costs[0].missing,2);assert.equal(off.steps.length,0);
});
test('重复开关和重算不会累加消耗；循环配方被拒绝',()=>{
 const costs=[{id:'high',count:2}],inventory={low:18};assert.deepEqual(calculateSynthesis(costs,inventory,recipes),calculateSynthesis(costs,inventory,recipes));
 assert.throws(()=>calculateSynthesis([{id:'a',count:1}],{}, {a:{outputCount:1,inputs:[{id:'b',count:3}]},b:{outputCount:1,inputs:[{id:'a',count:3}]}}),/循环/);
});
test('三款游戏的已保存配方均可计算，并包含正确的本地材料关联',()=>{
 for(const game of ['genshin','starrail','zenless']){const data=JSON.parse(readFileSync(`data/growth/${game}.json`,'utf8'));assert(Object.keys(data.recipes).length>0);const recipe=Object.values(data.recipes)[0],input=recipe.inputs[0];assert(data.materials[recipe.id]);assert(data.materials[input.id]);const result=calculateSynthesis([{id:recipe.id,count:2}],{[input.id]:input.count*2},data.recipes);assert.equal(result.costs.find(i=>i.id===recipe.id).missing,0);assert.equal(result.steps.find(s=>s.id===recipe.id).output,2);}
});
test('材料分组不复制共同材料；角色筛选与装备筛选遵循各自属性',()=>{
 const grouped=groupMaterialCosts([{id:'money',count:10},{id:'shared',count:3},{id:'book',count:1}],{shared:{purposes:['角色突破','装备突破']},book:{purposes:['等级经验']}},{p:{currencyId:'money'}});assert.equal(grouped.flatMap(g=>g.items).length,3);assert.equal(grouped.find(g=>g.label==='通用养成材料').items[0].id,'shared');
 const profiles={a:{id:'a',entryId:'a',category:'characters',name:'水角色',element:'水',type:'单手剑',rarity:5},b:{id:'b',entryId:'b',category:'weapons',name:'武器',type:'弓',rarity:4}};
 assert.deepEqual(plannerPicker(profiles,new Map(),'genshin','characters','',{element:['水'],rarity:['5']}).items.map(i=>i.id),['a']);assert.equal(plannerPicker(profiles,new Map(),'genshin','weapons','',{type:['单手剑']}).items.length,0);
});
