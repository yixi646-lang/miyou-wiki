import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SLOTS,defaultGoal} from '../modules/character-assessment/core/model.mjs';
import {equipmentAssignment,optimizerArtifactChanges,sortOptimizerResults} from '../modules/character-assessment/core/optimizer.mjs';
import {optimizerArtifactChangesHTML,optimizerArtifactComparisonHTML} from '../modules/character-assessment/analysis-dialog.mjs';

const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));
const character=key=>({key,level:90,ascension:6,constellation:0,talent:{auto:6,skill:10,burst:10}});
const artifact=(slot,location)=>({slotKey:slot,setKey:'GoldenTroupe',location,rarity:5,level:20,mainStatKey:{flower:'hp',plume:'atk',sands:'hp_',goblet:'hydro_dmg_',circlet:'critRate_'}[slot],substats:[{key:'critDMG_',value:7.8},{key:'enerRech_',value:5.2}],lock:false});
const fixture=()=>({format:'GOOD',version:3,characters:[character('Furina'),character('Jean')],weapons:[{key:'FavoniusSword',level:90,ascension:6,refinement:5,location:'Furina',lock:true}],artifacts:['Furina','Jean'].flatMap(key=>SLOTS.map(slot=>artifact(slot,key)))});
const goals={Furina:defaultGoal('hp','hydro'),Jean:defaultGoal('healer','anemo')};
const count=(text,pattern)=>(text.match(pattern)??[]).length;
const comparison=html=>html.slice(0,html.indexOf('<section class="ae-opt-full-analysis"'));

test('少换件仅排序允许指标差距内的方案，借用计入实际归属，保留原索引与输入',()=>{
 const good=fixture();good.artifacts.push(...SLOTS.map(slot=>artifact(slot,'')));
 const initial=equipmentAssignment(good,['Furina','Jean']);
 const make=(score,slots,borrow=false)=>{const assignment=structuredClone(initial);for(const slot of slots)assignment.Furina.artifacts[slot]=(borrow?5:10)+SLOTS.indexOf(slot);if(borrow)assignment.Jean.artifacts.flower=-1;return {score,assignment};};
 const results=[make(100,SLOTS.slice(0,4)),make(99.7,['flower'],true),make(99.5,['flower']),make(98,[])],snapshot=structuredClone({good,results});
 const rows=sortOptimizerResults(results,good,{mode:'changes',tolerance:1,keys:['Furina']});
 assert.deepEqual(rows.map(r=>r.index),[2,1,0,3]);assert.deepEqual(rows.map(r=>[r.changed,r.borrowed]),[[1,0],[1,1],[4,0],[0,0]]);assert.equal(rows.at(-1).withinTolerance,false);
 assert.deepEqual(sortOptimizerResults(results,good,{mode:'changes',tolerance:0,keys:['Furina']}).map(r=>r.index),[0,1,2,3]);
 assert.deepEqual(sortOptimizerResults(results,good,{mode:'changes',tolerance:2,keys:['Furina']}).map(r=>r.index),[3,2,1,0]);
 assert.deepEqual(sortOptimizerResults(results,good).map(r=>r.index),[0,1,2,3]);assert.deepEqual({good,results},snapshot);assert.equal(rows[0].candidate,results[2]);
 assert.equal(sortOptimizerResults([results[1]],good,{keys:['Furina','Jean']})[0].changed,2);
});

test('少换件兼容负数、零基准及旅行者共用装备，不按相同数值合并实物',()=>{
 const good=fixture();good.artifacts=SLOTS.map(slot=>artifact(slot,'Traveler'));good.artifacts.push({...good.artifacts[0],location:''});
 const original=equipmentAssignment(good,['TravelerCryoM']),changed=structuredClone(original);changed.TravelerCryoM.artifacts.flower=5;
 const results=[{score:-100,assignment:changed},{score:-100.5,assignment:original}];
 assert.deepEqual(sortOptimizerResults(results,good,{mode:'changes',tolerance:1}).map(r=>r.index),[1,0]);
 const zero=sortOptimizerResults(results.map((r,i)=>({...r,score:i?-0.01:0})),good,{mode:'changes',tolerance:100});assert.deepEqual(zero.map(r=>r.index),[0,1]);assert.equal(zero[0].borrowed,0);assert.equal(zero[0].changed,1);
});

test('库存同套装更换按原件识别，前面仅对比更换部位，后面保留完整分析与实际归属',()=>{
 const good=fixture();good.artifacts.push({...artifact('flower',''),substats:[{key:'critRate_',value:11.7},{key:'critDMG_',value:15.6}]});
 const original=structuredClone(good),assignment=equipmentAssignment(good,['Furina','Jean']);assignment.Furina.artifacts.flower=10;
 const changes=optimizerArtifactChanges(good,assignment,'Furina');assert.equal(changes.length,1);assert.equal(changes[0].slot,'flower');assert.equal(changes[0].beforeIndex,0);assert.equal(changes[0].afterIndex,10);assert.equal(optimizerArtifactChanges(good,assignment,'Jean').length,0);
 const list=optimizerArtifactChangesHTML({good,assignment,key:'Furina',catalog,data});assert.match(list,/原装备：/);assert.match(list,/推荐装备：/);assert.match(list,/当前未装备（库存）/);assert.match(list,/暴击率 11\.7%/);assert(!list.includes('没有从其他角色移交装备'));
 const html=optimizerArtifactComparisonHTML({good,assignment,key:'Furina',goals,catalog,data}),front=comparison(html);
 assert.equal(count(front,/data-opt-comparison-part=/g),1);assert.match(front,/data-opt-comparison-part="Furina-flower"/);assert(!front.includes('data-opt-comparison-part="Furina-plume"'));
 const after=front.slice(front.indexOf('<div data-opt-comparison-after>'));assert.match(after,/当前未装备（库存）/);
 assert.equal(count(html,/data-analysis-part=/g),5);assert.equal(new Set([...html.matchAll(/data-analysis-part="([^"]+)"/g)].map(m=>m[1])).size,5);assert(!html.includes('data-opt-full-member="Jean"'));
 assert(html.indexOf('data-opt-artifact-comparisons')<html.indexOf('data-opt-full-analysis'));assert.match(html,/实际次数/);assert.match(html,/档位组合/);assert.match(front,/有效副词条加权评分/);assert.match(front,/有效副词条总量/);
 assert.match(front,/class="ae-opt-piece-comparison"/);assert.match(front,/data-opt-comparison-metrics/);
 assert(front.indexOf('data-opt-comparison-after')<front.indexOf('data-opt-comparison-metrics'));
 assert.equal(count(front,/ae-comparison-compact/g),2);assert(!front.includes('class="ae-item-metrics"'));
 assert.deepEqual(good,original);
});

test('只展示计算角色，借用圣遗物仍标注实际归属，移交队友不重复分析',()=>{
 const good=fixture(),original=structuredClone(good),assignment=equipmentAssignment(good,['Furina','Jean']);assignment.Furina.artifacts.flower=5;assignment.Jean.artifacts.flower=-1;
 const html=optimizerArtifactComparisonHTML({good,assignment,key:'Furina',goals,catalog,data}),front=comparison(html);
 assert.equal(count(front,/data-opt-comparison-part=/g),1);assert(!front.includes('data-opt-comparison-part="Jean-flower"'));assert.match(front,/当前装备：琴/);assert(!html.includes('data-opt-full-member="Jean"'));
 const list=optimizerArtifactChangesHTML({good,assignment,key:'Furina',catalog,data});assert.match(list,/当前装备：琴，将移交给此角色/);
 assert.equal(count(html,/data-analysis-part=/g),5);assert.deepEqual(good,original);
});

test('未更换时不生成重复对比，完整分析和未改变的五个部位仍可查看',()=>{
 const good=fixture(),assignment=equipmentAssignment(good,['Furina','Jean']);
 const html=optimizerArtifactComparisonHTML({good,assignment,key:'Furina',goals,catalog,data});assert.equal(count(comparison(html),/data-opt-comparison-part=/g),0);assert.match(html,/本方案未更换圣遗物，无需对比/);assert.equal(count(html,/data-analysis-part=/g),5);
 assert.match(optimizerArtifactChangesHTML({good,assignment,key:'Furina',catalog,data}),/圣遗物未更换/);
});

test('旅行者共用装备位置，同数值的另一件圣遗物也按实物识别为更换',()=>{
 const good=fixture();good.characters=[character('TravelerCryoM')];good.weapons[0].location='Traveler';good.artifacts=SLOTS.map(slot=>artifact(slot,'Traveler'));good.artifacts.push({...structuredClone(good.artifacts[0]),location:''});
 const assignment=equipmentAssignment(good,['TravelerCryoM']);assert.equal(optimizerArtifactChanges(good,assignment,'TravelerCryoM').length,0);assignment.TravelerCryoM.artifacts.flower=5;
 const changes=optimizerArtifactChanges(good,assignment,'TravelerCryoM');assert.equal(changes.length,1);assert.equal(changes[0].beforeIndex,0);assert.equal(changes[0].afterIndex,5);
 const html=optimizerArtifactComparisonHTML({good,assignment,key:'TravelerCryoM',goals:{TravelerCryoM:defaultGoal('attack','cryo')},catalog,data});assert.equal(count(comparison(html),/data-opt-comparison-part=/g),1);assert.match(comparison(html),/>不变</);assert.equal(count(html,/data-analysis-part=/g),5);
});

test('圣遗物分析跟随推荐范围：单人仅显示当前角色，全队显示全部成员及各自更换部位',()=>{
 const good=fixture(),original=structuredClone(good),assignment=equipmentAssignment(good,['Furina','Jean']);
 good.artifacts.push(artifact('flower',''),artifact('plume',''));assignment.Furina.artifacts.flower=10;assignment.Jean.artifacts.plume=11;
 const single=optimizerArtifactComparisonHTML({good,assignment,key:'Furina',scope:'single',goals,catalog,data});
 assert.equal(count(single,/data-analysis-part=/g),5);assert.equal(count(comparison(single),/data-opt-comparison-part=/g),1);assert(!single.includes('data-opt-full-member="Jean"'));
 const team=optimizerArtifactComparisonHTML({good,assignment,key:'Furina',scope:'team',goals,catalog,data});
 assert.equal(count(team,/data-analysis-part=/g),10);assert.equal(count(comparison(team),/data-opt-comparison-part=/g),2);assert.match(team,/data-opt-comparison-part="Jean-plume"/);
 assert.match(team,/data-opt-full-member="Furina"/);assert.match(team,/data-opt-full-member="Jean"/);assert.equal(new Set([...team.matchAll(/data-analysis-part="([^"]+)"/g)].map(m=>m[1])).size,10);
 assert.deepEqual(good.artifacts.slice(0,10),original.artifacts);
});
