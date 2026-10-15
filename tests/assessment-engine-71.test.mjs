import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateBuild,calculateTrace,calculatorVersion} from '../modules/character-assessment/core/calculator.mjs';
import {basePanel} from '../modules/character-assessment/core/evaluate.mjs';
import {blankState,validateGOOD} from '../modules/character-assessment/core/model.mjs';
import {createWorkbench} from '../modules/character-assessment/workbench.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../modules/character-assessment/core/'+name,import.meta.url),'utf8'));
const data=await read('game-stats.json'),catalog=await read('catalog.json');
const character=(key,constellation=0)=>({key,level:90,ascension:6,constellation,talent:{auto:9,skill:9,burst:9}});
const weapon=(key,location,refinement=1)=>({key,level:90,ascension:6,refinement,location,lock:false});
const good=(characters,weapons=[])=>({format:'GOOD',version:3,characters,weapons,artifacts:[]});
const near=(actual,expected)=>assert(Math.abs(actual-expected)<Math.max(1,Math.abs(expected))*1e-8,`${actual} != ${expected}`);
const row=(result,path)=>{const r=result.rows.find(r=>r.path===path);assert(r,`缺少 ${path}`);return r;};
const stars={conditional:{Vesna:{a0StellarRadiance:'ss'}}};

test('7.1角色与五种导入武器有中文、Wiki素材及可计算的机制，计算不改写资料',()=>{
  assert.match(calculatorVersion,/7\.1.*开发版/);
  const newWeapons=['BeyondTheChrysalis','SilverLight','BreezeborneRefrain','WintersHeavyHeart','NewBough'];
  const roster=['Vesna','Vodyanitsa','Fischl'].map(key=>character(key));
  for(const [key,meta] of [...['Vesna','Vodyanitsa'].map(k=>[k,catalog.characters[k]]),...newWeapons.map(k=>[k,catalog.weapons[k]])]){
    assert.match(meta.name,/[\u4e00-\u9fff]/,key);assert(meta.wikiId&&meta.image,key);
  }
  for(const key of newWeapons){
    const owner={sword:'Vesna',catalyst:'Vodyanitsa',bow:'Fischl'}[data.weapon.data[key].weaponType];
    const input=good(roster,[weapon(key,owner)]),before=structuredClone(input);
    assert.deepEqual(validateGOOD(input,data).errors,[]);assert.deepEqual(validateGOOD(input,data).warnings,[]);
    const output=calculateBuild(input,owner);assert(output.rows.length>0);
    assert(Object.values(output.panel).every(Number.isFinite));
    assert(output.rows.every(r=>[r.hit,r.crit,r.average].every(Number.isFinite)));
    assert.deepEqual(input,before);
  }
});

test('新增角色普通伤害、治疗与基础面板按独立公式吻合，命座天赋加成由引擎计算',()=>{
  for(const key of ['Vesna','Vodyanitsa']){
    const c=character(key),input=good([c]),output=calculateBuild(input,key),base=basePanel(c,null,[],data);
    for(const stat of ['hp','atk','def','critRate_','critDMG_'])near(output.panel[stat],base[stat]);
    const multiplier=data.char.skillParam[key].skill[0][8],scale=key==='Vesna'?base.atk:base.hp;
    const hit=scale*multiplier*190/390*.9;
    near(row(output,'skill.skillDmg').hit,hit);
    near(row(output,'skill.skillDmg').average,hit*(1+base.critRate_/100*base.critDMG_/100));
    if(key==='Vodyanitsa')near(row(output,'skill.songHeal').average,base.hp*data.char.skillParam[key].skill[5][8]+data.char.skillParam[key].skill[4][8]);
    const constellation=calculateBuild(good([character(key,3)]),key);
    assert(row(constellation,'skill.skillDmg').average>row(output,'skill.skillDmg').average);
  }
});

test('整肃只强化灵剑，星扩散使用反应公式，取消条件可恢复，六命伤害保留',()=>{
  const input=good([character('Vesna')]),basic=calculateBuild(input,'Vesna');
  const stacks=calculateBuild(input,'Vesna',{conditional:{Vesna:{a1Stacks:'6'}}});
  near(row(stacks,'skill.sword1Dmg').average,row(basic,'skill.sword1Dmg').average);
  near(row(stacks,'skill.sword2Dmg').average,row(basic,'skill.sword2Dmg').average);
  near(row(stacks,'skill.sword2SpiritDmg').average,row(basic,'skill.sword2SpiritDmg').average*1.6);
  const enabled=calculateBuild(input,'Vesna',stars),path='skill.sword2SpiritStellarswirlDmg';
  assert(row(enabled,path).average>0);
  // 上游反应减伤使用极大防御值近似，随敌人等级有微小差别。
  near(row(calculateBuild(input,'Vesna',{...stars,enemyLevel:200}),path).average/row(enabled,path).average,(99999999+1000)/(99999999+1500));
  assert(!enabled.rows.some(r=>r.path==='skill.sword2SpiritDmg'));
  const cleared=calculateBuild(input,'Vesna',{conditional:{Vesna:{a1Stacks:'',a0StellarRadiance:''}}});
  near(row(cleared,'skill.sword2SpiritDmg').average,row(basic,'skill.sword2SpiritDmg').average);
  const c6=calculateBuild(good([character('Vesna',6)]),'Vesna',stars);
  assert(row(c6,'constellation6.swordStellarswirlDmg').average>0);
  assert(Number.isFinite(calculateTrace(input,'Vesna',stars,path).value));
});

test('新武器按精炼、层数与队伍计算，不只补名称和白值',()=>{
  const sword=key=>good([character('Vesna')],[weapon(key,'Vesna')]);
  const beyond=sword('BeyondTheChrysalis'),plain=calculateBuild(beyond,'Vesna');
  near(calculateBuild(beyond,'Vesna',{conditional:{BeyondTheChrysalis:{devotion:'on'}}}).panel.critDMG_-plain.panel.critDMG_,56);
  for(const refinement of [1,5]){
    const input=good([character('Vesna')],[weapon('SilverLight','Vesna',refinement)]);
    near(calculateBuild(input,'Vesna',{conditional:{SilverLight:{passive:'2'}}}).panel.eleMas-calculateBuild(input,'Vesna').panel.eleMas,refinement===1?104:208);
  }
  const bough=sword('NewBough'),b0=calculateBuild(bough,'Vesna'),b3=calculateBuild(bough,'Vesna',{conditional:{NewBough:{passive:'3'}}});
  near(b3.panel.eleMas-b0.panel.eleMas,60);
  near(b3.panel.atk-b0.panel.atk,basePanel(bough.characters[0],bough.weapons[0],[],data).baseATK*.12+basePanel(bough.characters[0],bough.weapons[0],[],data).weaponATK*.12);
  const bow=good([character('Fischl')],[weapon('BreezeborneRefrain','Fischl')]);
  near(calculateBuild(bow,'Fischl').panel.enerRech_-basePanel(bow.characters[0],bow.weapons[0],[],data).enerRech_,20);
  const team=good([character('Vesna'),character('Fischl')],[weapon('BreezeborneRefrain','Fischl')]);
  const off=calculateBuild(team,'Vesna',{...stars,members:['Fischl']});
  const on=calculateBuild(team,'Vesna',{...stars,members:['Fischl'],characters:{Fischl:{conditional:{BreezeborneRefrain:{viper:'on'}}}}});
  assert(row(on,'skill.sword2SpiritStellarswirlDmg').average>row(off,'skill.sword2SpiritStellarswirlDmg').average);
  const winter=good(['Vodyanitsa','Kaeya','Fischl'].map(k=>character(k)),[weapon('WintersHeavyHeart','Vodyanitsa')]);
  const w=calculateBuild(winter,'Vodyanitsa',{members:['Kaeya','Fischl']}),base=basePanel(winter.characters[0],winter.weapons[0],[],data);
  near(w.panel.eleMas-(base.eleMas??0),24);near(w.panel.atk-base.atk,(base.baseATK+base.weaponATK)*.048);
});

test('领唱与重唱的前后台门控、流荡风旋切换不叠加普通水冰和星扩散增益',()=>{
  const self=good([character('Vodyanitsa')]);
  const base={bonusStats:{hp:50000}},output=calculateBuild(self,'Vodyanitsa',base);
  const lead=calculateBuild(self,'Vodyanitsa',{...base,conditional:{Vodyanitsa:{a4LeadVocal:'on'}}});
  assert(row(lead,'skill.skillDmg').average>row(output,'skill.skillDmg').average);
  const vortex=calculateBuild(self,'Vodyanitsa',{...base,conditional:{Vodyanitsa:{a4LeadVocal:'on',a4Vortex:'on'}}});
  near(row(vortex,'skill.skillDmg').average,row(output,'skill.skillDmg').average);
  const team=good([character('Vesna'),character('Vodyanitsa')]);
  const settings={...stars,members:['Vodyanitsa'],characters:{Vodyanitsa:{bonusStats:{hp:50000},conditional:{Vodyanitsa:{a4LeadVocal:'on'}}}}};
  const ordinary=calculateBuild(team,'Vesna',settings),noBuff=calculateBuild(team,'Vesna',{...settings,characters:{Vodyanitsa:{bonusStats:{hp:50000}}}});
  near(row(ordinary,'skill.sword2SpiritStellarswirlDmg').average,row(noBuff,'skill.sword2SpiritStellarswirlDmg').average);
  const star=calculateBuild(team,'Vesna',{...settings,characters:{Vodyanitsa:{bonusStats:{hp:50000},conditional:{Vodyanitsa:{a4LeadVocal:'on',a4Vortex:'on'}}}}});
  assert(row(star,'skill.sword2SpiritStellarswirlDmg').average>row(ordinary,'skill.sword2SpiritStellarswirlDmg').average);
  const chorus=calculateBuild(team,'Vesna',{...settings,characters:{Vodyanitsa:{bonusStats:{hp:50000},conditional:{Vodyanitsa:{a4Chorus:'on',a4Vortex:'on'}}}}});
  near(row(chorus,'skill.sword2SpiritStellarswirlDmg').average,row(noBuff,'skill.sword2SpiritStellarswirlDmg').average);
});

test('原生界面展示新机制与六命伤害，条件启用后再取消能够恢复原数值',async()=>{
  const previousDocument=globalThis.document;globalThis.document={activeElement:null};
  try{
    const state=blankState();state.good=good([character('Vesna',6)]);let changed=0;
    const pane={innerHTML:'',querySelectorAll:()=>[]};
    const workbench=createWorkbench({pane,readState:()=>state,readSelected:()=> 'Vesna',catalog,data,selectionHTML:()=>'',buildHTML:()=>'',changed:()=>changed++,toast:()=>{},selectCharacter:()=>{}});
    workbench.render();assert.match(pane.innerHTML,/翔风剑·变移伤害/);
    const original=row(workbench.getResult(),'skill.sword2SpiritDmg').average;
    await workbench.click({dataset:{nativePage:'teams'}});assert.match(pane.innerHTML,/整肃层数/);assert.match(pane.innerHTML,/辉映·星扩散/);
    const index=workbench.getResult().conditions.findIndex(c=>c.path.join('.')==='Vesna.a1Stacks');
    const beforeChanges=changed; // 首次进入独立队伍页也可能保存默认单人队。
    const control=value=>({dataset:{nativeCond:String(index)},hasAttribute:k=>k==='data-native-cond',value});
    await workbench.change(control('6'));assert(row(workbench.getResult(),'skill.sword2SpiritDmg').average>original);
    await workbench.change(control(''));near(row(workbench.getResult(),'skill.sword2SpiritDmg').average,original);assert.equal(changed-beforeChanges,2);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
