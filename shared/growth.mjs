// Costs are transitions: steps[n] is the cost of n -> n+1 (0 can mean locked).
export const levelPhase = (profile, level) => profile.caps.findIndex(cap => level <= cap);
export function defaultGoal(profile) {
  return {profileId:profile.id,quantity:1,enabled:true,levels:true,fromLevel:profile.minLevel,toLevel:profile.maxLevel,fromPhase:0,toPhase:profile.caps.length-1,tracks:Object.fromEntries(profile.tracks.map(t=>[t.id,{from:t.min,to:t.max}]))};
}
export function calculateGoal(profile, goal) {
  const costs=new Map(),errors=[],warnings=[];let xp=0;
  const integer=(v,min,max,label)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max){errors.push(`${label}须为 ${min}–${max} 的整数`);return min;}return n;};
  const quantity=integer(goal.quantity??1,1,99,'数量');
  const add=items=>{for(const item of items??[]){if(!item.id||!Number.isFinite(item.count)||item.count<0)throw Error('无效消耗数据');costs.set(item.id,(costs.get(item.id)??0)+item.count*quantity);}};
  if(goal.enabled===false)return {costs:[],xp:0,errors,warnings};
  let targetPhase=profile.caps.length-1;
  if(goal.levels!==false){
    const from=integer(goal.fromLevel,profile.minLevel,profile.maxLevel,'当前等级'),to=integer(goal.toLevel,profile.minLevel,profile.maxLevel,'目标等级');
    const fp=integer(goal.fromPhase,0,profile.caps.length-1,'当前突破阶段'),tp=integer(goal.toPhase,0,profile.caps.length-1,'目标突破阶段');targetPhase=tp;
    if(to<from||tp<fp)errors.push('目标等级和突破阶段不能低于当前值');
    const validPhase=(level,phase)=>level<=profile.caps[phase]&&(phase===0||level>=profile.caps[phase-1]);
    if(!validPhase(from,fp)||!validPhase(to,tp))errors.push('等级与突破阶段不匹配，请调整阶段');
    if(!errors.length){for(let level=from;level<to;level++){const step=profile.xp[level-profile.minLevel];if(!Number.isFinite(step)){errors.push('该等级经验资料尚未收录');break;}xp+=step;}
      if(xp){add([{id:profile.expItem.id,count:Math.ceil(xp/profile.expItem.value)},{id:profile.currencyId,count:Math.ceil(xp*profile.currencyPerExp)}]);}
      for(let phase=fp;phase<tp;phase++)add(profile.ascensions[phase]);
    }
  }
  for(const track of profile.tracks){const range=goal.tracks?.[track.id]??{from:track.min,to:track.min};const from=integer(range.from,track.min,track.max,`${track.name}当前等级`),to=integer(range.to,track.min,track.max,`${track.name}目标等级`);if(to<from){errors.push(`${track.name}目标不能低于当前值`);continue;}
    for(let level=from;level<to;level++){if(!Array.isArray(track.steps[level-track.min])){errors.push(`${track.name}的升级材料尚未收录`);break;}add(track.steps[level-track.min]);const req=track.requirements?.[level-track.min];if(goal.levels!==false&&req&&(targetPhase<(req.phase??0)||Number(goal.toLevel)<(req.level??0)))warnings.push(`${track.name} ${level+1} 需要等级 ${req.level??'—'}、突破阶段 ${req.phase??'—'}`);}
  }
  if(profile.note)warnings.push(profile.note);
  return {costs:errors.length?[]:[...costs].map(([id,count])=>({id,count})),xp:xp*quantity,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
export function calculateBatch(profiles, goals, inventory={}) {
  const total=new Map(),rows=[],errors=[];
  for(const goal of goals){const profile=profiles[goal.profileId];if(!profile){errors.push('条目养成数据不存在');continue;}const result=calculateGoal(profile,goal);rows.push({key:goal.key,profileId:profile.id,name:profile.name,...result});if(result.errors.length)errors.push(...result.errors.map(e=>`${profile.name}：${e}`));for(const item of result.costs)total.set(item.id,(total.get(item.id)??0)+item.count);}
  return {rows,errors,costs:[...total].map(([id,count])=>{const have=Math.max(0,Math.floor(Number(inventory[id])||0));return {id,count,have,missing:Math.max(0,count-have)};})};
}
