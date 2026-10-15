import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {blankState} from '../modules/character-assessment/core/model.mjs';
import {readWorkspace,writeWorkspace,defaultScenario} from '../modules/character-assessment/core/workspace.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';

const core=new URL('../modules/character-assessment/core/',import.meta.url);
const engine=await import(process.env.WIKI_STAGED_CORE?pathToFileURL(join(process.env.WIKI_STAGED_CORE,'calculator.mjs')):new URL('calculator.mjs',core));
const baseline=process.env.WIKI_STAGED_CORE?await import(new URL('calculator.mjs',core)):null;
const catalog=JSON.parse(readFileSync(new URL('catalog.json',core)));
const character=(key,constellation=6)=>({key,level:90,ascension:6,constellation,talent:{auto:9,skill:9,burst:9}});
const artifact=(setKey,slotKey,location,i)=>({id:String(i),setKey,rarity:5,level:20,slotKey,mainStatKey:({flower:'hp',plume:'atk',sands:'def_',goblet:'geo_dmg_'})[slotKey],location,lock:false,substats:[]});
const good=(key,weapon,set)=>({format:'GOOD',version:3,characters:[character(key)],weapons:weapon?[{key:weapon,level:90,ascension:6,refinement:1,location:key,lock:false}]:[],artifacts:set?['flower','plume','sands','goblet'].map((slot,i)=>artifact(set,slot,key,i)):[]});
const numeric=result=>({panel:result.panel,rows:result.rows.map(({path,group,unit,variant,hit,crit,average})=>({path,group,unit,variant,hit,crit,average}))});
const write=(target,path,value)=>{for(const p of path.slice(0,-1))target=target[p]??={};target[path.at(-1)]=value;};

test('全量角色、武器、套装的可见及隐藏机制说明可提取，固定输入的数值保持一致',()=>{
  const inputs=Object.keys(catalog.characters).map(key=>[key,good(key)]);
  for(const [weapon,meta]of Object.entries(catalog.weapons)){
    const owner=Object.entries(catalog.characters).find(([key,c])=>c.weaponType===meta.weaponType&&!key.startsWith('Traveler'))[0];inputs.push([owner,good(owner,weapon)]);
  }
  for(const set of Object.keys(catalog.sets))inputs.push(['Xilonen',good('Xilonen',null,set)]);
  for(const [key,input]of inputs){
    const original=structuredClone(input),actual=engine.calculateBuild(input,key),docs=engine.inspectMechanicDocuments(input,key);
    if(baseline)assert.deepEqual(numeric(actual),numeric(baseline.calculateBuild(input,key)),`${key}/${input.weapons[0]?.key??input.artifacts[0]?.setKey??''}`);
    assert(docs.effects.length,key);
    for(const c of docs.conditions){assert(c.title.trim(),`${key}条件名称`);assert.notEqual(c.title,'效果数值',key);assert(c.options.every(o=>o.label.trim()),key);assert(docs.effects.some(e=>e.id===c.documentId),`${key}条件说明关联`);}
    const settings={conditional:{}};for(const c of docs.conditions)write(settings.conditional,c.path,c.options.at(-1)?.value??'');
    const active=engine.inspectMechanicDocuments(input,key,settings);
    for(const result of [docs,active])for(const f of [...result.effects.flatMap(e=>e.fields),...result.conditions.flatMap(c=>c.options.flatMap(o=>o.fields??[]))])assert.notEqual(f.label,'效果数值',`${key}数值名称 ${JSON.stringify(f)}`);
    assert.deepEqual(input,original);
  }
  assert.deepEqual(engine.mechanicTextDiagnostics(),[]);
  assert.equal(inputs.length,Object.keys(catalog.characters).length+Object.keys(catalog.weapons).length+Object.keys(catalog.sets).length);
});

test('说明对象、段落、富文本、插值及纯文字字段不会被数字筛选吞掉',()=>{
  const text=engine.textOf({type:'Translate',props:{ns:'char_Xilonen_gen',key18:'skill.description'}});
  assert.match(text,/源音采样/);assert.match(text,/降低.*元素抗性/);assert.match(text,/15秒/);assert.match(text,/\n/);assert.doesNotMatch(text,/<strong>|效果数值|\[object Object\]/);
  assert.equal(engine.textOf({type:'Translate',props:{ns:'sheet',key18:'stack',values:{count:2}}}),'2 层');
  assert.match(engine.textOf({type:'Translate',props:{ns:'char_Arlecchino_gen',key18:'auto.description'}}),/普通攻击/);
  assert.equal(engine.textOf({type:'Translate',props:{ns:'weapon_KagotsurubeIsshin_gen',key18:'passiveDescription.4'}}),engine.textOf({type:'Translate',props:{ns:'weapon_KagotsurubeIsshin_gen',key18:'passiveDescription.0'}}));
  const result=engine.calculateBuild(good('Xilonen','PeakPatrolSong'),'Xilonen');
  const c=result.conditions.find(c=>c.path.join('.')==='Xilonen.sourceActive');assert(c);
  assert.equal(c.title,'夜魂值达到上限后');assert(c.options.find(o=>o.value==='on').fields.some(f=>f.textOnly&&f.label==='源音采样已激活'));
  assert.match(result.effects.find(e=>e.id===c.documentId).description,/降低.*元素抗性/);
  const weapon=result.effects.find(e=>e.source==='武器效果');assert.match(weapon.description,/防御力|元素伤害/);assert.equal(weapon.sourceName,'岩峰巡歌');
});

test('魔女课业角色名称引用在说明和开关字段中展开，数值及输入保持一致',()=>{
  const zh=JSON.parse(readFileSync(new URL('zh.json',core)));
  const keys=Object.keys(catalog.characters).filter(key=>JSON.stringify(zh[`char_${key}_gen`]?.lockedPassive??{}).includes('魔女的课业'));
  assert(keys.includes('Durin'));assert(keys.includes('Sucrose'));assert(keys.length>=12);
  for(const key of keys){
    const name=zh.charNames_gen[key],expected=`${name}成为魔导角色`;
    for(const val of [`$t(charNames_gen:${key})`,`\${charNames_gen:${key}}`]){
      assert.equal(engine.textOf({type:'Translate',props:{ns:'sheet',key18:'hexerei.becomeHexerei',values:{val}}}),expected);
    }
    const input=good(key),original=structuredClone(input);
    for(const settings of [{},{conditional:{[key]:{lockHomework:'on'}}}]){
      const actual=engine.calculateBuild(input,key,settings),docs=engine.inspectMechanicDocuments(input,key,settings);
      const homework=docs.conditions.find(c=>c.path.join('.')===`${key}.lockHomework`);assert(homework,key);
      assert(homework.options.find(o=>o.value==='on').fields.some(f=>f.textOnly&&f.label===expected),key);
      assert.doesNotMatch(JSON.stringify([docs.effects,docs.conditions,actual.effects,actual.conditions]),/\$t\(|\$\{charNames_gen:/,key);
      if(baseline)assert.deepEqual(numeric(actual),numeric(baseline.calculateBuild(input,key,settings)),key);
    }
    assert.deepEqual(input,original,key);
  }
  // 未收录的引用保留原文，不能悄悄把角色名变成空白。
  assert.equal(engine.textOf('$t(charNames_gen:NotRecorded)'), '$t(charNames_gen:NotRecorded)');
});

test('独立增益按条件显示，逐元素开关使用上游实际枚举值，关闭后还原',()=>{
  for(const set of ['ScrollOfTheHeroOfCinderCity','ViridescentVenerer']){
    const owner=set==='ViridescentVenerer'?'Sucrose':'Xilonen',input=good(owner,null,set);input.characters.push(character('HuTao'));
    const settings={members:['HuTao']},off=engine.calculateBuild(input,owner,settings);
    const reaction=off.conditions.find(c=>c.path[0]===set&&c.path.at(-1).toLowerCase().includes('pyro'));assert(reaction);
    assert.equal(reaction.options[1].value,'pyro');
    settings.conditional={};write(settings.conditional,reaction.path,reaction.options[1].value);
    const on=engine.calculateBuild(input,owner,settings);
    const fields=on.effects.filter(e=>e.source==='套装效果').flatMap(e=>e.fields).concat(on.conditions.filter(c=>c.path[0]===set).flatMap(c=>c.options.find(o=>o.value===c.value)?.fields??[]));
    assert(fields.some(f=>Math.abs(f.value-(set==='ViridescentVenerer'?-40:12))<1e-9));
    if(set==='ScrollOfTheHeroOfCinderCity'){
      const night=on.conditions.find(c=>c.path.join('.')===set+'.nightsoul_pyro');assert(night);assert.equal(night.options[1].value,'pyro');write(settings.conditional,night.path,'pyro');
      const boosted=engine.calculateBuild(input,owner,settings);assert(boosted.effects.flatMap(e=>e.fields).some(f=>Math.abs(f.value-28)<1e-9));
      assert.match(boosted.effects.find(e=>e.sourceName.includes('4件套')).description,/12%[\s\S]*28%/);
    }
    write(settings.conditional,reaction.path,'');settings.conditional[set]= {};
    assert.deepEqual(numeric(engine.calculateBuild(input,owner,settings)),numeric(off));
  }
  const input=good('Xilonen');input.characters.push(character('HuTao'),character('Furina'));
  const result=engine.calculateBuild(input,'Xilonen',{members:['HuTao','Furina'],conditional:{Xilonen:{sourceActive:'on'}}});
  assert(result.effects.flatMap(e=>e.fields).some(f=>f.label.includes('敌人抗性')&&f.value<0));
});

test('共鸣纯说明、常驻数值和满辉开关均保留，月兆角色不会错误生成普通角色开关',()=>{
  const input=good('HuTao');input.characters.push(character('Bennett'),character('Ineffa'),character('Aino'));
  const result=engine.calculateBuild(input,'HuTao',{members:['Bennett','Ineffa','Aino']});
  assert(result.effects.some(e=>e.source==='元素共鸣'&&/热诚之火/.test(e.title)&&e.fields.some(f=>f.label.includes('攻击力')&&f.value===25)));
  assert(result.conditions.some(c=>c.owner==='HuTao'&&c.path.join('.')==='HuTao.moonsignAfterSkillBurst'));
  assert(!result.conditions.some(c=>['Ineffa','Aino'].includes(c.owner)&&c.path.at(-1)==='moonsignAfterSkillBurst'));
  assert(result.effects.some(e=>e.source==='元素共鸣'&&/满辉/.test(e.title)&&e.description.includes('角色')));
});

test('机制界面保持原开关卡片布局，仅展示开关相关说明与数值，保留折叠及锁定装备',{skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document}=parseHTML('<html><body><main class="assessment-root"><section id="pane"></section></main></body></html>');
  const prior=globalThis.document;globalThis.document=document;let bench;
  try{
    const state=blankState();state.selected='Xilonen';state.good=good('Xilonen','PeakPatrolSong','ScrollOfTheHeroOfCinderCity');state.good.characters.push(character('HuTao'),character('Furina'));
    const w=readWorkspace(state),scenario={...defaultScenario(),members:['HuTao','Furina'],conditional:{Xilonen:{sourceActive:'on'},ScrollOfTheHeroOfCinderCity:{react_pyro:'pyro',nightsoul_pyro:'pyro'}}};w.teamDraft={members:['Xilonen','HuTao','Furina'],scenario};writeWorkspace(state,w);
    const original=structuredClone(state.good),pane=document.querySelector('#pane'),data=JSON.parse(readFileSync(new URL('game-stats.json',core)));
    bench=createWorkbench({pane,readState:()=>state,readSelected:()=>state.selected,catalog,data,selectionHTML:()=>'',changed(){},toast:message=>assert.fail(message),isReadOnly:()=>true});bench.render();
    const groups=[...pane.querySelectorAll('.ae-condition-group')];assert(groups.length);
    assert.equal(pane.querySelector('.ae-effect-document'),null);assert.equal(pane.querySelector('.ae-effect-current'),null);
    const mechanics=groups.map(g=>g.textContent).join('\n');assert.match(mechanics,/夜魂值达到上限后/);assert.match(mechanics,/源音采样已激活/);assert.match(mechanics,/效果说明/);assert.doesNotMatch(mechanics,/冲刺伤害|夜魂加持时间限制|夜魂值上限/);
    for(const group of groups){assert.equal(group.children.length,2);assert(group.children[1].classList.contains('ae-condition-fields'));for(const card of group.children[1].children)assert(card.querySelector('[data-native-cond]')||card.hasAttribute('data-automatic-weapon'));}
    const cardNamed=name=>[...pane.querySelectorAll('.ae-condition-fields>.ae-field')].find(card=>card.firstElementChild.textContent===name);
    const pyro=cardNamed('触发火元素相关反应后'),night=cardNamed('处于夜魂加持状态时触发火元素相关反应后');assert(pyro);assert(night);
    assert.match(pyro.querySelector('.ae-effect-values').textContent,/12\.0%/);assert.doesNotMatch(pyro.querySelector('.ae-effect-values').textContent,/28\.0%/);
    assert.match(night.querySelector('.ae-effect-values').textContent,/28\.0%/);assert.doesNotMatch(night.querySelector('.ae-effect-values').textContent,/12\.0%/);
    const source=cardNamed('夜魂值达到上限后');assert.match(source.querySelector('.ae-effect-values').textContent,/敌人抗性/);assert.equal(source.querySelector('.ae-condition-description'),null);
    pyro.querySelector('.ae-condition-description').open=true;
    const furina=groups.find(g=>g.dataset.conditionOwner==='Furina');assert(furina);assert(furina.hidden);
    const select=pyro.querySelector('[data-native-cond]');assert.equal(select.value,'pyro');Object.defineProperty(select,'value',{value:'',writable:true});await bench.change(select);
    const restored=cardNamed('触发火元素相关反应后');assert(restored.querySelector('.ae-condition-description').open);assert.equal(restored.querySelector('.ae-effect-values'),null);
    assert([...pane.querySelectorAll('.ae-condition-group')].find(g=>g.dataset.conditionOwner==='Furina').hidden);assert.deepEqual(state.good,original);
  }finally{bench?.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
