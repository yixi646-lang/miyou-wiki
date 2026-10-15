import {damageFixture} from './assessment-damage.mjs';
import {defaultGoal} from '../../modules/character-assessment/core/model.mjs';

// 合成库存用于性能与等值回归，不读取个人账号。
export function optimizerPerformanceFixture({budget=120,scope='team',objective='charged.judgmentDmg',inventory=600}={}){
 const {good,key,scenario}=damageFixture('Neuvillette');
 const sets=['MarechausseeHunter','GoldenTroupe','ScrollOfTheHeroOfCinderCity','ViridescentVenerer','NoblesseOblige','TenacityOfTheMillelith','ArchaicPetra','HeartOfDepth','NymphsDream','VourukashasGlow','WanderersTroupe','EmblemOfSeveredFate'];
 for(let i=0;i<inventory;i++){
  const variant=Math.floor(i/5),piece=structuredClone(good.artifacts[i%5]);
  const stats=[{key:'critRate_',value:2.7+(variant%7)*2.7},{key:'critDMG_',value:5.4+(variant%5)*5.4},{key:'enerRech_',value:4.5+(variant%3)*4.5},{key:'hp_',value:4.1+(variant%4)*4.1}].filter(s=>s.key!==piece.mainStatKey);
  Object.assign(piece,{id:'extra-'+i,location:'',setKey:sets[variant%sets.length],substats:stats});good.artifacts.push(piece);
 }
 const goals=Object.fromEntries(good.characters.map(c=>[c.key,defaultGoal(c.key==='Neuvillette'||c.key==='Furina'?'hp':'support','hydro')]));
 return {good,key,scenario,goals,rules:{setMode:'none',borrow:true},scope,objective,pool:6,budget};
}
