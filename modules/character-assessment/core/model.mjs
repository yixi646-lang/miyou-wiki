// 本模块只读 Wiki 索引；GOOD 配装与评价目标在独立资料库中保存。
export const FORMAT='WIKI_ASSESSMENT';
export const SLOTS=['flower','plume','sands','goblet','circlet'];
export const SLOT_NAMES={flower:'生之花',plume:'死之羽',sands:'时之沙',goblet:'空之杯',circlet:'理之冠'};
export const STAT_NAMES={hp:'生命值',hp_:'生命值%',atk:'攻击力',atk_:'攻击力%',def:'防御力',def_:'防御力%',eleMas:'元素精通',enerRech_:'元素充能效率',critRate_:'暴击率',critDMG_:'暴击伤害',heal_:'治疗加成',physical_dmg_:'物理伤害加成',anemo_dmg_:'风元素伤害加成',geo_dmg_:'岩元素伤害加成',electro_dmg_:'雷元素伤害加成',dendro_dmg_:'草元素伤害加成',hydro_dmg_:'水元素伤害加成',pyro_dmg_:'火元素伤害加成',cryo_dmg_:'冰元素伤害加成'};
export const SUBSTATS=['hp','hp_','atk','atk_','def','def_','eleMas','enerRech_','critRate_','critDMG_'];
export const ELEMENTS={anemo:'风',geo:'岩',electro:'雷',dendro:'草',hydro:'水',pyro:'火',cryo:'冰'};
export const MAIN_STATS={flower:['hp'],plume:['atk'],sands:['hp_','atk_','def_','eleMas','enerRech_'],goblet:['hp_','atk_','def_','eleMas','physical_dmg_','anemo_dmg_','geo_dmg_','electro_dmg_','dendro_dmg_','hydro_dmg_','pyro_dmg_','cryo_dmg_'],circlet:['hp_','atk_','def_','eleMas','critRate_','critDMG_','heal_']};
export const ROLES={
  attack:{name:'攻击输出',weights:{atk_:1,atk:.25,critRate_:1,critDMG_:1,enerRech_:.7},talent:{auto:8,skill:8,burst:8},sands:['atk_','enerRech_'],circlet:['critRate_','critDMG_']},
  hp:{name:'生命输出',weights:{hp_:1,hp:.25,critRate_:1,critDMG_:1,enerRech_:.7},talent:{auto:1,skill:8,burst:8},sands:['hp_','enerRech_'],circlet:['critRate_','critDMG_']},
  defense:{name:'防御输出',weights:{def_:1,def:.25,critRate_:1,critDMG_:1,enerRech_:.7},talent:{auto:8,skill:8,burst:8},sands:['def_','enerRech_'],circlet:['critRate_','critDMG_']},
  reaction:{name:'精通反应',weights:{eleMas:1,enerRech_:.8},talent:{auto:1,skill:6,burst:6},sands:['eleMas','enerRech_'],circlet:['eleMas']},
  healer:{name:'生命治疗',weights:{hp_:1,hp:.4,enerRech_:1},talent:{auto:1,skill:8,burst:8},sands:['hp_','enerRech_'],circlet:['heal_','hp_']},
  shield:{name:'生命护盾',weights:{hp_:1,hp:.5,enerRech_:.6},talent:{auto:1,skill:8,burst:1},sands:['hp_','enerRech_'],circlet:['hp_']},
  support:{name:'充能辅助',weights:{enerRech_:1,critRate_:.5},talent:{auto:1,skill:8,burst:8},sands:['enerRech_'],circlet:['critRate_','heal_']},
  hpSupport:{name:'生命辅助',weights:{hp_:1,hp:.4,enerRech_:.5},talent:{auto:1,skill:8,burst:6},sands:['hp_','enerRech_'],goblet:['hp_'],circlet:['hp_']},
  attackHealer:{name:'攻击治疗',weights:{atk_:1,atk:.3,enerRech_:1},talent:{auto:1,skill:8,burst:9},sands:['atk_','enerRech_'],goblet:['atk_'],circlet:['heal_','atk_']},
  defenseSupport:{name:'防御辅助',weights:{def_:1,def:.3,enerRech_:1},talent:{auto:1,skill:8,burst:8},sands:['def_','enerRech_'],goblet:['def_'],circlet:['def_']},
  attackSupport:{name:'攻击辅助',weights:{atk_:1,atk:.3,enerRech_:1},talent:{auto:1,skill:8,burst:8},sands:['atk_','enerRech_'],goblet:['atk_'],circlet:['atk_']},
  attackShield:{name:'攻击护盾',weights:{atk_:1,atk:.3,enerRech_:.5},talent:{auto:1,skill:9,burst:6},sands:['atk_','enerRech_'],goblet:['atk_'],circlet:['atk_']},
  custom:{name:'自定义',weights:{},talent:{auto:1,skill:1,burst:1},sands:[],circlet:[]}
};
const safeKey=k=>typeof k==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(k)&&!['constructor','prototype','__proto__'].includes(k);
const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const numeric=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const integer=(n,min,max)=>Number.isInteger(n)&&numeric(n,min,max);
export const percent=k=>k.endsWith('_');
export const statDisplay=(value,key)=>Number.isFinite(value)?`${value.toFixed(percent(key)?1:0)}${percent(key)?'%':''}`:'未填写';
export function blankState(){return{format:FORMAT,version:1,game:'genshin',good:{format:'GOOD',version:3,source:'Wiki Assessment',characters:[],weapons:[],artifacts:[]},goals:{},engineStorage:{},selected:'',comparisons:{}};}
export function equipmentLocation(key){return key.startsWith('Traveler')?'Traveler':key;}
export function equipment(good,key){const location=equipmentLocation(key);return{weapon:good.weapons?.find(w=>w.location===location),artifacts:SLOTS.map(s=>good.artifacts?.find(a=>a.location===location&&a.slotKey===s)).filter(Boolean)};}
export function defaultGoal(role='attack',element='pyro'){
  const r=ROLES[role]??ROLES.attack;
  return{role,level:90,weaponLevel:90,ascension:6,talent:{...r.talent},effectiveRolls:25,weights:Object.fromEntries(SUBSTATS.map(k=>[k,r.weights[k]??0])),mainStats:{sands:[...r.sands],goblet:r.goblet?[...r.goblet]:['healer','shield'].includes(role)?['hp_']:role==='reaction'?['eleMas']:[`${element}_dmg_`],circlet:[...r.circlet]},sets:[],panel:{},notes:''};
}
export function validateGoal(g,key='Default'){
  if(!safeKey(key)||!record(g)||!Object.hasOwn(ROLES,g.role)||!integer(g.level,1,100)||!integer(g.weaponLevel,1,90)||!integer(g.ascension,0,6)||!record(g.talent)||['auto','skill','burst'].some(k=>!integer(g.talent[k],1,10))||!numeric(g.effectiveRolls,0,100)||!record(g.weights)||Object.entries(g.weights).some(([k,v])=>!SUBSTATS.includes(k)||!numeric(v,0,2))||!record(g.mainStats)||Object.entries(g.mainStats).some(([k,v])=>!['sands','goblet','circlet'].includes(k)||!Array.isArray(v)||v.some(x=>!MAIN_STATS[k].includes(x)))||!Array.isArray(g.sets)||g.sets.some(x=>!safeKey(x))||!record(g.panel)||Object.entries(g.panel).some(([k,v])=>!['hp','atk','def','enerRech_','eleMas','critRate_','critDMG_'].includes(k)||!numeric(v,0,1e7))||typeof g.notes!=='string'||g.notes.length>3000)throw Error(`角色 ${key} 的评价目标不正确。`);
  return g;
}
export function validateGuide(g){
  const text=(v,max=3000)=>typeof v==='string'&&v.length<=max;
  if(!record(g)||!text(g.intro,6000)||!Array.isArray(g.weapons)||g.weapons.length>100||g.weapons.some(w=>!record(w)||!safeKey(w.key)||!text(w.note))||!Array.isArray(g.teams)||g.teams.length>40)throw Error('攻略介绍、武器或配队格式不正确。');
  for(const t of g.teams){if(!record(t)||t.label!==undefined&&!text(t.label,500)||t.note!==undefined&&!text(t.note)||!Array.isArray(t.slots)||t.slots.length!==4||t.slots.some(s=>!record(s)||!text(s.label,500)||!Array.isArray(s.characters)||s.characters.length>20||s.characters.some(k=>!safeKey(k))))throw Error('攻略配队须包含四个位置，角色编号和说明须有效。');}
  if(!record(g.source)||!text(g.source.name,200)||!text(g.source.url,2000)||g.source.url&&!/^https?:\/\//i.test(g.source.url)||g.source.version!=null&&!text(g.source.version,100)||g.source.checkedAt!=null&&!text(g.source.checkedAt,100))throw Error('攻略来源须使用有效的名称与 HTTP / HTTPS 链接。');
  if(g.build!==undefined){const b=g.build;if(!record(b)||!record(b.mainStats)||['sands','goblet','circlet'].some(k=>!Array.isArray(b.mainStats[k])||b.mainStats[k].some(x=>!MAIN_STATS[k].includes(x)))||!Array.isArray(b.sets)||b.sets.length>2||b.sets.some(k=>!safeKey(k))||!record(b.talent)||['auto','skill','burst'].some(k=>!integer(b.talent[k],1,10)))throw Error('攻略圣遗物或天赋建议不正确。');}
  if(g.artifactAdvice!==undefined&&!text(g.artifactAdvice,6000))throw Error('圣遗物补充建议最多 6000 个字。');
  if(g.artifactPlans!==undefined){
    if(!Array.isArray(g.artifactPlans)||g.artifactPlans.length>40)throw Error('圣遗物方案最多 40 套。');
    const ids=new Set();for(const p of g.artifactPlans){
      if(!record(p)||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)||ids.has(p.id)||!text(p.name,100)||!p.name.trim()||!['four','two-two'].includes(p.mode)||typeof p.display!=='boolean'||!Array.isArray(p.sets)||p.sets.length!==(p.mode==='four'?1:2)||new Set(p.sets).size!==p.sets.length||p.sets.some(k=>!safeKey(k))||!record(p.mainStats)||['sands','goblet','circlet'].some(k=>!Array.isArray(p.mainStats[k])||p.mainStats[k].some(stat=>!MAIN_STATS[k].includes(stat))))throw Error('每套圣遗物方案须填写名称、四件套或两种不同的二件套，以及有效主词条。');
      ids.add(p.id);
    }
  }
  return g;
}
export function validLevelAscension(level,ascension,maxLevel=90){const caps=[20,40,50,60,70,80,maxLevel],floors=[1,20,40,50,60,70,80];return integer(ascension,0,6)&&integer(level,floors[ascension],caps[ascension]);}
export function validateGOOD(value,data){
  assertSafeJSON(value);
  if(!record(value)||value.format!=='GOOD'||![1,2,3].includes(value.version))throw Error('需要 GOOD 1–3 格式的 JSON 文件，或本模块的备份。');
  const errors=[],warnings=[];
  for(const [kind,max]of [['characters',500],['weapons',30000],['artifacts',30000]])if(value[kind]!==undefined&&(!Array.isArray(value[kind])||value[kind].length>max))errors.push(`${kind} 数量或格式不正确`);
  if(errors.length)return{errors,warnings};
  const keys=new Set(),equipped=new Set();
  for(const [i,c]of (value.characters??[]).entries()){
    const p=`角色第 ${i+1} 项`;
    if(!record(c)||!safeKey(c.key)){errors.push(`${p}：角色编号不正确`);continue;}
    if(keys.has(c.key))errors.push(`${p}：角色重复 ${c.key}`);keys.add(c.key);
    if(!validLevelAscension(c.level,c.ascension,100)||!integer(c.constellation,0,6)||!record(c.talent)||['auto','skill','burst'].some(k=>!integer(c.talent[k],1,10)))errors.push(`${p} ${c.key}：请提供实际等级、突破、命座和不含命座加成的 1–10 级天赋`);
    if(data&&!data.char.data[c.key]&&!c.key.startsWith('Traveler'))warnings.push(`${c.key} 尚不在当前计算引擎资料中，保留数据但无法计算`);
  }
  for(const [i,w]of (value.weapons??[]).entries()){
    const p=`武器第 ${i+1} 项`;
    if(!record(w)||!safeKey(w.key)||!validLevelAscension(w.level,w.ascension,data?.weapon.data[w.key]?.rarity<3?70:90)||!integer(w.refinement,1,5)||typeof w.location!=='string'||w.location!==''&&!safeKey(w.location)){errors.push(`${p}：编号、等级、突破、精炼或装备位置不正确`);continue;}
    if(data&&!data.weapon.data[w.key])warnings.push(`${w.key} 尚不在当前计算引擎资料中`);
    const owner=data?.char.data[w.location],item=data?.weapon.data[w.key];if(owner&&item&&owner.weaponType!==item.weaponType)errors.push(`${p}：武器类型与 ${w.location} 不符`);
    if(w.location){if(equipped.has(w.location))errors.push(`${p}：${w.location} 有多把已装备武器`);equipped.add(w.location);}
  }
  equipped.clear();
  for(const [i,a]of (value.artifacts??[]).entries()){
    const p=`圣遗物第 ${i+1} 项`;
    if(!record(a)||!safeKey(a.setKey)||!integer(a.rarity,1,5)||!integer(a.level,0,a.rarity<3?4:a.rarity*4)||!SLOTS.includes(a.slotKey)||!MAIN_STATS[a.slotKey].includes(a.mainStatKey)||typeof a.location!=='string'||a.location!==''&&!safeKey(a.location)||!Array.isArray(a.substats)||a.substats.length>4){errors.push(`${p}：套装、部位、主词条或等级不正确`);continue;}
    const sub=new Set();for(const s of a.substats){if(!record(s)||s.key!==''&&(!SUBSTATS.includes(s.key)||s.key===a.mainStatKey||sub.has(s.key))||!numeric(s.value,0,5000))errors.push(`${p}：副词条重复、与主词条相同或数值不正确`);if(s.key)sub.add(s.key);}
    const set=data?.art.data[a.setKey];if(data&&!set)warnings.push(`${a.setKey} 尚不在当前计算引擎资料中`);if(set&&(!set.rarities.includes(a.rarity)||!set.slots.includes(a.slotKey)))errors.push(`${p}：套装不支持这个部位或星级`);
    if(a.location){const k=`${a.location}:${a.slotKey}`;if(equipped.has(k))errors.push(`${p}：同一角色同一部位有多件圣遗物`);equipped.add(k);}
  }
  return{errors,warnings};
}
export function validateState(state,data){
  assertSafeJSON(state);
  if(!record(state)||state.format!==FORMAT||state.version!==1||state.game!=='genshin')throw Error('养成与评估备份格式不正确。');
  const result=validateGOOD(state.good,data);if(result.errors.length)throw Error(result.errors.slice(0,6).join('；'));
  if(['weapons','artifacts'].some(k=>state.good[k]?.some(a=>a.wikiTrialOnly)))throw Error('自定义试算装备不能写入账号库存。');
  if(state.customInventory!==undefined){
    const c=state.customInventory;
    if(!record(c)||c.version!==1||typeof c.showMarkers!=='boolean'||['characters','weapons','artifacts'].some(k=>!Array.isArray(c[k])))throw Error('自定义库存格式不正确。');
    const checked=validateGOOD({format:'GOOD',version:3,characters:c.characters,weapons:c.weapons,artifacts:c.artifacts},data);if(checked.errors.length)throw Error(checked.errors.slice(0,6).join('；'));
    for(const kind of ['weapons','artifacts']){const ids=new Set();for(const item of c[kind]){if(typeof item.id!=='string'||!item.id||item.id.length>150||ids.has(item.id)||state.good[kind]?.some(a=>a.id===item.id)||item.wikiTrialOnly)throw Error('自定义装备编号重复或格式不正确。');ids.add(item.id);}}
    if(c.unequippedSlots!==undefined){
      if(!Array.isArray(c.unequippedSlots)||c.unequippedSlots.length>3000)throw Error('未装备部位记录不正确。');
      const positions=new Set(),characters=[...state.good.characters,...c.characters];
      for(const a of c.unequippedSlots){
        if(!record(a)||!safeKey(a.character)||!characters.some(char=>equipmentLocation(char.key)===equipmentLocation(a.character))||!['weapons','artifacts'].includes(a.kind)||(a.kind==='weapons'?a.slot!=='':!SLOTS.includes(a.slot)))throw Error('未装备部位记录不正确。');
        const position=equipmentLocation(a.character)+':'+a.kind+':'+a.slot;if(positions.has(position))throw Error('未装备部位记录重复。');positions.add(position);
      }
    }
    if(c.equipmentAssignments!==undefined){
      if(!Array.isArray(c.equipmentAssignments)||c.equipmentAssignments.length>3000)throw Error('自定义角色的装备引用格式不正确。');
      const positions=new Set(),sources=new Set();
      for(const a of c.equipmentAssignments){
        const ref=a?.reference;
        if(!record(a)||!safeKey(a.character)||!c.characters.some(char=>equipmentLocation(char.key)===equipmentLocation(a.character))||!['weapons','artifacts'].includes(a.kind)||(a.kind==='weapons'?a.slot!=='':!SLOTS.includes(a.slot))||!record(ref)||typeof ref.signature!=='string'||ref.signature.length>2000||!integer(ref.occurrence,0,30000)||ref.id!==undefined&&!(typeof ref.id==='string'&&ref.id.length<=150||Number.isSafeInteger(ref.id)&&ref.id>=0))throw Error('自定义角色的装备引用格式不正确。');
        let fields;try{fields=JSON.parse(ref.signature);}catch{throw Error('装备引用的内容不正确。');}
        if(!Array.isArray(fields)||!safeKey(fields[0])||a.kind==='weapons'&&fields.length!==4||a.kind==='artifacts'&&(fields.length!==6||fields[1]!==a.slot))throw Error('装备引用的内容不正确。');
        if(a.kind==='weapons'&&data){const owner=data.char.data[a.character],weapon=data.weapon.data[fields[0]];if(owner&&weapon&&owner.weaponType!==weapon.weaponType)throw Error('引用武器类型与自定义角色不符。');}
        const position=equipmentLocation(a.character)+':'+a.kind+':'+a.slot,source=JSON.stringify([a.kind,ref.signature,ref.id??ref.occurrence]);
        if(positions.has(position)||sources.has(source))throw Error('自定义角色的装备引用重复。');positions.add(position);sources.add(source);
      }
    }
  }
  if(!record(state.goals)||!record(state.engineStorage)||!record(state.comparisons??{})||typeof state.selected!=='string')throw Error('目标或计算工作区格式不正确。');
  for(const [key,g]of Object.entries(state.goals)){
    validateGoal(g,key);
  }
  if(Object.keys(state.engineStorage).length>70000||Object.entries(state.engineStorage).some(([k,v])=>typeof v!=='string'||k.length>150||v.length>15*1024*1024))throw Error('计算工作区超过限制或格式不正确。');
  if(state.engineStorage['wiki.native.v1']){
    let native;try{native=JSON.parse(state.engineStorage['wiki.native.v1']);}catch{throw Error('原生计算工作区格式不正确。');}
    assertSafeJSON(native);
    if(!record(native)||native.version!==1||!record(native.scenarios)||!Array.isArray(native.teams)||!record(native.plans))throw Error('原生计算工作区格式不正确。');
    if(native.activeTeams!==undefined&&(!record(native.activeTeams)||Object.entries(native.activeTeams).some(([key,id])=>!safeKey(key)||typeof id!=='string'||id.length>200)))throw Error('当前队伍的记录不正确。');
    if(native.activeTeamId!==undefined&&(typeof native.activeTeamId!=='string'||native.activeTeamId.length>200))throw Error('当前队伍编号不正确。');
    if(native.independentTeams!==undefined&&typeof native.independentTeams!=='boolean')throw Error('独立队伍标记不正确。');
    const checkMembers=t=>{if(!record(t)||!Array.isArray(t.members)||t.members.length>4||t.members.some(k=>!safeKey(k))||new Set(t.members).size!==t.members.length||new Set(t.members.map(equipmentLocation)).size!==t.members.length||!record(t.scenario))throw Error('队伍成员或条件格式不正确。');};
    if(native.teamDraft!==undefined)checkMembers(native.teamDraft);
    for(const t of native.teams)if(t.members!==undefined)checkMembers(t);
    if(native.teamPlans!==undefined&&(!Array.isArray(native.teamPlans)||native.teamPlans.length>2000||native.teamPlans.some(p=>!record(p)||typeof p.id!=='string'||typeof p.teamId!=='string')))throw Error('独立队伍方案格式不正确。');
    if(native.removedTeamIds!==undefined&&(!Array.isArray(native.removedTeamIds)||native.removedTeamIds.some(id=>typeof id!=='string'||id.length>200)))throw Error('已移除队伍的记录不正确。');
    if(native.customArtifacts!==undefined){
      if(!Array.isArray(native.customArtifacts)||native.customArtifacts.length>500)throw Error('自定义圣遗物方案过多或格式不正确。');
      const ids=new Set();
      for(const item of native.customArtifacts){
        const d=item?.draft,set=data?.art.data[d?.setKey];
        if(!record(item)||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>150||!record(d)||!safeKey(d.setKey)||!SLOTS.includes(d.slotKey)||!MAIN_STATS[d.slotKey].includes(d.mainStatKey)||!integer(d.rarity,1,5)||!integer(d.level,0,d.rarity<3?4:d.rarity*4)||!integer(d.initialCount,0,4)||!Array.isArray(d.lines)||d.lines.length!==4||data&&!set||set&&(!set.slots.includes(d.slotKey)||!set.rarities.includes(d.rarity)))throw Error('自定义圣遗物方案格式不正确。');
        ids.add(item.id);const keys=new Set();
        for(const line of d.lines){if(!record(line)||line.key!==''&&(!SUBSTATS.includes(line.key)||line.key===d.mainStatKey||keys.has(line.key))||!Array.isArray(line.counts)||line.counts.length>4||line.counts.some(n=>!integer(n,0,50))||data&&line.key&&line.counts.length!==data.art.sub[d.rarity]?.[line.key]?.length)throw Error('自定义圣遗物的副词条或各档次数不正确。');if(line.key)keys.add(line.key);}
        if(item.values!==undefined){
          if(!record(item.values)||!Array.isArray(item.values.substats)||item.values.substats.some(s=>!record(s)||!numeric(s.value,0,1e7)))throw Error('自定义圣遗物的数值不正确。');
          // 理论值可超出实际库存范围；其余结构仍按 GOOD 检查，写入库存时再执行完整校验。
          const bounded={...item.values,substats:item.values.substats.map(s=>({...s,value:Math.min(s.value,5000)}))};
          if(validateGOOD({format:'GOOD',version:3,artifacts:[bounded]},data).errors.length||['setKey','slotKey','rarity','level','mainStatKey'].some(k=>item.values[k]!==d[k]))throw Error('自定义圣遗物的两种编辑资料不匹配。');
        }
      }
    }
    const actionScenarios=[...Object.values(native.scenarios),...native.teams.map(t=>t.scenario),native.teamDraft?.scenario,...Object.values(native.plans).flatMap(list=>list.map(p=>p.scenario)),...(native.teamPlans??[]).map(p=>p.scenario)].filter(Boolean);
    for(const scenario of actionScenarios)if(scenario.combo!==undefined){if(!Array.isArray(scenario.combo)||scenario.combo.length>200)throw Error('固定动作格式不正确。');for(const a of scenario.combo){if(!record(a)||a.owner!==undefined&&!safeKey(a.owner)||typeof a.path!=='string'||!a.path||a.path.length>200||!numeric(a.count,0,1000)||a.hitMode!==undefined&&!['hit','critHit','avgHit'].includes(a.hitMode)||a.infusion!==undefined&&!['inherit','none','',...Object.keys(ELEMENTS),'physical'].includes(a.infusion)||a.bonusStats!==undefined&&(!record(a.bonusStats)||Object.entries(a.bonusStats).some(([k,n])=>!safeKey(k)||!numeric(n,-1e7,1e7))))throw Error('固定动作的次数、命中方式、附魔或增益格式不正确。');}}
    for(const plans of [...Object.values(native.plans),native.teamPlans??[]]){if(!Array.isArray(plans))throw Error('保存方案格式不正确。');for(const plan of plans){if(!record(plan)||!record(plan.character)||typeof plan.name!=='string')throw Error('保存方案格式不正确。');const check=validateGOOD({format:'GOOD',version:3,characters:[plan.character],weapons:plan.weapon?[plan.weapon]:[],artifacts:plan.artifacts??[]},data);if(check.errors.length)throw Error('保存方案包含不合法的角色或装备。');if(plan.teamBuilds!==undefined){if(!Array.isArray(plan.teamBuilds)||!plan.teamBuilds.length||plan.teamBuilds.length>4||plan.teamBuilds.some(b=>!record(b)||!record(b.character)||!Array.isArray(b.artifacts))||new Set(plan.teamBuilds.map(b=>b.character.key)).size!==plan.teamBuilds.length||!plan.teamBuilds.some(b=>b.character.key===plan.character.key))throw Error('队伍配装方案格式不正确。');const teamCheck=validateGOOD({format:'GOOD',version:3,characters:plan.teamBuilds.map(b=>b.character),weapons:plan.teamBuilds.flatMap(b=>b.weapon?[b.weapon]:[]),artifacts:plan.teamBuilds.flatMap(b=>b.artifacts)},data);if(teamCheck.errors.length)throw Error('队伍配装方案包含不合法的角色或装备。');}}}
  }
  for(const [key,c]of Object.entries(state.comparisons??{})){if(!safeKey(key)||!record(c)||!record(c.character)||c.character.key!==key)throw Error('对比方案格式不正确。');const checked=validateGOOD({format:'GOOD',version:3,characters:[c.character],weapons:c.weapon?[c.weapon]:[],artifacts:c.artifacts??[]},data);if(checked.errors.length)throw Error('对比方案的配装不正确。');}
  return structuredClone(state);
}
export function assertSafeJSON(input,{maxNodes=1000000}={}){
  const queue=[[input,0]];let count=0;
  while(queue.length){const [value,depth]=queue.pop();if(++count>maxNodes||depth>80)throw Error('数据结构过大或嵌套过深。');if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('文件包含不允许的对象字段。');queue.push([child,depth+1]);}}
}
// 同一导入重复出现的物品按出现次数匹配，保留合法的相同物品副本。
export function mergeGOOD(current,incoming){
  const next=structuredClone(current);next.format='GOOD';next.version=Math.max(current.version??1,incoming.version??1);
  for(const key of ['characters','weapons','artifacts']){
    if(!incoming[key])continue;
    const items=next[key]??=[],used=new Set();
    for(const raw of incoming[key]){
      const item=structuredClone(raw),identity=x=>{const{id,location,lock,...rest}=x;return JSON.stringify(rest);};
      let index=items.findIndex((old,i)=>!used.has(i)&&(key==='characters'?old.key===item.key:item.id&&old.id===item.id||identity(old)===identity(item)));
      if(key!=='characters'&&item.location)for(const old of items)if(old.location===item.location&&(key==='weapons'||old.slotKey===item.slotKey))old.location='';
      if(index<0){index=items.length;items.push(item);}else items[index]=item;used.add(index);
    }
    next[key]=items;
  }
  // 引擎扩展的队伍、条件和优化配置保留原结构，未提供的部分不变。
  for(const [key,value]of Object.entries(incoming))if(!['characters','weapons','artifacts','format','version','source','__proto__','constructor','prototype'].includes(key))next[key]=structuredClone(value);
  return next;
}
export function importPreview(state,input,data){
  if(input?.format===FORMAT){const restored=validateState(input,data);return{state:restored,restore:true,counts:{characters:restored.good.characters?.length??0,weapons:restored.good.weapons?.length??0,artifacts:restored.good.artifacts?.length??0},warnings:['恢复备份会替换本模块当前配装、目标和计算工作区。']};}
  const result=validateGOOD(input,data);if(result.errors.length)throw Error(result.errors.slice(0,10).join('；'));
  const next={...structuredClone(state),good:mergeGOOD(state.good,input)};
  const merged=validateGOOD(next.good,data);if(merged.errors.length)throw Error(merged.errors.slice(0,10).join('；'));
  return{state:next,restore:false,counts:Object.fromEntries(['characters','weapons','artifacts'].map(k=>[k,input[k]?.length??0])),warnings:result.warnings};
}
