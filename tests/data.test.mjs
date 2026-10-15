import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat}from'node:fs/promises';
import{validateEntry}from'../shared/catalog.mjs';
const root=new URL('../',import.meta.url);
const entries=[];for(const file of await readdir(new URL('data/catalog/',root))){if(file.endsWith('.json'))entries.push(...JSON.parse(await readFile(new URL('data/catalog/'+file,root),'utf8')).entries);}
test('全部资料有效且编号唯一，专武关系只指向同游戏角色',()=>{
  const index=new Map(entries.map(e=>[e.id,e]));assert.equal(index.size,entries.length);
  for(const entry of entries){validateEntry(entry);for(const id of entry.signatureIds??[]){const character=index.get(id);assert.equal(character?.category,'characters',entry.name);assert.equal(character?.game,entry.game,entry.name);}assert(!entry.releaseDate||entry.releaseDate<='2026-10-03');}
});
test('已保存的图片位于工作区，所有养成材料能关联到资料条目',async()=>{
  const ids=new Set(entries.map(e=>e.id));for(const entry of entries){if(entry.image){assert.match(entry.image,/^\/assets\/[a-z0-9_/-]+\.(png|webp)$/i);assert((await stat(new URL(entry.image.slice(1),root))).size>20);}for(const group of entry.details?.materials??[])for(const item of group.items)assert(ids.has(item.id),`${entry.name} → ${item.name}`);}
});
test('角色、武器完整记录获取渠道；卡池版本、日期与跨条目关系有效',()=>{
  const index=new Map(entries.map(e=>[e.id,e]));
  for(const entry of entries){
    if(['characters','weapons'].includes(entry.category))assert(entry.details.acquisition?.every(t=>typeof t==='string'&&t.trim())&&entry.details.acquisition.length,entry.name);
    if(['characters','weapons','sets'].includes(entry.category))assert(entry.releaseVersion,entry.name);
    if(entry.category==='banners'){assert(entry.releaseVersion);assert(entry.banner.start.slice(0,10)===entry.releaseDate);assert(!entry.banner.end||entry.banner.end>=entry.banner.start);for(const group of entry.banner.groups)for(const item of group.items)if(item.id)assert.equal(index.get(item.id)?.game,entry.game);if(entry.game==='starrail')assert(entry.releaseDate>='2023-04-26');}
    if(entry.game==='zenless'&&entry.category==='weapons'){assert(Number.isFinite(entry.stats.secondaryValue));if(entry.secondary.includes('异常精通'))assert(entry.stats.secondaryValue>=60,entry.name);if(entry.name==='雨林饕客')assert.equal(entry.stats.secondaryValue,75);if(entry.type==='锋御'){assert(Number.isFinite(entry.stats.defense));assert.equal(entry.stats.attack,undefined);}}
  }
});
