import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artifactFilters,filterArtifacts,weaponBaseStats,sortWeapons} from '../modules/character-assessment/core/inventory.mjs';
const data=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url)));
const catalog={sets:{GladiatorsFinale:{name:'角斗士的终幕礼',aliases:['角斗士']},NoblesseOblige:{name:'昔日宗室之仪'}},weapons:{FavoniusSword:{name:'西风剑',rarity:4}}};
const artifact=(level,substats,extras={})=>({setKey:'GladiatorsFinale',slotKey:'goblet',rarity:5,level,mainStatKey:'hydro_dmg_',substats,location:'',lock:false,...extras});
const items=[artifact(20,[{key:'critRate_',value:10.5},{key:'critDMG_',value:21}]),artifact(4,[{key:'critRate_',value:3.9},{key:'eleMas',value:23}],{location:'Furina',lock:true}),artifact(20,[{key:'critDMG_',value:14},{key:'enerRech_',value:5.2}],{setKey:'NoblesseOblige'})];
const filter=(f={})=>filterArtifacts(items,catalog,data,{...artifactFilters(),...f},{critRate_:1,critDMG_:1},'Furina');
test('圣遗物组合筛选：主属性、副属性全部/任一、各自门槛与装备锁定',()=>{
  assert.deepEqual(filter({main:'hydro_dmg_',subs:['critRate_','critDMG_'],subMin:{critRate_:10}}).map(x=>x.i),[0]);
  assert.deepEqual(filter({subs:['critRate_','critDMG_'],subMode:'any',subMin:{critRate_:10,critDMG_:15}}).map(x=>x.i),[0]);
  assert.deepEqual(filter({subs:['critRate_','critDMG_'],subMode:'any',subMin:{critRate_:3,critDMG_:15}}).map(x=>x.i),[0,1]);
  assert.deepEqual(filter({status:'current',lock:'locked',maxLevel:4}).map(x=>x.i),[1]);
  assert.equal(filter({main:'atk_'}).length,0);assert.equal(filter({minLevel:20,maxLevel:4}).length,0);
  assert.equal(filter({search:'角斗士',status:'free',minCV:40,minEffective:6}).length,1);
  assert.equal(filter({minEffective:8}).length,0);
});
test('排序保留原始库存索引，双暴及单属性排序不改变实际装备',()=>{
  const before=structuredClone(items);
  assert.deepEqual(filter({sort:'cv'}).map(x=>x.i),[0,2,1]);
  assert.deepEqual(filter({sort:'sub:critRate_'}).map(x=>x.i),[0,1,2]);
  assert.deepEqual(filter({sort:'level-desc'}).map(x=>x.i),[0,2,1]);
  assert.deepEqual(items,before);
});
test('武器展示使用当前等级与突破的数值，排序保留副本索引',()=>{
  const high={key:'FavoniusSword',level:90,ascension:6,refinement:1},low={...high,level:1,ascension:0};
  const stats=weaponBaseStats(high,data);assert.equal(Math.round(stats.atk),454);assert.equal(stats.enerRech_.toFixed(1),'61.3');
  assert.equal(Math.round(weaponBaseStats(low,data).atk),41);
  assert.deepEqual(sortWeapons([{item:low,i:0},{item:high,i:1}],catalog,data,'atk').map(x=>x.i),[1,0]);
  assert.equal(weaponBaseStats({...high,key:'NotSupported'},data),null);
});
