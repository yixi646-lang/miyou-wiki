import {defaultGoal,STAT_NAMES,SLOT_NAMES} from './model.mjs';
import {recommendationData} from './recommendation-data.mjs';
import {recommendationPlan,recommendationPlans,splitGuideTeams,normalizeGuideArtifactPlans} from './recommendation-plans.mjs';
export function recommendedGoal(key,element,settings){
  if(settings?.version===2)return structuredClone(recommendationPlan(key,'goal',settings,'default',element).value);
  const p=settings?.records?.[key];
  if(p?.defaultRole&&p.goals?.[p.defaultRole])return structuredClone(p.goals[p.defaultRole]);
  const recommendation=recommendationData.records[key];
  if(recommendation)return structuredClone(p?.goals?.[recommendation.goal.role]??recommendation.goal);
  const g=defaultGoal('custom',element);g.effectiveRolls=0;g.mainStats={sands:[],goblet:[],circlet:[]};g.notes='该角色暂无已核查推荐，请按实际用途设置目标。';return g;
}
export function goalDefaults(key,element,role,settings){
  if(settings?.version===2){const saved=recommendationPlan(key,'goal',settings,'default',element).value;if(saved.role===role)return structuredClone(saved);}
  const saved=settings?.records?.[key]?.goals?.[role];if(saved)return structuredClone(saved);
  const original=recommendationData.records[key]?.goal;
  return original?.role===role?structuredClone(original):{...defaultGoal(role,element),effectiveRolls:0};
}
export function recommendationFor(key,settings){
  const original=recommendationData.records[key];if(!original)return null;
  if(settings?.version===2)return {...original,goal:recommendationPlan(key,'goal',settings).value,guide:recommendationPlan(key,'guide',settings).value};
  return {...original,goal:recommendedGoal(key,undefined,settings),guide:settings?.records?.[key]?.guide??original.guide};
}
export function planControlsHTML(key,kind,settings,{prefix=''}={}){
  const c=recommendationPlans(key,kind,settings),defaultPlan=c.plans.find(p=>p.id===c.defaultId);
  return `<div class="ae-plan-controls${kind==='guide'?' ae-guide-plan-controls':''}">${prefix}<label class="ae-field"><span>${kind==='guide'?'显示攻略方案':'显示评价方案'}</span><select data-rec-display="${kind}">${c.plans.map(p=>`<option value="${esc(p.id)}" ${p.id===c.displayId?'selected':''}>${esc(p.name)}${p.builtin?' · 只读':''}${p.id===c.defaultId?' · 默认':''}</option>`).join('')}</select></label><button class="subtle-action" data-ae="set-plan-default" data-kind="${kind}" ${c.defaultId===c.displayId?'disabled':''}>将显示方案设为默认</button><span class="ae-muted">默认：${esc(defaultPlan.name)}</span></div>`;
}
export function editableGuide(key,settings,custom){
  const p=recommendationFor(key,settings);if(!p?.guide)throw Error('该角色暂无可编辑攻略。');
  const guide=structuredClone(custom??p.guide);
  guide.teams=splitGuideTeams(guide.teams);
  guide.build??=structuredClone({sets:recommendationData.records[key].goal.sets,mainStats:recommendationData.records[key].goal.mainStats,talent:recommendationData.records[key].goal.talent});
  return normalizeGuideArtifactPlans(guide);
}

export function characterGuideHTML(key,catalog,good={weapons:[]},{settings}={}){
  const p=recommendationFor(key,settings);if(!p?.guide)return'';
  const guide=editableGuide(key,settings),name=catalog.characters[key]?.name??key;
  const link=(m,body)=>m?.wikiId?`<a href="/?game=genshin&entry=${encodeURIComponent(m.wikiId)}">${body}</a>`:body;
  const image=m=>m?.image?`<img src="${esc(m.image)}" alt="" loading="lazy">`:'';

  const weapons=guide.weapons.map(w=>{const m=catalog.weapons[w.key],owned=(good.weapons??[]).filter(a=>a.key===w.key).length;return `<article class="ae-guide-equipment">${link(m,image(m))}<div><strong>${link(m,esc(m?.name??w.key))}</strong><small>${m?.rarity??'?'} 星${owned?' · 库存 '+owned+' 把':''}</small><p>${esc(w.note)}</p></div></article>`;}).join('');
  const artifacts=guide.artifactPlans.filter(p=>p.display).map(p=>{
    const sets=p.sets.map(key=>{const m=catalog.sets[key];return `<div class="ae-guide-equipment">${link(m,image(m))}<div><strong>${link(m,esc(m?.name??key))} · ${p.mode==='four'?'四件套':'二件套'}</strong></div></div>`;}).join('');
    const mains=Object.entries(p.mainStats).map(([slot,keys])=>`<div><span>${SLOT_NAMES[slot]}</span><strong>${keys.map(key=>esc(STAT_NAMES[key])).join(' / ')||'未限制'}</strong></div>`).join('');
    return `<article class="ae-guide-artifact-plan"><h3>${esc(p.name)} <small>${p.mode==='four'?'四件套':'2+2'}</small></h3><div class="ae-guide-equipment-grid">${sets}</div><div class="ae-guide-mainstats">${mains}</div></article>`;
  }).join('');
  const teams=guide.teams.map(t=>`<article class="ae-guide-team"><div class="ae-guide-team-slots">${t.slots.map((slot,i)=>{const character=catalog.characters[slot.characters[0]];return `<div><small>位置 ${i+1}</small><span>${image(character)}</span><strong>${esc(character?.name??'未选择角色')}</strong></div>`;}).join('')}</div>${t.note?`<p>${esc(t.note)}</p>`:''}</article>`).join('');

  const displayPlan=recommendationPlan(key,'guide',settings);
  const source=guide.source.url?`<a href="${esc(guide.source.url)}" target="_blank" rel="noreferrer">${esc(guide.source.name||'参考链接')}</a>`:esc(guide.source.name||'自定义整理');
  return `<details class="panel ae-section ae-character-guide" data-ae-disclosure="character-guide"><summary>${esc(name)}培养攻略 · 武器、圣遗物与配队</summary>${planControlsHTML(key,'guide',settings,{prefix:`<button class="subtle-action" data-ae="edit-guide">管理攻略方案</button>`})}<p class="ae-guide-intro">${esc(guide.intro)}</p><p data-ae-hint="角色培养攻略使用说明" class="ae-muted">配装按这里注明的用途考虑；武器为攻略中的备选，排序不代表统一强弱。其他玩法请结合来源与队伍试算。攻略展示不会修改当前评价目标、队伍或实际装备。</p><details data-ae-disclosure="guide-weapons"><summary>推荐武器与选择条件</summary><div class="ae-guide-equipment-grid">${weapons}</div></details><details data-ae-disclosure="guide-artifacts"><summary>推荐圣遗物与培养方向</summary>${artifacts||'<p class="ae-muted">暂无展示的圣遗物方案。</p>'}${guide.artifactAdvice?`<p class="ae-guide-artifact-advice">${esc(guide.artifactAdvice)}</p>`:''}</details><details data-ae-disclosure="guide-teams"><summary>四位置配队</summary><div class="ae-guide-teams">${teams}</div></details><p class="ae-muted">${!displayPlan.builtin?'自定义内容参考：':'依据：'}${source}${guide.source.version?' · 攻略版本 '+esc(guide.source.version):''}${displayPlan.builtin?' · 资料核查 '+esc(guide.source.checkedAt):''}。<span data-ae-hint="攻略来源适用范围说明">内容已保存在本地，可离线阅读；来源可能针对不同版本与命座条件。</span></p></details>`;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function goalHelpHTML(key,settings){
  const p=recommendationFor(key,settings),g=p?.goal;
  return `<details class="ae-weight-help" data-ae-disclosure="goal-help"><summary>怎样设置评价目标与词条权重</summary><p><strong>评价目标</strong>是你希望培养到的等级、天赋、主词条、套装与面板。完成度表示这些目标的完成程度，不表示角色强度，也不直接等于伤害。</p><p><strong>权重</strong>是每个五星平均档副词条在评价中占多少“有效词条”。0＝忽略，0.5＝算半条，1＝算一条，2＝算两条。有效词条＝各副词条数值 ÷ 该属性五星平均档数值 × 权重，再求和；主词条、套装与天赋另外检查。</p><p>例如双暴合计4个平均档、攻击3档、充能2档，权重分别为1、0.75、0.5，则有效词条为 4×1＋3×0.75＋2×0.5＝7.25。不同属性先换算成平均档，所以暴击率与暴击伤害同设1不代表原始百分比等值；实际强化次数另有统计。</p><p><strong>开始设置：</strong>先采用下面的角色推荐；根据实际用途选择主词条与套装。爆发必须循环的角色先填队伍所需充能目标，够用后降低充能权重。输出角色再关注对应倍率属性和双暴；超绽放/扩散主要看等级与精通；治疗或护盾主要看对应生命、攻击、防御。西风武器才另外考虑触发所需暴击率。</p><p>暴击溢出、充能已足够、属性达到机制上限后，固定权重仍会继续加分，需要手动调整。精通价值取决于反应归属与队伍。权重只改变评价与词条分析，<strong>不会改变伤害公式</strong>；比较真实收益请到独立队伍页切换配装。</p><p><strong>默认值的依据：</strong>主词条、用途与优先级参考角色攻略；具体0–2权重、目标天赋级数、20/15有效词条是本地模板的透明约定。不是官方评分或全角色统一最优解。已有自定义值保留。可用“管理评价方案 / 编辑权重方案”管理通用多套评价方案，再按需点击“采用角色推荐”或分组“恢复默认”。充能及其他面板阈值默认不填，避免把某一队伍的阈值套给全部队伍。</p></details>${p?`<details class="ae-weight-help" data-ae-disclosure="goal-recommendation"><summary>当前显示的通用评价方案与依据</summary>${planControlsHTML(key,'goal',settings)}<p data-ae-hint="通用评价方案使用说明" class="ae-muted">显示方案用于查看参考；默认方案用于新建角色与恢复默认。已有账号目标保持当前设置，点击采用后才替换。</p><p>${esc(g.notes||p.source.basis)}</p><p>参考培养起点：角色${g.level}级，武器${g.weaponLevel}级；普攻/战技/爆发 ${g.talent.auto}/${g.talent.skill}/${g.talent.burst}；目标有效词条 ${g.effectiveRolls}。</p><p>副词条权重：${Object.entries(g.weights).filter(([,v])=>v>0).map(([k,v])=>esc(STAT_NAMES[k])+' '+v).join('、')}。</p><p>来源：<a href="${esc(p.source.url)}" target="_blank" rel="noreferrer">${esc(p.source.name)}</a> · 核查 ${esc(p.source.checkedAt)}。覆盖本地120名角色及空、荧各七元素；推荐内容已本地保存，可离线使用。</p><button class="subtle-action" data-ae="apply-displayed-goal">采用显示方案（仅评价目标）</button><button class="subtle-action" data-ae="apply-recommendation">采用默认方案（仅评价目标）</button></details>`:''}`;
}
