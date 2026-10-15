import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDamageRow} from '../modules/character-assessment/core/combat.mjs';
const core=new URL('../modules/character-assessment/core/',import.meta.url);
const engine=await import(process.env.WIKI_STAGED_CORE?pathToFileURL(join(process.env.WIKI_STAGED_CORE,'calculator.mjs')):new URL('calculator.mjs',core));
const baseline=process.env.WIKI_STAGED_CORE?await import(new URL('calculator.mjs',core)):null;
const catalog=JSON.parse(readFileSync(new URL('catalog.json',core)));
const character=key=>({key,level:90,ascension:6,constellation:6,talent:{auto:9,skill:9,burst:9}});
const sample=key=>({format:'GOOD',version:3,characters:[character(key)],weapons:[],artifacts:[]});
const numeric=r=>({panel:r.panel,rows:r.rows.map(({path,group,unit,variant,hit,crit,average})=>({path,group,unit,variant,hit,crit,average}))});
const write=(obj,path,value)=>{for(const k of path.slice(0,-1))obj=obj[k]??={};obj[path.at(-1)]=value;};

test('所有角色强化天赋与固有天赋输出分类，公式数值不变，护盾和增加量不会混为伤害',()=>{
 let enhanced=0;const found=new Set(),wrapped={Mona:'passive1.dmg',Yanfei:'passive2.probabilistic_dmg',Eula:'passive1.shatteredLightfallSword',Sayu:'passive2.extraHeal'};
 for(const key of Object.keys(catalog.characters)){
  const good=sample(key),settings={conditional:{}};
  for(const c of engine.inspectMechanicDocuments(good,key).conditions.filter(c=>c.owner===key))write(settings.conditional,c.path,c.options.at(-1)?.value??'');
  for(const scenario of [{},settings]){
   const result=engine.calculateBuild(good,key,scenario);
   if(scenario===settings&&wrapped[key]){const row=result.rows.find(r=>r.path===wrapped[key]);assert(row,key);assert(isDamageRow(row),key+' 包裹倍率的结果');}
   if(baseline)assert.deepEqual(numeric(result),numeric(baseline.calculateBuild(good,key,scenario)),key);
   for(const row of result.rows){
    if(row.group==='lockedPassive'&&row.resultType==='damage'){enhanced++;assert(isDamageRow(row),key);found.add(key);}
    if(row.resultType==='shield')assert(!isDamageRow(row),key+' '+row.path);
    if(/(?:dmgInc|healInc)/i.test(row.path)&&!row.resultType&&row.group.startsWith('passive'))assert(!isDamageRow(row),key+' '+row.path);
   }
  }
 }
 assert(enhanced>20);assert(found.has('YaeMiko'));assert(found.has('YumemizukiMizuki'));assert(found.has('TravelerCryoF'));
});

test('八重强化输出进入伤害类别，凝雪沉心精二随队伍自动计算，保留真实增益字段',()=>{
 const good=sample('Sandrone');good.characters.push(character('YaeMiko'),character('Odette'),character('Nicole'));
 good.characters.find(c=>c.key==='YaeMiko').constellation=1;
 good.weapons=[{key:'WintersHeavyHeart',level:90,ascension:6,refinement:2,location:'YaeMiko',lock:false}];
 const settings={members:['Sandrone','Odette','Nicole'],active:'Sandrone',conditional:{YaeMiko:{lockRevelation:'on',lockStellarRadianceSc:'on'}},characters:{Sandrone:{conditional:{Sandrone:{a0StellarRadianceSc:'on'}}}}};
 const result=engine.calculateBuild(good,'YaeMiko',settings);
 for(const path of ['lockedPassive.dmg1','lockedPassive.dmg2','lockedPassive.dmg3','lockedPassive.dmg']){const row=result.rows.find(r=>r.path===path);assert(row,path);assert(isDamageRow(row),path);}
 const fields=result.conditions.flatMap(c=>c.currentFields??[]);assert(fields.some(f=>f.resultType==='damage'));
 const weapon=result.effects.find(e=>e.source==='武器效果'&&e.owner==='YaeMiko');assert(weapon);assert(!result.conditions.some(c=>c.owner==='YaeMiko'&&c.source==='武器效果'));
 assert.equal(weapon.fields.find(f=>f.statKey==='eleMas').value,75);
 assert(Math.abs(weapon.fields.find(f=>f.statKey==='stellarconduct_dmg_').value-22.5)<1e-9);
 const off=engine.calculateBuild(good,'YaeMiko',{members:['Sandrone','Odette','Nicole'],active:'Sandrone'});
 assert.notDeepEqual(off.effects.find(e=>e.source==='武器效果'&&e.owner==='YaeMiko').fields,weapon.fields);
 if(baseline)assert.deepEqual(numeric(result),numeric(baseline.calculateBuild(good,'YaeMiko',settings)));
});
