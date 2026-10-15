
import {STAT_NAMES,ELEMENTS,assertSafeJSON} from './model.mjs';
export const ACTION_BONUS_STATS=[...Object.keys(STAT_NAMES),'shield_','all_dmg_','normal_dmg_','charged_dmg_','plunging_dmg_','skill_dmg_','burst_dmg_'];
export function normalizeActions(value,{members,owner}={}){
 assertSafeJSON(value,{maxNodes:20000});const actions=Array.isArray(value)?value:value?.format==='WikiActions'&&value.version===1?value.actions:value?.targets??value?.customMultiTargets?.[0]?.targets;
 if(!Array.isArray(actions)||actions.length>200)throw Error('请导入固定动作 JSON，最多 200 项。');
 return actions.map(a=>{
  const row={owner:a.owner??owner,path:Array.isArray(a.path)?a.path.join('.'):a.path,count:Number(a.count??a.weight??1),reaction:a.reaction??'',hitMode:a.hitMode??'avgHit',infusion:a.infusion??a.infusionAura??'inherit',bonusStats:{...a.bonusStats}};
  if(typeof row.owner!=='string'||members&&!members.includes(row.owner)||typeof row.path!=='string'||!/^[A-Za-z0-9_.]+$/.test(row.path)||row.path.split('.').some(s=>['__proto__','constructor','prototype'].includes(s))||row.path.length>200||!Number.isFinite(row.count)||row.count<0||row.count>1000)throw Error('动作角色、项目或次数 / 权重不正确。');
  if(!['hit','critHit','avgHit'].includes(row.hitMode)||!['','inherit','vaporize','melt','aggravate','spread'].includes(row.reaction)||!['inherit','none','',...Object.keys(ELEMENTS),'physical'].includes(row.infusion))throw Error('动作命中方式、反应或附魔不正确。');
  if(!row.bonusStats||typeof row.bonusStats!=='object'||Array.isArray(row.bonusStats)||Object.entries(row.bonusStats).some(([k,n])=>!ACTION_BONUS_STATS.includes(k)||!Number.isFinite(n)||Math.abs(n)>1e7))throw Error('动作额外增益须使用有效属性与数值。');
  return row;
 });
}
export const exportActions=(actions,options)=>JSON.stringify({format:'WikiActions',version:1,actions:normalizeActions(actions,options)},null,2);
