import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {detailEntry,TRAVELER_ELEMENTS} from '../shared/traveler.mjs';
import {elementIcon,rarityClass} from '../shared/appearance.mjs';
import {calculateSynthesis} from '../shared/synthesis.mjs';
const root=new URL('../',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const gi=read('data/catalog/genshin.json').entries;
test('空荧七元素在同一条目切换，默认冰，不改写基础编号或原始条目',()=>{
 for(const id of ['genshin-characters-10000005','genshin-characters-10000007']){const e=gi.find(e=>e.id===id);assert.equal(e.element,'冰');assert.deepEqual(Object.keys(e.details.traveler.elements),TRAVELER_ELEMENTS);assert.equal(detailEntry(e).element,'冰');for(const element of TRAVELER_ELEMENTS){const view=detailEntry(e,element);assert.equal(view.id,id);assert.equal(view.element,element);assert.ok(view.details.skills[0].levels[0].specs.length);assert.equal(view.details.upgrades.length,6);}assert.equal(e.details.skills.length,0);}
 assert.equal(gi.filter(e=>e.category==='characters'&&/^[空荧]$/.test(e.name)).length,2);
 assert.equal(detailEntry(gi.find(e=>e.id==='genshin-characters-10000005'),'非法').element,'冰');
});
test('零费用配方可正常合成，保留其他芯片收费且不生成零货币需求',()=>{
 const growth=read('data/growth/zenless.json'),zero=Object.values(growth.recipes).filter(r=>r.feeStatus==='user-default');assert.equal(zero.length,24);
 for(const r of zero){assert.equal(r.currency.id,'zenless-materials-10');assert.equal(r.currency.count,0);assert.equal(r.inputs[0].count,3);}
 const r=zero[0],result=calculateSynthesis([{id:r.id,count:2}],{[r.inputs[0].id]:6},growth.recipes);assert.equal(result.costs.find(c=>c.id===r.id).missing,0);assert.equal(result.steps[0].currency.count,0);assert.deepEqual(result.fees,[]);assert.ok(Object.values(growth.recipes).some(r=>r.currency?.count>0));
});
test('原清单25日期有来源，全部角色元素图标存在且星级分类可区分',()=>{
 const z=read('data/catalog/zenless.json').entries,s=read('data/catalog/starrail.json').entries,all=[...gi,...z,...s],facts=read('data/sources/release-date-research-2026-10-03.json').groups;
 assert.equal(facts.flatMap(g=>g.ids).length,25);for(const group of facts)for(const id of group.ids){const e=all.find(e=>e.id===id);assert.equal(e.releaseDate,group.date);assert.equal(e.releaseVersion,group.version);assert.ok(e.releaseDateBasis);}
 for(const e of all.filter(e=>e.category==='characters')){const icon=elementIcon(e);assert.ok(icon,e.name+'缺少属性图标');assert.ok(existsSync(fileURLToPath(new URL('.'+icon,root))),icon);}
 assert.equal(new Set([1,2,3,4,5].map(rarity=>rarityClass({rarity}))).size,5);
});
