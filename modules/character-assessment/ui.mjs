import {deletionUndo,restoreDeletion} from './core/undo.mjs';
import {focusNameInput} from '../../shared/name-input.mjs';
import {withResourceTimeout} from '../../shared/resource-loading.mjs';
import {createViewMemory,readScrollPosition,restoreScrollPosition} from '../../shared/view-state.mjs';
import {createManagedState,syncManagedState,serializeManagedState,isCustom,customMarkers,originMatches,snapshotItem,equipManagedEquipment,restoreManagedEquipment,customConversionCounts,convertCustomToDefault} from './core/managed-inventory.mjs';
import {openCharacterInventoryPicker,openAccountEquipmentPicker} from './inventory-dialogs.mjs';
import {catalogChoiceHTML,openCatalogPicker} from './analysis-dialog.mjs';
import {blankState,validateState,FORMAT,SLOTS,SLOT_NAMES,STAT_NAMES,SUBSTATS,ELEMENTS,MAIN_STATS,ROLES,defaultGoal,equipment,equipmentLocation,importPreview,validateGOOD,statDisplay,percent} from './core/model.mjs';
import {evaluate,ROSTER_SORTS,sortAssessmentRoster,moveAssessmentRoster} from './core/evaluate.mjs';
import {recommendedGoal,goalDefaults,goalHelpHTML,characterGuideHTML} from './core/profiles.mjs';
import {openGuideEditor,openGoalDefaultEditor} from './recommendation-editor.mjs';
import {recommendationPlan,recommendationPlans} from './core/recommendation-plans.mjs';
import {removeCharacter,resetGoalGroup,switchTravelerElement} from './core/actions.mjs';
import {blocksLockedButton,blocksLockedInput} from './core/permissions.mjs';
import {artifactCountSummary,artifactIconHTML} from './artifact-ui.mjs';
import {idlePanel} from './core/combat.mjs';
import {scanPreview} from './core/import-sync.mjs';
import {importMatchingHTML,chooseImportMatch,importMatchDecision} from './import-matching.mjs';
import {openArtifactDialog} from './analysis-dialog.mjs';

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const goalReset=(group,label='恢复默认')=>`<button class="subtle-action ae-reset" data-ae="reset-goal" data-group="${escape(group)}" title="按当前角色、用途的 Wiki 默认值恢复此组设置">${escape(label)}</button>`;
const option=(value,label,selected)=>`<option value="${escape(value)}" ${String(value)===String(selected)?'selected':''}>${escape(label)}</option>`;
const number=(label,value,attribute,min=0,max=100,step=1)=>`<label class="ae-field"><span>${escape(label)}</span><input type="number" ${attribute} value="${value??''}" min="${min}" max="${max}" step="${step}"></label>`;
// 保留原控件和权限校验，只把受锁定保护的实际数值显示为文本。
function syncLockedValues(host,{locked,blocksInput}){
  for(const input of host.querySelectorAll('[data-evaluation-editor="character"] input[type="number"]')){
    if(!input.matches('[data-char],[data-talent],[data-weapon]'))continue;
    const field=input.closest('.ae-field');if(!field)continue;
    const readonly=locked&&blocksInput(input);
    let value=field.querySelector('[data-readonly-value]');
    if(readonly){
      if(!value){value=document.createElement('span');value.className='ae-read-value';value.dataset.readonlyValue='';input.after(value);}
      value.textContent=input.value===''?'—':input.value;
      input.hidden=true;input.dataset.readonlyPresentation='';field.classList.add('ae-field-readonly');
    }else{
      value?.remove();field.classList.remove('ae-field-readonly');
      if(input.hasAttribute('data-readonly-presentation')){input.hidden=false;delete input.dataset.readonlyPresentation;}
    }
  }
}
const detailLink=(id,text)=>id?`<a href="/?game=genshin&entry=${encodeURIComponent(id)}">${escape(text)} ↗</a>`:escape(text);
function customConversionHTML(state,locked){
  const counts=customConversionCounts(state),empty=!Object.values(counts).some(Boolean);
  return `<section class="panel ae-section ae-custom-conversion"><h2>自定义转为默认配置</h2><p data-ae-hint="自定义转默认说明" class="ae-muted">将当前账号的自定义角色、武器和圣遗物转入默认资料，保留数值与当前配装；原始导入快照继续保留。</p><div class="ae-inline-actions"><span data-custom-conversion-counts>角色 ${counts.characters} · 武器 ${counts.weapons} · 圣遗物 ${counts.artifacts}</span><button class="subtle-action" data-ae="convert-custom" ${locked||empty?'disabled':''} title="${locked?'请先在右上角解锁账号':empty?'当前没有可转换的自定义资料':'转换当前账号的全部自定义库存'}">转为默认配置</button>${locked&&!empty?'<span class="ae-muted">请先解锁账号</span>':''}</div></section>`;
}
export function filterAssessmentRoster(roster,catalog,{origin='',element='',selected=''}={}){
  const eligible=roster.filter(c=>originMatches(c,origin)&&(!element||catalog.characters[c.key]?.element===element));
  return eligible.filter(c=>!c.key.startsWith('Traveler')||c.key===selected||!eligible.some(other=>other.key===selected&&other.key.startsWith('Traveler')&&other.key.at(-1)===c.key.at(-1))&&c===eligible.filter(x=>x.key.startsWith('Traveler')&&x.key.at(-1)===c.key.at(-1)).sort((a,b)=>Number(b.key.includes('Cryo'))-Number(a.key.includes('Cryo')))[0]);
}
let mounted=null,savingOnExit=Promise.resolve();
const viewMemory=createViewMemory('wiki.assessment.views.v1',{limit:50});
export function disposeAssessment(){const current=mounted;mounted=null;const pending=current?.dispose();if(pending)savingOnExit=Promise.all([savingOnExit,pending]).then(()=>{});return savingOnExit;}
export async function mountAssessment({host,api,toast,wikiEntries=[],characterId=null,isActive=()=>true}){
  const initialPosition=readScrollPosition(),previousSave=disposeAssessment();
  if(!document.querySelector('link[data-assessment-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/assessment/ui.css';link.dataset.assessmentStyle='';document.head.append(link);}
  const marker={};mounted=marker;host.innerHTML='<div class="panel ae-loading">正在加载原神养成与评估…</div>';
  const loading=new AbortController();let dead=false;marker.dispose=()=>{dead=true;loading.abort();};
  try{
    await previousSave;if(dead||!isActive()||mounted!==marker)return;
    const [saved,accountIndex,data,catalog,upstream,{createWorkbench,panelHTML,createCompositionInputHandler},defaultSettings]=await withResourceTimeout(signal=>{
      const json=async url=>{const response=await fetch(url,{signal});if(response.ok===false)throw Error(`养成资料加载失败（HTTP ${response.status}）`);return response.json();};
      return Promise.all([api('assessment/state'),api('assessment/accounts'),json('/assessment/core/game-stats.json'),json('/assessment/core/catalog.json'),json('/assessment/upstream.json'),import('./workbench.mjs'),api('assessment/recommendations')]);
    },{signal:loading.signal,message:'养成与评估资料加载超时，请刷新后重试。'});
    if(dead||!isActive()||mounted!==marker)return;
    let account=saved.account,accountList=accountIndex.accounts,accountBusy=false;const viewSelections=new Map();
    let evaluationTab='overview',evaluationSettingsOpen=false,evaluationSettingsFocus=null;
    let artifactPopup=null,settingsPopup=null,settings=defaultSettings;let inventoryPopup=null,rosterOrigin='',rosterElement='';let state=createManagedState(saved.state,account),revision=saved.revision,tab='evaluation',selected=state.selected||state.good.characters?.[0]?.key||'',filter='',pending=null,saveTimer,inputTimer,draftNode=null,saving=null,dirty=false,conflict=false,saveFailed=false;
    let view=viewMemory.get(account.id)??{},viewReady=false;applyViewSettings();
    const liveEntries=new Map(wikiEntries.filter(e=>e.game==='genshin').map(e=>[e.id,e]));
    for(const meta of [...Object.values(catalog.characters),...Object.values(catalog.weapons),...Object.values(catalog.sets)]){const live=liveEntries.get(meta.wikiId);if(live){meta.image=live.image;meta.aliases=Array.isArray(live.aliases)?live.aliases:[];}}
    for(const meta of [...Object.values(catalog.sets),...Object.values(catalog.characters)]){const live=liveEntries.get(meta.wikiId);if(live)for(const field of ['sourceId','releaseVersion','releaseDate'])if(live[field]!==undefined)meta[field]=live[field];}
    const current=()=>state.good.characters?.find(c=>c.key===selected),meta=key=>catalog.characters[key]??{name:key,element:'',weaponType:''};
    const goal=key=>state.goals[key]??(data.char.data[key]||key.startsWith('Traveler')?recommendedGoal(key,meta(key).element||'pyro',settings):{...defaultGoal('custom'),mainStats:{sands:[],goblet:[],circlet:[]}});
    const status=text=>{const node=root.querySelector('[data-save-status]');if(node)node.textContent=text;};
    const persist=()=>{syncManagedState(state);dirty=true;status('尚未保存');clearTimeout(saveTimer);if(!dead)saveTimer=setTimeout(save,550);};
    const save=async()=>{
      clearTimeout(saveTimer);if(saving)return saving;if(conflict||!dirty)return;
      dirty=false;status('正在保存…');const payload=serializeManagedState(state),savingAccount=account.id;
      saving=api('assessment/state',{method:'POST',body:{accountId:savingAccount,revision,state:payload}}).then(result=>{saveFailed=false;revision=result.revision;account=result.account;state.updatedAt=result.updatedAt;if(!dead){renderAccounts();status(dirty?'尚未保存':'已保存到本地');}}).catch(error=>{dirty=true;saveFailed=true;conflict=/另一个页面|已锁定|账号管理/.test(error.message);status(conflict?'保存冲突，请先导出备份':'保存失败');toast(error.message);}).finally(()=>{saving=null;if(dirty&&!conflict&&!dead)saveTimer=setTimeout(save,1800);});
      return saving;
    };
    host.innerHTML=`<section class="assessment-root ae-compact-layout"><div class="ae-top"><div class="ae-title"><div class="ae-titlebar"><h1>养成与评估</h1></div></div><div data-account-bar></div></div><div data-account-form hidden></div><div class="ae-tabs" role="tablist" aria-label="养成与评估功能"><button role="tab" data-tab="evaluation" aria-selected="true">养成评价</button><button role="tab" data-tab="engine" aria-selected="false">配装与伤害</button><button role="tab" data-tab="artifacts" aria-selected="false">圣遗物</button><button role="tab" data-tab="weapons" aria-selected="false">武器</button><button role="tab" data-tab="import" aria-selected="false">导入与备份</button></div><div data-pane="evaluation"></div><div data-pane="engine" hidden></div><div data-pane="import" hidden></div><p data-ae-hint="计算引擎与条件说明" class="ae-credit">计算引擎：Genshin Optimizer 源码 ${escape(upstream.version)} · <a href="/assessment/vendor/LICENSE.genshin-optimizer.txt" target="_blank">MIT 许可</a> · 计算资料日期 ${upstream.deployedAt.slice(0,10)}<br>支持范围以当前引擎为准；伤害依赖你设置的队伍、敌人、反应和增益条件。</p></section>`;
    const root=host.querySelector('.assessment-root'),pane=name=>root.querySelector(`[data-pane="${['artifacts','weapons'].includes(name)?'engine':name}"]`);
    const hintKey='wiki.assessment.hide-hints.v1',hintControl=document.createElement('label');
    hintControl.className='ae-hide-hints';hintControl.innerHTML='<input type="checkbox" data-hide-assessment-hints>隐藏提示';root.querySelector('.ae-titlebar').append(hintControl);
    let hintsHidden=false;try{hintsHidden=globalThis.localStorage?.getItem(hintKey)==='true';}catch{}
    root.dataset.hideHints=String(hintsHidden);hintControl.querySelector('input').checked=hintsHidden;
    let undoRecord=null,undoTimer;
    const recordUndo=(before,label)=>{const after=serializeManagedState(state);undoRecord=deletionUndo(before,after,account.id);clearTimeout(undoTimer);let node=root.querySelector('[data-undo-deletion]');if(!node){node=document.createElement('div');node.dataset.undoDeletion='';node.className='ae-undo-toast';root.append(node);}node.innerHTML='';const text=document.createElement('span');text.textContent=label+' · 30 秒内可撤销';const button=document.createElement('button');button.textContent='撤销';button.className='subtle-action';button.addEventListener('click',async()=>{try{await flushAccount();const next=restoreDeletion(serializeManagedState(state),undoRecord,{accountId:account.id,locked:account.locked});validateState(next,data);state=createManagedState(next,account);selected=state.selected||selected;persist();workbench.reset();if(['engine','artifacts','weapons'].includes(tab))workbench.render();else renderEvaluation();node.remove();undoRecord=null;clearTimeout(undoTimer);toast('已撤销移除');}catch(error){toast(error.message);}});node.append(text,button);undoTimer=setTimeout(()=>{node.remove();undoRecord=null;},30000);};
    const workbench=createWorkbench({pane:pane('engine'),readState:()=>state,readSelected:()=>selected,catalog,data,selectionHTML,buildHTML,readGoal:(key=selected)=>goal(key),readAccount:()=>account,replaceState:next=>{state=createManagedState(next,account);},changed:persist,recordUndo,toast,isReadOnly:()=>account.locked,onRendered:()=>{applyAccountLock();syncWorkbenchCategory();},onEvaluationChange:()=>renderEvaluation(),selectCharacter:key=>{selected=key;viewSelections.set(account.id,key);state.selected=key;}});
    function applyViewSettings(){
      tab=['evaluation','engine','artifacts','weapons','import'].includes(view.tab)?view.tab:'evaluation';evaluationTab=['overview','artifacts','progress','guide','growth'].includes(view.evaluationTab)?view.evaluationTab:'overview';
      if(state.good.characters.some(character=>character.key===view.selected))selected=view.selected;
      filter=view.filter??'';rosterOrigin=view.rosterOrigin??'';rosterElement=view.rosterElement??'';
    }
    function rememberView(){
      if(!viewReady)return;
      const roster=pane('evaluation').querySelector('.ae-character-list'),rosterScroll=tab==='evaluation'&&!pane('evaluation').hidden&&roster?roster.scrollTop:view.rosterScroll??0;
      view={tab,evaluationTab,selected,filter,rosterOrigin,rosterElement,rosterScroll,folds:[...pane('evaluation').querySelectorAll('details')].map(detail=>[detail.querySelector('summary')?.textContent,detail.open]),workbench:workbench.getViewState()};
      viewMemory.set(account.id,view);
    }
    function restoreView(position){
      const roster=pane('evaluation').querySelector('.ae-character-list');if(tab==='evaluation'&&!pane('evaluation').hidden&&roster)roster.scrollTop=view.rosterScroll??0;
      const folds=new Map(view.folds??[]);for(const detail of pane('evaluation').querySelectorAll('details')){const key=detail.querySelector('summary')?.textContent;if(folds.has(key))detail.open=folds.get(key);}
      restoreScrollPosition(position);
    }
    workbench.restoreViewState(view.workbench);

    const permissionContext=()=>({state,selected,...workbench.permissionContext()});
    const viewButton=node=>!blocksLockedButton(node,permissionContext());
    const viewInput=node=>!blocksLockedInput(node,permissionContext());
    function applyAccountLock(){
      const locked=account.locked;root.dataset.accountLocked=String(account.locked);
      for(const node of root.querySelectorAll('button,input,select,textarea')){
        if(node.dataset.accountDisabled){node.disabled=false;delete node.dataset.accountDisabled;}
        if((accountBusy||locked&&!(node.tagName==='BUTTON'?viewButton(node):viewInput(node)))&&!node.disabled){node.disabled=true;node.dataset.accountDisabled='1';}
      }
      for(const node of root.querySelectorAll('[data-account-action],[data-account-switch]'))if(accountBusy&&!node.disabled){node.disabled=true;node.dataset.accountDisabled='1';}
      syncLockedValues(root,{locked,blocksInput:node=>blocksLockedInput(node,permissionContext())});
    }
    function renderAccounts(){
      const menuOpen=root.querySelector('[data-account-menu]')?.open??false;
      const unknownCharacters=state.good.characters.filter(c=>!data.char.data[c.key]&&!c.key.startsWith('Traveler')).length,unknownWeapons=new Set(state.good.weapons.filter(w=>!data.weapon.data[w.key]).map(w=>w.key)).size;
      root.querySelector('[data-account-bar]').innerHTML=`<div class="panel ae-account-bar"><div class="ae-account-controls"><label class="ae-field"><select data-account-switch aria-label="切换养成账号">${accountList.map(a=>option(a.id,a.name+(a.locked?' · 已锁定':''),account.id)).join('')}</select></label><button class="subtle-action ae-account-lock" data-account-action="${account.locked?'unlock':'lock'}" aria-pressed="${account.locked}">${account.locked?'解锁账号':'锁定账号'}</button><details class="ui-action-menu" data-ui-menu data-account-menu data-disclosure-ignore ${menuOpen?'open':''}><summary>账号管理</summary><div class="ui-action-menu-items"><button class="subtle-action" data-account-action="new">新建账号</button><button class="subtle-action" data-account-action="copy" title="复制当前内容为可编辑账号，保留原账号和导入快照" ${accountList.length>=50?'disabled':''}>复制账号</button><button class="subtle-action" data-account-action="rename">重命名</button><button class="subtle-action ae-remove" data-account-action="remove" ${account.locked||accountList.length<2?'disabled':''}>移除账号</button><button class="subtle-action" data-ae="export-backup">导出备份</button></div></details></div><span class="ae-status" data-save-status></span>${unknownCharacters||unknownWeapons?`<span class="ae-account-warning" title="当前计算资料尚未覆盖 ${unknownCharacters} 名角色、${unknownWeapons} 种武器；导入数据完整保留，相关面板与伤害暂不计算。">计算支持范围有限 ⓘ</span>`:''}</div>`;
      applyAccountLock();
    }
    async function flushAccount(){
      if(draftNode?.isConnected){clearTimeout(inputTimer);const input=draftNode;draftNode=null;await onChange({target:input});}
      do{await save();}while(saving||dirty&&!conflict&&!saveFailed);
      if(dirty||conflict)throw Error('当前账号尚未保存成功，请先处理保存提示。');
    }
    async function adoptAccount(result){
      const position=readScrollPosition();rememberView();viewReady=false;
      inventoryPopup?.close();inventoryPopup=null;settingsPopup?.close();settingsPopup=null;
      artifactPopup?.close();artifactPopup=null;
      const sameAccount=result.account.id===account.id;clearTimeout(saveTimer);clearTimeout(inputTimer);draftNode=null;account=result.account;state=createManagedState(result.state,account);revision=result.revision;dirty=false;conflict=false;saveFailed=false;if(!sameAccount)pending=null;view=viewMemory.get(account.id)??{};applyViewSettings();
      selected=viewSelections.get(account.id)||state.good.characters.find(character=>character.key===view.selected)?.key||state.selected||state.good.characters[0]?.key||'';
      accountList=(await api('assessment/accounts')).accounts;workbench.reset();workbench.restoreViewState(view.workbench);root.querySelector('[data-account-form]').hidden=true;
      renderAccounts();setTab(tab);viewReady=true;restoreView(position);status('');
    }
    async function changeAccount(action,extra={}){
      if(accountBusy)return;accountBusy=true;applyAccountLock();
      try{
        await flushAccount();let result;
        if(action==='convert-custom'){
          if(account.locked)throw Error('账号已锁定，请先解锁再转换。');
          const converted=convertCustomToDefault(serializeManagedState(state),data);
          if(!converted.changed)return {converted:converted.counts,unchanged:true};
          result=await api('assessment/state',{method:'POST',body:{accountId:account.id,revision,state:converted.state}});result.converted=converted.counts;
        }else result=action==='import-bundle'?await api('assessment/accounts/import',{method:'POST',body:extra}):await api('assessment/accounts',{method:'POST',body:{action,accountId:account.id,revision,...extra}});
        await adoptAccount(result);if(action==='copy')toast('已复制账号，可独立修改。');return result;
      }
      finally{accountBusy=false;applyAccountLock();}
    }
    function accountForm(mode){
      const node=root.querySelector('[data-account-form]');node.hidden=false;
      node.innerHTML=mode==='remove'?`<div class="panel ae-account-form"><p>移除“${escape(account.name)}”及其养成配置？扫描源文件继续保留。</p><button class="subtle-action ae-remove" data-account-action="remove-confirm">确认移除账号</button><button class="subtle-action" data-account-action="cancel">取消</button></div>`:`<div class="panel ae-account-form"><label class="ae-field"><span>${mode==='new'?'新账号名称':'账号名称'}</span><input data-account-name maxlength="100" value="${escape(mode==='new'?'新账号':account.name)}" aria-label="账号名称"></label><button class="subtle-action" data-account-action="${mode==='new'?'create-confirm':'rename-confirm'}">保存</button><button class="subtle-action" data-account-action="cancel">取消</button></div>`;
      focusNameInput(node.querySelector('[data-account-name]'));
    }

    const roster=()=>state.good.characters??[];
    const rosterOrderKey='wiki.assessment-roster.v1';
    const rosterOrder=()=>{try{return JSON.parse(state.engineStorage[rosterOrderKey]??'{}');}catch{return{};}};
    function changeRosterOrder(prefs){state.engineStorage[rosterOrderKey]=JSON.stringify(prefs);persist();if(['engine','artifacts','weapons'].includes(tab))workbench.render();else renderEvaluation();}
    const sortedCharacters=()=>Object.entries(catalog.characters).filter(([,m])=>m.wikiId).sort((a,b)=>a[1].name.localeCompare(b[1].name,'zh-CN'));
    function selectionHTML(context='evaluation'){
      const title=context==='artifacts'?'评价角色':context==='weapons'?'参考角色':'我的角色',hint=context==='artifacts'?'切换角色，更新圣遗物的有效词条评价。':context==='weapons'?'用于当前装备筛选和添加武器的默认类型。':'';
      const sortPrefs=rosterOrder(),visible=sortAssessmentRoster(filterAssessmentRoster(roster(),catalog,{origin:rosterOrigin,element:rosterElement,selected}),state.good,goal,data,sortPrefs).filter(c=>meta(c.key).name.toLowerCase().includes(filter.toLowerCase()));return`<aside class="panel ae-roster"><div class="ae-roster-head"><div class="ae-roster-title"><h2>${title} <small>${visible.length}</small></h2><button class="subtle-action" data-ae="add">添加角色</button></div>${hint?`<p data-ae-hint="角色列表用途" class="ae-muted">${hint}</p>`:''}<input type="search" data-character-search placeholder="搜索已添加角色" value="${escape(filter)}" aria-label="搜索已添加角色"><div class="ae-roster-filters"><select data-roster-origin aria-label="角色来源">${[['','全部角色'],['original','原有角色'],['custom','自定义角色']].map(([k,n])=>option(k,n,rosterOrigin)).join('')}</select><select data-roster-element aria-label="角色元素">${option('','全部元素',rosterElement)}${Object.entries(ELEMENTS).map(([k,n])=>option(k,n+'元素',rosterElement)).join('')}</select></div><div class="ae-roster-sort"><select data-roster-sort aria-label="角色排序">${Object.entries(ROSTER_SORTS).map(([k,n])=>option(k,n,sortPrefs.sort??'original')).join('')}</select>${['totalRolls','effectiveRolls','totalCV'].includes(sortPrefs.sort)?`<button class="subtle-action" data-ae="roster-direction" title="切换升降序">${sortPrefs.ascending?'低 → 高':'高 → 低'}</button>`:''}</div>${sortPrefs.sort==='custom'?'<small data-ae-hint="角色顺序键盘操作说明" class="ae-muted">使用上下箭头调整顺序，按账号保存。</small>':''}</div><div class="ae-character-list">${visible.map((c,i)=>`<div class="ae-character-row"><button data-select="${escape(c.key)}" class="ae-character ${selected===c.key?'active':''}">${meta(c.key).image?`<img class="ae-rarity-${meta(c.key).rarity??5}" src="${escape(meta(c.key).image)}" alt="" loading="lazy" title="${meta(c.key).rarity??5}星">`:''}<span><strong>${escape(meta(c.key).name)}</strong></span></button>${sortPrefs.sort==='custom'?`<span class="ae-roster-move">${[[-1,'↑','上移'],[1,'↓','下移']].map(([offset,mark,title])=>`<button class="subtle-action" data-ae="roster-move" data-key="${escape(c.key)}" data-neighbor="${escape(visible[i+offset]?.key??'')}" aria-label="${title}${escape(meta(c.key).name)}" ${visible[i+offset]?'':'disabled'}>${mark}</button>`).join('')}</span>`:''}<button class="subtle-action ae-remove ae-character-remove" data-ae="remove-character" data-key="${escape(c.key)}" aria-label="移除${escape(meta(c.key).name)}角色方案" title="移除该角色的方案、目标及保存配装；装备退回库存">移除</button></div>`).join('')||'<p class="ae-muted">还没有匹配的角色。</p>'}</div></aside>`;
    }
    function buildHTML(c){
      const g=goal(c.key),{weapon,artifacts}=equipment(state.good,c.key),metadata=meta(c.key),weapons=Object.entries(catalog.weapons).filter(([,v])=>v.weaponType===metadata.weaponType).sort((a,b)=>a[1].name.localeCompare(b[1].name,'zh-CN'));
      return`<details class="panel ae-section" data-evaluation-editor="character" open><summary>角色与武器</summary><div class="ae-fields">${c.key.startsWith('Traveler')?`<label class="ae-field"><span>旅行者元素</span><select data-traveler-element>${Object.entries(ELEMENTS).map(([k,v])=>option(k,v,metadata.element)).join('')}</select></label>`:''}${number('角色等级',c.level,'data-char="level"',1,100)}${number('突破阶段',c.ascension,'data-char="ascension"',0,6)}${number('命之座',c.constellation,'data-char="constellation"',0,6)}${number('普攻基础等级',c.talent.auto,'data-talent="auto"',1,10)}${number('战技基础等级',c.talent.skill,'data-talent="skill"',1,10)}${number('爆发基础等级',c.talent.burst,'data-talent="burst"',1,10)}</div>${c.key.startsWith('Traveler')?'<p data-ae-hint="旅行者七元素切换说明" class="ae-muted">主角支持七元素切换；首次切换会创建自定义方案，天赋与命座请手动填写。各元素配置分别保存，等级与突破共用。</p>':''}<p data-ae-hint="天赋填写说明" class="ae-muted">天赋填基础等级，命座加成由计算引擎处理。命座和精炼是实际配装条件，不作为付费培养目标。</p><div class="ae-inline-actions"><button class="subtle-action" data-ae="inventory-equip" data-kind="weapons">从库存替换武器</button><button class="subtle-action" data-ae="restore-account-equipment">恢复原有装备</button>${weapon&&isCustom(weapon)&&customMarkers(state)?'<span class="ae-custom-badge">自定义武器</span>':''}</div><div class="ae-fields">${catalogChoiceHTML({label:"已装备武器",kind:"weapons",value:weapon?.key,catalog,buttonAttributes:'data-ae="choose-build-weapon"',inputAttributes:'data-weapon="key"'})}${weapon?number('武器等级',weapon.level,'data-weapon="level"',1,catalog.weapons[weapon.key]?.rarity<3?70:90)+number('武器突破',weapon.ascension,'data-weapon="ascension"',0,6)+number('精炼等级',weapon.refinement,'data-weapon="refinement"',1,5):''}</div>${weapon?`<p>${detailLink(catalog.weapons[weapon.key]?.wikiId,'查看武器资料')}</p>`:''}</details><details class="panel ae-section" data-evaluation-editor="artifacts"><summary>圣遗物</summary><div class="ae-inline-actions"><button class="subtle-action" data-ae="artifact-overview">查看五件圣遗物分析</button><button class="subtle-action" data-ae="restore-account-artifacts">恢复原有圣遗物</button></div><p data-ae-hint="圣遗物百分比填写" class="ae-muted">百分比按游戏面板填写，例如暴击率 3.9；填入实际强化后的数值。</p><div class="ae-artifact-editors">${SLOTS.map(slot=>{const a=artifacts.find(a=>a.slotKey===slot);return`<fieldset class="ae-artifact-editor ae-rarity-${a?.rarity??0}" data-slot="${slot}" title="${a?a.rarity+'星圣遗物':'未装备'}"><legend>${artifactIconHTML(a,catalog)}${SLOT_NAMES[slot]}</legend><div class="ae-inline-actions"><button class="subtle-action" data-ae="inventory-equip" data-kind="artifacts" data-slot="${slot}">从库存替换</button>${a&&isCustom(a)&&customMarkers(state)?'<span class="ae-custom-badge">自定义</span>':''}</div>${catalogChoiceHTML({label:"套装",kind:"sets",value:a?.setKey,catalog,buttonAttributes:`data-ae="choose-build-set" data-slot="${slot}"`,inputAttributes:'data-art="setKey"'})}${a?`<div class="ae-fields"><input type="hidden" data-art="rarity" value="${a.rarity}">${number('强化等级',a.level,'data-art="level"',0,a.rarity<3?4:a.rarity*4)}<label class="ae-field"><span>主词条</span><select data-art="mainStatKey">${MAIN_STATS[slot].map(k=>option(k,STAT_NAMES[k],a.mainStatKey)).join('')}</select></label></div><div class="ae-substats">${Array.from({length:4},(_,i)=>{const s=a.substats[i]??{key:'',value:0};return`<div><select data-sub-key="${i}" aria-label="${SLOT_NAMES[slot]}副词条${i+1}">${option('','未填写',s.key)}${SUBSTATS.filter(k=>k!==a.mainStatKey).map(k=>option(k,STAT_NAMES[k],s.key)).join('')}</select><input type="number" data-sub-value="${i}" min="0" max="5000" step="0.1" value="${s.value}" aria-label="${SLOT_NAMES[slot]}副词条${i+1}数值"></div>`;}).join('')}</div><p class="ae-muted" data-artifact-count-summary>${artifactCountSummary(a,data,g.weights)}</p><button class="subtle-action" data-ae="artifact-details" data-index="${state.good.artifacts.indexOf(a)}">详细词条分析</button>`:''}</fieldset>`;}).join('')}</div></details>`;
    }
    function targetHTML(c){const g=goal(c.key);return`<details class="panel ae-section" data-evaluation-editor="targets"><summary class="ae-reset-summary"><span class="ae-summary-row"><span>评价目标与词条权重</span>${goalReset('all','恢复全部默认')}</span></summary><div class="ae-inline-actions"><button class="subtle-action" data-ae="edit-goal-default">管理评价方案</button><button class="subtle-action" data-ae="edit-weight-default">编辑权重方案</button></div>${goalHelpHTML(c.key,settings)}<div class="ae-group-heading"><h3>培养目标</h3>${goalReset('targets')}</div><div class="ae-fields"><label class="ae-field"><span>用途模板</span><select data-goal="role">${Object.entries(ROLES).map(([k,v])=>option(k,v.name,g.role)).join('')}</select></label>${number('目标角色等级',g.level,'data-goal="level"',1,100)}${number('目标突破',g.ascension,'data-goal="ascension"',0,6)}${number('目标武器等级',g.weaponLevel,'data-goal="weaponLevel"',1,90)}${['auto','skill','burst'].map((k,i)=>number(['目标普攻','目标战技','目标爆发'][i],g.talent[k],`data-goal-talent="${k}"`,1,10)).join('')}${number('目标有效词条',g.effectiveRolls,'data-goal="effectiveRolls"',0,100,.1)}</div><div class="ae-group-heading"><h3>有效副词条权重</h3>${goalReset('weights')}</div><div class="ae-fields">${SUBSTATS.map(k=>number(STAT_NAMES[k],g.weights[k]??0,`data-weight="${k}"`,0,2,.05)).join('')}</div><p data-ae-hint="词条等效与权重说明" class="ae-muted">总等效按同星级平均档换算；有效词条统一按五星平均档换算后乘权重，便于比较不同星级。0 表示不计入；1 表示等权。小数等效数不等于实际强化次数。</p><div class="ae-main-goals">${['sands','goblet','circlet'].map(slot=>`<fieldset><legend>${SLOT_NAMES[slot]}可接受主词条</legend><div class="ae-group-actions">${goalReset(slot)}</div>${MAIN_STATS[slot].map(k=>`<label><input type="checkbox" data-goal-main="${slot}" value="${k}" ${(g.mainStats[slot]??[]).includes(k)?'checked':''}>${STAT_NAMES[k]}</label>`).join('')}</fieldset>`).join('')}</div><div class="ae-group-heading"><h3>目标套装</h3>${goalReset('sets')}</div><div class="ae-fields">${[0,1].map(i=>`<label class="ae-field ae-wide"><span>${i?'可选第二组二件套':'四件套 / 第一组二件套'}</span><select data-goal-set="${i}">${option('','不限制',g.sets[i]??'')}${Object.entries(catalog.sets).map(([k,v])=>option(k,v.name,g.sets[i])).join('')}</select></label>`).join('')}</div><div class="ae-group-heading"><h3>非战斗面板参考目标（0 为不设目标）</h3>${goalReset('panel')}</div><p data-ae-hint="面板评价目标说明" class="ae-muted">面板目标与当前角色的非战斗面板比较；0 表示不设目标。</p><div class="ae-fields">${['hp','atk','def','enerRech_','eleMas','critRate_','critDMG_'].map(k=>number(STAT_NAMES[k],g.panel[k]??0,`data-goal-panel="${k}"`,0,1e7,percent(k)?.1:1)).join('')}</div><div class="ae-group-heading"><h3>角色用途、队伍及充能目标依据</h3>${goalReset('notes')}</div><label class="ae-field"><span class="ae-sr-only">角色用途、队伍及充能目标依据</span><textarea data-goal-notes rows="3" maxlength="3000" placeholder="例如：队伍中搭配双水，西风触发要求；目标数值的适用条件">${escape(g.notes)}</textarea></label></details>`;}
    function evaluationHTML(c){
      const g=goal(c.key),result=evaluate(c,state.good,g,data),e=equipment(state.good,c.key);
      let battle=null,battleError='';try{battle={panel:idlePanel(state.good,c.key)};}catch(error){battleError=error.message;}
      const missing=[...(!e.weapon?['武器']:[]),...SLOTS.filter(slot=>!e.artifacts.some(a=>a.slotKey===slot)).map(s=>SLOT_NAMES[s])];
      const wrong=result.pieces.filter(p=>!p.missing&&!p.matches),panelTargets=Object.entries(g.panel).filter(([,target])=>target>0).map(([k,target])=>({key:k,target,value:battle?.panel[k]}));
      const old=state.comparisons[c.key];let oldBattle=null;
      if(old){try{const loc=equipmentLocation(c.key),good={...state.good,characters:state.good.characters.map(x=>x.key===c.key?old.character:x),weapons:[...state.good.weapons.filter(w=>w.location!==loc),...(old.weapon?[old.weapon]:[])],artifacts:[...state.good.artifacts.filter(a=>a.location!==loc),...old.artifacts]};oldBattle={panel:idlePanel(good,c.key)};}catch{}}
      return`<div class="panel ae-result" data-evaluation-output="overview"><div class="ae-result-heading"><div><h2>${escape(meta(c.key).name)}</h2><p>${detailLink(meta(c.key).wikiId,'角色资料')} · ${escape(ROLES[g.role].name)}</p></div></div><div class="ae-meters"><div><span>装备填写情况</span><strong>${Number(Boolean(e.weapon))+e.artifacts.length} <small>/ 6</small></strong></div><div><span>副词条总等效数</span><strong>${result.totalRolls.toFixed(1)}</strong></div><div><span>加权有效词条</span><strong>${result.effectiveRolls.toFixed(1)}${g.effectiveRolls?`<small> / ${g.effectiveRolls}</small>`:''}</strong></div><div title="圣遗物总双暴：暴击率 × 2 ＋ 暴击伤害，包含理之冠主词条和全部副词条；不含武器及角色自带双暴"><span>圣遗物总双暴值</span><strong>${result.totalCV.toFixed(1)}</strong></div></div>${missing.length?`<p class="ae-warning">尚未填写：${missing.join('、')}。面板和伤害仅按已填资料试算，补齐后再判断整体养成。</p>`:''}${result.unknown?'<p class="ae-warning">部分副词条档位或计算支持范围需要核对，请查看下方具体项目。</p>':''}</div>${buildHTML(c)}${characterGuideHTML(c.key,catalog,state.good,{settings})}<details class="panel ae-section" data-evaluation-output="progress" open><summary>培养建议</summary>${g.notes?`<p class="ae-profile-note">${escape(g.notes)}</p>`:''}<div class="ae-progress-items">${result.metrics.filter(m=>m.target>0).map(m=>`<span>${escape(m.label)}<b>${m.value===undefined?'未填写':Number.isInteger(m.value)?m.value:m.value.toFixed(1)} / ${m.target}</b></span>`).join('')}</div>${wrong.length?`<p class="ae-warning">主词条需调整：${wrong.map(p=>SLOT_NAMES[p.slot]+'当前为'+STAT_NAMES[p.artifact.mainStatKey]).join('；')}。</p>`:''}${result.advice.length?`<ol class="ae-advice">${result.advice.filter(a=>!missing.includes(a.label)).slice(0,8).map(a=>`<li>${escape(a.detail)}</li>`).join('')}</ol>`:'<p>已满足当前填写的培养目标。</p>'}${panelTargets.length?`<h3>非战斗面板目标</h3><div class="ae-progress-items">${panelTargets.map(m=>`<span>${STAT_NAMES[m.key]}<b>${m.value===undefined?'暂无法计算':statDisplay(m.value,m.key)} / ${statDisplay(m.target,m.key)}</b></span>`).join('')}</div>`:''}</details><details class="panel ae-section" data-evaluation-output="panel" open><summary>非战斗面板</summary><p data-ae-hint="非战斗面板说明" class="ae-muted">按当前实际配装计算常驻属性，包含常驻天赋、武器和套装加成；不使用配队、战斗触发条件及手动增益。</p>${battle?panelHTML(battle.panel,result.panel):`<p class="ae-warning">${escape(battleError)}</p>`}${oldBattle&&battle?`<p class="ae-muted">较对比基准：${['hp','atk','def','eleMas','enerRech_','critRate_','critDMG_'].map(k=>STAT_NAMES[k]+' '+((battle.panel[k]-oldBattle.panel[k])>=0?'+':'')+statDisplay(battle.panel[k]-oldBattle.panel[k],k)).join('；')}</p>`:''}<div class="ae-inline-actions">${old?'<button class="subtle-action ae-remove" data-ae="remove-baseline">移除对比基准</button>':''}</div></details><div data-evaluation-output="growth">${workbench.upgradeHTML()}</div>`;
    }
    const evaluationTabs=[['overview','概览'],['artifacts','圣遗物'],['progress','培养建议'],['guide','培养攻略'],['growth','提升收益']];
    function applyEvaluationTab(){
      for(const panel of pane('evaluation').querySelectorAll('[data-evaluation-panel]'))panel.hidden=panel.dataset.evaluationPanel!==evaluationTab;
      for(const button of pane('evaluation').querySelectorAll('[data-evaluation-tab]')){const active=button.dataset.evaluationTab===evaluationTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
      const scroller=pane('evaluation').querySelector('[data-evaluation-scroll]');if(scroller)scroller.dataset.evaluationActive=evaluationTab;
    }
    function setEvaluationSettings(open){
      evaluationSettingsOpen=open;
      const drawer=pane('evaluation').querySelector('[data-evaluation-settings]'),backdrop=pane('evaluation').querySelector('[data-evaluation-settings-backdrop]');
      if(!drawer)return;drawer.hidden=!open;if(backdrop)backdrop.hidden=!open;
      pane('evaluation').querySelector('[data-ae="evaluation-settings"]')?.setAttribute('aria-expanded',String(open));
      if(open){evaluationSettingsFocus=document.activeElement;drawer.querySelector('button')?.focus({preventScroll:true});}
      else{const focus=evaluationSettingsFocus?.isConnected?evaluationSettingsFocus:pane('evaluation').querySelector('[data-ae="evaluation-settings"]');focus?.focus({preventScroll:true});evaluationSettingsFocus=null;}
    }
    function showEvaluationCards(container){
      for(const detail of [...container.querySelectorAll('details')].reverse()){
        if(detail.matches('[data-ae-disclosure="goal-help"],[data-ae-disclosure="goal-recommendation"]'))continue;
        const section=document.createElement('section'),summary=[...detail.children].find(n=>n.tagName==='SUMMARY');
        for(const attribute of detail.attributes)if(attribute.name!=='open')section.setAttribute(attribute.name,attribute.value);
        if(summary){
          section.setAttribute('aria-label',summary.textContent.trim());
          const redundant=detail.matches('[data-evaluation-editor="artifacts"],[data-evaluation-editor="targets"],[data-evaluation-output="progress"],.ae-character-guide,[data-native-disclosure="growth-reference"]');
          if(redundant){const actions=[...summary.querySelectorAll('button')];if(actions.length){const bar=document.createElement('div');bar.className='ae-inline-actions';bar.append(...actions);summary.replaceWith(bar);}else summary.remove();}
          else{const heading=document.createElement('h3');heading.className='ae-static-heading';heading.innerHTML=summary.innerHTML;summary.replaceWith(heading);}
        }
        section.append(...detail.childNodes);detail.replaceWith(section);
      }
    }
    function evaluationLayoutHTML(c){
      // Move the original sections into panels without duplicating editors or changing their data bindings.
      const source=document.createElement('div');source.innerHTML=evaluationHTML(c);
      const take=selector=>source.querySelector(selector)?.outerHTML??'';
      const overview=source.querySelector('[data-evaluation-output="overview"]');overview.querySelector('.ae-result-heading')?.remove();
      const meters=document.createElement('div');meters.className='ae-result';meters.dataset.evaluationOutput='overview';meters.append(overview.querySelector('.ae-meters'));overview.dataset.evaluationOutput='warnings';
      showEvaluationCards(source);
      const targets=document.createElement('div');targets.innerHTML=targetHTML(c);showEvaluationCards(targets);
      const panels={overview:overview.outerHTML+'<div class="ae-overview-columns">'+take('[data-evaluation-editor="character"]')+take('[data-evaluation-output="panel"]')+'</div>',artifacts:take('[data-evaluation-editor="artifacts"]'),progress:take('[data-evaluation-output="progress"]'),guide:take('.ae-character-guide'),growth:take('[data-evaluation-output="growth"]')};
      const m=meta(c.key);
      return `<div class="panel ae-evaluation-context"><div class="ae-evaluation-hero"><div class="ae-evaluation-identity" data-evaluation-output="identity">${m.image?`<img class="ae-hero-avatar ae-rarity-${m.rarity??5}" src="${escape(m.image)}" alt="">`:''}<div><h2>${escape(m.name)}</h2><p>Lv.${c.level} · ${c.constellation} 命</p></div></div>${meters.outerHTML}<button class="subtle-action" data-ae="evaluation-settings" aria-haspopup="dialog" aria-expanded="${evaluationSettingsOpen}">评价目标与词条权重</button></div></div><nav class="ae-section-tabs" role="tablist" aria-label="养成评价内容">${evaluationTabs.map(([id,name])=>`<button role="tab" data-evaluation-tab="${id}" aria-controls="ae-evaluation-${id}" aria-selected="${id===evaluationTab}">${name}</button>`).join('')}</nav><div class="ae-content-scroll" data-evaluation-scroll data-evaluation-owner="${escape(account.id+':'+selected)}" data-evaluation-active="${evaluationTab}">${evaluationTabs.map(([id])=>`<section id="ae-evaluation-${id}" role="tabpanel" data-evaluation-panel="${id}" ${id===evaluationTab?'':'hidden'}>${panels[id]}</section>`).join('')}</div><button class="ae-settings-backdrop" data-evaluation-settings-backdrop data-ae="close-evaluation-settings" aria-label="关闭评价设置" ${evaluationSettingsOpen?'':'hidden'}></button><aside class="ae-settings-drawer" data-evaluation-settings role="dialog" aria-modal="true" aria-labelledby="ae-evaluation-settings-title" ${evaluationSettingsOpen?'':'hidden'}><div class="ae-settings-heading"><h2 id="ae-evaluation-settings-title">评价目标与词条权重</h2><button class="subtle-action" data-ae="close-evaluation-settings">关闭</button></div>${targets.innerHTML}</aside>`;
    }
    function refreshEvaluationResults(editedInput){
      const page=pane('evaluation'),c=current(),main=page.querySelector('.ae-main');if(!c||!main)return false;
      const next=document.createElement('div');next.innerHTML=evaluationLayoutHTML(c);
      const editorPairs=[...next.querySelectorAll('[data-evaluation-editor]')].map(fresh=>[main.querySelector(`[data-evaluation-editor="${fresh.dataset.evaluationEditor}"]`),fresh]);
      if(editorPairs.some(([old])=>!old))return false;
      const controls=[];
      for(const [old,fresh] of editorPairs)for(const node of fresh.querySelectorAll('input,select,textarea')){
        const attrs=[...node.attributes].filter(a=>a.name.startsWith('data-')),slot=node.closest('[data-slot]')?.dataset.slot,scope=slot?old.querySelector(`[data-slot="${slot}"]`):old;
        const selector=attrs.map(a=>`[${a.name}="${CSS.escape(a.value)}"]`).join('')+(node.type==='checkbox'?`[value="${CSS.escape(node.value)}"]`:'');
        const existing=attrs.length?scope?.querySelector(selector):null;if(!existing)return false;controls.push([existing,node]);
      }
      const outputs=[...next.querySelectorAll('[data-evaluation-output]')].map(fresh=>[main.querySelector(`[data-evaluation-output="${fresh.dataset.evaluationOutput}"]`),fresh]);if(outputs.some(([old])=>!old))return false;
      const folds=new Map([...main.querySelectorAll('details')].map(d=>[d.querySelector('summary')?.textContent,d.open]));
      for(const [old,fresh] of controls){
        if(old===editedInput||old===document.activeElement)continue;
        for(const name of ['min','max','step'])if(fresh.hasAttribute(name))old.setAttribute(name,fresh.getAttribute(name));
        if(old.type==='checkbox')old.checked=fresh.checked;else if(old.value!==fresh.value)old.value=fresh.value;
      }
      for(const [old,fresh] of outputs)old.innerHTML=fresh.innerHTML;
      for(const summary of next.querySelectorAll('[data-artifact-count-summary]')){const slot=summary.closest('[data-slot]').dataset.slot;const old=main.querySelector(`[data-slot="${slot}"] [data-artifact-count-summary]`);if(old)old.innerHTML=summary.innerHTML;}
      const roster=page.querySelector('.ae-character-list'),rosterNext=document.createElement('div');rosterNext.innerHTML=selectionHTML();if(roster)roster.innerHTML=rosterNext.querySelector('.ae-character-list').innerHTML;
      for(const d of main.querySelectorAll('details')){const name=d.querySelector('summary')?.textContent;if(folds.has(name))d.open=folds.get(name);}
      applyAccountLock();return true;
    }
    function renderEvaluation(editedInput){
      if(['engine','artifacts','weapons'].includes(tab)){workbench.render();return;}
      // 数字框没有可靠的选区 API；输入时保留原节点，让浏览器保持光标和未提交文本。
      if(editedInput?.isConnected&&pane('evaluation').contains(editedInput)&&editedInput.matches('input[type=number],textarea[data-goal-notes]')&&refreshEvaluationResults(editedInput))return;
      const position=readScrollPosition(),rosterScroll=pane('evaluation').querySelector('.ae-character-list')?.scrollTop??view.rosterScroll??0;
      const prior=new Map([...pane('evaluation').querySelectorAll('details')].map(d=>[d.querySelector('summary')?.textContent,d.open]));
      const active=document.activeElement,attribute=active&&pane('evaluation').contains(active)?[...active.attributes].find(a=>a.name.startsWith('data-')):null;
      const focus=attribute?{name:attribute.name,value:attribute.value,slot:active.closest('[data-slot]')?.dataset.slot}:null;
      pane('evaluation').innerHTML=`<div class="ae-workspace ae-evaluation-workspace">${selectionHTML()}<div class="ae-main ae-evaluation-main">${current()?evaluationLayoutHTML(current()):`<div class="panel ae-empty"><h2>建立你的第一个角色方案</h2><p data-ae-hint="养成评价首次使用说明">从左侧添加角色，填写角色、武器和五件圣遗物；也可以先导入已有的 GOOD 文件。</p><button class="subtle-action" data-ae="go-import">导入外部配装</button></div>`}</div></div>`;
      for(const d of pane('evaluation').querySelectorAll('details')){const name=d.querySelector('summary')?.textContent;if(prior.has(name))d.open=prior.get(name);}
      applyAccountLock();applyEvaluationTab();
      if(focus){const scope=focus.slot?pane('evaluation').querySelector(`[data-slot="${focus.slot}"]`):pane('evaluation');scope?.querySelector(`[${focus.name}="${CSS.escape(focus.value)}"]`)?.focus({preventScroll:true});}
      const roster=pane('evaluation').querySelector('.ae-character-list');if(roster)roster.scrollTop=rosterScroll;restoreScrollPosition(position);
    }
    function renderImport(){pane('import').innerHTML=`<div class="panel ae-section"><h2>导入外部角色养成资料</h2><p data-ae-hint="GOOD支持范围说明">支持 Genshin Optimizer 及导出 GOOD 格式的工具。可导入角色等级、突破、基础天赋、命座、武器与圣遗物；计算引擎导出的队伍及条件配置也会保留。</p><div class="ae-import-zone"><label class="subtle-action">选择 JSON / JSON.GZ 文件<input data-import-file type="file" accept=".json,.gz,application/json" hidden></label><span>或拖放文件到这里</span></div><p data-ae-hint="GOOD导入流程说明" class="ae-muted">GOOD 先预览，可新建账号或更新当前账号。更新保留评价目标、队伍和配装方案；更新实际数据前须解锁，完成后自动锁定。扫描文件通常不含可靠的账号 UID，请先在账号管理中选好目标账号。备份文件仍导入为独立账号。</p><div data-import-preview></div></div><div class="panel ae-section"><h2>独立备份与互通</h2>${account.kind!=='imported'&&!(!account.kind&&account.hasOriginal)?`<label class="ae-lock"><input type="checkbox" data-custom-markers ${customMarkers(state)?'checked':''}>显示自定义标记</label>`:''}<div class="ae-inline-actions"><button class="subtle-action" data-ae="export-backup">导出完整备份 .json.gz</button><button class="subtle-action" data-ae="export-good">导出 GOOD 配装</button><button class="subtle-action" data-ae="export-all">导出全部账号 .json.gz</button>${account.hasOriginal?'<button class="subtle-action" data-ae="export-original">导出原始导入快照</button>':''}${account.hasScanRecovery?'<button class="subtle-action" data-ae="export-before-scan">导出上次更新前存档</button>':''}<button class="subtle-action" data-ae="save">立即保存</button></div><p data-ae-hint="备份格式说明">当前账号备份包含配装、评价目标、对比基准和计算工作台；全部账号备份同时保留账号名称、锁定状态及原始导入快照。导入备份建立新账号，恢复后默认锁定。GOOD 用于其他兼容工具，不包含 Wiki 自定义评价目标。</p><p data-ae-hint="本地保存与同步说明" class="ae-muted">资料只保存于本机，扫描文件按次导入，不自动同步游戏账号。百科“资料与备份”与本模块的备份分别管理。</p></div>${customConversionHTML(state,account.locked)}<details class="panel ae-section" open><summary>计算与评价的适用范围</summary><ul><li>配装与伤害：由本地 Genshin Optimizer 处理角色机制、天赋、命座、武器被动、圣遗物套装和元素反应，使用其已有的公式及条件选项。</li><li>先设置角色 / 队伍条件和敌人等级、抗性，再选择实际的攻击或反应目标；未开启的条件不会自动假定触发。</li><li>多目标组合适合比较固定动作及命中次数。完整队伍循环、元素附着时序、ICD 和能量过程需要专门的战斗模拟；这里不把固定组合伤害标成动态队伍 DPS。</li><li>评价目标按角色用途保存。精通、充能、生命或防御的价值随队伍改变，请调整权重与目标，而非只看双暴。</li><li>引擎固定为 ${escape(upstream.version)}（资料构建 ${upstream.deployedAt.slice(0,10)}）。Wiki 最新资料可能更晚，不支持的角色和装备会提示，不能据此宣称全部版本机制已覆盖。</li></ul></details>`;renderImportPreview();}
    function setTab(next){const position=readScrollPosition();rememberView();if(next!=='evaluation')setEvaluationSettings(false);tab=next;for(const node of root.querySelectorAll('[data-pane]'))node.hidden=node.dataset.pane==='engine'?!['engine','artifacts','weapons'].includes(tab):node.dataset.pane!==tab;for(const button of root.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button.dataset.tab===tab));if(tab==='evaluation')renderEvaluation();if(tab==='import')renderImport();if(['engine','artifacts','weapons'].includes(tab))openEngine();applyAccountLock();if(viewReady)restoreView(position);}
    function openEngine(){workbench.showCategory(tab);}
    function syncWorkbenchCategory(){if(!['engine','artifacts','weapons'].includes(tab))return;tab=workbench.getCategory();for(const button of root.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button.dataset.tab===tab));}
    const restoreEngine=()=>{workbench.reset();if(['engine','artifacts','weapons'].includes(tab))workbench.render();};
    function updateCharacter(next,editedInput){const index=state.good.characters.findIndex(c=>c.key===selected);state.good.characters[index]=next;if(selected.startsWith('Traveler'))for(const c of state.good.characters)if(c.key.startsWith('Traveler')&&c.key.at(-1)===selected.at(-1)){c.level=next.level;c.ascension=next.ascension;}persist();renderEvaluation(editedInput);}
    function updateEquipment(kind,item,slot,editedInput){
      const items=state.good[kind]??=[],old=equipment(state.good,selected)[kind==='weapons'?'weapon':'artifacts'];
      const previous=kind==='weapons'?old:old.find(a=>a.slotKey===slot),same=previous&&item&&(kind==='weapons'?previous.key===item.key:previous.setKey===item.setKey);
      if(previous&&(same||isCustom(previous)))previous.location='';
      if(item){if(same){const i=items.indexOf(previous);items[i]={...previous,...item,id:previous.id??crypto.randomUUID()};}else{item.id='custom-'+crypto.randomUUID();item.wikiCustom=true;items.push(item);}}
      state.good[kind]=items;persist();renderEvaluation(editedInput);
    }
    async function download(filename,value,gzip=false){
      const bytes=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),blob=gzip?await new Response(bytes.stream().pipeThrough(new CompressionStream('gzip'))).blob():bytes;
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function previewFile(file){
      pending=null;if(file.size>32*1024*1024)throw Error('文件超过 32 MB。');let stream=file.stream();const signature=new Uint8Array(await file.slice(0,2).arrayBuffer());if(signature[0]===31&&signature[1]===139)stream=stream.pipeThrough(new DecompressionStream('gzip'));
      const reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32*1024*1024)throw Error('解压后的文件超过 32 MB。');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
      let input;try{input=JSON.parse(await new Blob(parts).text());}catch{throw Error('JSON 格式不正确。');}
      pending=input?.format==='WIKI_ASSESSMENT_ACCOUNTS'?{bundle:true,input,counts:Object.fromEntries(['characters','weapons','artifacts'].map(k=>[k,(input.accounts??[]).reduce((n,a)=>n+(a.state?.good?.[k]?.length??0),0)])),warnings:[]}:importPreview(blankState(),input,data);
      Object.assign(pending,{input,sourceName:file.name,mode:'new',name:input.accountName||('扫描账号 '+new Date().toLocaleDateString('sv-SE')),confirmed:false});
      if(input?.format==='GOOD'&&input.characters?.some(c=>/^Traveler(?:Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/.test(c.key))){pending.travelerSource=input;const genders=new Set(roster().filter(c=>/^Traveler.*[MF]$/.test(c.key)).map(c=>c.key.at(-1)));pending.gender=genders.size===1?[...genders][0]:'';}
      renderImportPreview();applyAccountLock();
    }
    function importSource(){
      if(!pending.travelerSource)return pending.input;
      if(!pending.gender)throw Error('请先选择旅行者外观。');
      const source=structuredClone(pending.input);source.characters=source.characters.map(c=>/^Traveler(?:Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)$/.test(c.key)?{...c,key:c.key+pending.gender}:c);return source;
    }
    function renderImportPreview(){
      const target=pane('import').querySelector('[data-import-preview]');if(!target||!pending)return;
      let preview=pending,warning='',notice='';const updating=!pending.bundle&&!pending.restore&&pending.mode!=='new';
      if(updating){try{
        const actual=serializeManagedState(state),basis=JSON.stringify(actual.good);
        if(pending.matchBasis&&pending.matchBasis!==basis){pending.decisions=[];pending.matchTargets={};pending.matchPage=0;notice='当前装备已变化，疑似装备需要重新确认。';}
        pending.matchBasis=basis;preview=scanPreview(actual,importSource(),data,{mode:pending.mode,decisions:pending.decisions});pending.matchPreview=preview;
      }catch(error){warning=error.message;pending.matchPreview=null;}}
      pending.valid=!warning;
      const labels={characters:'角色',weapons:'武器',artifacts:'圣遗物'};
      target.innerHTML=`<div class="ae-preview"><h3>${pending.bundle?'多账号备份导入预览':pending.restore?'账号备份导入预览':'GOOD 导入预览'}</h3><p>角色 ${pending.counts.characters} · 武器 ${pending.counts.weapons} · 圣遗物 ${pending.counts.artifacts}</p>
        ${!pending.bundle&&!pending.restore?`<label class="ae-field"><span>导入方式</span><select data-import-mode>${option('new','新建独立账号',pending.mode)}${option('merge','合并更新当前账号',pending.mode)}${option('sync','按完整扫描替换当前装备库存',pending.mode)}</select></label>`:''}
        <p>${pending.bundle?'将建立 '+(pending.input.accounts?.length??0)+' 个独立账号，默认锁定。':updating?'更新账号：“'+escape(account.name)+'”；保留评价目标、队伍、方案及原始快照。':'将建立独立账号并默认锁定，原有账号继续保留。'}</p>
        ${!pending.bundle&&!updating?`<label class="ae-field"><span>账号名称</span><input data-import-name maxlength="100" value="${escape(pending.name)}" aria-label="导入账号名称"></label>`:''}
        ${pending.travelerSource?`<label class="ae-field"><span>原文件未区分旅行者外观，请选择</span><select data-import-traveler>${option('','请选择',pending.gender)}${option('M','空',pending.gender)}${option('F','荧',pending.gender)}</select></label>`:''}
        ${updating&&preview.changes?`<div class="ae-table-wrap"><table class="ae-table"><thead><tr><th>资料</th><th>新增</th><th>更新</th><th>相同不变</th><th>移除</th></tr></thead><tbody>${Object.entries(preview.changes).map(([k,c])=>`<tr><td>${labels[k]}</td><td>${c.added}</td><td>${c.updated}</td><td>${c.unchanged}</td><td>${c.removed}</td></tr>`).join('')}</tbody></table></div>`:''}
        ${notice?`<p class="ae-warning">${escape(notice)}</p>`:''}${updating?importMatchingHTML(preview,pending,catalog,data):''}
        ${(preview.warnings??[]).filter(w=>!w.includes('恢复备份会替换')).map(w=>`<p class="ae-warning">${escape(w)}</p>`).join('')}${warning?`<p class="ae-warning">${escape(warning)}</p>`:''}
        ${updating&&account.locked?'<p class="ae-warning">当前账号已锁定，请先在账号管理中解锁，再确认更新。</p>':''}
        ${updating&&pending.mode==='sync'?`<label class="ae-import-consent"><input type="checkbox" data-import-confirm-sync ${pending.confirmed?'checked':''}>我确认这是完整库存扫描，同意移除对应类别中本次未扫描到的装备；更新前存档会保留。</label>`:''}
        <div class="ae-inline-actions"><button class="subtle-action" data-ae="confirm-import" ${warning||updating&&(preview.unresolved||account.locked||pending.mode==='sync'&&!pending.confirmed)?'disabled':''}>${updating?'确认更新当前账号':'新建账号并锁定导入'}</button><button class="subtle-action" data-ae="cancel-import">取消</button></div></div>`;
    }
    let handledPointerClick=false;
    async function editSettings(kind){
      const c=current();if(!c)return;
      // 每次打开读取最新默认文件，避免其他页面或账号的修改停留在旧缓存。
      settings=await api('assessment/recommendations');
      settingsPopup?.close();
      const key=c.key;
      const common={root,key,catalog,data,settings,toast,onClose:()=>{settingsPopup=null;root.querySelector(`[data-ae="${kind==='guide'?'edit-guide':kind==='weights'?'edit-weight-default':'edit-goal-default'}"]`)?.focus({preventScroll:true});},onSave:async(request)=>{
        settings=await api('assessment/recommendations',{method:'POST',body:{...request,key,kind:kind==='guide'?'guide':'goal'}});
        renderEvaluation();toast(({save:'方案已保存',add:'已新增方案',copy:'已复制为可编辑方案',delete:'方案已删除',default:'已更换默认方案；显示方案保持原选择',display:'已切换显示方案'})[request.action]);return settings;
      }};
      if(kind==='guide')settingsPopup=openGuideEditor(common);
      else settingsPopup=openGoalDefaultEditor({...common,element:meta(key).element||'pyro',current:goal(key),focusWeights:kind==='weights'});
    }
    const onClick=async event=>{
      for(const menu of root.querySelectorAll('[data-ui-menu][open]'))if(!menu.contains(event.target))menu.open=false;
      if(handledPointerClick&&event.detail>0){handledPointerClick=false;return;}
      const target=event.target.closest('button');if(!target||!root.contains(target))return;if(target.dataset.ae==='reset-goal'||target.dataset.native==='reset-scenario-group')event.preventDefault?.();
      if(target.hasAttribute('data-fold'))return;
      try{
        if(target.disabled||accountBusy)return;
        if(account.locked&&!viewButton(target))throw Error('账号已锁定，请先解锁再修改。');
        target.closest('[data-ui-menu]')?.removeAttribute('open');
        if(draftNode?.isConnected){clearTimeout(inputTimer);const input=draftNode;draftNode=null;await onChange({target:input});}
        if(pending&&(target.hasAttribute('data-import-match-action')||target.hasAttribute('data-import-match-new-all')||target.hasAttribute('data-import-match-page'))){
          if(target.hasAttribute('data-import-match-page'))pending.matchPage=Number(target.dataset.importMatchPage);
          else if(target.hasAttribute('data-import-match-new-all'))for(const match of pending.matchPreview.matches.filter(m=>!m.decision))(pending.decisions??=[]).push(importMatchDecision(match,'new'));
          else{const kind=target.dataset.importMatchKind,incomingIndex=Number(target.dataset.importMatchIndex),key=kind+':'+incomingIndex,match=pending.matchPreview.matches.find(m=>m.kind===kind&&m.incomingIndex===incomingIndex);chooseImportMatch(pending,pending.matchPreview,{kind,incomingIndex,action:target.dataset.importMatchAction,targetIndex:pending.matchTargets?.[key]??match.candidates.find(c=>!c.claimed)?.targetIndex});}
          renderImportPreview();applyAccountLock();return;
        }
        if(target.dataset.accountAction){const action=target.dataset.accountAction;if(['new','rename','remove'].includes(action))accountForm(action);else if(action==='cancel')root.querySelector('[data-account-form]').hidden=true;else if(action==='create-confirm'||action==='rename-confirm')await changeAccount(action==='create-confirm'?'create':'rename',{name:root.querySelector('[data-account-name]').value});else if(action==='remove-confirm')await changeAccount('remove');else await changeAccount(action);return;}
        if(target.dataset.ae==='reset-goal'){settings=await api('assessment/recommendations');const c=current();if(!c)throw Error('请先选择角色。');resetGoalGroup(state,c.key,target.dataset.group,{element:meta(c.key).element||'pyro',supported:!!data.char.data[c.key]||c.key.startsWith('Traveler'),settings});persist();renderEvaluation();toast('评价设置已恢复默认');return;}
        const position=readScrollPosition(),viewChange=target.matches('[data-evaluation-tab],[data-select],[data-native-page],[data-native-team-tab],[data-native-condition-tab],[data-native-condition-member],[data-native-artifact-page]');
        rememberView();
        if(await workbench.click(target)){if(viewChange)restoreView(position);return;}
        if(target.dataset.tab){setTab(target.dataset.tab);return;}
        if(target.dataset.evaluationTab){evaluationTab=target.dataset.evaluationTab;applyEvaluationTab();restoreView(position);return;}
        if(target.dataset.ae==='evaluation-settings'){setEvaluationSettings(true);return;}
        if(target.dataset.ae==='close-evaluation-settings'){setEvaluationSettings(false);return;}
        if(target.dataset.select){evaluationSettingsOpen=false;artifactPopup?.close();artifactPopup=null;selected=target.dataset.select;viewSelections.set(account.id,selected);state.selected=selected;persist();workbench.reset();renderEvaluation();restoreView(position);return;}
        const action=target.dataset.ae;
        if(action==='roster-direction'){const prefs=rosterOrder();changeRosterOrder({...prefs,ascending:!prefs.ascending});return;}
        if(action==='roster-move'){const prefs=rosterOrder();changeRosterOrder({...prefs,sort:'custom',order:moveAssessmentRoster(roster(),prefs.order??[],target.dataset.key,target.dataset.neighbor)});return;}
        if(action==='set-plan-default'){
          const kind=target.dataset.kind;settings=await api('assessment/recommendations');const c=recommendationPlans(selected,kind,settings);
          settings=await api('assessment/recommendations',{method:'POST',body:{key:selected,kind,action:'default',id:c.displayId,revision:settings.revision}});renderEvaluation();toast('已设为默认方案');return;
        }
        if(['edit-guide','edit-goal-default','edit-weight-default'].includes(action)){await editSettings(action==='edit-guide'?'guide':action==='edit-weight-default'?'weights':'goal');return;}
        if(action==='add'){
          inventoryPopup?.close();inventoryPopup=openCharacterInventoryPicker({root,state,catalog,toast,onClose:()=>{inventoryPopup=null;},onChoose:key=>{
            if(roster().some(c=>c.key===key))throw Error('该角色已在账号中。');
            selected=key;state.selected=key;viewSelections.set(account.id,key);state.good.characters.push({key,level:1,ascension:0,constellation:0,talent:{auto:1,skill:1,burst:1},wikiCustom:true});state.goals[key]=recommendedGoal(key,meta(key).element,settings);persist();
            return ()=>{workbench.reset();if(['engine','artifacts','weapons'].includes(tab))workbench.render();else renderEvaluation();};
          }});
        }else if(action==='choose-build-weapon'||action==='choose-build-set'){
          const weapon=action==='choose-build-weapon',slot=target.dataset.slot,kind=weapon?'weapons':'sets',input=weapon?pane('evaluation').querySelector('[data-weapon="key"]'):pane('evaluation').querySelector(`[data-slot="${slot}"] [data-art="setKey"]`),member=selected;
          if(account.locked&&!viewInput(input))throw Error('原有装备已锁定，请先解锁再修改。');
          inventoryPopup?.close();inventoryPopup=openCatalogPicker({root,catalog,data,kind,weaponType:weapon?meta(member).weaponType:'',slot,selected:input.value,allowEmpty:true,toast,onClose:()=>{inventoryPopup=null;},onChoose:value=>{
            if(selected!==member)throw Error('当前角色已改变，请重新选择。');input.value=value;return ()=>{void onChange({target:input});};
          }});
        }else if(action==='inventory-equip'){
          const member=selected,kind=target.dataset.kind,slot=target.dataset.slot;inventoryPopup?.close();inventoryPopup=openAccountEquipmentPicker({root,state,member,kind,slot,catalog,data,weights:goal(member).weights,locked:account.locked,toast,onClose:()=>{inventoryPopup=null;},onChoose:index=>{
            if(selected!==member)throw Error('当前角色已改变，请重新选择。');
            const item=index===''?null:state.good[kind][Number(index)];if(kind==='weapons'&&item&&catalog.weapons[item.key]?.weaponType!==meta(member).weaponType)throw Error('武器类型不匹配。');
            equipManagedEquipment(state,member,kind,index,slot,{locked:account.locked});persist();return ()=>{restoreEngine();renderEvaluation();};
          },onRestore:()=>{
            if(selected!==member)throw Error('当前角色已改变，请重新选择。');
            const changed=restoreManagedEquipment(state,member,{kind,slot});persist();return ()=>{restoreEngine();renderEvaluation();toast(changed?'已恢复原有装备':'当前已是原有装备，无需恢复');};
          }});
        }else if(action==='restore-account-equipment'||action==='restore-account-artifacts'){const changed=restoreManagedEquipment(state,selected,action==='restore-account-artifacts'?{kind:'artifacts'}:{});persist();restoreEngine();renderEvaluation();toast(changed?(action==='restore-account-artifacts'?'已恢复原有圣遗物':'已恢复原有装备'):'当前已是原有装备，无需恢复');
        }else if(action==='remove-character'){if(removeCharacter(state,target.dataset.key)){selected=state.selected;workbench.reset();persist();renderEvaluation();toast('已移除角色方案，装备保留在库存');}}else if(action==='remove-baseline'){delete state.comparisons[selected];persist();renderEvaluation();}else if(action==='artifact-details'||action==='artifact-overview'){const c=current();if(!c)return;const a=state.good.artifacts[Number(target.dataset.index)];artifactPopup?.close();artifactPopup=openArtifactDialog({root,character:c,good:state.good,goal:goal(c.key),catalog,data,slotKey:action==='artifact-details'?a?.slotKey:undefined,all:action==='artifact-overview',onClose:()=>{artifactPopup=null;}});}else if(action==='baseline'){const c=current(),e=equipment(state.good,c.key);state.comparisons[c.key]={character:snapshotItem(c),weapon:e.weapon?snapshotItem(e.weapon):null,artifacts:e.artifacts.map(snapshotItem),savedAt:new Date().toISOString()};persist();renderEvaluation();}
        else if(action==='apply-recommendation'){if(current()){settings=await api('assessment/recommendations');state.goals[selected]=recommendedGoal(selected,meta(selected).element,settings);persist();renderEvaluation();toast('已采用角色推荐；实际角色与装备未修改');}}
        else if(action==='apply-displayed-goal'){if(current()){settings=await api('assessment/recommendations');state.goals[selected]=structuredClone(recommendationPlan(selected,'goal',settings).value);persist();renderEvaluation();toast('已采用显示的评价方案；实际装备保留');}}
        else if(action==='open-engine')setTab('engine');
        else if(action==='go-import')setTab('import');
        else if(action==='save')await save();
        else if(action==='convert-custom'){
          const result=await changeAccount('convert-custom');
          toast(result.unchanged?'当前没有可转换的自定义资料':`已转为默认配置：角色 ${result.converted.characters}、武器 ${result.converted.weapons}、圣遗物 ${result.converted.artifacts}`);
        }
        else if(action==='expand'||action==='collapse')for(const d of pane(tab).querySelectorAll('details'))d.open=action==='expand';
        else if(action==='export-backup'){await download(`${account.name.replace(/[<>:"\\/|?*]/g,'_')}-assessment-${new Date().toISOString().replace(/[:.]/g,'-')}.json.gz`,{...serializeManagedState(state),accountName:account.name,accountKind:account.kind},true);}
        else if(action==='export-all'){await flushAccount();await download('genshin-all-accounts.json.gz',await api('assessment/accounts/export'),true);}
        else if(action==='export-original'){const original=await api('assessment/accounts/original?account='+encodeURIComponent(account.id));await download('genshin-original-import.json.gz',original.state,true);}
        else if(action==='export-good'){await download('genshin-builds.good.json',serializeManagedState(state).good);}
        else if(action==='export-before-scan'){const value=await api('assessment/accounts/recovery?account='+encodeURIComponent(account.id));await download('genshin-before-last-scan.json.gz',{...value.previousState,accountName:account.name+'（更新前）'},true);}
        else if(action==='confirm-import'&&pending){
          const imported=pending;
          if(imported.bundle){await changeAccount('import-bundle',{backup:imported.input,source:imported.sourceName});toast('已导入独立账号，默认锁定');}
          else if(!imported.restore&&imported.mode!=='new'){
            if(account.locked)throw Error('请先解锁当前账号，再更新实际数据。');
            if(imported.mode==='sync'&&!imported.confirmed)throw Error('请先确认完整扫描的替换范围。');
            if(!imported.valid||imported.matchPreview?.unresolved)throw Error('请先处理全部疑似装备。');
            const result=await changeAccount('import-scan',{good:importSource(),mode:imported.mode,decisions:imported.decisions,confirmReplace:imported.confirmed,source:imported.sourceName});
            pending=null;toast(result.unchanged?'内容相同，原账号数据未改动':'已更新当前账号并锁定，更新前存档已保留');
          }else{
            const name=pane('import').querySelector('[data-import-name]').value.trim();if(!name)throw Error('请填写账号名称。');
            const next=importPreview(blankState(),importSource(),data).state;
            if(next.engineStorage['wiki.native.v1']){const native=JSON.parse(next.engineStorage['wiki.native.v1']);native.migrated=false;next.engineStorage['wiki.native.v1']=JSON.stringify(native);}
            await changeAccount('create',{name,state:next,source:imported.sourceName});toast('已导入独立账号，默认锁定');
          }
          pending=null;setTab('evaluation');
        }
        else if(action==='cancel-import'){pending=null;pane('import').querySelector('[data-import-preview]').innerHTML='';}
      }catch(error){toast(error.message);}
    };
    const onChange=async event=>{
      if(event.target.hasAttribute('data-hide-assessment-hints')){const hidden=event.target.checked;root.dataset.hideHints=String(hidden);try{globalThis.localStorage?.setItem(hintKey,String(hidden));}catch{}return;}
      const target=event.target,c=current();if(event.isComposing||inputEvents.isComposing(target))return;clearTimeout(inputTimer);draftNode=null;try{
        if(pending&&target.hasAttribute('data-import-name')){pending.name=target.value;return;}
        if(pending&&target.hasAttribute('data-import-match-target')){const key=target.dataset.importMatchKind+':'+target.dataset.importMatchIndex;(pending.matchTargets??={})[key]=Number(target.value);pending.decisions=(pending.decisions??[]).filter(d=>d.kind!==target.dataset.importMatchKind||d.incomingIndex!==Number(target.dataset.importMatchIndex));renderImportPreview();applyAccountLock();pane('import').querySelector(`[data-import-match="${key}"] [data-import-match-target]`)?.focus({preventScroll:true});return;}
        if(pending&&(target.hasAttribute('data-import-mode')||target.hasAttribute('data-import-traveler')||target.hasAttribute('data-import-confirm-sync'))){
          const name=pane('import').querySelector('[data-import-name]');if(name)pending.name=name.value;
          if(target.hasAttribute('data-import-mode')){pending.mode=target.value;pending.confirmed=false;}
          else if(target.hasAttribute('data-import-traveler'))pending.gender=target.value;
          else pending.confirmed=target.checked;
          renderImportPreview();applyAccountLock();return;
        }
        if(target.hasAttribute('data-account-switch')){await changeAccount('switch',{accountId:target.value});return;}
        if(target.hasAttribute('data-custom-markers')){if(account.kind==='imported')throw Error('导入账号须保留自定义标记。');state.customInventory.showMarkers=target.checked;persist();renderAccounts();renderEvaluation();if(['engine','artifacts','weapons'].includes(tab))workbench.render();return;}
        if(target.hasAttribute('data-roster-sort')){changeRosterOrder({...rosterOrder(),sort:target.value});return;}
        if(target.hasAttribute('data-roster-origin')||target.hasAttribute('data-roster-element')){if(target.hasAttribute('data-roster-origin'))rosterOrigin=target.value;else rosterElement=target.value;if(['engine','artifacts','weapons'].includes(tab))workbench.render();else renderEvaluation();return;}
        if(account.locked&&!viewInput(target))throw Error('账号已锁定，请先解锁再修改。');
        if(pane('evaluation').contains(target)&&target.type==='number'&&(target.value===''||!target.checkValidity())){status('请填写允许范围内的数值');return;}
        if(target.hasAttribute('data-import-file')){const file=target.files?.[0];if(file)await previewFile(file);target.value='';return;}
        if(await workbench.change(target))return;
        if(!c)return;
        if(target.hasAttribute('data-rec-display')){
          const kind=target.dataset.recDisplay;settings=await api('assessment/recommendations');settings=await api('assessment/recommendations',{method:'POST',body:{key:selected,kind,action:'display',id:target.value,revision:settings.revision}});renderEvaluation();return;
        }
        if(target.hasAttribute('data-traveler-element')){selected=switchTravelerElement(state,c.key,target.value);viewSelections.set(account.id,selected);persist();workbench.reset();renderEvaluation();return;}
        if(target.dataset.char||target.dataset.talent){const next=structuredClone(c),key=target.dataset.char;if(key)next[key]=Number(target.value);else next.talent[target.dataset.talent]=Number(target.value);if(key==='level'&&next.level>[20,40,50,60,70,80,100][next.ascension])next.ascension=[20,40,50,60,70,80,100].findIndex(cap=>next.level<=cap);if(key==='level'&&next.level<[1,20,40,50,60,70,80][next.ascension])next.ascension=[20,40,50,60,70,80,100].findIndex(cap=>next.level<=cap);if(key==='ascension')next.level=Math.max([1,20,40,50,60,70,80][next.ascension]??1,Math.min(next.level,[20,40,50,60,70,80,100][next.ascension]??100));const check=validateGOOD({format:'GOOD',version:3,characters:[next]},data);if(check.errors.length)throw Error(check.errors[0]);updateCharacter(next,target);}
        else if(target.dataset.weapon){
          const old=equipment(state.good,c.key).weapon,key=target.dataset.weapon;let next=old?structuredClone(old):null;
          if(key==='key')next=target.value?{key:target.value,level:1,ascension:0,refinement:1,location:equipmentLocation(selected),lock:false}:null;else if(next){next[key]=Number(target.value);const cap=catalog.weapons[next.key]?.rarity<3?70:90;if(key==='level')next.ascension=[20,40,50,60,70,80,cap].findIndex(v=>next.level<=v);if(key==='ascension')next.level=Math.max([1,20,40,50,60,70,80][next.ascension]??1,Math.min(next.level,[20,40,50,60,70,80,cap][next.ascension]??cap));}
          const checked=validateGOOD({format:'GOOD',version:3,weapons:next?[next]:[]},data);if(checked.errors.length)throw Error(checked.errors[0]);updateEquipment('weapons',next,undefined,target);
        }else if(target.dataset.art||target.hasAttribute('data-sub-key')||target.hasAttribute('data-sub-value')){
          const slot=target.closest('[data-slot]').dataset.slot,old=equipment(state.good,c.key).artifacts.find(a=>a.slotKey===slot);let next=old?structuredClone(old):null;
          if(target.dataset.art==='setKey'){if(!target.value)next=null;else if(next){next.setKey=target.value;if(!data.art.data[next.setKey].rarities.includes(next.rarity))next.rarity=Math.max(...data.art.data[next.setKey].rarities);next.level=Math.min(next.level,next.rarity<3?4:next.rarity*4);}else next={setKey:target.value,rarity:Math.max(...data.art.data[target.value].rarities),level:0,slotKey:slot,mainStatKey:MAIN_STATS[slot][0],substats:[],location:equipmentLocation(selected),lock:false};}
          else if(next){if(target.dataset.art){const key=target.dataset.art;next[key]=['rarity','level'].includes(key)?Number(target.value):target.value;if(key==='rarity')next.level=Math.min(next.level,next.rarity<3?4:next.rarity*4);if(key==='mainStatKey')next.substats=next.substats.filter(s=>s.key!==next.mainStatKey);}
            else{const index=Number(target.dataset.subKey??target.dataset.subValue);while(next.substats.length<=index)next.substats.push({key:'',value:0});next.substats[index][target.hasAttribute('data-sub-key')?'key':'value']=target.hasAttribute('data-sub-key')?target.value:Number(target.value);}
          }
          const checked=validateGOOD({format:'GOOD',version:3,artifacts:next?[next]:[]},data);if(checked.errors.length)throw Error(checked.errors[0]);updateEquipment('artifacts',next,slot,target);
        }else if(target.dataset.goal||target.dataset.goalTalent||target.dataset.weight||target.dataset.goalMain||target.hasAttribute('data-goal-set')||target.dataset.goalPanel||target.hasAttribute('data-goal-notes')){
          let g=structuredClone(goal(c.key));if(target.dataset.goal==='role'){g=goalDefaults(c.key,meta(c.key).element,target.value,settings);}else if(target.dataset.goal)g[target.dataset.goal]=Number(target.value);else if(target.dataset.goalTalent)g.talent[target.dataset.goalTalent]=Number(target.value);else if(target.dataset.weight)g.weights[target.dataset.weight]=Number(target.value);else if(target.dataset.goalMain){const slot=target.dataset.goalMain;g.mainStats[slot]=[...pane('evaluation').querySelectorAll(`[data-goal-main="${slot}"]:checked`)].map(n=>n.value);}else if(target.hasAttribute('data-goal-set')){const sets=[...pane('evaluation').querySelectorAll('[data-goal-set]')].map(n=>n.value).filter(Boolean);if(new Set(sets).size!==sets.length)throw Error('二加二请选择两种不同套装。');g.sets=sets;}else if(target.dataset.goalPanel)g.panel[target.dataset.goalPanel]=Number(target.value);else g.notes=target.value;
          if(!target.checkValidity())throw Error('数值超出可填写范围。');state.goals[c.key]=g;persist();renderEvaluation(target);
        }
      }catch(error){toast(error.message);if(c)renderEvaluation(target);}
    };
    const onInput=event=>{if(account.locked&&!viewInput(event.target))return;if(pending&&event.target.hasAttribute('data-import-name')){pending.name=event.target.value;return;}if(event.target.hasAttribute('data-character-search')){filter=event.target.value;const list=pane(tab).querySelector('.ae-character-list');const temp=document.createElement('div');temp.innerHTML=selectionHTML();list.innerHTML=temp.querySelector('.ae-character-list').innerHTML;applyAccountLock();}else if(event.target.hasAttribute('data-team-loadout-search')||event.target.hasAttribute('data-native-search')||event.target.hasAttribute('data-custom-name')||event.target.hasAttribute('data-native-team-name')||event.target.hasAttribute('data-native-plan-name')||event.target.dataset.weaponPicker==='search'){void workbench.change(event.target);}else if(event.target.matches('input[type=number],textarea[data-goal-notes]')){clearTimeout(inputTimer);draftNode=event.target;if(!event.target.hasAttribute('data-artifact-filter')&&!event.target.hasAttribute('data-artifact-sub-min'))status('输入尚未保存');inputTimer=setTimeout(()=>{const input=draftNode;draftNode=null;if(input?.isConnected&&(input.value!==''||input.hasAttribute('data-artifact-filter')||input.hasAttribute('data-artifact-sub-min')))void onChange({target:input});},450);}};
    // 数字输入失焦会重绘表单；先处理待提交输入，避免重绘吞掉紧接着的按钮点击。
    const onPointerDown=event=>{handledPointerClick=false;const button=event.target.closest('button');if(event.button===0&&button&&!button.disabled&&draftNode?.isConnected){event.preventDefault();handledPointerClick=true;void onClick({target:button});}};
    const onDrag=event=>{if(event.target.closest('.ae-import-zone'))event.preventDefault();};
    const onDrop=event=>{if(!event.target.closest('.ae-import-zone'))return;event.preventDefault();const file=event.dataTransfer.files[0];if(file)previewFile(file).catch(e=>toast(e.message));};
    const inputEvents=createCompositionInputHandler(onInput);
    root.addEventListener('pointerdown',onPointerDown);root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('input',inputEvents.input);root.addEventListener('compositionstart',inputEvents.start);root.addEventListener('compositionend',inputEvents.end);root.addEventListener('dragover',onDrag);root.addEventListener('drop',onDrop);
    const onEvaluationKey=event=>{
      if(event.key==='Escape'){
        const menu=event.target.closest('[data-ui-menu][open]')??root.querySelector('[data-ui-menu][open]');
        if(menu){menu.open=false;menu.querySelector('summary')?.focus({preventScroll:true});event.preventDefault();return;}
      }
      if(event.defaultPrevented||[...root.querySelectorAll('dialog')].some(dialog=>dialog.open))return;
      if(evaluationSettingsOpen){if(event.key==='Escape'){event.preventDefault();setEvaluationSettings(false);return;}if(event.key==='Tab'){const drawer=pane('evaluation').querySelector('[data-evaluation-settings]'),controls=[...drawer.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href]')].filter(n=>!n.disabled&&!n.closest('details:not([open])'));const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
      const button=event.target.closest('[data-evaluation-tab],[data-native-team-tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const position=readScrollPosition();rememberView();const teamButton=button.hasAttribute('data-native-team-tab'),buttons=[...root.querySelectorAll(teamButton?'[data-native-team-tab]':'[data-evaluation-tab]')],index=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;if(teamButton){void workbench.click(buttons[next]).then(()=>restoreView(position));}else{evaluationTab=buttons[next].dataset.evaluationTab;applyEvaluationTab();restoreView(position);}buttons[next].focus({preventScroll:true});
    };root.addEventListener('keydown',onEvaluationKey);
    const onHidden=()=>{if(document.visibilityState==='hidden'){rememberView();void flushAccount().catch(()=>{});}};
    const onPageHide=()=>rememberView();globalThis.window?.addEventListener('pagehide',onPageHide);
    document.addEventListener('visibilitychange',onHidden);
    marker.dispose=()=>{rememberView();dead=true;root.removeEventListener('keydown',onEvaluationKey);document.removeEventListener('visibilitychange',onHidden);globalThis.window?.removeEventListener('pagehide',onPageHide);inventoryPopup?.close();inventoryPopup=null;settingsPopup?.close();settingsPopup=null;artifactPopup?.close();artifactPopup=null;clearTimeout(inputTimer);clearTimeout(undoTimer);clearTimeout(saveTimer);const flushed=flushAccount().catch(()=>{});workbench.dispose();return flushed;};
    if(characterId){const preferred=Object.entries(catalog.characters).filter(([,m])=>m.wikiId===characterId).sort(([a],[b])=>Number(b.includes('Cryo'))-Number(a.includes('Cryo')))[0]?.[0];if(preferred&&roster().some(c=>c.key===preferred)){selected=preferred;tab='evaluation';filter='';rosterOrigin='';rosterElement='';}}
    renderAccounts();status('');setTab(tab);viewReady=true;restoreView(initialPosition);
  }catch(error){if(!dead&&isActive()){host.innerHTML=`<div class="panel ae-empty"><strong>养成与评估暂时无法加载</strong><p>${escape(error.message)}</p></div>`;toast(error.message);}}
}
