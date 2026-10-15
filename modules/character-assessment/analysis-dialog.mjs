import {evaluate,rollValues} from './core/evaluate.mjs';
import {SLOTS,SLOT_NAMES,STAT_NAMES,ROLES,ELEMENTS,equipment,equipmentLocation,defaultGoal,statDisplay} from './core/model.mjs';
import {assignedGOOD,optimizerArtifactChanges,OPTIMIZER_METRICS,WEIGHTED_ROLLS_EDIT_HINT} from './core/optimizer.mjs';
import {artifactAnalysisHTML,artifactIconHTML} from './artifact-ui.mjs';
import {statLabel} from './core/calculator.mjs';
import {artifactMajorVersion,artifactVersionChoices,compareArtifactSets,compareCharacterRelease,artifactReleaseLabel} from './core/artifact-order.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DAMAGE_GROUP_NAMES={normal:'普通攻击',charged:'重击',plunging:'下落攻击',skill:'元素战技',burst:'元素爆发',reaction:'元素反应',lockedPassive:'强化天赋',passive:'固有天赋',passive1:'固有天赋一',passive2:'固有天赋二',passive3:'固有天赋三',weapon:'武器效果',artifact:'套装效果',moonsign:'月兆',nicole:'元素投射'};
const amount=value=>Number.isFinite(value)?value.toFixed(1):'—';
export function artifactTriggerAuditHTML(before=[],after=[],catalog={}){
 if(!before.length&&!after.length)return '';
 const list=entries=>entries.map(e=>`<li><strong>${esc(catalog.characters?.[e.member]?.name??e.member)} · ${esc(e.name)} ${e.count}件</strong>：${Object.entries(e.conditions).map(([field,value])=>esc(e.conditionLabels?.[field]?.title??field)+'：'+esc(e.conditionLabels?.[field]?.value??value)).join('、')||(e.count<2&&!e.set.startsWith('Prayers')?'未凑齐二件效果':'常驻效果按实际件数计入')}${e.notes.length?'<small> '+esc([...new Set(e.notes)].join('；'))+'</small>':''}</li>`).join('');
 return `<details class="ae-section ae-artifact-trigger-audit"><summary>套装自动触发依据</summary><p data-ae-hint="套装自动条件计算说明" class="ae-muted">按同一准备阶段比较，角色与武器开关仍沿用保存值；不是完整循环模拟。下列窗口及层数为规则约定，缺少证据的效果不会自动开启。</p><h4>基准配装</h4><ul>${list(before)}</ul><h4>当前方案</h4><ul>${list(after)}</ul></details>`;
}
function equipmentStatus(artifact,good,catalog){
 if(!artifact)return '该部位未装备圣遗物';if(!artifact.location)return '当前未装备（库存）';
 const key=good.characters.find(c=>equipmentLocation(c.key)===artifact.location)?.key??artifact.location;
 return '当前装备：'+(catalog.characters[key]?.name??key);
}

export function damageResultGroupsHTML(rows,{owner,selected}={}){
  return [...new Set(rows.map(r=>r.group))].map(group=>`<details class="ae-calculation-group" data-native-disclosure="damage-${esc(owner)}-${esc(group)}" open><summary>${esc(DAMAGE_GROUP_NAMES[group]??statLabel(group))}</summary><div class="ae-table-wrap"><table class="ae-table ae-damage-table"><thead><tr><th>计算项目</th><th>非暴击</th><th>暴击</th><th>期望值</th><th></th></tr></thead><tbody>${rows.filter(r=>r.group===group).map(r=>`<tr class="${r.path===selected?.path&&r.owner===selected?.owner?'ae-target-row':''}"><td>${esc(r.label)}${r.variant==='heal'?'<small>治疗量</small>':''}</td><td>${amount(r.hit)}</td><td>${amount(r.crit)}</td><td><strong>${amount(r.average)}</strong></td><td><button class="subtle-action" data-native="trace" data-owner="${esc(owner)}" data-path="${esc(r.path)}">计算过程</button></td></tr>`).join('')}</tbody></table></div></details>`).join('');
}

export function teamDamageComparisonHTML(before,after,catalog,{beforeLabel='替换前期望',afterLabel='替换后期望'}={}){
  const owners=[...new Set([...(before.members??[]),...(after.members??[])].map(m=>m.key))];
  return `<div class="ae-damage-members">${owners.map(owner=>{
    const error=before.members?.find(m=>m.key===owner)?.error??after.members?.find(m=>m.key===owner)?.error;
    const oldRows=before.rows.filter(r=>r.owner===owner),newRows=after.rows.filter(r=>r.owner===owner);
    const rows=[...oldRows,...newRows.filter(r=>!oldRows.some(x=>x.path===r.path))],groups=[...new Set(rows.map(r=>r.group))];
    return `<details class="ae-damage-member" data-popup-disclosure="member-${esc(owner)}" open><summary>${esc(catalog.characters[owner]?.name??owner)}</summary>${error?`<p class="ae-warning">${esc(error)}</p>`:groups.map(group=>`<details class="ae-calculation-group" data-popup-disclosure="compare-${esc(owner)}-${esc(group)}" open><summary>${esc(DAMAGE_GROUP_NAMES[group]??statLabel(group))}</summary><div class="ae-table-wrap"><table class="ae-table ae-damage-table"><thead><tr><th>计算项目</th><th>${esc(beforeLabel)}</th><th>${esc(afterLabel)}</th><th>变化</th></tr></thead><tbody>${rows.filter(r=>r.group===group).map(row=>{
      const a=oldRows.find(r=>r.path===row.path)?.average,b=newRows.find(r=>r.path===row.path)?.average,d=Number.isFinite(a)&&Number.isFinite(b)?b-a:null;
      return `<tr><td>${esc(row.label)}${row.variant==='heal'?'<small>治疗量</small>':''}</td><td>${amount(a)}</td><td>${amount(b)}</td><td class="${d>0?'ae-gain':d<0?'ae-loss':''}">${d===null?'该方案暂无此项目':`${d>=0?'+':''}${amount(d)}${a>0?' ('+(d/a*100).toFixed(2)+'%)':''}`}</td></tr>`;
    }).join('')}</tbody></table></div></details>`).join('')||'<p class="ae-muted">暂无可计算项目。</p>'}</details>`;
  }).join('')}</div>`;
}

export function inventoryArtifactHTML(artifact,{catalog,data,weights={},label='圣遗物',sourceGood,compact=false}={}){
  if(!artifact)return `<div class="ae-comparison-artifact"><h3>${esc(label)}</h3><p class="ae-muted">这个部位未装备圣遗物。</p></div>`;
  const a=artifact,main=(data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level]??0)*(a.mainStatKey.endsWith('_')?100:1),rolls=rollValues(a,data,weights??{});
  return `<div class="ae-comparison-artifact ae-rarity-${a.rarity} ${compact?'ae-comparison-compact':''}"><h3>${esc(label)}</h3><div class="ae-artifact-heading">${artifactIconHTML(a,catalog)}<div><strong>${esc(catalog.sets[a.setKey]?.name??a.setKey)}</strong><p>${SLOT_NAMES[a.slotKey]} · ${a.rarity} 星 · +${a.level}</p><b>${STAT_NAMES[a.mainStatKey]} ${statDisplay(main,a.mainStatKey)}</b></div></div>${sourceGood?`<p class="ae-item-owner">${esc(equipmentStatus(a,sourceGood,catalog))}</p>`:''}<div class="ae-item-substats">${a.substats.filter(s=>s.key).map(s=>`<span class="${weights?.[s.key]>0?'ae-stat-effective':''}">${STAT_NAMES[s.key]} <b>${statDisplay(s.value,s.key)}</b></span>`).join('')}</div>${compact?'':`<div class="ae-item-metrics"><span>全部副词条总量 <b>${rolls.total.toFixed(1)}</b></span>${weights===null?'':`<span title="${esc(WEIGHTED_ROLLS_EDIT_HINT)}">有效副词条加权评分 <b>${rolls.effective.toFixed(1)}</b></span>`}<span>双暴 <b>${rolls.cv.toFixed(1)}</b></span></div>`}</div>`;
}

export function openAssessmentDialog({root,title,subtitle='',subtitleHint='',html='',onChange=()=>{},onClick=()=>{},onClose=()=>{}}){
  const focus=document.activeElement,overflow=document.body.style.overflow,dialog=document.createElement('dialog');let closed=false;
  dialog.className='ae-analysis-dialog';dialog.setAttribute('aria-labelledby','ae-analysis-title');
  dialog.innerHTML=`<div class="ae-analysis-dialog-head"><div><h2 id="ae-analysis-title">${esc(title)}</h2>${subtitle?`<p ${subtitleHint?`data-ae-hint="${esc(subtitleHint)}"`:''}>${esc(subtitle)}</p>`:''}</div><button class="subtle-action" data-analysis-close aria-label="关闭浮层">关闭</button></div><div data-analysis-content></div>`;
  const setHTML=value=>{const content=dialog.querySelector('[data-analysis-content]'),folds=new Map(Array.from(content.querySelectorAll?.('[data-popup-disclosure]')??[]).map(d=>[d.dataset.popupDisclosure,d.open]));content.innerHTML=value;for(const d of content.querySelectorAll?.('[data-popup-disclosure]')??[])if(folds.has(d.dataset.popupDisclosure))d.open=folds.get(d.dataset.popupDisclosure);};
  const close=()=>{if(closed)return;closed=true;if(dialog.open)dialog.close();dialog.remove();onClose();document.body.style.overflow=overflow;if(focus?.isConnected)focus.focus({preventScroll:true});};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
  dialog.addEventListener('click',event=>{event.stopPropagation?.();if(event.target===dialog||event.target.closest('[data-analysis-close]'))close();else onClick(event,dialog);});
  dialog.addEventListener('change',event=>{event.stopPropagation?.();onChange(event,dialog);});
  root.append(dialog);setHTML(html);document.body.style.overflow='hidden';try{dialog.showModal();}catch(error){close();throw error;}
  return {close,setHTML,dialog};
}

export function openCurrentLoadoutDialog({root,good,keys,catalog,data,onClose=()=>{}}){
 const snapshot=structuredClone(good),members=[...new Set(keys)].filter(key=>snapshot.characters.some(c=>c.key===key));
 if(!members.length)throw Error('请选择要查看配装的角色。');
 const html=members.map(key=>{const character=snapshot.characters.find(c=>c.key===key),{weapon,artifacts}=equipment(snapshot,key),meta=weapon?catalog.weapons[weapon.key]:null;return `<section class="ae-current-loadout" data-current-loadout="${esc(key)}"><h3>${esc(catalog.characters[key]?.name??key)} · Lv.${character.level}</h3><div class="ae-current-weapon">${meta?.image?`<img class="ae-item-image" src="${esc(meta.image)}" alt="">`:''}<div><strong>${weapon?esc(meta?.name??weapon.key):'未装备武器'}</strong>${weapon?`<p>Lv.${weapon.level} · 精炼 ${weapon.refinement}</p>`:''}</div></div><div class="ae-current-artifacts">${SLOTS.map(slot=>inventoryArtifactHTML(artifacts.find(a=>a.slotKey===slot),{catalog,data,weights:null,label:SLOT_NAMES[slot],sourceGood:snapshot,compact:true})).join('')}</div></section>`;}).join('');
 return openAssessmentDialog({root,title:'当前配装详情',html,onClose});
}

export function characterArtifactHTML({character,good,goal,catalog,data,slotKey,all=false,sourceGood,partPrefix=''}){
  const result=evaluate(character,good,goal,data);
  const pieceHTML=p=>{
    if(p.missing)return '<p class="ae-muted">这个部位尚未填写圣遗物。</p>';
    const a=p.artifact;
    return `<div class="ae-analysis-piece"><div class="ae-artifact-heading">${artifactIconHTML(a,catalog)}<div><h3>${SLOT_NAMES[a.slotKey]} · ${esc(catalog.sets[a.setKey]?.name??a.setKey)}</h3><p>${a.rarity} 星 · +${a.level} · ${STAT_NAMES[a.mainStatKey]} ${statDisplay(p.mainValue*(a.mainStatKey.endsWith('_')?100:1),a.mainStatKey)} · ${p.matches?'符合当前主词条目标':'主词条需调整'}</p></div></div>${sourceGood?`<p class="ae-item-owner">${esc(equipmentStatus(sourceGood.artifacts[good.artifacts.indexOf(a)],sourceGood,catalog))}</p>`:''}<div class="ae-item-metrics"><span>全部副词条总量 <b>${p.rolls.total.toFixed(1)}</b></span><span title="${esc(WEIGHTED_ROLLS_EDIT_HINT)}">有效副词条加权评分 <b>${p.rolls.effective.toFixed(1)}</b></span><span>双暴值 <b>${p.rolls.cv.toFixed(1)}</b></span></div>${artifactAnalysisHTML(a,data,goal.weights)}</div>`;
  };
  if(!all){const chosen=slotKey?result.pieces.find(p=>p.slot===slotKey):result.pieces.find(p=>!p.missing);return chosen?`<p data-ae-hint="有效词条评分编辑说明" class="ae-muted">${esc(WEIGHTED_ROLLS_EDIT_HINT)}</p>`+pieceHTML(chosen):'<p class="ae-muted">当前角色还没有填写圣遗物。</p>';}
  const overview=`<div class="ae-table-wrap"><table class="ae-table ae-artifact-overview"><thead><tr><th>部位与套装</th><th>主词条</th><th>全部副词条总量</th><th title="${esc(WEIGHTED_ROLLS_EDIT_HINT)}">有效副词条加权评分</th><th>双暴值</th></tr></thead><tbody>${result.pieces.map(p=>p.missing?`<tr><td>${SLOT_NAMES[p.slot]}</td><td colspan="4">未填写</td></tr>`:`<tr><td><button class="ae-analysis-slot" data-analysis-slot="${esc(partPrefix+p.slot)}">${artifactIconHTML(p.artifact,catalog)}<span>${SLOT_NAMES[p.slot]} · +${p.artifact.level}<small>${esc(catalog.sets[p.artifact.setKey]?.name??p.artifact.setKey)}</small></span></button></td><td>${STAT_NAMES[p.artifact.mainStatKey]} ${statDisplay(p.mainValue*(p.artifact.mainStatKey.endsWith('_')?100:1),p.artifact.mainStatKey)}<small>${p.matches?'符合目标':'需调整'}</small></td><td>${p.rolls.total.toFixed(1)}</td><td>${p.rolls.effective.toFixed(1)}</td><td>${p.rolls.cv.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<p data-ae-hint="有效词条评分编辑说明" class="ae-muted">${esc(WEIGHTED_ROLLS_EDIT_HINT)}</p>`+overview+`<div class="ae-analysis-pieces">${result.pieces.map(p=>`<details class="ae-analysis-part" data-analysis-part="${esc(partPrefix+p.slot)}" open><summary tabindex="-1">${SLOT_NAMES[p.slot]}${p.missing?' · 未填写':''}</summary>${pieceHTML(p)}</details>`).join('')}</div>`;
}
export function optimizerArtifactChangesHTML({good,assignment,key,catalog,data}){
 const changes=optimizerArtifactChanges(good,assignment,key);
 const describe=a=>{if(!a)return '未装备';const main=(data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level]??0)*(a.mainStatKey.endsWith('_')?100:1);return `${esc(catalog.sets[a.setKey]?.name??a.setKey)} · +${a.level} · ${STAT_NAMES[a.mainStatKey]} ${statDisplay(main,a.mainStatKey)}`;};
 const subs=a=>a?`<small>${a.substats.filter(s=>s.key).map(s=>STAT_NAMES[s.key]+' '+statDisplay(s.value,s.key)).join(' · ')}</small>`:'';
 return `<section class="ae-opt-transfers"><h4>圣遗物更换${changes.length?' · '+changes.length+' 个部位':''}</h4>${changes.length?`<ul class="ae-opt-change-list">${changes.map(c=>`<li><strong>${SLOT_NAMES[c.slot]}</strong><span>原装备：${describe(c.before)}</span>${subs(c.before)}<span>推荐装备：${describe(c.after)}</span>${subs(c.after)}<small>${esc(equipmentStatus(c.after,good,catalog))}${c.after?.location&&c.after.location!==equipmentLocation(key)?'，将移交给此角色':''}</small></li>`).join('')}</ul>`:'<p class="ae-muted">圣遗物未更换。</p>'}</section>`;
}
export function optimizerArtifactComparisonHTML({good,assignment,key,scope='single',goals={},catalog,data}){
 const next=assignedGOOD(good,assignment),keys=(scope==='team'?Object.keys(assignment):[key]).filter(k=>assignment[k]&&good.characters.some(c=>c.key===k));
 const members=keys.map(member=>({key:member,character:good.characters.find(c=>c.key===member),goal:goals[member]??defaultGoal('attack',catalog.characters[member]?.element??'pyro'),changes:optimizerArtifactChanges(good,assignment,member)}));
 const metrics=(a,weights)=>{if(!a)return{weightedRolls:0,effectiveRolls:0,cv:0};const r=rollValues(a,data,weights??{});return{weightedRolls:r.effective,effectiveRolls:r.details.reduce((n,s)=>n+(s.weight>0?s.rolls:0),0),cv:r.cv};};
 const comparison=members.filter(m=>m.changes.length).map(member=>`<section class="ae-opt-artifact-member"><h3>${esc(catalog.characters[member.key]?.name??member.key)} · 更换 ${member.changes.length} 个部位</h3>${member.changes.map(change=>{
  const before=metrics(change.before,member.goal.weights),after=metrics(change.after,member.goal.weights);
  return `<details class="ae-analysis-part" data-opt-comparison-part="${esc(member.key)}-${change.slot}" data-popup-disclosure="opt-compare-${esc(member.key)}-${change.slot}" open><summary>${SLOT_NAMES[change.slot]}</summary><div class="ae-opt-piece-comparison"><div class="ae-artifact-comparison"><div data-opt-comparison-before>${inventoryArtifactHTML(change.before,{catalog,data,weights:member.goal.weights,label:'原装备',sourceGood:good,compact:true})}</div><div data-opt-comparison-after>${inventoryArtifactHTML(change.after,{catalog,data,weights:member.goal.weights,label:'推荐装备（尚未应用）',sourceGood:good,compact:true})}</div></div><div class="ae-table-wrap ae-opt-piece-metrics" data-opt-comparison-metrics><table class="ae-table"><thead><tr><th>词条评价</th><th>原装备</th><th>推荐装备</th><th>变化</th></tr></thead><tbody>${Object.entries(OPTIMIZER_METRICS).map(([metric,label])=>{const delta=after[metric]-before[metric];return `<tr><td>${esc(label)}</td><td>${amount(before[metric])}</td><td>${amount(after[metric])}</td><td>${delta===0?'不变':(delta>0?'+':'')+amount(delta)}</td></tr>`;}).join('')}</tbody></table></div></div></details>`;
 }).join('')}</section>`).join('');
 const fullAnalysis=members.map(member=>{const html=characterArtifactHTML({character:member.character,good:next,goal:member.goal,catalog,data,all:true,sourceGood:good,partPrefix:member.key+'-'}),title=esc(catalog.characters[member.key]?.name??member.key)+' · 五件圣遗物词条分析';return members.length===1?`<section data-opt-full-member="${esc(member.key)}"><h3>${title}</h3>${html}</section>`:`<details data-opt-full-member="${esc(member.key)}" data-popup-disclosure="opt-full-${esc(member.key)}" ${member.key===key?'open':''}><summary>${title}</summary>${html}</details>`;}).join('');
 return `<section data-opt-artifact-comparisons><h3>圣遗物前后对比</h3><p data-ae-hint="推荐装备对比说明" class="ae-muted">仅对比更换部位；装备状态为当前账号的实际状态，推荐装备尚未应用。</p><p data-ae-hint="有效词条评分说明" class="ae-muted">有效副词条加权评分采用该角色的词条权重。${esc(WEIGHTED_ROLLS_EDIT_HINT)}</p>${comparison||'<p class="ae-muted">本方案未更换圣遗物，无需对比。</p>'}</section><section class="ae-opt-full-analysis" data-opt-full-analysis><h3>完整圣遗物分析</h3>${fullAnalysis}</section>`;
}
export function openOptimizerArtifactDialog({root,good,assignment,key,scope='single',goals,catalog,data,onClose=()=>{}}){
 return openAssessmentDialog({root,title:'圣遗物对比与分析',html:optimizerArtifactComparisonHTML({good,assignment,key,scope,goals,catalog,data}),onClose,onClick:(event,dialog)=>{
  const button=event.target.closest('[data-analysis-slot]');if(!button)return;
  const part=dialog.querySelector(`[data-analysis-part="${button.dataset.analysisSlot}"]`);if(!part)return;
  part.open=true;const group=part.closest('details[data-opt-full-member]');if(group)group.open=true;
  part.scrollIntoView({block:'start'});part.querySelector('summary')?.focus({preventScroll:true});
 }});
}
export function openArtifactDialog({root,character,good,goal,catalog,data,slotKey,all=false,onClose=()=>{}}){
  const focus=document.activeElement,overflow=document.body.style.overflow,dialog=document.createElement('dialog');let closed=false;
  dialog.className='ae-analysis-dialog';dialog.setAttribute('aria-labelledby','ae-analysis-title');
  dialog.innerHTML=`<div class="ae-analysis-dialog-head"><div><h2 id="ae-analysis-title">${esc(catalog.characters[character.key]?.name??character.key)} · ${all?'五件圣遗物词条分析':SLOT_NAMES[slotKey]+'词条分析'}</h2><p data-ae-hint="五件分析评价口径">${esc(ROLES[goal.role]?.name??'自定义用途')} · 按当前角色的主词条目标与有效词条权重分析</p></div><button class="subtle-action" data-analysis-close aria-label="关闭圣遗物分析">关闭</button></div><div data-analysis-content></div>`;
  const render=()=>{dialog.querySelector('[data-analysis-content]').innerHTML=characterArtifactHTML({character,good,goal,catalog,data,slotKey,all});};
  const close=()=>{if(closed)return;closed=true;if(dialog.open)dialog.close();dialog.remove();document.body.style.overflow=overflow;onClose();if(focus?.isConnected)focus.focus({preventScroll:true});};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-analysis-close]'))close();else{const button=event.target.closest('[data-analysis-slot]');if(button){const part=dialog.querySelector(`[data-analysis-part="${button.dataset.analysisSlot}"]`);if(part){part.open=true;part.scrollIntoView({block:'start'});part.querySelector('summary')?.focus({preventScroll:true});}}}});
  root.append(dialog);render();document.body.style.overflow='hidden';try{dialog.showModal();}catch(error){close();throw error;}return{close};
}

// 通用目录选择与直接筛选；沿用现有浮层资源，兼容尚未重启的本地服务。
const types={sword:'单手剑',claymore:'双手剑',polearm:'长柄武器',bow:'弓',catalyst:'法器'};
export function filterButtonsHTML(label,choices,current,attribute){
  const selected=v=>Array.isArray(current)?(!v?!current.length:current.includes(String(v))):String(current??'')===String(v);
  return `<div class="ae-picker-filter-row"><span>${esc(label)}</span><div>${choices.map(([value,name])=>`<button type="button" class="subtle-action" ${attribute} value="${esc(value)}" data-value="${esc(value)}" aria-pressed="${selected(value)}">${esc(name)}</button>`).join('')}</div></div>`;
}
export function refreshFilterButtons(root,attribute,filters){
  for(const button of root.querySelectorAll(`button[${attribute}]`))button.setAttribute('aria-pressed',String(String(filters[button.getAttribute(attribute)]??'')===button.dataset.value));
}
export function catalogChoiceHTML({label,kind,value,catalog,buttonAttributes,inputAttributes='',multiple=false,placeholder=multiple?'选择角色备选':'未填写，点击选择'}){
  const keys=multiple?(value??[]):[value],names=keys.filter(Boolean).map(key=>catalog[kind][key]?.name??key),image=!multiple&&catalog[kind][value]?.image;
  return `<div class="ae-field"><span>${esc(label)}</span><button type="button" class="ae-choice-button" ${buttonAttributes} aria-haspopup="dialog">${image?`<img class="ae-item-image" src="${esc(image)}" alt="" loading="lazy">`:''}<span>${esc(names.join('、')||placeholder)}</span><small>选择</small></button>${inputAttributes?`<input type="hidden" ${inputAttributes} value="${esc(multiple?JSON.stringify(value??[]):value??'')}">`:''}</div>`;
}
export function catalogCandidates(catalog,data,kind,{weaponType='',slot=''}={}){
  return Object.entries(catalog[kind]).filter(([key,m])=>m.wikiId&&(kind!=='weapons'||(!weaponType||m.weaponType===weaponType)&&(!data||data.weapon.data[key]))&&(kind!=='sets'||!data||data.art.data[key]&&(!slot||data.art.data[key].slots.includes(slot))));
}
export function filterCatalogCandidates(entries,data,kind,filters){
  const words=(filters.search??'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(([key,m])=>{
    const rarities=kind==='sets'?(data?.art.data[key]?.rarities??[m.rarity??5]):[m.rarity],stat=data?.weapon.data[key]?.subStat?.type??'none';
    return words.every(word=>[key,m.name,...(m.aliases??[])].join(' ').toLowerCase().includes(word))&&(!filters.rarity?.length||rarities.some(n=>filters.rarity.includes(String(n))))&&(kind!=='sets'||!filters.version?.length||filters.version.includes(artifactMajorVersion(m)))&&(!filters.type?.length||filters.type.includes(m.weaponType))&&(!filters.element?.length||filters.element.includes(m.element))&&(!filters.stat?.length||filters.stat.includes(stat));
  });
}
export function openCatalogPicker({root,catalog,data,kind,selected,multiple=false,weaponType='',slot='',allowEmpty=false,emptyLabel='不选择 / 移除当前配置',allowedKeys=null,title,onChoose,onClose=()=>{},toast=()=>{}}){
  const allowed=allowedKeys===null?null:new Set(allowedKeys);
  const entries=catalogCandidates(catalog,data,kind,{weaponType,slot}).filter(([key])=>!allowed||allowed.has(key)),filters={search:'',rarity:[],version:[],type:[],element:[],stat:[]},chosen=new Set(multiple?selected??[]:selected?[selected]:[]);
  let popup,page=1,composing=false;
  const buttonRow=(name,key,choices)=>filterButtonsHTML(name,[['','全部'],...choices],filters[key],`data-catalog-filter="${key}"`);
  const rarityChoices=[5,4,3,2,1].filter(n=>entries.some(([key,m])=>(kind==='sets'?data?.art.data[key]?.rarities??[m.rarity??5]:[m.rarity]).includes(n))).map(n=>[String(n),n+' 星']);
  function filterHTML(){return (kind==='sets'?buttonRow('登场大版本','version',artifactVersionChoices(entries)):buttonRow('星级','rarity',rarityChoices))+(kind==='characters'?buttonRow('元素','element',Object.entries(ELEMENTS)):kind==='weapons'?(!weaponType?buttonRow('类型','type',Object.entries(types)):'')+(data?buttonRow('副属性','stat',[...new Set(entries.map(([key])=>data.weapon.data[key]?.subStat?.type??'none'))].map(key=>[key,STAT_NAMES[key]??'无副属性'])):''):'');}
  function refresh(){
    popup.dialog.querySelector('[data-catalog-filters]').innerHTML=filterHTML();
    const matches=filterCatalogCandidates(entries,data,kind,filters).sort((a,b)=>kind==='sets'?compareArtifactSets(a[1],b[1]):kind==='characters'?compareCharacterRelease(a[1],b[1])||a[0].localeCompare(b[0]):(b[1].rarity??5)-(a[1].rarity??5)||a[1].name.localeCompare(b[1].name,'zh-CN')),pages=Math.max(1,Math.ceil(matches.length/24));page=Math.max(1,Math.min(page,pages));
    popup.dialog.querySelector('[data-catalog-selected]').innerHTML=multiple?`<p class="ae-muted">已选 ${chosen.size} 名</p><div class="ae-inline-actions">${[...chosen].map(key=>`<button type="button" class="subtle-action" data-catalog-choice="${esc(key)}" aria-pressed="true">${esc(catalog[kind][key]?.name??key)} ×</button>`).join('')}</div>`:'';
    popup.dialog.querySelector('[data-catalog-results]').innerHTML=`<div class="ae-inventory-toolbar"><span>${matches.length} ${kind==='characters'?'名角色':kind==='weapons'?'把武器':'种套装'}</span><div class="ae-inventory-pages"><span>第 ${page} / ${pages} 页</span><button type="button" class="subtle-action" data-catalog-page="-1" ${page===1?'disabled':''}>上一页</button><button type="button" class="subtle-action" data-catalog-page="1" ${page===pages?'disabled':''}>下一页</button></div></div><div class="ae-member-picker-candidates">${matches.slice((page-1)*24,page*24).map(([key,m])=>`<button type="button" class="ae-member-picker-choice ae-rarity-${m.rarity??5} ${chosen.has(key)?'ae-member-picker-current':''}" data-catalog-choice="${esc(key)}" aria-pressed="${chosen.has(key)}">${m.image?`<img class="ae-item-image" src="${esc(m.image)}" alt="" loading="lazy">`:''}<span><strong>${esc(m.name)}</strong><small>${kind==='characters'?`${ELEMENTS[m.element]??''}元素 · ${m.rarity} 星`:kind==='weapons'?`${types[m.weaponType]} · ${m.rarity} 星${data?' · '+(STAT_NAMES[data.weapon.data[key]?.subStat?.type]??'无副属性'):''}`:esc(artifactReleaseLabel(m))+' · '+(data?.art.data[key]?.rarities??[m.rarity??5]).join(' / ')+' 星'}</small></span><small>${chosen.has(key)?'已选':'选择'}</small></button>`).join('')||'<p class="ae-muted">没有匹配内容，请调整筛选。</p>'}</div>`;
  }
  const commit=value=>{const after=onChoose(value);popup.close();after?.();};
  popup=openAssessmentDialog({root,title:title??(kind==='characters'?'选择角色备选':kind==='weapons'?'选择武器':'选择圣遗物套装'),html:`<label class="ae-field"><span>搜索${kind==='characters'?'角色':kind==='weapons'?'武器':'套装'}</span><input type="search" data-catalog-search placeholder="名称、别名或关键词"></label><div class="ae-picker-filters" data-catalog-filters></div><div data-catalog-selected></div><div data-catalog-results></div><div class="ae-inline-actions">${multiple?'<button type="button" class="subtle-action" data-catalog-confirm>确认选择</button>':''}${allowEmpty&&!multiple?`<button type="button" class="subtle-action" data-catalog-empty>${esc(emptyLabel)}</button>`:''}<button type="button" class="subtle-action" data-catalog-clear>清空筛选</button><button type="button" class="subtle-action" data-analysis-close>取消</button></div>`,onClose,onClick:event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    try{
      if(button.hasAttribute('data-catalog-filter')){const key=button.dataset.catalogFilter,value=button.dataset.value;filters[key]=!value?[]:filters[key].includes(value)?filters[key].filter(v=>v!==value):[...filters[key],value];page=1;refresh();}
      else if(button.hasAttribute('data-catalog-page')){page+=Number(button.dataset.catalogPage);refresh();}
      else if(button.hasAttribute('data-catalog-clear')){for(const key of ['rarity','version','type','element','stat'])filters[key]=[];filters.search='';popup.dialog.querySelector('[data-catalog-search]').value='';page=1;refresh();}
      else if(button.hasAttribute('data-catalog-choice')){const key=button.dataset.catalogChoice;if(multiple){chosen.has(key)?chosen.delete(key):chosen.add(key);refresh();}else commit(key);}
      else if(button.hasAttribute('data-catalog-confirm'))commit([...chosen]);
      else if(button.hasAttribute('data-catalog-empty'))commit('');
    }catch(error){toast(error.message);}
  }});
  const search=event=>{event.stopPropagation();if(event.target.hasAttribute('data-catalog-search')&&!composing&&!event.isComposing){filters.search=event.target.value;page=1;refresh();}};
  popup.dialog.addEventListener('input',search);popup.dialog.addEventListener('compositionstart',event=>{event.stopPropagation();composing=true;});popup.dialog.addEventListener('compositionend',event=>{composing=false;search(event);});refresh();return popup;
}

// 配装计算与生成分析共用目标选择：角色、分类、搜索及双面板切换。
const objectiveCategories={metrics:'词条评价',panel:'面板',damage:'伤害',healing:'治疗',team:'全队合计'};
export function openCalculationTargetPicker({root,catalog,objectives,members,selectedTarget,selectedValue,onChoose,onClose=()=>{},toast=()=>{}}){
 const targetMembers=members,renderedTargetKey=selectedTarget,ownerName=key=>key==='team'?'全队':catalog.characters[key]?.name??key;
  let owner=renderedTargetKey,search='',composing=false,picker;const selected=selectedValue??'';
  let panelMode=selected.startsWith('panel:')?'battle':'idle';
  const panelGroups={idle:'非战斗面板',battle:'队伍战斗面板'};
  const choiceHTML=e=>`<button type="button" class="ae-opt-objective-choice" data-opt-objective-choice="${e.index}" data-target="${esc(e.targetKey)}" data-value="${esc(e.value)}" aria-pressed="${e.targetKey===renderedTargetKey&&e.value===selected}" title="${esc(e.description)}" ${e.disabled?'disabled':''}><strong>${esc(e.name)}</strong></button>`;
  function groupedHTML(matches){
   return Object.keys(objectiveCategories).map(category=>{const entries=matches.filter(e=>e.category===category);if(!entries.length)return '';
    if(category==='panel')return `<section class="ae-opt-objective-group" data-opt-objective-group="panel"><div class="ae-opt-objective-panel-heading"><h3>${objectiveCategories.panel}</h3><div class="ae-opt-objective-filters ae-opt-objective-panel-tabs" role="group" aria-label="面板类型">${Object.entries(panelGroups).map(([mode,name])=>`<button type="button" class="subtle-action" data-opt-objective-panel-mode="${mode}" aria-pressed="${panelMode===mode}" aria-controls="opt-objective-panel-${esc(entries[0].targetKey)}-${mode}">${name}</button>`).join('')}</div></div>${Object.entries(panelGroups).map(([mode,name])=>`<section class="ae-opt-objective-subgroup" id="opt-objective-panel-${esc(entries[0].targetKey)}-${mode}" data-opt-objective-subgroup="${name}" data-opt-objective-panel-body="${mode}" ${panelMode===mode?'':'hidden'}><div class="ae-opt-objective-candidates">${entries.filter(e=>e.group===name).map(choiceHTML).join('')||'<p class="ae-muted">当前面板没有匹配项目。</p>'}</div></section>`).join('')}</section>`;
    const groups=['damage','healing'].includes(category)?[...new Set([...Object.keys(DAMAGE_GROUP_NAMES),...entries.map(e=>e.group)])].filter(group=>entries.some(e=>e.group===group)):[''];
    return `<section class="ae-opt-objective-group" data-opt-objective-group="${category}"><h3>${objectiveCategories[category]}</h3>${groups.map(group=>`<section class="ae-opt-objective-subgroup" ${group?`data-opt-objective-subgroup="${esc(group)}"`:''}>${group?`<h4>${esc(DAMAGE_GROUP_NAMES[group]??group)}</h4>`:''}<div class="ae-opt-objective-candidates">${entries.filter(e=>!group||e.group===group).map(choiceHTML).join('')}</div></section>`).join('')}${category==='team'?`<p data-ae-hint="计算目标类型说明" class="ae-muted">${esc(entries[0].description)}</p>`:''}</section>`;
   }).join('')||'<p class="ae-muted">没有匹配项目，请调整搜索词。</p>';
  }
  function refresh(){
   const words=search.trim().toLowerCase().split(/\s+/).filter(Boolean),matches=objectives.map((entry,index)=>({...entry,index})).filter(e=>(words.length||e.targetKey===owner)&&words.every(word=>[ownerName(e.targetKey),e.name,e.group,e.description,objectiveCategories[e.category]].join(' ').toLowerCase().includes(word)));
   const panels=matches.filter(e=>e.category==='panel');if(panels.length&&!panels.some(e=>e.group===panelGroups[panelMode]))panelMode=panels.some(e=>e.group===panelGroups.idle)?'idle':'battle';
   picker.dialog.querySelector('[data-opt-objective-owners]').innerHTML=[...targetMembers.map(key=>[key,ownerName(key)]),['team','全队合计']].map(([key,name])=>`<button type="button" class="subtle-action" data-opt-objective-owner="${esc(key)}" aria-pressed="${owner===key}">${esc(name)}</button>`).join('');
   picker.dialog.querySelector('[data-opt-objective-results]').innerHTML=words.length&&matches.length?[...targetMembers,'team'].map(key=>{const entries=matches.filter(e=>e.targetKey===key);return entries.length?`<section data-opt-objective-member="${esc(key)}"><h3>${esc(ownerName(key))}</h3>${groupedHTML(entries)}</section>`:'';}).join(''):groupedHTML(matches);
  }
  picker=openAssessmentDialog({root,title:'选择计算目标',html:'<label class="ae-field"><span>搜索计算项目</span><input type="search" data-opt-objective-search placeholder="技能、属性或关键词"></label><div class="ae-opt-objective-filters" data-opt-objective-owners></div><div data-opt-objective-results></div>',onClose,onClick:event=>{
   const button=event.target.closest('button');if(!button||button.disabled)return;
   if(button.hasAttribute('data-opt-objective-owner')){owner=button.dataset.optObjectiveOwner;refresh();}
   else if(button.hasAttribute('data-opt-objective-panel-mode')){panelMode=button.dataset.optObjectivePanelMode;for(const tab of picker.dialog.querySelectorAll('[data-opt-objective-panel-mode]'))tab.setAttribute('aria-pressed',String(tab.dataset.optObjectivePanelMode===panelMode));for(const panel of picker.dialog.querySelectorAll('[data-opt-objective-panel-body]'))panel.hidden=panel.dataset.optObjectivePanelBody!==panelMode;}
   else if(button.hasAttribute('data-opt-objective-choice'))try{const entry=objectives[Number(button.dataset.optObjectiveChoice)];if(!entry||entry.disabled)return;const after=onChoose(entry);picker.close();after?.();}catch(error){toast(error.message);}
  }});
  picker.dialog.classList.add('ae-opt-objective-dialog','ae-opt-goal-dialog');const input=picker.dialog.querySelector('[data-opt-objective-search]');input.addEventListener('input',event=>{event.stopPropagation();if(composing||event.isComposing)return;search=input.value;refresh();});input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;search=input.value;refresh();});refresh();input.focus({preventScroll:true});return picker;
 }
