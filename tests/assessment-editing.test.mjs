import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankState,validateState} from '../modules/character-assessment/core/model.mjs';
import {removeCharacter,removeEquipment,removePlan,removeTeam} from '../modules/character-assessment/core/actions.mjs';
import {readWorkspace,writeWorkspace} from '../modules/character-assessment/core/workspace.mjs';
import {analyzeArtifact,inspectDraft,draftFromArtifact,substatTiers,createArtifactEditor,switchArtifactMode,artifactEditorSnapshot} from '../modules/character-assessment/core/artifacts.mjs';
import {filterWeaponChoices} from '../modules/character-assessment/workbench.mjs';
const data=JSON.parse(await readFile(new URL('../modules/character-assessment/core/game-stats.json',import.meta.url),'utf8'));
const char=key=>({key,level:1,ascension:0,constellation:0,talent:{auto:1,skill:1,burst:1}});
const weapon={key:'FavoniusSword',level:1,ascension:0,refinement:1,location:'Furina',lock:false,id:'w1'};
const artifact={setKey:'GoldenTroupe',slotKey:'flower',rarity:5,level:20,mainStatKey:'hp',substats:[{key:'critRate_',value:3.9},{key:'critDMG_',value:7.8},{key:'hp_',value:5.8},{key:'enerRech_',value:32.4}],location:'Furina',lock:false,id:'a1'};
test('圣遗物默认次数编辑，两种方式保留输入和明确选择的档位，未知数值不丢失',()=>{
  const raw={...structuredClone(artifact),substats:[{key:'hp_',value:1.4},{key:'critRate_',value:3.9},{key:'atk',value:0}]},editor=createArtifactEditor(raw,data);assert.equal(editor.mode,'rolls');switchArtifactMode(editor,'values',data);assert.deepEqual(editor.values.substats,raw.substats);switchArtifactMode(editor,'rolls',data);assert.equal(editor.draft.lines[0].key,'hp_');assert.equal(editor.draft.lines[2].key,'atk');
  editor.draft.lines[1].counts=[0,0,0,2];editor.countsChanged=true;editor.changedLines=[1];switchArtifactMode(editor,'values',data);assert.equal(editor.values.substats.find(s=>s.key==='hp_').value,1.4);assert.equal(editor.values.substats.find(s=>s.key==='critRate_').value,7.8);switchArtifactMode(editor,'rolls',data);assert.deepEqual(editor.draft.lines[1].counts,[0,0,0,2]);
  switchArtifactMode(editor,'values',data);editor.values.substats.find(s=>s.key==='hp_').value=5.8;editor.valuesChanged=true;switchArtifactMode(editor,'rolls',data);assert.equal(editor.draft.lines[0].counts.at(-1),1);switchArtifactMode(editor,'values',data);editor.values.substats[0].value=1.4;editor.valuesChanged=true;
  const snapshot=artifactEditorSnapshot(editor,data),s=blankState();writeWorkspace(s,{version:1,migrated:true,scenarios:{},teams:[],plans:{},customArtifacts:[{id:'both',name:'保留数值',...snapshot}]});const restored=validateState(s,data);assert.equal(readWorkspace(restored).customArtifacts[0].values.substats[0].value,1.4);
});
test('武器候选按类型、星级和副属性交叉筛选，支持名字、别名和空结果',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../modules/character-assessment/core/catalog.json',import.meta.url),'utf8'));catalog.weapons.FavoniusSword.aliases=['西风系列'];
  const candidates=filterWeaponChoices(catalog,data,{type:'sword',rarity:'4',stat:'enerRech_',search:'西风'});assert.deepEqual(candidates.map(([k])=>k),['FavoniusSword']);assert.equal(filterWeaponChoices(catalog,data,{type:'bow',rarity:'4',stat:'enerRech_',search:'西风'}).length,1);assert.equal(filterWeaponChoices(catalog,data,{type:'sword',rarity:'5',search:'西风'}).length,0);assert.equal(filterWeaponChoices(catalog,data,{search:'西风系列',type:'sword'})[0][0],'FavoniusSword');assert(filterWeaponChoices(catalog,data,{}).every(([,m])=>m.wikiId));
});
test('移除角色清理关联目标、保存配装与队伍，装备退回库存，旅行者按空荧分别移除',()=>{
  const s=blankState();s.good.characters=['Furina','Bennett','TravelerCryoM','TravelerGeoM','TravelerCryoF'].map(char);s.selected='Furina';s.good.weapons=[structuredClone(weapon)];s.good.artifacts=[structuredClone(artifact)];s.goals.Furina={};s.comparisons.Furina={};
  writeWorkspace(s,{version:1,migrated:true,scenarios:{Furina:{},Bennett:{members:['Furina'],active:'Furina',characters:{Furina:{}}}},teams:[{id:'lead',character:'Furina',scenario:{}},{id:'other',character:'Bennett',scenario:{members:['Furina'],active:'Furina',characters:{Furina:{}}}}],plans:{Furina:[{name:'a'}],Bennett:[{character:char('Bennett'),name:'b',artifacts:[],scenario:{members:['Furina']}}]}});
  assert(removeCharacter(s,'Furina'));const w=readWorkspace(s);assert.equal(s.selected,'Bennett');assert.equal(s.good.weapons[0].location,'');assert.equal(s.good.artifacts[0].location,'');assert(!s.goals.Furina&&!s.comparisons.Furina&&!w.plans.Furina&&!w.scenarios.Furina);assert.equal(w.teams.length,1);assert.deepEqual(w.teams[0].scenario.members,[]);assert.equal(w.scenarios.Bennett.active,'Bennett');assert.deepEqual(w.plans.Bennett[0].scenario.members,[]);
  s.good.weapons[0].location='Traveler';removeCharacter(s,'TravelerCryoM');assert(!s.good.characters.some(c=>c.key.endsWith('M')));assert(s.good.characters.some(c=>c.key==='TravelerCryoF'));assert.equal(s.good.weapons[0].location,'Traveler');validateState(s,data);
});
test('移除库存装备、保存方案和旧导入队伍，锁定装备需先解锁，已保存快照保留',()=>{
  const s=blankState();s.good.characters=[char('Furina')];s.good.weapons=[structuredClone(weapon)];s.good.artifacts=[{...structuredClone(artifact),lock:true}];
  writeWorkspace(s,{version:1,migrated:true,scenarios:{},teams:[{id:'good-old',character:'Furina',scenario:{}}],plans:{Furina:[{name:'保留',character:char('Furina'),weapon:structuredClone(weapon),artifacts:[]}]}});
  assert.throws(()=>removeEquipment(s,'artifacts',0),/解除/);s.good.artifacts[0].lock=false;removeEquipment(s,'artifacts',0);removeEquipment(s,'weapons',0);assert.equal(readWorkspace(s).plans.Furina[0].weapon.key,'FavoniusSword');removePlan(s,'Furina',0);assert(!readWorkspace(s).plans.Furina);removeTeam(s,'good-old');
  s.good.teamchars=[{id:'a',key:'Furina'}];s.good.teams=[{id:'old',loadoutData:[{teamCharId:'a'}]}];const w=readWorkspace(s);w.migrated=false;writeWorkspace(s,w);assert.equal(readWorkspace(s).teams.length,0);validateState(s,data);
});
test('档位生成符合真实总次数，反推保留档位解；理论分配独立保存',()=>{
  const a=analyzeArtifact(artifact,data,{hp_:1,enerRech_:1});assert.equal(a.minCount,8);assert.equal(a.maxCount,9);assert.equal(a.minEffective,6);assert.equal(a.maxEffective,7);assert.equal(a.details.find(s=>s.key==='enerRech_').minCount,5);assert.equal(a.details.find(s=>s.key==='enerRech_').maxCount,6);assert(Math.abs(a.details.find(s=>s.key==='enerRech_').maxQuality-100)<.001);
  const draft=draftFromArtifact(artifact,data),built=inspectDraft(draft,data);assert(built.realistic);assert.deepEqual(built.artifact.substats,artifact.substats);assert.equal(draft.initialCount,3);assert.equal(built.total,8);
  const impossible={...structuredClone(artifact),substats:artifact.substats.map(s=>s.key==='enerRech_'?{...s,value:45.4}:s)};assert(analyzeArtifact(impossible,data).invalid.length);
  const theoretical=structuredClone(draft);theoretical.lines.find(s=>s.key==='enerRech_').counts[substatTiers(data,5,'enerRech_').length-1]=20;assert(!inspectDraft(theoretical,data).realistic);
  const s=blankState();writeWorkspace(s,{version:1,migrated:true,scenarios:{},teams:[],plans:{},customArtifacts:[{id:'theory',name:'理论词条',draft:theoretical}]});validateState(s,data);assert.equal(s.good.artifacts.length,0);const restored=validateState(JSON.parse(JSON.stringify(s)),data);assert.equal(readWorkspace(restored).customArtifacts[0].draft.lines.find(s=>s.key==='enerRech_').counts.at(-1),20);
  const bad=readWorkspace(s);bad.customArtifacts[0].draft.lines[0].counts[0]=-1;writeWorkspace(s,bad);assert.throws(()=>validateState(s,data),/次数不正确/);
});
test('三初始与强化补第四条分别计数，取整歧义受到整体次数约束',()=>{
  const draft=draftFromArtifact(artifact,data);draft.level=0;draft.initialCount=3;draft.lines[3]={key:'',counts:[0,0,0,0]};for(const l of draft.lines.slice(0,3))l.counts=[0,0,0,1];assert(inspectDraft(draft,data).realistic);
  draft.level=4;assert(!inspectDraft(draft,data).realistic);draft.lines[3]={key:'enerRech_',counts:[0,0,0,1]};const built=inspectDraft(draft,data);assert(built.realistic);const r=analyzeArtifact(built.artifact,data);assert.deepEqual(r.initial,[3]);assert.equal(r.minCount,4);
  // 低档重复叠加与高档少量叠加可能显示同一个数值，保留可行区间。
  const table=data.art.subRoll[5].hp,ambiguous=Object.entries(table).find(([,variants])=>new Set(variants.map(v=>v.length)).size>1);assert(ambiguous);
  const [value,variants]=ambiguous;for(const count of [...new Set(variants.map(v=>v.length))]){if(count>6||count<1)continue;const other=9-count;if(other<3||other>18)continue;const counts=[1,1,other-2];if(counts[2]>6)continue;const d={...structuredClone(draft),level:20,initialCount:4,mainStatKey:'atk',slotKey:'plume',lines:[{key:'hp',counts:variants.find(v=>v.length===count).reduce((a,i)=>(a[i]++,a),[0,0,0,0])},...['critRate_','critDMG_','enerRech_'].map((key,i)=>({key,counts:[0,0,0,counts[i]]}))]};const a=inspectDraft(d,data).artifact;a.substats[0].value=Number(value);const r=analyzeArtifact(a,data);assert(r.details[0].variants.length>0);assert(r.solutions.every(s=>s.total===9));break;}
});
