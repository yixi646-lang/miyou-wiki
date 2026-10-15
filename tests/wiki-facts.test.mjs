import test from 'node:test';
import assert from 'node:assert/strict';
import{parameters,template,wikiSection,sourceVersion,factKey,poolFields,normalizeBannerTime}from'../lib/wiki-facts.mjs';
test('多行获取字段和小节不会截断；来源模板只提取事实',()=>{
  const text='{{Agent Infobox\n|id = 1\n|obtain =\n* 常驻\n* 商店\n|type = A\n}}\n==Availability==\n===Featured===\n* 活动奖励\n==Gallery==\n正文';
  assert.equal(parameters(template(text,'Agent Infobox')).obtain,'* 常驻\n* 商店');
  assert(wikiSection(text,'Availability').includes('活动奖励'));assert(!wikiSection(text,'Availability').includes('正文'));
  assert.equal(sourceVersion('{{Change History|Luna VIII}}'),'6.7');assert.equal(sourceVersion('{{Change History|3.2}}'),'3.2');
  assert.equal(factKey('Topaz & Numby'),factKey('Topaz and Numby'));
  assert.equal(poolFields('[[Lightrace Wish]]\n** 5-Star Characters: [[A]]/[[B]]','genshin').character_5,'A;B');
  assert.equal(normalizeBannerTime('2024/07/04 10:00:00'),'2024-07-04 10:00:00');assert.equal(normalizeBannerTime('2025-09-4 11:00:00'),'2025-09-04 11:00:00');assert.equal(normalizeBannerTime('2025-02-30 10:00:00'),null);
});
