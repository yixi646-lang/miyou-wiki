import {ELEMENTS} from './model.mjs';
import {independentWorkspace} from './teams.mjs';
export const nativeKey='wiki.native.v1';
export function readWorkspace(state){
  let w;try{w=JSON.parse(state.engineStorage?.[nativeKey]??'null');}catch{}
  if(!w||w.version!==1)w={version:1,scenarios:{},teams:[],plans:{}};
  // 原 GO 工作区与扩展原样保留；可识别的条件迁入原生界面。
  if(!w.migrated){
    const chars=new Map(),teams=[];
    const resolveKey=k=>state.good.characters.find(c=>c.key===k)?.key??state.good.characters.find(c=>c.key.startsWith(k)&&k.startsWith('Traveler'))?.key;
    for(const [storageKey,value]of Object.entries(state.engineStorage??{})){try{const item=JSON.parse(value);if(/^(?:teamchar|teamChar|teamCharacter)_/.test(storageKey)){const id=storageKey.replace(/^(?:teamchar|teamChar|teamCharacter)_/,'');chars.set(id,item);chars.set(storageKey,item);}else if(storageKey.startsWith('team_'))teams.push([storageKey,item]);}catch{}}
    for(const item of Array.isArray(state.good.teamchars)?state.good.teamchars:[])if(item?.id){chars.set(item.id,item);chars.set('teamchar_'+item.id,item);}
    for(const item of Array.isArray(state.good.teams)?state.good.teams:[])teams.push(['good-'+(item.id??teams.length),item]);
    const convert=c=>({conditional:structuredClone(c.conditional??{}),bonusStats:structuredClone(c.bonusStats??{}),reaction:c.reaction??'',infusion:c.infusionAura??'',combo:(c.customMultiTargets?.[0]?.targets??[]).map(t=>({path:t.path?.join('.'),count:t.weight??1,reaction:t.reaction??'',hitMode:t.hitMode??'avgHit',infusion:t.infusionAura??'inherit',bonusStats:structuredClone(t.bonusStats??{})})).filter(t=>t.path)});
    for(const c of new Set(chars.values())){const key=resolveKey(c.key??c.characterKey);if(key&&!w.scenarios[key])w.scenarios[key]=convert(c);}
    for(const [id,t]of teams){if((w.removedTeamIds??[]).includes(id))continue;const members=(t.loadoutData??[]).filter(Boolean).map(l=>chars.get(l.teamCharId)).filter(Boolean),keys=members.map(c=>resolveKey(c.key)).filter(Boolean);if(!keys.length)continue;
      const enemy=t.enemyOverride??{},scenario={...convert(members[0]),members:keys.slice(1),active:keys[0],enemyLevel:enemy.enemyLevel??100,resistance:10,resistances:Object.fromEntries(Object.keys({...ELEMENTS,physical:''}).map(e=>[e,enemy[e+'_enemyRes_']??10])),enemyDefRed_:enemy.enemyDefRed_??0,enemyDefIgn_:enemy.enemyDefIgn_??0,characters:Object.fromEntries(members.slice(1).map(c=>[resolveKey(c.key),convert(c)])),conditional:{...t.conditional,...members[0].conditional}};
      if(!(w.removedTeamIds??[]).includes(id)&&!w.teams.some(x=>x.id===id))w.teams.push({id,name:/^Team Name/.test(t.name??'')?`导入队伍 ${w.teams.length+1}`:(t.name||`导入队伍 ${w.teams.length+1}`),character:keys[0],scenario});if(!w.scenarios[keys[0]]?.members?.length)w.scenarios[keys[0]]=structuredClone(scenario);
    }
    w.migrated=true;
  }
  return independentWorkspace(w,state);
}
export function defaultScenario(){return {enemyLevel:100,resistance:10,conditional:{},characters:{},members:[],reaction:'',combo:[]};}
export function activeTeamFor(state,key){
  const w=readWorkspace(state),id=w.activeTeams?.[key];
  return id!==undefined?w.teams.find(t=>t.id===id&&t.character===key):w.teams.find(t=>t.character===key);
}
export function scenarioFor(state,key){return readWorkspace(state).scenarios[key]??structuredClone(activeTeamFor(state,key)?.scenario??defaultScenario());}
export function writeWorkspace(state,workspace){state.engineStorage[nativeKey]=JSON.stringify(workspace);}
