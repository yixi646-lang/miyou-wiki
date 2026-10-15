import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {damageFixture} from './fixtures/assessment-damage.mjs';
import {growthTeamScenario,configureMembers} from '../modules/character-assessment/core/teams.mjs';

const engine=await import(process.env.WIKI_STAGED_CORE?pathToFileURL(join(process.env.WIKI_STAGED_CORE,'calculator.mjs')):new URL('../modules/character-assessment/core/calculator.mjs',import.meta.url));
const numeric=r=>({panel:r.panel,rows:r.rows.map(({path,hit,crit,average})=>({path,hit,crit,average}))});
// 从 1.0.2 / R000003 核心以同一合成输入取得，不从本轮新代码生成期望值。
const expected={Skirk:{'normal.0':[2101.1486831579928,6192.135596835001,3901.1829251758772],'skill.0':[21654.670124835273,63816.83256997255,40206.021600695676]},Neuvillette:{'charged.dmg':[4834.700696103231,12115.759944434696,12115.759944434696],'charged.judgmentDmg':[16196.062169957853,40587.33179791437,40587.33179791437]}};

test('丝柯克普攻与那维莱特重击固定输入保持原核心数值，主角色重排不改变队伍伤害',()=>{
 for(const key of ['Skirk','Neuvillette']){
  const {good,scenario}=damageFixture(key),snapshot=structuredClone({good,scenario}),original=engine.calculateBuild(good,key,scenario),members=[key,...scenario.members];
  for(const anchor of members){const reordered=configureMembers(scenario,members,[anchor,...members.filter(k=>k!==anchor)]),team={members:[anchor,...reordered.members],scenario:reordered};assert.deepEqual(numeric(engine.calculateBuild(good,key,growthTeamScenario(team,key))),numeric(original));}
  const paths=key==='Skirk'?['normal.0','skill.0']:['charged.dmg','charged.judgmentDmg'];
  for(const path of paths){const row=original.rows.find(r=>r.path===path);assert(row?.average>0,path);for(const [i,field]of ['hit','crit','average'].entries())assert(Math.abs(row[field]-expected[key][path][i])<1e-8,`${key}/${path}/${field}`);}
  assert.deepEqual({good,scenario},snapshot);
 }
});

test('旧逐元素开关 on 与明确元素枚举得到相同结果；关闭仍关闭，不补设角色或套装层数',()=>{
 const {good,key,scenario}=damageFixture('Neuvillette'),original=structuredClone(scenario),canonical=engine.calculateBuild(good,key,scenario),legacy=structuredClone(scenario);
 for(const owner of ['Xilonen','KaedeharaKazuha'])for(const conditions of Object.values(legacy.characters[owner].conditional))for(const [k,v]of Object.entries(conditions))if(v==='hydro')conditions[k]='on';
 assert.deepEqual(numeric(engine.calculateBuild(good,key,legacy)),numeric(canonical));
 assert.equal(engine.calculateBuild(good,key,legacy).conditions.find(c=>c.path.join('.')==='ViridescentVenerer.swirlhydro').value,'hydro');
 const off=structuredClone(legacy);off.characters.KaedeharaKazuha.conditional.ViridescentVenerer.swirlhydro='';assert(engine.calculateBuild(good,key,off).rows.find(r=>r.path==='charged.judgmentDmg').average<canonical.rows.find(r=>r.path==='charged.judgmentDmg').average);
 delete legacy.conditional.Neuvillette;delete legacy.conditional.SacrificialJade;
 const result=engine.calculateBuild(good,key,legacy);assert.equal(result.conditions.find(c=>c.path.join('.')==='Neuvillette.a1Stacks').value,'');assert.equal(result.conditions.find(c=>c.path.join('.')==='SacrificialJade.offField').value,'');
 assert.deepEqual(scenario,original);
});
