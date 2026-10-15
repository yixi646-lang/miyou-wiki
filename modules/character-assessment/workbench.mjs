import {createArtifactResearch,createArtifactPotential} from './artifact-research-ui.mjs';
import {focusNameInput} from '../../shared/name-input.mjs';
import {readScrollPosition,restoreScrollPosition} from '../../shared/view-state.mjs';
import {potentialSourceIndex,potentialSimulationGOOD} from './core/artifact-research.mjs';
import {advancedActionsHTML,downloadActions} from './multitarget-ui.mjs';
import {normalizeActions} from './core/multitarget.mjs';
import {createOptimizer} from './optimizer-ui.mjs';
import {isCustom,customMarkers,originMatches,managedInventory,storeCustomEquipment,serializeManagedState} from './core/managed-inventory.mjs';
import {calculateTrace,statLabel} from './core/calculator.mjs';
import {SLOTS,SLOT_NAMES,STAT_NAMES,MAIN_STATS,SUBSTATS,ELEMENTS,equipment,equipmentLocation,validateGOOD,statDisplay} from './core/model.mjs';
import {calculateTeam,memberScenario,comboDamage,captureTeamPlan,goodWithPlan as planGOOD,upgradeReference,teamKeys} from './core/combat.mjs';
import {calculatePreparedTeam,ARTIFACT_TRIGGER_VERSION} from './core/artifact-triggers.mjs';
import {ARTIFACT_TRIGGER_SETS} from './core/artifact-trigger-data.mjs';
import {artifactTriggerAuditHTML} from './analysis-dialog.mjs';
import {artifactFilters,filterArtifacts,matchesEquipment,weaponBaseStats,sortWeapons,ARTIFACT_SORTS,WEAPON_SORTS} from './core/inventory.mjs';
import {artifactVersionChoices,compareArtifactSets} from './core/artifact-order.mjs';
import {blocksLockedButton,blocksLockedInput} from './core/permissions.mjs';
import {removeEquipment,removeTeam,addTeam,saveTeam,renameTeam} from './core/actions.mjs';
import {artifactMaxLevel,artifactInitialCounts,substatTiers,draftFromArtifact,inspectDraft,createArtifactEditor,switchArtifactMode,artifactEditorSnapshot} from './core/artifacts.mjs';
import {artifactAnalysisHTML,artifactCountSummary,customArtifactHTML,artifactIconHTML} from './artifact-ui.mjs';
import {openTrialEquipmentEditor} from './trial-equipment-editor.mjs';
import {filterTeamCharacters,characterPickerFiltersHTML,toggleCharacterFilter} from './character-filters.mjs';
import {filterButtonsHTML,refreshFilterButtons,openCatalogPicker,catalogChoiceHTML} from './analysis-dialog.mjs';
export {filterTeamCharacters} from './character-filters.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scenarioReset=(group,owner='')=>`<button class="subtle-action ae-reset" data-native="reset-scenario-group" data-group="${esc(group)}" ${owner?`data-owner="${esc(owner)}"`:''}>恢复默认</button>`;
const opt=(v,t,s)=>`<option value="${esc(v)}" ${String(v)===String(s)?'selected':''}>${esc(t)}</option>`;
const num=(title,value,attrs,min=0,max=1e7,step=1)=>`<label class="ae-field"><span>${esc(title)}</span><input type="number" value="${value??''}" ${attrs} min="${min}" max="${max}" step="${step}"></label>`;
const field=(title,html)=>`<label class="ae-field"><span>${esc(title)}</span>${html}</label>`;
const disclosureKey=detail=>detail.dataset.nativeDisclosure??detail.dataset.popupDisclosure??detail.dataset.cardDisclosureTitle??detail.querySelector('summary')?.textContent;
const inputSelection=node=>typeof node?.selectionStart==='number'?{start:node.selectionStart,end:node.selectionEnd,direction:node.selectionDirection??'none',scrollLeft:node.scrollLeft??0}:null;
function restoreInputFocus(node,selection){
  if(!node)return;node.focus({preventScroll:true});
  if(selection&&typeof node.setSelectionRange==='function'){node.setSelectionRange(selection.start,selection.end,selection.direction);node.scrollLeft=selection.scrollLeft;}
}

function refreshFilteredRegions(root,html,selectors){
  const targets=selectors.map(selector=>root.querySelector(selector));
  if(targets.some(node=>!node))return false;
  const next=document.createElement('div');next.innerHTML=html;
  const sources=selectors.map(selector=>next.querySelector(selector));
  if(sources.some(node=>!node))return false;
  for(let i=0;i<targets.length;i++)targets[i].innerHTML=sources[i].innerHTML;
  return true;
}

// 输入法组合期间保留原输入节点，提交文字后再筛选或重绘。
export function createCompositionInputHandler(onInput){
  const composing=new WeakSet();
  return{
    isComposing:node=>composing.has(node),
    start:event=>composing.add(event.target),
    end:event=>{composing.delete(event.target);return onInput(event);},
    input:event=>{if(!event.isComposing&&!composing.has(event.target))return onInput(event);}
  };
}
import {DAMAGE_GROUP_NAMES as groupNames,damageResultGroupsHTML,teamDamageComparisonHTML,inventoryArtifactHTML,openAssessmentDialog} from './analysis-dialog.mjs';
import {recommendedGoal} from './core/profiles.mjs';
import {membersOf,configureMembers,growthTeamChoices,growthTeamScenario,switchEquipment,replaceWithTrialEquipment,hasTrialEquipment,actualEquipmentFromTrial} from './core/teams.mjs';
const reactions={vaporize:'蒸发',melt:'融化',aggravate:'超激化',spread:'蔓激化'};
import {nativeKey,readWorkspace,scenarioFor,defaultScenario} from './core/workspace.mjs';
export {readWorkspace,scenarioFor} from './core/workspace.mjs';
export function panelHTML(panel,base=null){
  if(!panel)return'<p class="ae-warning">请核对角色和装备是否在计算支持范围内。</p>';
  const keys=['hp','atk','def','eleMas','enerRech_','critRate_','critDMG_','heal_',...Object.keys(ELEMENTS).map(e=>e+'_dmg_'),'physical_dmg_'];
  return`<div class="ae-panel-stats">${keys.filter(k=>keys.indexOf(k)<7||panel[k]).map(k=>`<div><span>${STAT_NAMES[k]}</span><strong>${statDisplay(panel[k],k)}</strong>${base?`<small>基础 ${statDisplay(base[k]??0,k)}</small>`:''}</div>`).join('')}</div>`;
}

const weaponTypes={sword:'单手剑',claymore:'双手剑',polearm:'长柄武器',bow:'弓',catalyst:'法器'};
export function weaponMatches(key,m,source,filters){
  const terms=(filters.search??'').trim().toLowerCase().split(/\s+/).filter(Boolean),text=[m.name,key,...(Array.isArray(m.aliases)?m.aliases:[])].join(' ').toLowerCase();
  return(!filters.type||m.weaponType===filters.type)&&(!filters.rarity||m.rarity===Number(filters.rarity))&&(!filters.stat||(source?.subStat?.type??'none')===filters.stat)&&terms.every(t=>text.includes(t));
}
export function filterWeaponChoices(catalog,data,filters){return Object.entries(catalog.weapons).filter(([key,m])=>m.wikiId&&data.weapon.data[key]&&weaponMatches(key,m,data.weapon.data[key],filters)).sort((a,b)=>b[1].rarity-a[1].rarity||a[1].name.localeCompare(b[1].name,'zh-CN'));}

export function filterTeamEquipment(good,member,kind,slot,catalog,data,filters,weights={}){
  const location=equipmentLocation(member);
  if(kind==='artifacts')return filterArtifacts(good.artifacts,catalog,data,{...filters,slot},weights,location).filter(({a})=>originMatches(a,filters.origin));
  const items=good.weapons.map((item,i)=>({item,i})).filter(({item})=>originMatches(item,filters.origin)&&weaponMatches(item.key,catalog.weapons[item.key]??{name:item.key},data.weapon.data[item.key],{...filters,type:catalog.characters[member]?.weaponType})&&matchesEquipment(item,filters.status,filters.lock,location)&&(!filters.minLevel||item.level>=Number(filters.minLevel))&&(!filters.maxLevel||item.level<=Number(filters.maxLevel))&&(!filters.refinement||item.refinement>=Number(filters.refinement)));
  return sortWeapons(items,catalog,data,filters.sort).map(({item,i})=>({a:item,i}));
}

export function createWorkbench({pane,readState,readSelected,catalog,data,selectionHTML,buildHTML,changed,recordUndo=()=>{},replaceState=()=>{throw Error('请刷新后再应用推荐。');},readAccount=()=>({locked:isReadOnly()}),toast,selectCharacter,readGoal,isReadOnly=()=>false,onRendered=()=>{},onEvaluationChange=()=>{}}){
  let teamTab='conditions',conditionTab='enemy',conditionOwner='';
  let artifactPage='inventory';let inventoryOrigin='',artifactFilter=artifactFilters(),inventoryPage=1,pageSize=60,weaponSort='level-desc';let teamName=null,planName='';let previewPlan=null,upgradeTarget=null,upgradeBasis='';let enginePage='teams',page='teams',teamId='',inventorySearch='',slotFilter='',setFilter='',weaponFilter='',weaponRarity='',weaponStat='',weaponStatus='',weaponPicker=null,editing=null,last=null,resultError='',target='',upgrade=null,customEditing=null,floating=null;
  let loadoutConditionsReview=false;let trialGood=null,comparisonBaseline=null,trialBasis='',baselineName='当前账号装备',currentPlanName='',currentPlanBasis='',trialPreparation=null;
  let teamPicker=null,memberPicker=null,customPopup=null,catalogPopup=null;const teamPickerFilters=new Map();
  const memberFilter={element:[],rarity:[],search:''};
  const permissionContext=()=>({state:state(),selected:readSelected(),customEditing,weaponPicker});
  const badge=item=>isCustom(item)&&customMarkers(state())?'<em class="ae-custom-badge">自定义</em>':'';
  const originFilter=()=>field('来源',`<select data-inventory-origin>${[['','全部来源'],['original','原有库存'],['custom','自定义库存']].map(([k,n])=>opt(k,n,inventoryOrigin)).join('')}</select>`);
  let artifactReference='';
  let inventoryViews={},foldStates={},renderedPage='';
  function rememberInventory(){if(['artifacts','weapons'].includes(page))inventoryViews[page]={inventoryOrigin,inventorySearch,inventoryPage,pageSize,weaponSort,artifactFilter:structuredClone(artifactFilter),weaponFilter,weaponRarity,weaponStat,weaponStatus};}
  function restoreInventory(category){
    const view=inventoryViews[category]??{};inventoryOrigin=view.inventoryOrigin??'';inventorySearch=view.inventorySearch??'';inventoryPage=Math.max(1,Number(view.inventoryPage)||1);pageSize=[24,60,120].includes(view.pageSize)?view.pageSize:60;
    weaponSort=view.weaponSort??'level-desc';artifactFilter={...artifactFilters(),...view.artifactFilter};artifactFilter.subs=Array.isArray(artifactFilter.subs)?artifactFilter.subs:[];artifactFilter.subMin={...artifactFilter.subMin};
    weaponFilter=view.weaponFilter??'';weaponRarity=view.weaponRarity??'';weaponStat=view.weaponStat??'';weaponStatus=view.weaponStatus??'';slotFilter=artifactFilter.slot;setFilter=artifactFilter.set;
  }
  function rememberFolds(){if(renderedPage)for(const detail of pane.querySelectorAll('details'))foldStates[renderedPage+':'+disclosureKey(detail)]=detail.open;}
  function viewState(){rememberInventory();rememberFolds();return structuredClone({enginePage,teamTab,conditionTab,conditionOwner,artifactPage,artifactReference,inventoryViews,foldStates});}
  function restoreViewState(view={}){
    inventoryViews=structuredClone(view.inventoryViews??{});foldStates={...view.foldStates};renderedPage='';
    enginePage=['teams','optimizer'].includes(view.enginePage)?view.enginePage:'teams';teamTab=['conditions','loadouts','panel','damage','actions'].includes(view.teamTab)?view.teamTab:'conditions';conditionTab=['enemy','mechanics','bonus'].includes(view.conditionTab)?view.conditionTab:'enemy';conditionOwner=view.conditionOwner??'';
    artifactPage=view.artifactPage==='potential'?'potential':'inventory';artifactReference=view.artifactReference??'';page=enginePage;restoreInventory(page);
  }
  const state=()=>readState(),key=()=>page==='teams'?teamMembers()[0]??'':page==='artifacts'?artifactReference:page==='weapons'?'':readSelected(),meta=k=>catalog.characters[k]??{name:k},current=()=>state().good.characters.find(c=>c.key===key());
  const workspace=()=>readWorkspace(state());
  const weights=()=>page==='artifacts'?(artifactReference?readGoal?.(artifactReference)?.weights??state().goals[artifactReference]?.weights??recommendedGoal(artifactReference,meta(artifactReference).element).weights:{}):readGoal?.()?.weights??state().goals[readSelected()]?.weights??{};
  const inventoryWeights=()=>artifactReference?weights():null;
  function chooseArtifactReference(value){
    if(value&&!state().good.characters.some(c=>c.key===value))throw Error('请选择当前账号已添加的角色。');
    artifactReference=value;inventoryPage=1;
    if(!value){artifactFilter.minEffective='';if(artifactFilter.status==='current')artifactFilter.status='';if(artifactFilter.sort==='effective')artifactFilter.sort='level-desc';}
  }
  function openArtifactReference(){
    catalogPopup?.close();catalogPopup=openCatalogPicker({root:popupRoot(),catalog,data,kind:'characters',selected:artifactReference,allowedKeys:state().good.characters.map(c=>c.key),allowEmpty:true,emptyLabel:'不选择角色（隐藏词条权重评价）',title:'选择词条评价角色',toast,onClose:()=>{catalogPopup=null;},onChoose:value=>{chooseArtifactReference(value);return()=>render();}});
  }
  const commit=w=>{state().engineStorage[nativeKey]=JSON.stringify(w);changed();};
  const activeTeam=()=>workspace().teams.find(t=>t.id===teamId)??workspace().teamDraft;
  const teamMembers=()=>membersOf(activeTeam()).filter(k=>state().good.characters.some(c=>c.key===k));
  const scenario=()=>{const team=activeTeam(),members=teamMembers();if(page==='teams')return structuredClone(team?.scenario??defaultScenario());return members.includes(readSelected())?configureMembers(team.scenario,members,[readSelected(),...members.filter(k=>k!==readSelected())]):defaultScenario();};
  const restoreTeam=()=>{teamId=workspace().activeTeamId??'';teamName=null;};
  restoreTeam();
  const rememberTeam=()=>{const w=workspace();w.activeTeamId=teamId;commit(w);};
  const saveScenario=s=>{const w=workspace();const team=w.teams.find(t=>t.id===teamId)??w.teamDraft;team.scenario=structuredClone(s);team.character=team.members?.[0]??'';w.activeTeamId=teamId;commit(w);};
  const closeFloating=()=>{potential?.closeDetails();research?.close();catalogPopup?.close();catalogPopup=null;customPopup?.close();customPopup=null;floating?.close();floating=null;teamPicker=null;memberPicker=null;};
  const popupRoot=()=>pane.closest?.('.assessment-root')??pane;
  const image=(m,size='')=>m?.image?`<img class="ae-item-image ${size}" src="${esc(m.image)}" alt="" loading="lazy">`:'';
  const locationName=k=>k==='Traveler'?'旅行者':meta(k).name;
  const check=(kind,item)=>{const r=validateGOOD({format:'GOOD',version:3,[kind]:[item]},data);if(r.errors.length)throw Error(r.errors[0]);};
  const calculationGOOD=()=>trialGood??(previewPlan?planGOOD(state().good,key(),previewPlan):state().good);
  const plans=()=>workspace().teamPlans.filter(p=>p.teamId===teamId||!p.teamId);
  const currentLoadoutName=()=>currentPlanName?'队伍方案：'+currentPlanName:trialGood||previewPlan?'未保存试算':'当前账号装备';
  const rememberBaseline=(replace=false)=>{if(replace||!comparisonBaseline){comparisonBaseline=structuredClone(calculationGOOD());baselineName=currentLoadoutName();}};
  const clearTrial=()=>{loadoutConditionsReview=false;trialGood=null;comparisonBaseline=null;previewPlan=null;trialBasis='';baselineName='当前账号装备';currentPlanName='';currentPlanBasis='';trialPreparation=null;};
  const trialCalculate=good=>trialPreparation?calculatePreparedTeam(good,key(),scenario(),trialPreparation):calculateTeam(good,key(),scenario());
  function calculate(){try{last=current()?trialCalculate(calculationGOOD()):null;resultError='';}catch(e){last=null;resultError=e.message;}return last;}
  const damageRows=()=>last?.rows??[];
  function chosenTarget(){const rows=damageRows();return rows.find(r=>r.path===(target||scenario().target))??rows.find(r=>r.group==='skill')??rows[0];}
  function conditionHTML(){
    const list=last?.conditions??[],isResult=f=>['damage','heal'].includes(f.resultType),sameField=(a,b)=>a.label===b.label&&a.value===b.value&&a.unit===b.unit;
    const visibleFields=c=>[...(c.options.find(o=>o.value===c.value)?.fields??[]),...(c.currentFields??[])].filter((f,i,a)=>!isResult(f)&&a.findIndex(x=>sameField(x,f))===i);
    const weapons=(last?.effects??[]).filter(e=>e.source==='武器效果').map(e=>{
      const controls=list.filter(c=>c.documentId===e.id),shown=controls.flatMap(visibleFields);
      return{...e,automatic:!controls.length,fields:e.fields.filter((f,i,a)=>!isResult(f)&&a.findIndex(x=>sameField(x,f))===i&&!shown.some(x=>sameField(x,f)))};
    }).filter(e=>e.fields.length||e.automatic&&e.description);
    const owners=[...new Set([...list.map(c=>c.owner),...weapons.map(e=>e.owner)])];
    if(!owners.length)return'<p class="ae-muted">当前配装没有可切换的额外机制。</p>';
    const valuesHTML=fields=>fields.map(f=>`<div><span>${esc(f.label)}</span>${f.textOnly?'':`<strong>${Number.isFinite(f.value)?Number(f.value).toFixed(Math.min(6,Math.max(0,f.precision??1))):esc(f.value)}${esc(f.unit)}</strong>`}</div>`).join('');
    const controlHTML=(c,i)=>{
      const values=valuesHTML(visibleFields(c));
      return field(c.title,`<select data-native-cond="${i}" ${trialPreparation&&ARTIFACT_TRIGGER_SETS[c.path[0]]?'disabled title="推荐对比中的套装条件由代码规则计算；恢复账号装备后可手动设置"':''}>${c.options.map(o=>opt(o.value,o.label,c.value)).join('')}</select><small>${esc([c.source,c.sourceName].filter(Boolean).join(' · '))}</small>${values?`<div class="ae-effect-values">${values}</div>`:''}${c.description?`<details data-ae-hint="机制效果说明" class="ae-condition-description" data-native-disclosure="condition-description-${esc(c.owner)}-${esc(c.path.join('.'))}"><summary>效果说明</summary><p>${esc(c.description)}</p></details>`:''}`);
    };
    const weaponHTML=e=>`<div class="ae-field ae-automatic-effect" data-automatic-weapon="${esc(e.owner)}"><span>${esc(e.sourceName)} · ${esc(e.title)}</span><strong class="ae-automatic-state">${e.automatic?'自动计算':'当前生效数值'}</strong>${e.fields.length?`<div class="ae-effect-values">${valuesHTML(e.fields)}</div>`:''}${e.description?`<details class="ae-condition-description" data-ae-hint="武器效果说明" data-native-disclosure="weapon-description-${esc(e.id)}"><summary>效果说明</summary><p>${esc(e.description)}</p></details>`:''}</div>`;
    return owners.map(owner=>`<section class="ae-condition-group" data-condition-owner="${esc(owner)}" data-native-disclosure="conditions-${esc(owner)}"><div class="ae-condition-actions">${scenarioReset('conditions',owner)}</div><div class="ae-fields ae-condition-fields">${list.map((c,i)=>c.owner===owner?controlHTML(c,i):'').join('')}${weapons.filter(e=>e.owner===owner).map(weaponHTML).join('')}</div></section>`).join('');
  }
  function damageHTML(){
    if(!last)return`<p class="ae-warning">${esc(resultError||'请先添加角色方案。')}</p>`;
    const rows=damageRows(),selected=chosenTarget(),s=scenario();
    const membersHTML=last.members.map(member=>{
      const memberRows=rows.filter(r=>(r.owner??key())===member.key);
      const table=member.error?`<p class="ae-warning">${esc(member.error)}</p>`:memberRows.length?damageResultGroupsHTML(memberRows,{owner:member.key,selected}):'<p class="ae-muted">此角色暂无可用的伤害、治疗或反应项目。</p>';
      return `<section class="ae-damage-member" data-damage-owner="${esc(member.key)}" data-native-disclosure="team-damage-${esc(member.key)}"><div class="ae-damage-member-head"><h3 class="ae-member-heading">${image(meta(member.key))}${esc(meta(member.key).name)}</h3><div class="ae-damage-fold-controls" role="group" aria-label="${esc(meta(member.key).name)}技能详情">${[[true,'展开'],[false,'折叠']].map(([open,label])=>`<button type="button" class="subtle-action" data-native="fold-member-skills" data-owner="${esc(member.key)}" data-open="${open}" aria-label="${label}${esc(meta(member.key).name)}全部技能">${label}</button>`).join('')}</div></div>${table}<div data-native-trace="${esc(member.key)}"></div></section>`;
    }).join('');
    return`<section class="panel ae-section"><div class="ae-damage-context">${trialGood||previewPlan?`<span class="ae-warning" data-team-trial-status>正在展示${esc(currentLoadoutName())}的伤害。</span><button class="subtle-action" data-native="clear-plan-preview">恢复当前账号装备</button>`:''}<span class="ae-muted">敌人 ${s.enemyLevel??100} 级 · 默认抗性 ${s.resistance??10}% · ${esc(reactions[s.reaction]??'不预设增幅或激化反应')}</span></div><div class="ae-damage-members">${membersHTML}</div></section>`;
  }
  function fixedActionsHTML(){
    if(!last)return '<p class="ae-warning">'+esc(resultError||'请先添加角色方案。')+'</p>';
    const rows=damageRows(),s=scenario();
    return '<section class="panel ae-section"><div class="ae-group-heading"><h3>固定动作组合</h3>'+scenarioReset('combo')+'</div><p data-ae-hint="固定动作使用说明" class="ae-muted">按角色选择动作与次数 / 权重；高级设置可分别调整命中方式、附魔、反应和额外增益。治疗不计入合计，不模拟附着时序与完整循环。</p>'+advancedActionsHTML({combo:s.combo??[],members:last.members.map(m=>m.key),rows,anchor:key(),catalog})+'<div class="ae-inline-actions">'+comboSummary()+'</div></section>';
  }
  function comboSummary(){try{return '<strong>固定动作合计 '+comboDamage(calculationGOOD(),key(),last?.scenario??scenario(),last).value.toFixed(1)+'</strong>';}catch(error){return '<span class="ae-warning">'+esc(error.message)+'</span>';}}
  function plansHTML(){
    const list=plans(),theory=hasTrialEquipment(calculationGOOD());
    return`<section class="panel ae-section" data-native-disclosure="team-loadouts"><div class="ae-loadout-fold-controls" role="group" aria-label="全队配装展开折叠">${[[true,'全部展开'],[false,'全部折叠']].map(([open,label])=>`<button type="button" class="subtle-action" data-native="fold-team-loadouts" data-open="${open}">${label}</button>`).join('')}</div><p data-ae-hint="队伍配装试算说明" class="ae-muted">可切换库存装备，或自定义武器与圣遗物，比较全队变化。试算配装可保存为队伍方案；自定义装备也可手动存入自定义库存。对比双方使用相同队伍、角色等级与天赋、敌人、机制与动作配置。</p>${teamLoadoutsHTML()}<div class="ae-inline-actions ae-team-plan-toolbar"><button class="subtle-action" data-native="open-theory">理论配装优化</button><input class="ae-plan-name" data-native-plan-name value="${esc(planName)}" placeholder="方案名称，例如：充能沙 / 输出配装"><button class="subtle-action" data-native="save-plan">保存当前队伍方案</button><button class="subtle-action" data-native="set-team-baseline">将当前试算设为比较基准</button><button class="subtle-action" data-native="clear-plan-preview" ${trialGood||previewPlan?'':'disabled'}>恢复当前账号装备</button>${trialGood||previewPlan?`<button class="subtle-action" data-native="apply-team-trial" ${theory?'disabled title="自定义试算装备只能保存在队伍方案中"':''}>应用到实际装备</button>`:''}</div><p class="ae-muted ae-team-comparison-status"><span data-team-baseline-label>计算基准：${esc(baselineName)}</span><span data-team-current-label>当前配装：${esc(currentLoadoutName())}</span></p>${list.length?`<div class="ae-plan-list">${list.map((p,i)=>`<div><span><strong>${esc(p.name)}</strong><small>${p.teamBuilds?'全队 '+p.teamBuilds.length+' 人':'原有单角色方案'} · ${new Date(p.savedAt).toLocaleString('zh-CN')}</small></span><button class="subtle-action" data-native="preview-plan" data-index="${i}">切换并对比</button><button class="subtle-action ae-remove" data-native="remove-plan" data-index="${i}">移除</button></div>`).join('')}</div>`:''}<div data-native-comparison>${trialComparisonHTML()}</div></section>`;
  }
  function teamLoadoutsHTML(){
    const good=calculationGOOD();
    const row=(member,kind,slot,a)=>{const weapon=kind==='weapons',m=weapon?catalog.weapons[a?.key]:catalog.sets[a?.setKey],title=weapon?'武器':SLOT_NAMES[slot];return `<div class="ae-loadout-row">${a?(weapon?image(m):artifactIconHTML(a,catalog)):'<span class="ae-loadout-empty">—</span>'}<div class="ae-loadout-label"><small>${title}${a?.wikiTrialOnly?' · 自定义试算':isCustom(a)&&customMarkers(state())?' · 自定义':''}</small><strong>${esc(m?.name??'未装备')}</strong>${a?`<small>${weapon?'Lv.'+a.level+' · 精炼 '+a.refinement:'+'+a.level+' · '+STAT_NAMES[a.mainStatKey]}</small>`:''}</div><div class="ae-loadout-actions"><button class="subtle-action" data-native="open-team-equipment" data-member="${esc(member)}" data-kind="${kind}" data-slot="${slot??''}" aria-label="切换${esc(meta(member).name)}的${title}">库存</button><button class="subtle-action" data-native="open-trial-equipment" data-member="${esc(member)}" data-kind="${kind}" data-slot="${slot??''}" aria-label="自定义${esc(meta(member).name)}的${title}">自定义</button></div></div>`;};
    return `<div class="ae-team-loadouts">${teamMembers().map(member=>{const e=equipment(good,member);return `<details class="ae-team-loadout" data-native-disclosure="loadout-${esc(member)}" open><summary>${image(meta(member))}${esc(meta(member).name)}<small>${trialGood||previewPlan?'试算配装':'实际配装'}</small></summary><div class="ae-loadout-rows">${row(member,'weapons','',e.weapon)}${SLOTS.map(slot=>row(member,'artifacts',slot,e.artifacts.find(a=>a.slotKey===slot))).join('')}</div></details>`;}).join('')}</div>`;
  }

  function setTeamMember(slot,value){
    if(!Number.isInteger(slot)||slot<0||slot>3)throw Error('请选择有效的队伍位置。');
    const w=workspace(),team=w.teams.find(x=>x.id===teamId)??w.teamDraft,previous=membersOf(team),members=[...previous];
    members[slot]=value;const next=members.filter(Boolean);
    if(next.some(k=>!state().good.characters.some(c=>c.key===k)))throw Error('请选择已添加的角色。');
    team.scenario=configureMembers(team.scenario,previous,next);team.members=next;team.character=next[0]??'';clearTrial();commit(w);
  }
  function memberPickerHTML(){
    const members=teamMembers(),slot=memberPicker.slot,selected=members[slot]??'',candidates=filterTeamCharacters(state().good.characters,catalog,memberFilter);
    return `${characterPickerFiltersHTML({roster:state().good.characters,catalog,filters:memberFilter,searchAttribute:'data-member-picker-filter'})}<div class="ae-inline-actions"><span class="ae-muted">${candidates.length} 名候选 · 当前：${esc(selected?meta(selected).name:'空位')}</span><button class="subtle-action" data-member-picker-action="clear">清空筛选</button><button class="subtle-action" data-member-picker-action="empty">设为空位</button></div><div class="ae-member-picker-candidates">${candidates.map(c=>{const m=meta(c.key),occupied=members.findIndex((k,i)=>i!==slot&&equipmentLocation(k)===equipmentLocation(c.key));return `<button class="ae-member-picker-choice ae-rarity-${m.rarity} ${c.key===selected?'ae-member-picker-current':''}" data-member-picker-action="choose" data-key="${esc(c.key)}" ${occupied>=0?'disabled':''}>${image(m)}<span><strong>${esc(m.name)} ${badge(c)}</strong><small>${ELEMENTS[m.element]??''}元素 · ${m.rarity} 星 · Lv.${c.level}</small></span><small>${occupied>=0?'成员 '+(occupied+1):c.key===selected?'当前':'选择'}</small></button>`;}).join('')||'<p class="ae-muted">没有匹配角色，请调整筛选。</p>'}</div>`;
  }
  function refreshMemberPicker(filterButton){
    const active=document.activeElement,attribute=active?.attributes&&[...active.attributes].find(a=>a.name==='data-member-picker-filter'),selection=inputSelection(active);
    floating.setHTML(memberPickerHTML());
    restoreInputFocus(filterButton?floating.dialog.querySelector(`[data-character-filter="${filterButton.dataset.characterFilter}"][data-value="${filterButton.dataset.value}"]`):attribute&&floating.dialog.querySelector(`[${attribute.name}="${CSS.escape(attribute.value)}"]`),selection);
  }
  function openMemberPicker(slot){
    if(!Number.isInteger(slot)||slot<0||slot>3)throw Error('请选择有效的队伍位置。');
    closeFloating();memberPicker={slot};
    const inputEvents=createCompositionInputHandler(event=>onFilter(event));
    const onFilter=event=>{const t=event.target;if(!memberPicker||event.isComposing||inputEvents.isComposing(t)||t.dataset.memberPickerFilter!=='search')return;memberFilter.search=t.value;refreshMemberPicker();};
    floating=openAssessmentDialog({root:popupRoot(),title:`成员 ${slot+1} · 选择角色`,html:memberPickerHTML(),onClose:()=>{floating=null;memberPicker=null;},onChange:onFilter,onClick:event=>{const button=event.target.closest('[data-character-filter],[data-member-picker-action]');if(!button||button.disabled)return;try{if(button.hasAttribute('data-character-filter')){if(toggleCharacterFilter(memberFilter,button.dataset.characterFilter,button.dataset.value))refreshMemberPicker(button);return;}const action=button.dataset.memberPickerAction;if(action==='clear'){Object.assign(memberFilter,{search:'',element:[],rarity:[]});refreshMemberPicker();}else{setTeamMember(memberPicker.slot,action==='empty'?'':button.dataset.key);closeFloating();render();}}catch(error){toast(error.message);}}});
    floating.dialog.classList.add('ae-member-picker-dialog');
    floating.dialog.addEventListener('compositionstart',event=>{event.stopPropagation();inputEvents.start(event);});
    floating.dialog.addEventListener('compositionend',event=>{event.stopPropagation();inputEvents.end(event);});
    floating.dialog.addEventListener('input',event=>{event.stopPropagation();if(event.target.matches('input[type=search]'))inputEvents.input(event);});
  }

  function teamPickerHTML(){
    const p=teamPicker,f=p.filters,weapon=p.kind==='weapons',good=calculationGOOD(),memberWeights=state().goals[p.member]?.weights??recommendedGoal(p.member,meta(p.member).element).weights;
    const items=filterTeamEquipment(good,p.member,p.kind,p.slot,catalog,data,f,memberWeights).filter(({a})=>!a.wikiTrialOnly),pages=Math.max(1,Math.ceil(items.length/24));p.page=Math.min(Math.max(1,p.page),pages);
    const selected=good[p.kind].findIndex(a=>a.location===equipmentLocation(p.member)&&(weapon||a.slotKey===p.slot));
    const select=(title,k,options)=>filterButtonsHTML(title,options,f[k],`data-team-picker-filter="${k}"`),limit=(title,k,max=1e7)=>field(title,`<input type="number" data-team-picker-filter="${k}" value="${esc(f[k])}" min="0" max="${max}" step="any" placeholder="不限">`);
    const sets=[...new Set(good.artifacts.filter(a=>a.slotKey===p.slot).map(a=>a.setKey))].sort((a,b)=>compareArtifactSets(catalog.sets[a],catalog.sets[b]));
    const filters=`<div class="ae-fields ae-filter-fields">${field(weapon?'搜索武器':'搜索套装',`<input type="search" data-team-picker-filter="search" value="${esc(f.search)}" placeholder="名称、别名或关键词">`)}${weapon?select('副属性','stat',secondaryOptions()):select('套装','set',[['','全部套装'],...sets.map(k=>[k,catalog.sets[k]?.name??k])])}${select('来源','origin',[['','全部来源'],['original','原有库存'],['custom','自定义库存']])}${weapon?select('星级','rarity',[['','全部星级'],...[5,4,3,2,1].map(n=>[n,n+' 星'])]):select('登场大版本','version',[['','全部版本'],...artifactVersionChoices(sets.map(k=>[k,catalog.sets[k]]))])}${weapon?'':select('主词条','main',[['','全部主词条'],...MAIN_STATS[p.slot].map(k=>[k,STAT_NAMES[k]])])}${select('装备状态','status',[['','全部状态'],['free','未装备'],['equipped','已装备'],['current','此成员装备']])}${select('装备锁定','lock',[['','不限'],['locked','已锁定'],['unlocked','未锁定']])}${limit(weapon?'最低等级':'最低强化','minLevel',weapon?90:20)}${limit(weapon?'最高等级':'最高强化','maxLevel',weapon?90:20)}${weapon?select('精炼至少','refinement',[['','不限'],...[1,2,3,4,5].map(n=>[n,n+' 阶'])]):''}</div>`;
    const subs=weapon?'':`<details class="ae-filter-details" data-popup-disclosure="team-picker-subs"><summary>副词条与数值筛选${f.subs.length?' · '+f.subs.length+' 项已选':''}</summary><div class="ae-fields">${select('匹配方式','subMode',[['all','满足全部所选'],['any','满足任一所选']])}${limit('最低双暴值','minCV')}${artifactReference?limit('最低有效等效','minEffective'):''}</div><div class="ae-substat-filters">${SUBSTATS.map(k=>`<div class="ae-substat-filter ${f.subs.includes(k)?'active':''}"><label><input type="checkbox" data-team-picker-sub="${k}" ${f.subs.includes(k)?'checked':''}>${STAT_NAMES[k]}</label>${f.subs.includes(k)?`<input type="number" data-team-picker-sub-min="${k}" min="0" max="10000000" step="any" value="${esc(f.subMin[k]??'')}" placeholder="最低数值，不限" aria-label="${STAT_NAMES[k]}最低数值">`:''}</div>`).join('')}</div><p data-ae-hint="库存替换评价与借用说明" class="ae-muted">有效等效使用 ${esc(meta(p.member).name)} 的评价权重；选择已装备物品会在试算中计入原角色失去该件的变化。</p></details>`;
    const controls=`<div class="ae-inventory-toolbar"><div class="ae-inventory-results"><span>${items.length} 件候选</span><button class="subtle-action" data-team-picker-action="clear">清空筛选</button><button class="subtle-action" data-team-picker-action="unequip">不装备</button></div>${select('排序','sort',Object.entries(weapon?WEAPON_SORTS:{release:'登场顺序（新到旧）',...ARTIFACT_SORTS}))}<div class="ae-inventory-pages"><span>第 ${p.page} / ${pages} 页</span><button class="subtle-action" data-team-picker-action="page" data-direction="-1" ${p.page<=1?'disabled':''}>上一页</button><button class="subtle-action" data-team-picker-action="page" data-direction="1" ${p.page>=pages?'disabled':''}>下一页</button></div></div>`;
    return filters+subs+`<div data-team-picker-results>${controls}<div class="ae-team-picker-candidates">${items.slice((p.page-1)*24,p.page*24).map(({a,i,metrics:r})=>{const m=weapon?catalog.weapons[a.key]:catalog.sets[a.setKey];return `<button class="ae-team-picker-choice ae-rarity-${weapon?m?.rarity:a.rarity} ${i===selected?'ae-team-picker-current':''}" data-team-picker-action="choose" data-index="${i}">${weapon?image(m):artifactIconHTML(a,catalog)}<span><strong>${esc(m?.name??a.key??a.setKey)} ${badge(a)}</strong><small>${weapon?'Lv.'+a.level+' · 精炼 '+a.refinement+' · '+(STAT_NAMES[data.weapon.data[a.key]?.subStat?.type]??'无副属性'):a.rarity+' 星 · +'+a.level+' · '+STAT_NAMES[a.mainStatKey]}</small>${weapon?'':`<small>${a.substats.filter(s=>s.key).map(s=>STAT_NAMES[s.key]+' '+statDisplay(s.value,s.key)).join(' · ')}</small><small>有效 ${r.effective.toFixed(1)} · 双暴 ${r.cv.toFixed(1)}</small>`}<small>${a.location?'装备：'+esc(locationName(a.location)):'未装备'}${a.lock?' · 已锁定':''}</small></span><b>${i===selected?'当前':'选择'}</b></button>`;}).join('')||'<p class="ae-muted">没有匹配装备，请调整筛选。</p>'}</div></div>`;
  }
  function refreshTeamPicker(preserveFilters=false){
    if(preserveFilters&&refreshFilteredRegions(floating.dialog,teamPickerHTML(),['[data-team-picker-results]']))return;
    const active=document.activeElement,attribute=active?.attributes&&[...active.attributes].find(a=>a.name.startsWith('data-team-picker-')),selection=inputSelection(active);
    floating.setHTML(teamPickerHTML());
    const next=attribute&&floating.dialog.querySelector(`[${attribute.name}="${CSS.escape(attribute.value)}"]`);restoreInputFocus(next,selection);
  }
  function switchTeamEquipment(member,kind,index,slot){
    if(!teamMembers().includes(member))throw Error('请选择队伍中的角色。');
    const next=switchEquipment(calculationGOOD(),member,kind,index,slot,catalog);rememberBaseline();trialGood=next;trialBasis=JSON.stringify(state().good);previewPlan=null;currentPlanName='';loadoutConditionsReview=true;render();
  }
  function openTrialEditor(member,kind,slot){
    if(!teamMembers().includes(member)||!['weapons','artifacts'].includes(kind)||kind==='artifacts'&&!SLOTS.includes(slot))throw Error('请选择有效的成员与装备部位。');
    const good=calculationGOOD(),equipped=equipment(good,member),basis=JSON.stringify(state().good),current=kind==='weapons'?equipped.weapon:equipped.artifacts.find(a=>a.slotKey===slot);
    closeFloating();floating=openTrialEquipmentEditor({root:popupRoot(),member,kind,slot,current,catalog,data,weights:state().goals[member]?.weights??recommendedGoal(member,meta(member).element).weights,weaponChoices:filters=>filterWeaponChoices(catalog,data,{...filters,type:meta(member).weaponType}),toast,onClose:()=>{floating=null;},onStore:managedInventory(state())?raw=>{const id=storeCustomEquipment(state(),kind,raw);changed();if(trialGood){trialGood[kind].push(structuredClone(state().good[kind].find(a=>a.id===id)));trialBasis=JSON.stringify(state().good);}return ()=>render();}:undefined,onApply:raw=>{
      if(basis!==JSON.stringify(state().good))throw Error('实际库存已更新，请关闭后重新试算。');
      const next=replaceWithTrialEquipment(calculationGOOD(),member,kind,slot,raw,catalog,data);rememberBaseline();trialGood=next;trialBasis=basis;previewPlan=null;currentPlanName='';loadoutConditionsReview=true;return ()=>render();
    }});
  }
  function openTeamPicker(member,kind,slot){
    if(!teamMembers().includes(member)||!['weapons','artifacts'].includes(kind)||kind==='artifacts'&&!SLOTS.includes(slot))throw Error('请选择有效的成员与装备部位。');
    closeFloating();const id=member+':'+kind+':'+slot;teamPicker={member,kind,slot,page:1,basis:JSON.stringify(state().good),filters:teamPickerFilters.get(id)??{...artifactFilters(),search:'',version:'',stat:'',refinement:'',sort:kind==='artifacts'?'release':'level-desc'}};teamPickerFilters.set(id,teamPicker.filters);
    const inputEvents=createCompositionInputHandler(event=>onFilter(event));
    const onFilter=event=>{const t=event.target,p=teamPicker;if(!p||event.isComposing||inputEvents.isComposing(t))return;try{if(t.checkValidity&&!t.checkValidity())throw Error('请填写有效筛选数值。');if(t.hasAttribute('data-team-picker-filter'))p.filters[t.dataset.teamPickerFilter]=t.dataset.value??t.value;else if(t.hasAttribute('data-team-picker-sub')){p.filters.subs=p.filters.subs.filter(k=>k!==t.dataset.teamPickerSub);if(t.checked)p.filters.subs.push(t.dataset.teamPickerSub);}else if(t.hasAttribute('data-team-picker-sub-min'))p.filters.subMin[t.dataset.teamPickerSubMin]=t.value;else return;p.page=1;refreshTeamPicker(t.type==='number');}catch(error){toast(error.message);}};
    floating=openAssessmentDialog({root:popupRoot(),title:meta(member).name+' · 切换'+(kind==='weapons'?'武器':SLOT_NAMES[slot]),subtitle:kind==='weapons'?'仅显示此成员可用的'+weaponTypes[meta(member).weaponType]+'；选择后仅用于队伍试算。':'从库存筛选此部位；选择后仅用于队伍试算。',html:teamPickerHTML(),onClose:()=>{floating=null;teamPicker=null;},onChange:onFilter,onClick:event=>{const filter=event.target.closest('button[data-team-picker-filter]');if(filter){onFilter({target:filter});floating?.dialog.querySelector(`button[data-team-picker-filter="${filter.dataset.teamPickerFilter}"][value="${filter.dataset.value}"]`)?.focus({preventScroll:true});return;}const button=event.target.closest('[data-team-picker-action]');if(!button||button.disabled)return;try{const p=teamPicker,action=button.dataset.teamPickerAction;if(action==='clear'){Object.assign(p.filters,{...artifactFilters(),search:'',version:'',stat:'',refinement:'',sort:p.kind==='artifacts'?'release':'level-desc'});p.page=1;refreshTeamPicker();}else if(action==='page'){p.page+=Number(button.dataset.direction);refreshTeamPicker();floating.dialog.querySelector('.ae-team-picker-candidates')?.scrollIntoView({block:'nearest'});}else{if(p.basis!==JSON.stringify(state().good))throw Error('实际库存已更新，请关闭后重新选择。');const {member,kind,slot}=p;closeFloating();switchTeamEquipment(member,kind,action==='unequip'?'':button.dataset.index,slot);}}catch(error){toast(error.message);}}});
    floating.dialog.addEventListener('compositionstart',event=>{event.stopPropagation();inputEvents.start(event);});
    floating.dialog.addEventListener('compositionend',event=>{event.stopPropagation();inputEvents.end(event);});
    floating.dialog.addEventListener('input',event=>{event.stopPropagation();if(event.target.matches('input[type=search],input[type=number]'))inputEvents.input(event);});
  }
  function comparisonHeadingHTML(label){
    return `<div class="ae-team-comparison-heading"><strong>${esc(label)}</strong>${loadoutConditionsReview?'<span class="ae-loadout-condition-notice" data-loadout-condition-notice role="status">配装已切换，请检查角色、武器、套装与共鸣条件开关，确认新装备对应的条件是否按实际情况启用。</span>':''}</div>`;
  }
  function trialComparisonHTML(){
    if(!comparisonBaseline||!last)return `${loadoutConditionsReview?comparisonHeadingHTML("比较基准 → 当前试算"):""}<p data-ae-hint="配装对比使用说明" class="ae-muted">切换装备后在这里显示切换前后各成员的伤害、治疗与反应变化。设置固定动作组合后还可比较全队合计。</p>`;
    try{const before={...trialCalculate(comparisonBaseline),good:comparisonBaseline},after={...last,good:calculationGOOD()};return comparisonHTML(before,after,'比较基准 → 当前试算');}catch(e){return `${comparisonHeadingHTML('比较基准 → 当前试算')}<p class="ae-warning">${esc(e.message)}</p>`;}
  }
  function growthContext(){
    const character=readSelected(),w=workspace(),teams=growthTeamChoices(state(),character,w),requested=w.growthTeams?.[character],team=requested==='solo'?null:teams.find(t=>t.id===requested)??teams.find(t=>t.id===w.activeTeamId)??teams[0];
    return {character,teams,team,id:team?.id??'solo',scenario:growthTeamScenario(team,character)};
  }
  const upgradeStamp=()=>{const context=growthContext();return JSON.stringify([context.character,state().good,context.id,context.scenario]);};
  function upgradeHTML(){const previous=page;page='evaluation';try{return evaluationUpgradeHTML();}finally{page=previous;}}
  function evaluationUpgradeHTML(){
    if(upgrade&&upgradeBasis!==upgradeStamp())upgrade=null;
    if(!current())return'';const context=growthContext();let result;try{result=calculateTeam(state().good,context.character,context.scenario);}catch(e){return`<details class="panel ae-section"><summary>提升收益参考</summary><p class="ae-warning">${esc(e.message)}</p></details>`;}
    const choices=result.rows.filter(r=>r.owner===context.character&&r.variant!=='heal'),selected=choices.find(r=>JSON.stringify({owner:r.owner,path:r.path})===upgradeTarget)??choices.find(r=>r.group==='skill')??choices[0];
    const targetValue=selected?JSON.stringify({owner:selected.owner,path:selected.path}):'';
    return`<details class="panel ae-section" data-native-disclosure="growth-reference"><summary>提升收益参考</summary>${filterButtonsHTML('计算队伍',[['solo','单人计算'],...context.teams.map(t=>[t.id,t.name+' · '+membersOf(t).map(k=>meta(k).name).join(' / ')])],context.id,'data-native-growth-team')}<p data-ae-hint="提升收益参考条件说明" class="ae-muted">${context.team?'使用「'+esc(context.team.name)+'」已保存的队友、敌人、反应、条件开关与额外增益':'使用单人默认条件'}，配装使用 ${esc(meta(context.character).name)} 当前装备。修改队伍条件后，收益计算随之更新。</p>${field('当前角色的比较项目',`<button class="ae-choice-button" data-native="open-upgrade-target" aria-haspopup="dialog" ${selected?'':'disabled'}><span>${esc(selected?meta(context.character).name+' · '+selected.label:'没有可计算项目')}</span><small>选择项目</small></button><input type="hidden" data-native-upgrade-target value="${esc(targetValue)}">`)}<p data-ae-hint="提升收益计算说明" class="ae-muted">按一次所选攻击或反应计算。期望值按暴击率加权平均；每次只给当前角色增加一个平均档五星副词条或一级基础天赋，其他设置保持相同。提升幅度＝期望值增加量 ÷ 提升前期望值。</p><div class="ae-inline-actions"><button class="subtle-action" data-native="upgrade" ${selected?'':'disabled'}>计算词条与天赋收益</button>${upgrade?'<button class="subtle-action" data-native="close-upgrade">关闭收益列表</button>':''}</div>${upgrade?`<table class="ae-table"><thead><tr><th>当前角色的提升</th><th>所选项目期望值：提升前 → 提升后</th><th>期望值增加量</th><th>提升幅度</th></tr></thead><tbody>${upgrade.map(r=>`<tr><td>${esc(r.stat?STAT_NAMES[r.stat]+' +'+statDisplay(r.value,r.stat):({auto:'普通攻击',skill:'元素战技',burst:'元素爆发'}[r.talent]+'基础等级 +1'))}</td><td>${r.base.toFixed(1)} → ${(r.base+r.delta).toFixed(1)}</td><td>${r.delta>=0?'+':''}${r.delta.toFixed(1)}</td><td>${r.base>0?(r.delta/r.base*100).toFixed(2)+'%':'基准为 0'}</td></tr>`).join('')}</tbody></table>`:''}</details>`;
  }
  function openGrowthTarget(){
    const context=growthContext(),choices=calculateTeam(state().good,context.character,context.scenario).rows.filter(r=>r.owner===context.character&&r.variant!=='heal');let group='',search='';closeFloating();
    const refresh=()=>{const rows=choices.filter(r=>(!group||r.group===group)&&r.label.toLowerCase().includes(search.trim().toLowerCase()));floating.dialog.querySelector('[data-growth-groups]').innerHTML=filterButtonsHTML('分类',[['','全部'],...[...new Set(choices.map(r=>r.group))].map(k=>[k,groupNames[k]??k])],group,'data-growth-group');floating.dialog.querySelector('[data-growth-results]').innerHTML=`<div class="ae-member-picker-candidates">${rows.map(r=>`<button class="ae-member-picker-choice" data-growth-path="${esc(r.path)}"><span><strong>${esc(r.label)}</strong><small>${esc(groupNames[r.group]??r.group)} · 当前期望 ${r.average.toFixed(1)}</small></span></button>`).join('')||'<p class="ae-muted">没有匹配项目。</p>'}</div>`;};
    floating=openAssessmentDialog({root:popupRoot(),title:meta(context.character).name+' · 选择收益比较项目',html:'<label class="ae-field"><span>搜索项目</span><input type="search" data-growth-search placeholder="攻击或反应名称"></label><div data-growth-groups></div><div data-growth-results></div>',onClose:()=>{floating=null;},onClick:e=>{const b=e.target.closest('[data-growth-group],[data-growth-path]');if(!b)return;if(b.hasAttribute('data-growth-group')){group=b.dataset.value;refresh();}else{upgradeTarget=JSON.stringify({owner:context.character,path:b.dataset.growthPath});upgrade=null;closeFloating();onEvaluationChange();}}});
    const input=createCompositionInputHandler(e=>{if(e.target.hasAttribute('data-growth-search')){search=e.target.value;refresh();}});floating.dialog.addEventListener('input',e=>{e.stopPropagation();input.input(e);});floating.dialog.addEventListener('compositionstart',input.start);floating.dialog.addEventListener('compositionend',input.end);refresh();
  }
  const teamTabs=[['conditions','战斗条件'],['loadouts','配装与对比'],['panel','战斗面板'],['damage','队伍伤害、治疗与反应结果'],['actions','固定动作']];
  const teamScrollKey=()=>teamId+':'+teamTab+(teamTab==='conditions'?':'+conditionTab+':'+conditionOwner:'');
  function conditionMemberButtons(){return `<div class="ae-condition-members" aria-label="编辑队员条件">${teamMembers().map(member=>`<button class="subtle-action" data-native-condition-member="${esc(member)}" aria-pressed="${member===conditionOwner}">${image(meta(member))}${esc(meta(member).name)}</button>`).join('')}</div>`;}
  function indentConditionControls(){return `<section class="panel ae-section"><div data-team-condition-results>${conditionHTML()}</div></section>`;}
  function applyTeamView(){
    if(page!=='teams')return;
    const scroller=pane.querySelector('[data-team-scroll]');if(!scroller)return;
    if(!teamMembers().includes(conditionOwner))conditionOwner=teamMembers()[0]??'';
    for(const panel of pane.querySelectorAll('[data-team-panel]'))panel.hidden=panel.dataset.teamPanel!==teamTab;
    for(const button of pane.querySelectorAll('[data-native-team-tab]')){const active=button.dataset.nativeTeamTab===teamTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    for(const panel of pane.querySelectorAll('[data-team-condition-panel]'))panel.hidden=panel.dataset.teamConditionPanel!==conditionTab;
    for(const button of pane.querySelectorAll('[data-native-condition-tab]'))button.setAttribute('aria-pressed',String(button.dataset.nativeConditionTab===conditionTab));
    for(const group of pane.querySelectorAll('[data-condition-owner]'))group.hidden=group.dataset.conditionOwner!==conditionOwner;
    for(const button of pane.querySelectorAll('[data-native-condition-member]'))button.setAttribute('aria-pressed',String(button.dataset.nativeConditionMember===conditionOwner));
    scroller.dataset.teamScrollKey=teamScrollKey();
  }
  function openTeamRename(){
    closeFloating();const openingTeamId=teamId;
    floating=openAssessmentDialog({root:popupRoot(),title:'队伍重命名',html:`<label class="ae-field"><span>队伍名称</span><input data-team-rename-input maxlength="150" value="${esc(activeTeam()?.name??'')}" placeholder="输入队伍名称"></label><button class="subtle-action" data-team-rename-confirm>保存名称</button>`,onClose:()=>{floating=null;},onClick:event=>{
      if(!event.target.closest('[data-team-rename-confirm]'))return;
      try{if(teamId!==openingTeamId)throw Error('当前队伍已改变，请重新打开。');const name=floating.dialog.querySelector('[data-team-rename-input]').value.trim();if(!name||name.length>150)throw Error('队伍名称须为 1–150 个字。');
        if(teamId){renameTeam(state(),teamId,name);changed();}else{const members=teamMembers(),team=saveTeam(state(),{name,character:key(),scenario:scenario()}),w=workspace();w.teams.find(t=>t.id===team.id).members=members;for(const plan of w.teamPlans)if(!plan.teamId)plan.teamId=team.id;teamId=team.id;w.activeTeamId=teamId;commit(w);}
        teamName=null;closeFloating();render();toast('队伍已重命名');
      }catch(error){toast(error.message);}
    }});focusNameInput(floating.dialog.querySelector('[data-team-rename-input]'));
  }
  function teamHTML(){
    const s=scenario(),w=workspace();
    const selectedTeam=w.teams.find(t=>t.id===teamId);
    const members=teamMembers();
    const slots=`<div class="ae-fields ae-team-slots">${[0,1,2,3].map(i=>`<div class="ae-field"><button class="ae-team-member-button" data-native="open-team-member" data-slot="${i}" aria-haspopup="dialog" aria-label="选择成员 ${i+1}，当前${esc(members[i]?meta(members[i]).name:'空位')}">${members[i]?image(meta(members[i]),'ae-rarity-'+(meta(members[i]).rarity??5)):''}<span>${esc(members[i]?meta(members[i]).name:'选择角色')}</span><span aria-hidden="true">▾</span></button></div>`).join('')}</div>`;
    const controls=`<div class="panel ae-section ae-team-context"><div class="ae-team-toolbar"><h2>计算队伍</h2><select data-native-team-select aria-label="选择队伍">${opt('','未命名队伍（自动保存）',teamId)}${w.teams.map(t=>opt(t.id,t.name,teamId)).join('')}</select><div class="ae-inline-actions ae-team-controls"><button class="subtle-action" data-native="new-team">新建队伍</button><button class="subtle-action" data-native="rename-team">队伍重命名</button><button class="subtle-action" data-native="save-team">保存队伍</button><button class="subtle-action ae-remove" data-native="remove-team" ${!selectedTeam&&!members.length?'disabled':''}>删除队伍</button><button class="subtle-action" data-native="reset-scenario">重置当前条件</button></div>${slots}</div></div>`;

    if(!members.length)return controls+'<div class="panel ae-empty">请选择队伍成员；没有角色时先在养成评价添加，或导入 GOOD 配装。</div>';
    const settings=`<section class="panel ae-section ae-enemy-settings"><div class="ae-fields">${field('当前站场角色',`<select data-native-setting="active">${members.map(k=>opt(k,meta(k).name,s.active??key())).join('')}</select>`)}${num('敌人等级',s.enemyLevel??100,'data-native-setting="enemyLevel"',1,200)}${num('默认抗性 %',s.resistance??10,'data-native-setting="resistance"',-300,500,.1)}${num('防御降低 %',s.enemyDefRed_??0,'data-native-setting="enemyDefRed_"',0,100,.1)}${num('无视防御 %',s.enemyDefIgn_??0,'data-native-setting="enemyDefIgn_"',0,100,.1)}</div><section class="ae-element-resistances"><h4>按元素分别设置抗性</h4><div class="ae-fields">${Object.entries({...ELEMENTS,physical:'物理'}).map(([k,n])=>num(n+'抗性 %',s.resistances?.[k]??s.resistance??10,`data-native-res="${k}"`,-300,500,.1)).join('')}</div></section></section>`;
    const conditionPanels={enemy:settings,mechanics:indentConditionControls(),bonus:memberSettingsHTML()};
    const conditions=`<div class="ae-conditions-workspace"><nav class="ae-condition-nav" aria-label="战斗条件分类">${[['enemy','站场与敌人'],['mechanics','机制开关'],['bonus','反应、附魔与额外增益']].map(([id,name])=>`<button class="subtle-action" data-native-condition-tab="${id}" aria-pressed="${id===conditionTab}">${name}</button>`).join('')}</nav><div class="ae-condition-content">${[['enemy'],['mechanics'],['bonus']].map(([id])=>`<section data-team-condition-panel="${id}" ${id===conditionTab?'':'hidden'}>${id!=='enemy'?conditionMemberButtons():''}${conditionPanels[id]}</section>`).join('')}</div></div>`;
    const panels={conditions,loadouts:plansHTML(),panel: `<section class="panel ae-section"><div data-team-panel-results>${teamPanelsHTML()}</div></section>`,damage: `<div class="ae-team-damage-results" data-team-damage-results>${damageHTML()}</div>`,actions: `<div data-team-action-results>${fixedActionsHTML()}</div>`};
    return `<div class="ae-team-workbench">${controls}<nav class="ae-section-tabs" role="tablist" aria-label="队伍与伤害内容">${teamTabs.map(([id,name])=>`<button role="tab" data-native-team-tab="${id}" aria-controls="ae-team-${id}" aria-selected="${id===teamTab}">${name}</button>`).join('')}</nav><div class="ae-content-scroll" data-team-scroll data-team-scroll-owner="${esc(teamId)}" data-team-scroll-tab="${teamTab}">${teamTabs.map(([id])=>`<section id="ae-team-${id}" role="tabpanel" data-team-panel="${id}" ${id===teamTab?'':'hidden'}>${panels[id]}</section>`).join('')}</div></div>`;

  }
  function teamPanelsHTML(){return last?`<div class="ae-team-panels">${last.members.map(m=>`<section class="ae-team-member" data-native-disclosure="team-panel-${esc(m.key)}"><h3 class="ae-member-heading">${image(meta(m.key))}${esc(meta(m.key).name)}</h3>${m.error?`<p class="ae-warning">${esc(m.error)}</p>`:panelHTML(m.panel)}</section>`).join('')}</div>`:`<p class="ae-warning">${esc(resultError)}</p>`;}
  function refreshScenarioResults(){
    calculate();
    for(const [selector,html] of [['[data-team-condition-results]',conditionHTML()],['[data-team-panel-results]',teamPanelsHTML()],['[data-team-damage-results]',damageHTML()],['[data-team-action-results]',fixedActionsHTML()],['[data-native-comparison]',trialComparisonHTML()]]){
      const region=pane.querySelector(selector);if(!region)continue;
      const folds=new Map([...region.querySelectorAll('details')].map(d=>[disclosureKey(d),d.open]));
      region.innerHTML=html;
      for(const d of region.querySelectorAll('details'))if(folds.has(disclosureKey(d)))d.open=folds.get(disclosureKey(d));
    }
    applyTeamView(false);onRendered();
  }
  function memberSettingsHTML(){
    const s=scenario();
    return `<section class="panel ae-section ae-member-settings" data-native-disclosure="member-settings"><p data-ae-hint="额外增益填写说明" class="ae-muted">各成员分别设置。增益填写额外增加量，暴击率 10 表示增加 10%；避免重复计算机制加成。</p><div class="ae-member-settings-cards">${teamMembers().map(member=>{
      const own=member===key()?s:s.characters?.[member]??{};
      return `<section class="ae-member-setting" data-condition-owner="${esc(member)}" data-native-disclosure="member-settings-${esc(member)}"><div class="ae-fields ae-member-reactions">${field('增幅 / 激化反应',`<select data-native-setting="reaction" data-owner="${esc(member)}">${opt('','不触发',own.reaction??'')}${Object.entries(reactions).map(([k,n])=>opt(k,n,own.reaction)).join('')}</select>`)}${field('外部元素附魔',`<select data-native-setting="infusion" data-owner="${esc(member)}">${opt('','无外部附魔',own.infusion??'')}${Object.entries(ELEMENTS).map(([k,n])=>opt(k,n+'元素',own.infusion)).join('')}</select>`)}</div><section class="ae-member-bonus" data-native-disclosure="member-bonus-${esc(member)}"><div class="ae-group-heading"><h4>额外增益</h4>${scenarioReset('bonus',member)}</div><div class="ae-fields ae-member-bonus-fields">${Object.entries(STAT_NAMES).map(([k,n])=>num(n,own.bonusStats?.[k]??0,`data-native-bonus="${k}" data-owner="${esc(member)}"`,-1e6,1e6,.1)).join('')}</div></section></section>`;
    }).join('')}</div></section>`;
  }
  function openArtifactEditor(index){const item=state().good.artifacts[index];if(!item)throw Error('这件圣遗物已被移除。');if(isReadOnly()&&!isCustom(item))throw Error('账号已锁定，请先解锁再编辑原有圣遗物。');closeFloating();customEditing=createArtifactEditor(item,data,{name:'',sourceIndex:index});editing=null;}
  const customEditorHTML=()=>customArtifactHTML({...customEditing,hasCharacter:Boolean(current()&&last)},data,catalog,inventoryWeights()).replaceAll('加入实际库存','加入自定义库存').replaceAll('可写入实际库存','可加入自定义库存');
  function refreshCustomSummary(){
    if(!customPopup||!customEditing)return;
    const next=document.createElement('div');next.innerHTML=customEditorHTML();
    for(const selector of ['.ae-custom-lines fieldset>p','[data-custom-editor]>p']){const old=customPopup.dialog.querySelectorAll(selector),fresh=next.querySelectorAll(selector);if(old.length===fresh.length)old.forEach((node,i)=>{node.innerHTML=fresh[i].innerHTML;node.className=fresh[i].className;});}
    const write=customPopup.dialog.querySelector('[data-native="custom-to-inventory"]');if(write)write.disabled=next.querySelector('[data-native="custom-to-inventory"]').disabled;
  }
  function showCustomEditor(){
    customPopup=openAssessmentDialog({root:popupRoot(),title:customEditing.sourceIndex===undefined?'添加自定义圣遗物':'编辑圣遗物',html:customEditorHTML(),onClose:()=>{catalogPopup?.close();catalogPopup=null;customPopup=null;customEditing=null;},onChange:async e=>{try{await change(e.target);}catch(error){toast(error.message);}},onClick:async e=>{const button=e.target.closest('[data-native]');if(!button||button.disabled)return;try{await click(button);}catch(error){toast(error.message);}}});
    customPopup.dialog.addEventListener('input',e=>{e.stopPropagation();if(e.target.type==='number'||e.target.hasAttribute('data-custom-name'))void change(e.target).catch(error=>toast(error.message));});onRendered();
  }
  function openNewWeapon(){
    closeFloating();floating=openTrialEquipmentEditor({root:popupRoot(),member:'',kind:'weapons',purpose:'inventory',catalog,data,initialFilters:{type:weaponFilter,rarity:weaponRarity,stat:weaponStat},weaponChoices:f=>filterWeaponChoices(catalog,data,f),toast,onClose:()=>{floating=null;},onApply:item=>{storeCustomEquipment(state(),'weapons',item);changed();return()=>{render();toast('已加入自定义武器库存');};}});
  }
  function openArtifactAnalysis(index,customId){
    const custom=customId?workspace().customArtifacts?.find(c=>c.id===customId):null;
    const a=custom?(custom.values??inspectDraft(custom.draft,data).artifact):state().good.artifacts[index];
    if(!a)throw Error('这件圣遗物已被移除。');closeFloating();
    floating=openAssessmentDialog({root:popupRoot(),title:(custom?.name??SLOT_NAMES[a.slotKey])+' · 词条详情',subtitle:artifactReference?'按'+meta(artifactReference).name+'的词条权重评价，仅查看':'词条次数与档位分析，仅查看',html:inventoryArtifactHTML(a,{catalog,data,weights:inventoryWeights(),label:'圣遗物详情'})+artifactAnalysisHTML(a,data,inventoryWeights()),onClose:()=>{floating=null;}});
  }
  function itemActions(kind,item,index,buttons){
    return`<div class="ae-item-actions">${buttons}<button class="subtle-action" data-native="copy-inventory-item" data-kind="${kind}" data-index="${index}">复制为自定义</button><label class="ae-lock"><input type="checkbox" data-native-lock="${kind}" data-index="${index}" ${item.lock?'checked':''}>锁定</label><button class="subtle-action ae-remove" data-native="${kind==='artifacts'?'remove-artifact':'remove-weapon'}" data-index="${index}">移除</button></div>`;
  }
  function inventoryToolbar(count,total,unit,clear,sort,pages){
    return`<div class="ae-inventory-toolbar"><div class="ae-inventory-results"><span>显示 ${count} / ${total} ${unit}</span><button class="subtle-action" data-native="${clear}">清空筛选</button></div>${sort}${pages}</div>`;
  }
  function inventoryPages(total){
    const pages=Math.max(1,Math.ceil(total/pageSize));inventoryPage=Math.max(1,Math.min(inventoryPage,pages));
    return `<div class="ae-inventory-pages"><span>第 ${inventoryPage} / ${pages} 页</span><button class="subtle-action" data-native="inventory-page" data-direction="-1" ${inventoryPage<=1?'disabled':''}>上一页</button><button class="subtle-action" data-native="inventory-page" data-direction="1" ${inventoryPage>=pages?'disabled':''}>下一页</button><select data-inventory-page-size aria-label="每页装备数量">${[24,60,120].map(n=>opt(n,'每页 '+n+' 件',pageSize)).join('')}</select></div>`;
  }
  function artifactFilterHTML(){
    const f=artifactFilter,select=(title,k,options)=>field(title,`<select data-artifact-filter="${k}">${options.map(([v,n])=>opt(v,n,f[k])).join('')}</select>`);
    const mains=[...new Set((f.slot?MAIN_STATS[f.slot]:Object.values(MAIN_STATS).flat()))];
    const limit=(title,k,max=1e7)=>field(title,`<input type="number" data-artifact-filter="${k}" value="${esc(f[k])}" min="0" max="${max}" step="any" placeholder="不限">`);
    const advanced=['lock','minLevel','maxLevel','subCount','minCV',...(artifactReference?['minEffective']:[]),'minTotal'].filter(k=>f[k]!=='').length+f.subs.length;
    return `<div class="ae-fields ae-filter-fields">${originFilter()}${field('搜索套装',`<input type="search" data-native-search value="${esc(inventorySearch)}" placeholder="名称、别名或英文关键词">`)}${select('部位','slot',[['','全部部位'],...SLOTS.map(k=>[k,SLOT_NAMES[k]])])}${catalogChoiceHTML({label:'套装',kind:'sets',value:f.set,catalog,placeholder:'全部套装',buttonAttributes:'data-native="choose-artifact-filter-set"',inputAttributes:'data-artifact-filter="set"'})}${select('星级','rarity',[['','全部星级'],...[5,4,3,2,1].map(n=>[n,n+' 星'])])}${select('主词条','main',[['','全部主词条'],...mains.map(k=>[k,STAT_NAMES[k]])])}${select('装备状态','status',[['','全部状态'],['free','未装备'],['equipped','已装备'],...(current()?[['current','当前角色装备']]:[])])}</div><details class="ae-filter-details" data-disclosure-ignore data-native-disclosure="artifact-filters"><summary>副词条与更多筛选${advanced?' · '+advanced+' 项已选':''}</summary><div class="ae-fields ae-filter-fields">${select('装备锁定','lock',[['','不限'],['locked','已锁定'],['unlocked','未锁定']])}${limit('最低强化等级','minLevel',20)}${limit('最高强化等级','maxLevel',20)}${select('副词条数量至少','subCount',[['','不限'],...[1,2,3,4].map(n=>[n,n+' 条'])])}${limit('最低双暴值','minCV')}${artifactReference?limit('最低有效等效','minEffective'):''}${limit('最低总等效','minTotal')}${select('副词条匹配方式','subMode',[['all','满足全部所选'],['any','满足任一所选']])}</div><div class="ae-substat-filters">${SUBSTATS.map(k=>`<div class="ae-substat-filter ${f.subs.includes(k)?'active':''}"><label><input type="checkbox" data-artifact-sub="${k}" ${f.subs.includes(k)?'checked':''}>${STAT_NAMES[k]}</label>${f.subs.includes(k)?`<input type="number" data-artifact-sub-min="${k}" min="0" max="10000000" step="any" value="${esc(f.subMin[k]??'')}" placeholder="最低数值，不限" aria-label="${STAT_NAMES[k]}副词条最低数值">`:''}</div>`).join('')}</div><p data-ae-hint="库存副词条筛选说明" class="ae-muted">勾选副词条后可填写最低数值；百分比按游戏显示填写。${artifactReference?'有效等效沿用所选角色的词条权重；':''}双暴值 = 暴击率 × 2 + 暴击伤害。</p></details>`;
  }
  function artifactsHTML(){
    const all=state().good.artifacts,items=filterArtifacts(all,catalog,data,{...artifactFilter,search:inventorySearch},weights(),current()?equipmentLocation(key()):'').filter(({a})=>originMatches(a,inventoryOrigin)),pages=inventoryPages(items.length),shown=items.slice((inventoryPage-1)*pageSize,inventoryPage*pageSize);
    return `<div class="panel ae-section ae-inventory-panel"><div class="ae-result-heading"><h2>圣遗物库存</h2><div class="ae-inline-actions"><button class="subtle-action" data-native="choose-artifact-reference" aria-haspopup="dialog">选择角色显示词条权重评价</button><button class="subtle-action" data-native="new-artifact">添加自定义圣遗物</button></div></div>${inventoryContextHTML('artifacts')}${artifactFilterHTML()}${inventoryToolbar(items.length,all.length,'件','clear-artifact-filters',`<select class="ae-inventory-sort" data-artifact-filter="sort" aria-label="圣遗物排序">${[...Object.entries(ARTIFACT_SORTS).filter(([k])=>artifactReference||k!=='effective'),...SUBSTATS.map(k=>['sub:'+k,STAT_NAMES[k]+'从高到低'])].map(([k,n])=>opt(k,n,artifactFilter.sort)).join('')}</select>`,pages)}</div>${customListHTML()}<div class="ae-artifact-inventory-results" data-artifact-inventory-results><div class="ae-inventory-grid">${shown.map(({a,i,metrics:r})=>{
      const main=(data.art.main[a.rarity]?.[a.mainStatKey]?.[a.level]??0)*(a.mainStatKey.endsWith('_')?100:1);
      return `<article class="panel ae-item-card ae-artifact-card ae-rarity-${a.rarity}"><div class="ae-item-head">${artifactIconHTML(a,catalog)}<div><h3>${esc(catalog.sets[a.setKey]?.name??a.setKey)} ${badge(a)}</h3><p class="ae-item-meta"><span class="ae-stars">${a.rarity} 星</span> · ${SLOT_NAMES[a.slotKey]} · +${a.level}</p><strong>${STAT_NAMES[a.mainStatKey]} ${statDisplay(main,a.mainStatKey)}</strong></div></div><div class="ae-item-substats">${a.substats.filter(s=>s.key).map(s=>`<span class="${weights()[s.key]>0?'ae-stat-effective':''}">${STAT_NAMES[s.key]} <b>${statDisplay(s.value,s.key)}</b></span>`).join('')}</div><p class="ae-item-counts">${artifactCountSummary(a,data,inventoryWeights())}</p><div class="ae-item-metrics">${artifactReference?`<span>有效 <b>${r.effective.toFixed(1)}</b></span>`:''}<span>总等效 <b>${r.total.toFixed(1)}</b></span><span>双暴 <b>${r.cv.toFixed(1)}</b></span></div><p class="ae-item-owner">${a.location?'装备：'+esc(locationName(a.location)):'未装备'}${r.invalid.length?' · <span class="ae-warning">词条档位需核对</span>':''}</p>${itemActions('artifacts',a,i,`<button class="subtle-action" data-native="view-artifact" data-index="${i}">词条详情</button><button class="subtle-action" data-native="open-potential" data-index="${i}">强化潜力</button><button class="subtle-action" data-native="edit-artifact" data-index="${i}">编辑</button>`)}</article>`;
    }).join('')||'<div class="panel ae-empty">没有匹配的圣遗物，可清空或调整筛选。</div>'}</div>${items.length>pageSize?pages:''}</div>`;
  }

  function refreshArtifactResults(){
    if(page==='artifacts'&&refreshFilteredRegions(pane,artifactsHTML(),['.ae-inventory-panel>.ae-inventory-toolbar','[data-artifact-inventory-results]','[data-native-disclosure="artifact-filters"]>summary']))onRendered();
    else render();
  }

  function customListHTML(){const list=workspace().customArtifacts??[];if(!list.length)return'';return`<details class="panel ae-section" open><summary>已保存的自定义圣遗物</summary><p data-ae-hint="自定义库存说明" class="ae-muted">自定义配置单独保存，包含在工作区备份中；不会自动装备，也不会混入 GOOD 的实际库存。</p><div class="ae-plan-list">${list.map(c=>{const r=inspectDraft(c.draft,data);return`<div><span><strong>${esc(c.name)}</strong><small>${SLOT_NAMES[c.draft.slotKey]} · ${c.draft.rarity} 星 +${c.draft.level} · ${r.total} 次 · ${r.realistic?'正常范围':'理论配置'}</small></span><button class="subtle-action" data-native="view-custom" data-id="${esc(c.id)}">查看分析</button><button class="subtle-action" data-native="edit-custom" data-id="${esc(c.id)}">编辑</button><button class="subtle-action ae-remove" data-native="remove-custom" data-id="${esc(c.id)}">移除</button></div>`;}).join('')}</div></details>`;}
  function newCustom(){closeFloating();const set=setFilter||Object.keys(catalog.sets).find(k=>data.art.data[k]?.rarities.includes(5)&&data.art.data[k]?.slots.includes(slotFilter||'flower')),slot=slotFilter||SLOTS.find(k=>data.art.data[set].slots.includes(k)),rarity=Math.max(...data.art.data[set].rarities);if(!data.art.data[set].slots.includes(slot))throw Error('请调整套装或部位筛选。');customEditing={name:'',mode:'rolls',countsChanged:false,valuesChanged:false,changedLines:[],draft:{setKey:set,slotKey:slot,rarity,level:0,mainStatKey:MAIN_STATS[slot][0],initialCount:artifactInitialCounts(rarity).at(-1),lines:Array.from({length:4},(_,i)=>{const k=['atk_','critRate_','critDMG_','enerRech_'][i],tiers=substatTiers(data,rarity,k);return{key:i<artifactInitialCounts(rarity).at(-1)?k:'',counts:tiers.map((_,j)=>i<artifactInitialCounts(rarity).at(-1)&&j===tiers.length-1?1:0)};})}};customEditing.values=inspectDraft(customEditing.draft,data).artifact;editing=null;}
  const secondaryOptions=()=>[['','全部副属性'],...Object.entries(STAT_NAMES).filter(([k])=>Object.values(data.weapon.data).some(w=>w.subStat?.type===k)),['none','无副属性']];
  function openWeaponPicker(index){
    const old=index!==undefined?state().good.weapons[index]:null;catalogPopup?.close();weaponPicker={index};
    catalogPopup=openCatalogPicker({root:popupRoot(),catalog,data,kind:'weapons',selected:old?.key,toast,onClose:()=>{catalogPopup=null;weaponPicker=null;},onChoose:value=>{chooseWeapon(value);}});
  }
  function chooseWeapon(weapon){
    const m=catalog.weapons[weapon];if(!m?.wikiId||!data.weapon.data[weapon])throw Error('请选择列表中的武器。');
    let index=weaponPicker.index;
    if(index===undefined){state().good.weapons.push({key:weapon,level:1,ascension:0,refinement:1,location:'',lock:false,id:crypto.randomUUID()});index=state().good.weapons.length-1;}
    else{const old=state().good.weapons[index];if(!old)throw Error('这把武器已被移除。');const item={...old,key:weapon},cap=m.rarity<3?70:90;item.level=Math.min(cap,item.level);item.ascension=Math.min(m.rarity<3?4:6,item.ascension);item.level=Math.max([1,20,40,50,60,70,80][item.ascension],Math.min(item.level,[20,40,50,60,70,80,cap][item.ascension]));if(item.location){const owner=item.location==='Traveler'?state().good.characters.find(c=>c.key.startsWith('Traveler'))?.key:item.location;if(m.weaponType!==meta(owner).weaponType)item.location='';}check('weapons',item);state().good.weapons[index]=item;}
    weaponPicker=null;editing={kind:'weapons',index};changed();render();toast('已选择 '+m.name);
  }
  function weaponEditorHTML(index){const item=state().good.weapons[index];if(!item)return'';const m=catalog.weapons[item.key];return`<div class="panel ae-section" data-native-weapon-index="${index}"><h3>编辑武器</h3><div class="ae-selected-weapon">${image(m)}<div><strong>${esc(m?.name??item.key)}</strong><p class="ae-muted">${m?.rarity??'?'} 星 · ${weaponTypes[m?.weaponType]??'未知类型'}</p></div><button class="subtle-action" data-native="replace-weapon" data-index="${index}">搜索并更换武器</button></div><div class="ae-fields">${num('等级',item.level,'data-native-weapon="level"',1,m?.rarity<3?70:90)}${num('突破阶段',item.ascension,'data-native-weapon="ascension"',0,m?.rarity<3?4:6)}${num('精炼等级',item.refinement,'data-native-weapon="refinement"',1,5)}</div><div class="ae-inline-actions"><button class="subtle-action" data-native="close-editor">完成编辑</button><button class="subtle-action ae-remove" data-native="remove-weapon" data-index="${index}">移除这把武器</button></div></div>`;}
  function inventoryContextHTML(kind){
    if(kind!=='artifacts'||!artifactReference)return '';
    return `<div class="ae-inventory-context"><strong>词条评价角色：${esc(meta(artifactReference).name)}</strong><span>有效词条、排序及筛选按该角色的词条权重计算。</span><button class="subtle-action" data-native="clear-artifact-reference">取消角色评价</button></div>`;
  }
  function weaponsHTML(){
    const all=state().good.weapons,filters={search:inventorySearch,type:weaponFilter,rarity:weaponRarity,stat:weaponStat};
    const items=sortWeapons(all.map((item,i)=>({item,i})).filter(({item})=>weaponMatches(item.key,catalog.weapons[item.key]??{name:item.key},data.weapon.data[item.key],filters)&&originMatches(item,inventoryOrigin)&&matchesEquipment(item,weaponStatus,'',current()?equipmentLocation(key()):'')),catalog,data,weaponSort),pages=inventoryPages(items.length),shown=items.slice((inventoryPage-1)*pageSize,inventoryPage*pageSize);
    return `<div class="panel ae-section ae-inventory-panel"><div class="ae-result-heading"><h2>武器库存</h2><button class="subtle-action" data-native="new-weapon">添加自定义武器</button></div>${inventoryContextHTML('weapons')}<div class="ae-fields ae-filter-fields">${originFilter()}${field('搜索库存',`<input type="search" data-native-search value="${esc(inventorySearch)}" placeholder="名称、别名或英文关键词">`)}${field('武器类型',`<select data-native-filter="weapon">${opt('','全部类型',weaponFilter)}${Object.entries(weaponTypes).map(([k,n])=>opt(k,n,weaponFilter)).join('')}</select>`)}${field('星级',`<select data-native-filter="weapon-rarity">${opt('','全部星级',weaponRarity)}${[5,4,3,2,1].map(k=>opt(String(k),k+' 星',weaponRarity)).join('')}</select>`)}${field('副属性',`<select data-native-filter="weapon-stat">${secondaryOptions().map(([k,n])=>opt(k,n,weaponStat)).join('')}</select>`)}${field('装备状态',`<select data-native-filter="weapon-status">${[['','全部状态'],['free','未装备'],['equipped','已装备'],...(current()?[['current','当前角色装备']]:[])].map(([k,n])=>opt(k,n,weaponStatus)).join('')}</select>`)}</div>${inventoryToolbar(items.length,all.length,'把','clear-weapon-filters',`<select class="ae-inventory-sort" data-weapon-sort aria-label="武器排序">${Object.entries(WEAPON_SORTS).map(([k,n])=>opt(k,n,weaponSort)).join('')}</select>`,pages)}</div>${editing?.kind==='weapons'?weaponEditorHTML(editing.index):''}<div class="ae-inventory-grid">${shown.map(({item:a,i})=>{
      const m=catalog.weapons[a.key],values=weaponBaseStats(a,data),sub=data.weapon.data[a.key]?.subStat?.type,link=m?.wikiId?'/?game=genshin&entry='+encodeURIComponent(m.wikiId):'',title=esc(m?.name??a.key);
      return `<article class="panel ae-item-card ae-weapon-card ae-rarity-${m?.rarity??0}"><div class="ae-item-head">${link?`<a class="ae-item-art-link" href="${link}" aria-label="查看${title}武器资料">${image(m)}</a>`:image(m)}<div><h3>${link?`<a href="${link}">${title}</a>`:title} ${badge(a)}</h3><p class="ae-item-meta"><span class="ae-stars">${m?.rarity??'?'} 星</span> · ${weaponTypes[m?.weaponType]??'未知类型'} · ${a.refinement} 阶精炼</p><p class="ae-weapon-level">Lv.${a.level} · 突破 ${a.ascension}</p></div></div><div class="ae-item-metrics ae-weapon-stats"><span>基础攻击力 <b>${values?.atk===undefined?'—':statDisplay(values.atk,'atk')}</b></span><span>${STAT_NAMES[sub]??'无副属性'} <b>${values?.[sub]===undefined?'—':statDisplay(values[sub],sub)}</b></span></div><p class="ae-item-owner">${a.location?'装备：'+esc(locationName(a.location)):'未装备'}</p>${itemActions('weapons',a,i,`<button class="subtle-action" data-native="edit-weapon" data-index="${i}">编辑</button>`)}</article>`;
    }).join('')||`<div class="panel ae-empty">${all.length?'没有匹配的武器，可清空或调整筛选。':'库存为空，点击“添加武器”搜索并选择。'}</div>`}</div>${items.length>pageSize?pages:''}`;
  }

  const emptyHTML=()=>'<div class="panel ae-empty"><h2>先建立角色方案</h2></div>';
  const researchTrial=(artifacts,member,name,context)=>{
    if(context){clearTrial();const w=workspace(),saved=w.teams.find(t=>t.id===context.id);teamId=saved?.id??'';if(!saved)w.teamDraft={members:context.members,character:context.key,scenario:structuredClone(context.scenario)};w.activeTeamId=teamId;commit(w);}
    if(!teamMembers().includes(member)){const w=workspace();w.teamDraft={members:[member],character:member,scenario:defaultScenario()};teamId='';w.activeTeamId='';commit(w);}
    rememberBaseline();let next=calculationGOOD();if(context?.sourceArtifact&&context.sourceIndex>=0)next=potentialSimulationGOOD(next,member,potentialSourceIndex(next,context.sourceArtifact,context.sourceIndex));for(const a of artifacts)next=replaceWithTrialEquipment(next,member,'artifacts',a.slotKey,a,catalog,data);trialGood=next;trialBasis=JSON.stringify(state().good);previewPlan=null;trialPreparation=null;currentPlanName=name;currentPlanBasis=trialBasis;page='teams';teamTab='loadouts';render();
  };
  const potential=createArtifactPotential({root:popupRoot(),catalog,data,readState,readGoal,readContext:()=>({teams:workspace().teams,activeTeam:{...activeTeam(),id:teamId||'draft'},role:artifactReference||readSelected()}),changed,recordUndo,toast,onTrial:researchTrial});
  const research=createArtifactResearch({root:popupRoot(),catalog,data,readState,readGOOD:()=>page==='teams'?calculationGOOD():state().good,readGoal,readContext:()=>{const members=teamMembers(),anchor=members[0]||readSelected()||state().good.characters[0]?.key;return {key:anchor,members:members.length?members:[anchor].filter(Boolean),scenario:members.length?structuredClone(activeTeam().scenario):defaultScenario(),name:activeTeam()?.name??'当前队伍'};},changed,recordUndo,toast,onTrial:researchTrial,onSavePlan:plan=>{const w=workspace();w.teamPlans??=[];w.teamPlans.push({...plan,id:crypto.randomUUID(),teamId});commit(w);}});
  const optimizer=createOptimizer({readState,readSelected,readGoal,readAccount,catalog,data,changed,replaceState,toast,onTrial:(good,context)=>{
    const baseline=structuredClone(context.baseline??state().good),w=workspace(),saved=w.teams.find(t=>t.id===context.team?.id),members=[context.key,...(context.scenario.members??[])];
    if(context.team&&(!saved||JSON.stringify(growthTeamScenario(saved,context.key))!==JSON.stringify(context.scenario)))throw Error('队伍条件已变化，请重新计算后查看对比；已保存队伍设置保留。');
    clearTrial();trialPreparation=context.artifactPreparation??null;teamId=saved?.id??'';
    // 推荐配装只带入装备副本；已保存队伍的条件不能被结果快照覆盖。
    if(!saved)w.teamDraft={members,character:context.key,scenario:structuredClone(context.scenario)};
    w.activeTeamId=teamId;commit(w);comparisonBaseline=baseline;baselineName='当前账号装备';trialGood=good;trialBasis=JSON.stringify(state().good);loadoutConditionsReview=true;currentPlanName='圣遗物推荐方案';currentPlanBasis=trialBasis;page='teams';teamTab='loadouts';render();const comparison=pane.querySelector('[data-native-comparison]');if(comparison){const section=comparison.closest('details');if(section)section.open=true;comparison.scrollIntoView?.({block:'start'});}
  }});
  function render(){
    const position=readScrollPosition();
    if(artifactReference&&!state().good.characters.some(c=>c.key===artifactReference))chooseArtifactReference('');
    if(customPopup&&customEditing){customPopup.setHTML(customEditorHTML());onRendered();return;}
    if(trialGood&&trialBasis!==JSON.stringify(state().good)){clearTrial();toast('实际资料已更新，试算已恢复为最新实际配装');}
    if(currentPlanName&&!trialGood&&!previewPlan&&currentPlanBasis!==JSON.stringify(state().good))currentPlanName='';
    if(!['artifacts','weapons'].includes(page))enginePage=page;
    rememberFolds();
    const active=document.activeElement,selection=inputSelection(active),attrs=active&&pane.contains(active)?[...active.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]):[],parent=active?.closest('[data-slot],[data-native-art-index],[data-native-weapon-index]'),parentAttr=parent?[...parent.attributes].find(a=>a.name.startsWith('data-')):null;
    if(page==='teams'&&!state().engineStorage[nativeKey]?.includes('\"independentTeams\":true'))commit(workspace());
    optimizer.dispose();if(page!=='artifacts'||artifactPage!=='potential')potential.dispose();if(page!=='optimizer'&&(page!=='artifacts'||artifactPage!=='potential'))calculate();pane.innerHTML=`${page==='artifacts'?`<nav class="ae-native-nav ae-tool-nav" aria-label="圣遗物功能">${[['inventory','库存'],['potential','强化潜力']].map(([k,n])=>`<button type="button" class="subtle-action ${artifactPage===k?'active':''}" data-native-artifact-page="${k}" aria-current="${artifactPage===k?'page':'false'}">${n}</button>`).join('')}</nav>`:['weapons'].includes(page)?'':`<nav class="ae-native-nav ae-tool-nav" aria-label="配装与伤害功能">${[['teams','队伍与伤害'],['optimizer','圣遗物配装计算']].map(([k,n])=>`<button class="subtle-action ${page===k?'active':''}" data-native-page="${k}" aria-current="${page===k?'page':'false'}">${n}</button>`).join('')}</nav>`}<div class="ae-workspace ae-independent-team ${page==='teams'?'ae-team-workspace':['artifacts','weapons'].includes(page)?'ae-inventory-workspace':''}"><div class="ae-main">${page==='teams'?teamHTML():page==='optimizer'?'<div data-optimizer-host></div>':page==='artifacts'?(artifactPage==='potential'?'<div data-potential-host></div>':artifactsHTML()):weaponsHTML()}</div></div>`;
    if(page==='optimizer')optimizer.render(pane.querySelector('[data-optimizer-host]'));
    if(page==='artifacts'&&artifactPage==='potential')potential.mount(pane.querySelector('[data-potential-host]'));
    for(const d of pane.querySelectorAll('details')){const name=page+':'+disclosureKey(d);if(Object.hasOwn(foldStates,name))d.open=foldStates[name];}renderedPage=page;
    applyTeamView();onRendered();
    if(attrs.length){const scope=parentAttr?pane.querySelector(`[${parentAttr.name}="${CSS.escape(parentAttr.value)}"]`):pane;restoreInputFocus(scope?.querySelector(attrs.map(([n,v])=>`[${n}="${CSS.escape(v)}"]`).join('')),selection);}
    restoreScrollPosition(position);
  }
  function comparisonHTML(before,after,label){
    let oldCombo=null,newCombo=null;try{oldCombo=comboDamage(before.good??calculationGOOD(),key(),before.scenario??scenario(),before).value;newCombo=comboDamage(after.good??calculationGOOD(),key(),after.scenario??scenario(),after).value;}catch{}
    return`${comparisonHeadingHTML(label)}<p data-ae-hint="配装对比条件说明" class="ae-muted">使用相同的当前队伍与计算条件。${trialPreparation?'（圣遗物按同一自动规则准备；角色与武器状态保留）':''}</p>${artifactTriggerAuditHTML(before.artifactAudit,after.artifactAudit,catalog)}${scenario().combo?.length&&oldCombo!==null&&newCombo!==null?`<p>固定组合期望：${oldCombo.toFixed(1)} → ${newCombo.toFixed(1)}（${newCombo-oldCombo>=0?'+':''}${(newCombo-oldCombo).toFixed(1)}）</p>`:''}${teamDamageComparisonHTML(before,after,catalog,{beforeLabel:'基准配装期望',afterLabel:'当前方案期望'})}`;
  }
  function traceHTML(trace){const value=trace.unit==='%'?trace.value*100:trace.value;return`<li><span>${esc(trace.label)}：${Number.isFinite(value)?value.toFixed(2):'需核对'}${esc(trace.unit)}${trace.children.length?' · '+({add:'相加',mul:'相乘',sum_frac:'分式',res:'抗性倍率',min:'取最小值',max:'取最大值'}[trace.op]??''):''}</span>${trace.children.length?`<ul>${trace.children.map(traceHTML).join('')}</ul>`:''}</li>`;}
  async function click(button){
    if(button.dataset.nativeArtifactPage){closeFloating();artifactPage=button.dataset.nativeArtifactPage;page='artifacts';if(artifactPage==='potential')potential.open(null,artifactReference);render();return true;}
    if(button.dataset.nativeTeamTab){teamTab=button.dataset.nativeTeamTab;applyTeamView();return true;}
    if(button.dataset.nativeConditionTab){conditionTab=button.dataset.nativeConditionTab;applyTeamView();return true;}
    if(button.dataset.nativeConditionMember){conditionOwner=button.dataset.nativeConditionMember;applyTeamView();return true;}
    if(button.dataset.nativePage){rememberInventory();const next=button.dataset.nativePage==='characters'?'teams':button.dataset.nativePage;if(next!==page&&['artifacts','weapons'].includes(next))restoreInventory(next);page=next;editing=null;customEditing=null;closeFloating();weaponPicker=null;upgrade=null;render();return true;}
    if(button.dataset.nativeGrowthTeam!==undefined){const context=growthContext(),w=workspace(),id=button.dataset.value;if(id!=='solo'&&!context.teams.some(t=>t.id===id))throw Error('请选择含当前角色的队伍。');(w.growthTeams??={})[readSelected()]=id;upgrade=null;upgradeTarget=null;commit(w);onEvaluationChange();return true;}
    const action=button.dataset.native;if(!action)return false;
    if(action==='open-theory'){closeFloating();research.openTheory();return true;}
    if(action==='open-potential'){closeFloating();potential.open(state().good.artifacts[Number(button.dataset.index)],artifactReference);artifactPage='potential';page='artifacts';render();return true;}
    if(action==='export-combo'){downloadActions(scenario().combo??[],{members:teamMembers(),owner:key()});return true;}
    if(['copy-combo','add-combo-bonus','remove-combo-bonus'].includes(action)){
      const s=scenario(),i=Number(button.dataset.index);if(!s.combo?.[i])throw Error('动作已不存在。');
      if(action==='copy-combo'){if(s.combo.length>=200)throw Error('固定动作最多 200 项。');s.combo.splice(i+1,0,structuredClone(s.combo[i]));}
      else if(action==='add-combo-bonus'){const stat=pane.querySelector('[data-combo-add-stat="'+i+'"]').value;(s.combo[i].bonusStats??={})[stat]??=0;}
      else delete s.combo[i].bonusStats?.[button.dataset.stat];saveScenario(s);render();return true;
    }
    if(isReadOnly()&&blocksLockedButton(button,permissionContext()))throw Error('实际角色与装备已锁定，请先解锁再修改。');
    if(action==='fold-team-loadouts'){
      for(const detail of pane.querySelectorAll('[data-native-disclosure="team-loadouts"] .ae-team-loadout'))detail.open=button.dataset.open==='true';
      return true;
    }
    if(action==='fold-member-skills'){
      const member=pane.querySelector(`[data-team-damage-results] [data-damage-owner="${CSS.escape(button.dataset.owner)}"]`);
      if(member)for(const detail of member.children)if(detail.matches('details.ae-calculation-group'))detail.open=button.dataset.open==='true';
      return true;
    }
    if(action==='choose-artifact-reference'){openArtifactReference();return true;}
    if(action==='clear-artifact-reference'){chooseArtifactReference('');render();return true;}
    if(action==='copy-inventory-item'){const item=state().good[button.dataset.kind][Number(button.dataset.index)];if(!item)throw Error('装备已被移除。');storeCustomEquipment(state(),button.dataset.kind,item);changed();render();toast('已复制到自定义库存');return true;}
    if(action==='close-upgrade'){upgrade=null;upgradeBasis='';onEvaluationChange();return true;}
    if(action==='open-upgrade-target'){openGrowthTarget();return true;}
    if(action==='choose-artifact-filter-set'){
      catalogPopup?.close();catalogPopup=openCatalogPicker({root:popupRoot(),catalog,data,kind:'sets',selected:artifactFilter.set,allowedKeys:[...new Set(state().good.artifacts.map(a=>a.setKey))],allowEmpty:true,emptyLabel:'全部套装',title:'筛选圣遗物套装',toast,onClose:()=>{catalogPopup=null;},onChoose:value=>{const input=pane.querySelector('[data-artifact-filter="set"]');input.value=value;return()=>{void change(input).catch(error=>toast(error.message));};}});return true;
    }
    if(action==='choose-custom-set'){
      catalogPopup?.close();catalogPopup=openCatalogPicker({root:popupRoot(),catalog,data,kind:'sets',slot:customEditing.draft.slotKey,selected:customEditing.draft.setKey,toast,onClose:()=>{catalogPopup=null;},onChoose:value=>{const input=customPopup.dialog.querySelector('[data-custom-field="setKey"]');input.value=value;return()=>{void change(input).catch(error=>toast(error.message));};}});return true;
    }
    if(action==='open-team-equipment'){openTeamPicker(button.dataset.member,button.dataset.kind,button.dataset.slot);return true;}
    if(action==='open-trial-equipment'){openTrialEditor(button.dataset.member,button.dataset.kind,button.dataset.slot);return true;}
    if(action==='open-team-member'){openMemberPicker(Number(button.dataset.slot));return true;}
    if(action==='reset-scenario-group'){const next=scenario(),owner=button.dataset.owner;if(button.dataset.group==='combo')next.combo=[];else if(button.dataset.group==='bonus'){if(!owner||owner===key())delete next.bonusStats;for(const[k,own]of Object.entries(next.characters??{}))if(!owner||owner===k)delete own.bonusStats;}else{if(!owner||owner===key())delete next.conditional;for(const[k,own]of Object.entries(next.characters??{}))if(!owner||owner===k)delete own.conditional;}upgrade=null;saveScenario(next);render();toast('此组计算设置已恢复默认');return true;}
    if(action==='inventory-page'){inventoryPage+=Number(button.dataset.direction);render();return true;}
    if(action==='clear-artifact-filters'){inventoryOrigin='';artifactFilter=artifactFilters();inventorySearch='';slotFilter='';setFilter='';inventoryPage=1;render();return true;}
    if(action==='view-artifact'){openArtifactAnalysis(Number(button.dataset.index));return true;}
    if(action==='view-custom'){openArtifactAnalysis(undefined,button.dataset.id);return true;}
    if(action==='close-analysis'){closeFloating();return true;}
    if(action==='artifact-mode'){switchArtifactMode(customEditing,button.dataset.mode,data);render();return true;}
    if(action==='replace-weapon'){openWeaponPicker(Number(button.dataset.index));return true;}
    if(action==='choose-weapon'){chooseWeapon(button.dataset.key);return true;}
    if(action==='clear-weapon-filters'){inventoryOrigin='';inventorySearch='';weaponFilter='';weaponRarity='';weaponStat='';weaponStatus='';weaponSort='level-desc';inventoryPage=1;render();return true;}
    if(['remove-artifact','remove-weapon'].includes(action)){const kind=action==='remove-artifact'?'artifacts':'weapons',index=Number(button.dataset.index),before=serializeManagedState(state());if(removeEquipment(state(),kind,index)){if(editing?.kind===kind){if(editing.index===index)editing=null;else if(editing.index>index)editing.index--;}if(kind==='weapons'&&weaponPicker?.index!==undefined){if(weaponPicker.index===index)weaponPicker=null;else if(weaponPicker.index>index)weaponPicker.index--;}if(kind==='artifacts'&&customEditing?.sourceIndex!==undefined){if(customEditing.sourceIndex===index)customEditing=null;else if(customEditing.sourceIndex>index)customEditing.sourceIndex--;}changed();recordUndo(before,'已从库存移除');render();toast('已从库存移除；已保存配装的快照保留');}return true;}
    if(action==='remove-plan'){const p=plans()[Number(button.dataset.index)],w=workspace();w.teamPlans=w.teamPlans.filter(x=>x.id!==p.id);if(p.legacyOwner)w.plans[p.legacyOwner]=(w.plans[p.legacyOwner]??[]).filter(x=>JSON.stringify(x)!==JSON.stringify({...p,id:undefined,legacyOwner:undefined,legacyIndex:undefined,teamId:undefined}));commit(w);render();return true;}
    if(action==='remove-team'){
      const before=serializeManagedState(state());let w=workspace();const saved=w.teams.some(t=>t.id===teamId);
      if(saved){const removedId=teamId;removeTeam(state(),removedId);w=workspace();w.teamPlans=w.teamPlans.map(p=>p.teamId===removedId?{...p,teamId:''}:p);teamId=w.teams[0]?.id??'';}
      else{w.teamDraft={members:[],scenario:defaultScenario()};teamId='';}
      teamName=null;clearTrial();target='';upgrade=null;w.activeTeamId=teamId;commit(w);recordUndo(before,saved?'已删除队伍':'已清空未命名队伍');render();toast(saved?'已删除队伍，已保存配装方案保留':'已清空未命名队伍');return true;
    }
    if(action==='reset-scenario'){clearTrial();saveScenario(configureMembers(defaultScenario(),[],teamMembers()));target='';upgrade=null;render();return true;}
    if(action==='set-team-baseline'){rememberBaseline(true);render();toast('已设为比较基准，后续切换使用相同计算条件');return true;}
    if(action==='apply-team-trial'){if(!trialGood&&!previewPlan)throw Error('请先切换试算配装。');if(trialBasis!==JSON.stringify(state().good))throw Error('实际资料已更新，请先重新试算。');state().good=actualEquipmentFromTrial(state().good,calculationGOOD());clearTrial();changed();render();toast('已应用到实际装备，角色等级与天赋保留');return true;}
    if(action==='new-custom'){newCustom();showCustomEditor();return true;}
    if(action==='custom-from-artifact'){openArtifactEditor(Number(button.dataset.index));showCustomEditor();return true;}
    if(action==='edit-custom'){closeFloating();const c=workspace().customArtifacts.find(c=>c.id===button.dataset.id);customEditing=createArtifactEditor(c.values??inspectDraft(c.draft,data).artifact,data,{id:c.id,name:c.name,draft:c.draft});editing=null;showCustomEditor();return true;}
    if(action==='remove-custom'){const before=serializeManagedState(state()),w=workspace();w.customArtifacts=w.customArtifacts.filter(c=>c.id!==button.dataset.id);if(customEditing?.id===button.dataset.id)customEditing=null;commit(w);recordUndo(before,'已移除自定义圣遗物');render();return true;}
    if(action==='close-custom'||action==='cancel-artifact'){customPopup?.close();customEditing=null;render();return true;}
    if(action==='custom-tier'||action==='custom-clear-line'){const line=customEditing.draft.lines[Number(button.dataset.line)],count=line.counts.reduce((a,b)=>a+b,0);if(action==='custom-clear-line'){line.key='';line.counts=line.counts.map(()=>0);}else{if(count>50)throw Error('单个档位最多 50 次，请保持分档设置。');line.counts=line.counts.map((_,j)=>j===Number(button.dataset.tier)?count:0);}customEditing.changedLines=[...new Set([...(customEditing.changedLines??[]),Number(button.dataset.line)])];customEditing.countsChanged=true;render();return true;}
    if(action==='save-custom'){const name=(customPopup?.dialog??pane).querySelector('[data-custom-name]').value.trim();if(!name||name.length>150)throw Error('自定义方案名称须为 1–150 个字。');const w=workspace(),c={id:customEditing.id||crypto.randomUUID(),name,...artifactEditorSnapshot(customEditing,data)},list=w.customArtifacts??=[],i=list.findIndex(c=>c.id===customEditing.id);if(i<0)list.push(c);else list[i]=c;customEditing.id=c.id;customEditing.name=name;w.customArtifacts=list;commit(w);customPopup?.close();render();toast('自定义方案已保存');return true;}
    if(action==='custom-to-inventory'){const r=inspectDraft(customEditing.draft,data),valuesMode=customEditing.mode==='values';if(!valuesMode&&!r.realistic)throw Error('次数分配超出正常范围，请调整或单独保存理论方案。');const a=valuesMode?structuredClone(customEditing.values):r.artifact;check('artifacts',a);let index=customEditing.sourceIndex;if(index!==undefined){const old=state().good.artifacts[index];state().good.artifacts[index]={...old,...a,id:old.id,location:old.location,lock:old.lock};}else{state().good.artifacts.push({...a,location:'',lock:false,id:crypto.randomUUID()});index=state().good.artifacts.length-1;}customEditing.sourceIndex=index;customEditing.values=structuredClone(state().good.artifacts[index]);if(valuesMode)customEditing.draft=draftFromArtifact(a,data,customEditing.draft.initialCount);customEditing.countsChanged=false;customEditing.valuesChanged=false;customEditing.changedLines=[];changed();customPopup?.close();render();toast('已保存圣遗物');return true;}
    if(action==='page-teams'){page='teams';render();}
    else if(action==='trace'){const owner=button.dataset.owner??key(),trace=calculateTrace(calculationGOOD(),owner,memberScenario(calculationGOOD(),key(),last?.scenario??scenario(),owner),button.dataset.path);pane.querySelector(`[data-native-trace="${owner}"]`).innerHTML=`<section class="ae-trace"><h4>计算过程 · ${esc(meta(owner).name)} · ${esc(last.rows.find(r=>r.owner===owner&&r.path===button.dataset.path)?.label??'')}</h4><ul>${traceHTML(trace)}</ul></section>`;}
    else if(action==='add-combo'){const s=scenario(),row=chosenTarget();if(!row)throw Error('暂无可用的伤害项目。');if((s.combo?.length??0)>=200)throw Error('固定动作最多 200 项。');(s.combo??=[]).push({owner:row.owner??key(),path:row.path,count:1,reaction:s.reaction??''});saveScenario(s);render();}
    else if(action==='remove-combo'){const s=scenario();s.combo.splice(Number(button.dataset.index),1);saveScenario(s);render();}
    else if(action==='new-team'){const team=addTeam(state(),key(),scenario()),w=workspace();w.teams.find(t=>t.id===team.id).members=teamMembers();teamId=team.id;teamName=null;clearTrial();w.activeTeamId=teamId;commit(w);render();toast('已新建 '+team.name+'，沿用当前配队与条件');}
    else if(action==='rename-team'){openTeamRename();}
    else if(action==='save-team'){const members=teamMembers(),team=saveTeam(state(),{id:teamId,name:teamName??activeTeam()?.name??'新队伍',character:key(),scenario:scenario()}),w=workspace();w.teams.find(t=>t.id===team.id).members=members;if(!teamId)for(const p of w.teamPlans)if(!p.teamId)p.teamId=team.id;teamId=team.id;teamName=null;w.activeTeamId=teamId;commit(w);render();toast('队伍与计算条件已保存');}
    else if(action==='save-plan'){if(!current())throw Error('请先配置队伍成员。');const name=(planName||pane.querySelector('[data-native-plan-name]')?.value||'').trim();if(!name||name.length>150)throw Error('方案名称须为 1–150 个字。');const w=workspace();w.teamPlans.push({...captureTeamPlan(calculationGOOD(),key(),last?.scenario??scenario(),name),artifactPreparation:trialPreparation,manualScenario:scenario(),id:crypto.randomUUID(),teamId});commit(w);currentPlanName=name;currentPlanBasis=JSON.stringify(state().good);if(baselineName==='未保存试算'&&JSON.stringify(comparisonBaseline)===JSON.stringify(calculationGOOD()))baselineName='队伍方案：'+name;planName='';render();toast('全队配装方案已保存');}
    else if(action==='preview-plan'||action==='compare-plan'){const p=plans()[Number(button.dataset.index)];if(!p)throw Error('方案已不可用。');const saved=p.teamBuilds?.map(b=>b.character.key)??[p.character.key];if(saved.some(k=>!teamMembers().includes(k))||p.teamBuilds&&saved.length!==teamMembers().length)throw Error('方案成员与当前队伍不同，请先将队伍成员调整为该方案的成员。');rememberBaseline();trialGood={...planGOOD(state().good,key(),p),characters:structuredClone(state().good.characters)};trialBasis=JSON.stringify(state().good);previewPlan=p;trialPreparation=p.artifactPreparation?.version===ARTIFACT_TRIGGER_VERSION?p.artifactPreparation:null;currentPlanName=p.name;loadoutConditionsReview=true;render();toast('已切换配装，并使用当前队伍条件比较；请检查角色、武器、套装与共鸣条件开关。');}
    else if(action==='clear-plan-preview'){clearTrial();loadoutConditionsReview=true;render();}
    else if(action==='new-artifact'){newCustom();showCustomEditor();}
    else if(action==='new-weapon'){openNewWeapon();}
    else if(action==='close-editor'){editing=null;render();}
    else if(action==='edit-artifact'||action==='edit-weapon'){if(action==='edit-artifact'){openArtifactEditor(Number(button.dataset.index));showCustomEditor();}else{editing={kind:'weapons',index:Number(button.dataset.index)};weaponPicker=null;render();pane.querySelector('[data-native-weapon-index]')?.scrollIntoView({block:'nearest',behavior:'smooth'});}}
    else if(action==='upgrade'){
      const selectedValue=popupRoot().querySelector('[data-native-upgrade-target]')?.value??upgradeTarget;if(!selectedValue)throw Error('请先选择当前角色的计算项目。');
      const context=growthContext(),target=JSON.parse(selectedValue);if(target.owner!==context.character)throw Error('收益计算只选择当前角色的项目。');
      upgrade=upgradeReference(state().good,context.character,context.scenario,data,target);upgradeBasis=upgradeStamp();onEvaluationChange();
    }
    return true;
  }
  async function change(t){
    if(t.hasAttribute('data-native-combo-import')){const file=t.files?.[0];if(!file)return true;if(file.size>1048576)throw Error('动作文件过大。');const s=scenario();s.combo=normalizeActions(JSON.parse(await file.text()),{members:teamMembers(),owner:key()});saveScenario(s);render();toast('已导入固定动作，队伍与装备保留');return true;}
    if(t.hasAttribute('data-native-combo-bonus')){const s=scenario(),i=Number(t.dataset.nativeComboBonus),value=Number(t.value);if(!Number.isFinite(value)||Math.abs(value)>1e7)throw Error('动作增益数值不正确。');(s.combo[i].bonusStats??={})[t.dataset.stat]=value;normalizeActions(s.combo,{members:teamMembers(),owner:key()});saveScenario(s);render();return true;}
    if(t.hasAttribute('data-native-upgrade-target')){upgradeTarget=t.value;upgrade=null;onEvaluationChange();return true;}
    if(t.hasAttribute('data-native-team-name')){teamName=t.value;if(teamId&&t.value.trim()&&t.value.trim().length<=150){renameTeam(state(),teamId,t.value);changed();}return true;}
    if(t.hasAttribute('data-native-plan-name')){planName=t.value;return true;}
    if(isReadOnly()&&blocksLockedInput(t,permissionContext()))throw Error('实际角色与装备已锁定，请先解锁再修改。');
    if(t.hasAttribute('data-inventory-origin')){inventoryOrigin=t.value;inventoryPage=1;render();return true;}
    if(t.dataset.artifactFilter){if(!t.checkValidity())throw Error('筛选数值超出允许范围。');artifactFilter[t.dataset.artifactFilter]=t.value;if(t.dataset.artifactFilter==='slot'&&t.value&&artifactFilter.main&&!MAIN_STATS[t.value].includes(artifactFilter.main))artifactFilter.main='';slotFilter=artifactFilter.slot;setFilter=artifactFilter.set;inventoryPage=1;if(t.type==='number')refreshArtifactResults();else render();return true;}
    if(t.hasAttribute('data-artifact-sub')){const k=t.dataset.artifactSub;artifactFilter.subs=artifactFilter.subs.filter(x=>x!==k);if(t.checked)artifactFilter.subs.push(k);inventoryPage=1;render();return true;}
    if(t.hasAttribute('data-artifact-sub-min')){if(!t.checkValidity())throw Error('请填写有效的副词条门槛。');artifactFilter.subMin[t.dataset.artifactSubMin]=t.value;inventoryPage=1;refreshArtifactResults();return true;}
    if(t.hasAttribute('data-inventory-page-size')){pageSize=Number(t.value);inventoryPage=1;render();return true;}
    if(t.hasAttribute('data-weapon-sort')){weaponSort=t.value;inventoryPage=1;render();return true;}
    if(t.dataset.nativeLock){const item=state().good[t.dataset.nativeLock][Number(t.dataset.index)];item.lock=t.checked;changed();render();return true;}
    if(t.hasAttribute('data-custom-name')){customEditing.name=t.value;return true;}
    if(t.hasAttribute('data-custom-value')||t.hasAttribute('data-custom-value-key')){if(!t.checkValidity())throw Error('请填写允许范围内的数值。');const a=structuredClone(customEditing.values),i=Number(t.dataset.customValue??t.dataset.customValueKey);while(a.substats.length<=i)a.substats.push({key:'',value:0});if(t.hasAttribute('data-custom-value'))a.substats[i].value=Number(t.value);else a.substats[i].key=t.value;customEditing.values=a;customEditing.valuesChanged=true;if(customPopup&&t.type==='number')refreshCustomSummary();else render();return true;}
    if(t.dataset.customField||t.hasAttribute('data-custom-line')||t.hasAttribute('data-custom-count')){if(!t.checkValidity())throw Error('请填写允许范围内的整数次数或等级。');const d=structuredClone(customEditing.draft);
      if(t.dataset.customField){const k=t.dataset.customField;d[k]=['rarity','level','initialCount'].includes(k)?Number(t.value):t.value;
        if(k==='slotKey'){if(!data.art.data[d.setKey].slots.includes(d.slotKey))d.setKey=Object.keys(catalog.sets).find(x=>data.art.data[x].slots.includes(d.slotKey));if(!MAIN_STATS[d.slotKey].includes(d.mainStatKey))d.mainStatKey=MAIN_STATS[d.slotKey][0];}
        if(k==='rarity'||k==='setKey'||k==='slotKey'){if(!data.art.data[d.setKey].rarities.includes(d.rarity))d.rarity=Math.max(...data.art.data[d.setKey].rarities);d.level=Math.min(d.level,artifactMaxLevel(d.rarity));if(!artifactInitialCounts(d.rarity).includes(d.initialCount))d.initialCount=artifactInitialCounts(d.rarity).at(-1);for(const l of d.lines){const n=substatTiers(data,d.rarity,l.key||'atk_').length;l.counts=Array.from({length:n},(_,i)=>l.counts[i]??0);}}
        for(const l of d.lines)if(l.key===d.mainStatKey){l.key='';l.counts=l.counts.map(()=>0);}
      }else if(t.hasAttribute('data-custom-line')){const l=d.lines[Number(t.dataset.customLine)];l.key=t.value;l.counts=substatTiers(data,d.rarity,l.key||'atk_').map(()=>0);}else d.lines[Number(t.dataset.customCount)].counts[Number(t.dataset.tier)]=Number(t.value);
      customEditing.draft=d;
      if(customEditing.mode==='values'){for(const k of ['setKey','slotKey','rarity','level','mainStatKey'])customEditing.values[k]=d[k];customEditing.values.substats=customEditing.values.substats.filter(l=>l.key!==d.mainStatKey);customEditing.valuesChanged=true;}else{customEditing.countsChanged=true;if(t.hasAttribute('data-custom-line')||t.hasAttribute('data-custom-count'))customEditing.changedLines=[...new Set([...(customEditing.changedLines??[]),Number(t.dataset.customLine??t.dataset.customCount)])];}
      if(customPopup&&t.type==='number')refreshCustomSummary();else render();return true;
    }
    if(t.hasAttribute('data-native-search')){inventorySearch=t.value;inventoryPage=1;render();return true;}
    if(t.dataset.nativeFilter){if(t.dataset.nativeFilter==='slot')slotFilter=t.value;else if(t.dataset.nativeFilter==='set')setFilter=t.value;else if(t.dataset.nativeFilter==='weapon')weaponFilter=t.value;else if(t.dataset.nativeFilter==='weapon-rarity')weaponRarity=t.value;else if(t.dataset.nativeFilter==='weapon-stat')weaponStat=t.value;else weaponStatus=t.value;inventoryPage=1;render();return true;}
    if(t.hasAttribute('data-native-team-select')){clearTrial();teamId=t.value;teamName=null;rememberTeam();render();return true;}
    if(t.hasAttribute('data-team-member')){setTeamMember(Number(t.dataset.teamMember),t.value);render();return true;}
    if(t.hasAttribute('data-team-equipment')){switchTeamEquipment(t.dataset.member,t.dataset.teamEquipment,t.value,t.dataset.slot);return true;}
    const s=scenario();
    if(t.hasAttribute('data-native-member')){const i=Number(t.dataset.nativeMember),members=[...(s.members??[])];members[i]=t.value;if(members.filter(Boolean).some((k,i,a)=>a.indexOf(k)!==i))throw Error('队友不能重复。');s.members=members;s.combo=(s.combo??[]).filter(a=>!a.owner||[key(),...members].includes(a.owner));if(![key(),...members].includes(s.active))s.active=key();saveScenario(s);render();return true;}
    if(t.hasAttribute('data-native-cond')){const c=last.conditions[Number(t.dataset.nativeCond)];if(trialPreparation&&ARTIFACT_TRIGGER_SETS[c.path[0]])throw Error('当前套装状态按自动规则计算；请先恢复账号装备，再调整手动条件。');let owner=s;if(c.owner!==key()){s.characters??={};owner=s.characters[c.owner]??={};}owner.conditional??={};let obj=owner.conditional;for(const p of c.path.slice(0,-1))obj=obj[p]??={};obj[c.path.at(-1)]=t.value;saveScenario(s);render();return true;}
    if(t.dataset.nativeSetting||t.dataset.nativeRes||t.dataset.nativeBonus){if(t.type==='number'&&t.value==='')return true;if(!t.checkValidity())throw Error('请填写允许范围内的数值。');const owner=t.dataset.owner??key();if(owner!==key()&&!teamMembers().includes(owner))throw Error('设置角色已不在队伍中。');const own=owner===key()?s:((s.characters??={})[owner]??={});if(t.dataset.nativeSetting){const k=t.dataset.nativeSetting;own[k]=t.type==='number'?Number(t.value):t.value;if(k==='target'){target=t.value;upgrade=null;}}else if(t.dataset.nativeRes)(s.resistances??={})[t.dataset.nativeRes]=Number(t.value);else(own.bonusStats??={})[t.dataset.nativeBonus]=Number(t.value);upgrade=null;saveScenario(s);if(page==='teams'&&t.type==='number')refreshScenarioResults();else render();return true;}
    if(t.hasAttribute('data-native-combo')){const i=Number(t.dataset.nativeCombo);if(!t.checkValidity())throw Error('请填写合法的命中次数。');s.combo[i][t.dataset.part]=t.dataset.part==='count'?Number(t.value):t.value;if(t.dataset.part==='owner'){const row=damageRows().find(r=>r.owner===t.value&&r.variant!=='heal');if(!row)throw Error('此角色暂无可用的伤害动作。');s.combo[i].path=row.path;}normalizeActions(s.combo,{members:teamMembers(),owner:key()});saveScenario(s);render();return true;}
    if(t.dataset.nativeArt||t.hasAttribute('data-native-sub')){const i=Number(t.closest('[data-native-art-index]').dataset.nativeArtIndex),a=structuredClone(state().good.artifacts[i]);if(t.dataset.nativeArt){const k=t.dataset.nativeArt;a[k]=['level','rarity'].includes(k)?Number(t.value):t.value;if(k==='setKey'&&!data.art.data[a.setKey].rarities.includes(a.rarity))a.rarity=Math.max(...data.art.data[a.setKey].rarities);if(k==='rarity'||k==='setKey'){a.level=Math.min(a.level,a.rarity<3?4:a.rarity*4);}if(k==='slotKey'){if(!MAIN_STATS[a.slotKey].includes(a.mainStatKey))a.mainStatKey=MAIN_STATS[a.slotKey][0];if(a.location&&state().good.artifacts.some((x,j)=>j!==i&&x.location===a.location&&x.slotKey===a.slotKey))a.location='';}if(k==='mainStatKey'||k==='slotKey')a.substats=a.substats.filter(x=>x.key!==a.mainStatKey);}else{const j=Number(t.dataset.nativeSub);while(a.substats.length<=j)a.substats.push({key:'',value:0});a.substats[j][t.dataset.part]=t.dataset.part==='value'?Number(t.value):t.value;}check('artifacts',a);state().good.artifacts[i]=a;changed();render();return true;}
    if(t.dataset.nativeWeapon){const i=Number(t.closest('[data-native-weapon-index]').dataset.nativeWeaponIndex),a=structuredClone(state().good.weapons[i]),k=t.dataset.nativeWeapon;a[k]=k==='key'?t.value:Number(t.value);const cap=catalog.weapons[a.key]?.rarity<3?70:90;if(k==='key'){a.level=Math.min(cap,a.level);if(a.location&&catalog.weapons[a.key]?.weaponType!==meta(a.location).weaponType)a.location='';}if(k==='level')a.ascension=[20,40,50,60,70,80,cap].findIndex(c=>a.level<=c);if(k==='ascension')a.level=Math.max([1,20,40,50,60,70,80][a.ascension],Math.min(a.level,[20,40,50,60,70,80,cap][a.ascension]));check('weapons',a);state().good.weapons[i]=a;changed();render();return true;}
    return false;
  }
  return{render,click,change,showCategory(category){rememberInventory();const next=['artifacts','weapons'].includes(category)?category:enginePage;if(next!==page&&['artifacts','weapons'].includes(next))restoreInventory(next);page=next;closeFloating();editing=null;customEditing=null;weaponPicker=null;render();},getCategory:()=>['artifacts','weapons'].includes(page)?page:'engine',getViewState:viewState,restoreViewState,getViewKey:()=>page==='teams'?'teams:'+teamScrollKey():page==='artifacts'?'artifacts:'+artifactPage:page,permissionContext,upgradeHTML,getResult:()=>calculate(),reset(){potential.reset();for(const k of Object.keys(memberFilter))memberFilter[k]='';restoreTeam();planName='';clearTrial();upgradeTarget=null;target='';editing=null;customEditing=null;closeFloating();weaponPicker=null;upgrade=null;},openArtifact(index){page='artifacts';artifactPage='inventory';inventorySearch='';artifactFilter=artifactFilters();inventoryPage=1;slotFilter='';setFilter='';if(isReadOnly()&&!isCustom(state().good.artifacts[index])){render();openArtifactAnalysis(index);}else{openArtifactEditor(index);showCustomEditor();}},dispose(){potential.dispose();research.dispose();optimizer.dispose();closeFloating();last=null;},getPage:()=>page};
}
