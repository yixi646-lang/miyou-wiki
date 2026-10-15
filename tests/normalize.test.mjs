import test from'node:test';
import assert from'node:assert/strict';
import{genshinTalentLevels,normalizeDate,hsrDescription}from'../lib/normalize.mjs';
test('技能数值按等级转换，百分比、整数与固定小数分别处理',()=>{
  const levels=genshinTalentLevels({description:'技能介绍',attributes:{labels:['伤害|{param1:F1P}','冷却|{param2:F1}秒','治疗|{param3:I}']}},{param1:[0.2,0.24],param2:[10,9],param3:[100,130]});
  assert.equal(levels[1].specs[0].value,'24.0%');assert.equal(levels[1].specs[1].value,'9.0秒');assert.equal(levels[0].specs[2].value,'100');
});
test('实装日期解析与技能参数换算',()=>{assert.equal(normalizeDate('2024年07月04日'),'2024-07-04');assert.equal(hsrDescription('造成#1[i]%伤害并增加#2[f1]点速度',[0.35,5]),'造成35%伤害并增加5点速度');});
