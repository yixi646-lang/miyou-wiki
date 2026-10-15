import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachSkillTerms,resolveTermMarkup,resolveGenshinExplanation,skillExplanations,skillDescriptionHTML,normalizeSkillTerm} from '../shared/skill-terms.mjs';
import {summarizeEntry,selectEntries,buildFacets} from '../shared/catalog.mjs';
import {applyWeaponChannelIndex} from '../shared/acquisition-channels.mjs';

test('编号术语恢复名称，未知编号保留缺口而不吞掉文字',()=>{
  const nouns={36:{name:'[猩红铭刻]'}};
  assert.equal(resolveTermMarkup('处于<Term:36></Term>下',nouns),'处于[猩红铭刻]下');
  assert.equal(resolveTermMarkup('<Term:36>已编辑名称</Term>',nouns),'已编辑名称');
  assert.match(resolveTermMarkup('<Term:99></Term>',nouns),/99.*待补充/);
});

test('过滤空白、无解释及旧条目残留项，同时保留正常的用户注释',()=>{
  const invalid=[null,{},...['','  ','\u200b','[]','「　」','** **'].map(name=>({name,description:'不应匹配全部技能'})),{name:'无内容',description:' \u200b '},{name:'无字段'}];
  for(const term of invalid)assert.equal(normalizeSkillTerm(term),null);
  const original={id:'legacy',game:'zenless',category:'characters',details:{skills:[{name:'普通攻击',description:'造成物理伤害',terms:[...invalid,{name:'用户注释',description:'用户保留的具体说明'}]},{name:'额外能力',description:'进入[残锋]状态'}],upgrades:[]}};
  const index={common:{zenless:[...invalid,{name:'残锋',description:'残锋下锐暴伤害提升'}]}};
  const annotated=attachSkillTerms(original,index);
  assert.deepEqual(annotated.details.skills[0].terms,[{name:'用户注释',description:'用户保留的具体说明'}]);
  assert.equal(annotated.details.skills[0].description,original.details.skills[0].description);
  assert.ok(annotated.details.skills[1].terms.some(t=>t.name==='残锋'));
  assert.deepEqual(skillExplanations(original.details.skills,original.details.skills[0]).map(t=>t.name),['用户注释']);
  assert.equal(skillDescriptionHTML('无效项不产生按钮',invalid,value=>value),'无效项不产生按钮');
  assert.equal(original.details.skills[0].terms.length,invalid.length+1,'原条目保持不变');
});

test('绝区零全部角色的技能和影画不含空白或重复名词，残锋仅关联实际引用',()=>{
  const index=JSON.parse(readFileSync(new URL('../shared/skill-term-data.json',import.meta.url)));
  const nouns=JSON.parse(readFileSync(new URL('../data/sources/zenless/skill-term-index-3.2.json',import.meta.url)));
  const residual=Object.values(nouns).find(noun=>noun.name==='[残锋]');
  assert.equal(residual.title,'');assert.ok(index.common.zenless.some(t=>t.name==='残锋'));
  const roles=JSON.parse(readFileSync(new URL('../data/catalog/zenless.json',import.meta.url))).entries.filter(e=>e.category==='characters');
  assert.ok(roles.length);
  let linked=0;
  for(const original of roles){
    const entry=attachSkillTerms(original,index),context=[...entry.details.skills,...entry.details.upgrades];
    for(const skill of context){
      const terms=skillExplanations(context,skill,skill.levels?.at(-1)?.level),label=entry.name+'/'+skill.name;
      assert.ok(terms.every(t=>normalizeSkillTerm(t)),label);
      assert.equal(new Set(terms.map(t=>t.name)).size,terms.length,label);
      const body=[skill.description,...(skill.levels??[]).map(row=>row.description)].join('\n');
      if(!body.includes('残锋'))assert.ok(!terms.some(t=>t.name==='残锋'),label);
      else{assert.ok(terms.some(t=>t.name==='残锋'),label);linked++;}
      assert.ok((skill.terms??[]).every(t=>normalizeSkillTerm(t)),label);
    }
  }
  assert.ok(linked,'保留引用残锋的实际技能说明');
});

test('跨技能解释取对应等级且不引用其他角色的同名机制',()=>{
  const skills=[{name:'来源技能',description:'玉璋护盾\n抗性降低20%',levels:[{level:1,description:'玉璋护盾\n抗性降低10%'},{level:2,description:'玉璋护盾\n抗性降低20%'}]},{name:'另一个技能',description:'玉璋护盾持续时间延长'}];
  assert.equal(skillExplanations(skills,skills[1],1).find(t=>t.name==='玉璋护盾').description,'抗性降低10%');
  assert.equal(skillExplanations(skills,skills[1],2).find(t=>t.name==='玉璋护盾').description,'抗性降低20%');
  assert.deepEqual(skillExplanations([skills[1]],skills[1],1),[]);
});

test('真实来源补充流萤超击破、绝区零缺字，保持用户编辑与旅行者元素',()=>{
  const index=JSON.parse(readFileSync(new URL('../shared/skill-term-data.json',import.meta.url)));
  const read=game=>JSON.parse(readFileSync(new URL(`../data/catalog/${game}.json`,import.meta.url))).entries;
  const firefly=attachSkillTerms(read('starrail').find(e=>e.name==='流萤'),index);
  const trace=firefly.details.skills.find(s=>s.description.includes('超击破伤害'));
  assert.ok(trace.terms.find(t=>t.name==='超击破伤害')?.description);
  const clare=attachSkillTerms(read('zenless').find(e=>e.name==='克拉蕾'),index);
  assert.match(clare.details.skills.find(s=>s.name==='普通攻击：血华誓·锻星').description,/处于\[猩红铭刻\]下/);
  const edited=structuredClone(clare);edited.details.skills[0].description='用户自己写的技能说明';
  assert.equal(attachSkillTerms(edited,index).details.skills[0].description,'用户自己写的技能说明');
  const traveler=attachSkillTerms(read('genshin').find(e=>e.name==='空'),index);
  assert.equal(Object.keys(traveler.details.traveler.elements).length,7);
  assert.ok(traveler.details.traveler.elements.火.skills.some(s=>s.terms?.some(t=>t.name==='夜魂加持')));
});

test('渠道筛选支持多选和其他筛选交集，摘要不包含获取原文',()=>{
  const entries=[{id:'a',game:'genshin',category:'weapons',name:'武器甲',rarity:5,details:{acquisition:['武器活动祈愿','活动奖励（含历史活动）']}},{id:'b',game:'genshin',category:'weapons',name:'武器乙',rarity:4,details:{acquisition:['锻造（部分配方需要先解锁）']}}].map(summarizeEntry);
  assert.equal(entries[0].details,undefined);assert.equal(entries[0].acquisition,undefined);
  assert.deepEqual(selectEntries(entries,{game:'genshin',category:'weapons',filters:{acquisitionChannels:['锻造','限定武器池'],rarity:['4']}}).map(e=>e.id),['b']);
  const facet=buildFacets(entries,{game:'genshin',category:'weapons'}).find(f=>f.key==='acquisitionChannels');
  assert.equal(facet.label,'获取渠道');assert.ok(facet.values.some(v=>v.value==='活动奖励'));
});

test('薇斯纳和沃雅妮莎的独立名词有具体机制，含同技能和无引号的定义',()=>{
  const index=JSON.parse(readFileSync(new URL('../shared/skill-term-data.json',import.meta.url)));
  const entries=JSON.parse(readFileSync(new URL('../data/catalog/genshin.json',import.meta.url))).entries;
  const role=name=>attachSkillTerms(entries.find(e=>e.name===name),index);
  const find=(entry,name)=>entry.details.skills.flatMap(s=>skillExplanations(entry.details.skills,s,10)).find(t=>t.name===name);
  const vesna=role('薇斯纳'),vodyanitsa=role('沃雅妮莎');
  assert.match(find(vesna,'剑气').description,/积攒剑气/);
  assert.match(find(vesna,'巡风列装').description,/15秒/);
  assert.match(find(vesna,'整肃').description,/20秒.*6层/);
  assert.match(find(vesna,'巡游').description,/维持悬浮状态/);
  const solo=find(vodyanitsa,'领唱'),chorus=find(vodyanitsa,'重唱');
  assert.match(solo.description,/40000/);assert.match(solo.description,/6500/);
  assert.match(chorus.description,/后台角色/);
  assert.match(find(vodyanitsa,'遥久之歌').description,/抗打断能力/);
  assert.match(find(vodyanitsa,'流荡风旋').description,/风元素抗性降低35%/);
  for(const entry of [vesna,vodyanitsa])for(const skill of entry.details.skills)for(const term of skillExplanations(entry.details.skills,skill,10))assert.doesNotMatch(term.description,/\{PARAM#|\{LINK#/);
  assert.equal(vodyanitsa.details.skills.find(s=>s.name==='终奏·伴尔沉沦').terms?.some(t=>t.name==='领唱')??false,false);
});

test('其他原神角色、同编号别名与技能命座交叉引用使用真实说明',()=>{
  const index=JSON.parse(readFileSync(new URL('../shared/skill-term-data.json',import.meta.url)));
  const entries=JSON.parse(readFileSync(new URL('../data/catalog/genshin.json',import.meta.url))).entries;
  const term=(name,label)=>{const e=attachSkillTerms(entries.find(e=>e.name===name),index),context=[...e.details.skills,...e.details.upgrades];return context.flatMap(s=>skillExplanations(context,s,10)).find(t=>t.name===label);};
  assert.match(term('哥伦比娅','引力干涉').description,/月感电|月绽放|月结晶/);
  assert.match(term('妮露','丰穰之核').description,/无法触发超绽放与烈绽放/);
  assert.match(term('神里绫人','水影').description,/水影完全形成后/);
  assert.match(term('莉奈娅','究极厉害形态').description,/月结晶反应伤害/);
  assert.match(term('爱可菲','低温冷藏').description,/冻霜芭菲/);
  const skills=[{name:'来源技能',description:'玉璋护盾\n抗性降低20%'}],upgrade={name:'命之座',description:'「玉璋护盾」持续时间延长'};
  assert.match(skillExplanations([...skills,upgrade],upgrade)[0].description,/抗性降低20%/);
  for(const original of entries.filter(e=>e.details?.traveler)){
    const supplemented=attachSkillTerms(original,index);
    for(const [element,variant] of Object.entries(supplemented.details.traveler.elements)){
      assert.deepEqual(variant.skills.map(s=>s.description),original.details.traveler.elements[element].skills.map(s=>s.description));
    }
  }
});

test('名词参数按原文解析，双引号和加粗名词可点击且原文安全转义',()=>{
  assert.equal(resolveGenshinExplanation('{PARAM#P9|2S100}%',{9:[0,0.2]}),'20%');
  assert.throws(()=>resolveGenshinExplanation('{PARAM#P9|2S100}%',{}),/参数缺失/);
  const skill={name:'示例',description:'“领唱”与"重唱"及**剑气**',terms:[{name:'领唱',description:'定义'},{name:'重唱',description:'定义'},{name:'剑气',description:'定义'}]};
  const terms=skillExplanations([skill],skill),escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html=skillDescriptionHTML(skill.description+'<script>',terms,escape);
  for(const term of terms)assert.ok(html.includes(`data-skill-term="${term.name}"`));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('**'));
});

test('旧服务缺少摘要渠道时，本地索引让三个游戏的武器筛选实际出现',()=>{
  const index=JSON.parse(readFileSync(new URL('../shared/weapon-channel-data.json',import.meta.url)));
  for(const game of ['genshin','starrail','zenless']){
    const entries=JSON.parse(readFileSync(new URL(`../data/catalog/${game}.json`,import.meta.url))).entries.filter(e=>e.category==='weapons').map(e=>({id:e.id,name:e.name,game:e.game,category:e.category,rarity:e.rarity,type:e.type,secondary:e.secondary}));
    const supplemented=entries.map(e=>applyWeaponChannelIndex(e,index));
    const facet=buildFacets(supplemented,{game,category:'weapons'}).find(f=>f.key==='acquisitionChannels');
    assert.equal(facet?.label,'获取渠道');assert.ok(facet.values.length>1);
    const value=facet.values.find(v=>v.value!=='待补充').value;
    const filtered=selectEntries(supplemented,{game,category:'weapons',filters:{acquisitionChannels:[value]}});
    assert.ok(filtered.length);assert.ok(filtered.every(e=>e.acquisitionChannels.includes(value)));
    assert.equal(supplemented[0].details,undefined);
  }
  const edited={id:'custom',category:'weapons',acquisitionChannels:['用户维护渠道']};
  assert.strictEqual(applyWeaponChannelIndex(edited,index),edited);
});
