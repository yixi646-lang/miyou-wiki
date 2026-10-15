import {ROLES,SUBSTATS,STAT_NAMES,SLOT_NAMES,MAIN_STATS,defaultGoal,validateGoal} from './core/model.mjs';
import {focusNameInput} from '../../shared/name-input.mjs';
import {recommendationPlans,builtinPlanValue,normalizeGuideArtifactPlans,syncGuideArtifactBuild,defaultArtifactAdvice} from './core/recommendation-plans.mjs';
import {validateGuideCatalog} from './core/recommendation-settings.mjs';
import {openAssessmentDialog} from './analysis-dialog.mjs';
import {catalogChoiceHTML,openCatalogPicker} from './analysis-dialog.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(key,name,value)=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(name)}</option>`;
const field=(label,value,attr,{min=0,max=100,step=1}={})=>`<label class="ae-field"><span>${esc(label)}</span><input type="number" ${attr} value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
const text=(label,value,attr,rows=2,max=3000)=>`<label class="ae-field"><span>${esc(label)}</span><textarea ${attr} rows="${rows}" maxlength="${max}">${esc(value)}</textarea></label>`;
const select=(label,attr,entries,value,empty=true)=>`<label class="ae-field"><span>${esc(label)}</span><select ${attr}>${empty?option('','不限制 / 未填写',value):''}${entries.map(([k,m])=>option(k,typeof m==='string'?m:m.name,value)).join('')}</select></label>`;
function buildFields(build,catalog){
  return `<div class="ae-fields">${[0,1].map(i=>catalogChoiceHTML({label:i?'第二组二件套（可选）':'四件套 / 第一组二件套',kind:'sets',value:build.sets[i]??'',catalog,buttonAttributes:`data-rec-action="pick-set" data-index="${i}"`,inputAttributes:`data-rec-set="${i}"`})).join('')}${['auto','skill','burst'].map((k,i)=>field(['普攻参考等级','战技参考等级','爆发参考等级'][i],build.talent[k],`data-rec-talent="${k}"`,{min:1,max:10})).join('')}</div><div class="ae-main-goals">${['sands','goblet','circlet'].map(slot=>`<fieldset><legend>${SLOT_NAMES[slot]}可接受主词条</legend>${MAIN_STATS[slot].map(k=>`<label><input type="checkbox" data-rec-main="${slot}" value="${k}" ${build.mainStats[slot].includes(k)?'checked':''}>${STAT_NAMES[k]}</label>`).join('')}</fieldset>`).join('')}</div>`;
}
function readBuild(container,build){
  build.sets=[...container.querySelectorAll('[data-rec-set]')].map(n=>n.value).filter(Boolean);
  if(new Set(build.sets).size!==build.sets.length)throw Error('二加二请选择两种不同套装。');
  for(const n of container.querySelectorAll('[data-rec-talent]'))build.talent[n.dataset.recTalent]=Number(n.value);
  for(const slot of ['sands','goblet','circlet'])build.mainStats[slot]=[...container.querySelectorAll(`[data-rec-main="${slot}"]:checked`)].map(n=>n.value);
}
function checkFields(container){
  const invalid=[...container.querySelectorAll('input,select,textarea')].find(n=>!n.checkValidity());
  if(invalid){invalid.reportValidity();throw Error('请检查标出的字段。');}
}
function guideArtifactFields(draft,catalog,parentVisible){
  const plans=draft.artifactPlans.map((p,i)=>`<details class="ae-rec-artifact-plan" data-rec-artifact-plan="${esc(p.id)}" data-popup-disclosure="artifact-plan-${esc(p.id)}" ${i===0?'open':''}><summary><span>${esc(p.name)} · ${p.mode==='four'?'四件套':'2+2'}</span><small>${parentVisible&&p.display?'展示中':'未展示'}</small></summary><label class="ae-field"><span>圣遗物方案名称</span><input data-rec-artifact-name maxlength="100" required value="${esc(p.name)}"></label><div class="ae-inline-actions">${[['four','四件套'],['two-two','2+2']].map(([mode,name])=>`<button type="button" class="subtle-action" data-rec-action="artifact-mode" data-artifact-id="${esc(p.id)}" data-mode="${mode}" aria-pressed="${p.mode===mode}">${name}</button>`).join('')}</div><div class="ae-fields">${Array.from({length:p.mode==='four'?1:2},(_,index)=>catalogChoiceHTML({label:p.mode==='four'?'四件套':`第 ${index+1} 组二件套`,kind:'sets',value:p.sets[index]??'',catalog,buttonAttributes:`data-rec-action="pick-artifact-set" data-artifact-id="${esc(p.id)}" data-index="${index}"`,inputAttributes:`data-rec-artifact-set="${index}"`})).join('')}</div><div class="ae-main-goals">${['sands','goblet','circlet'].map(slot=>`<fieldset><legend>${SLOT_NAMES[slot]}可接受主词条</legend>${MAIN_STATS[slot].map(key=>`<label><input type="checkbox" data-rec-artifact-main="${slot}" value="${key}" ${p.mainStats[slot].includes(key)?'checked':''}>${STAT_NAMES[key]}</label>`).join('')}</fieldset>`).join('')}</div><div class="ae-inline-actions"><button type="button" class="subtle-action" data-rec-action="save-artifact-plan" data-artifact-id="${esc(p.id)}">保存此方案</button><button type="button" class="subtle-action" data-rec-action="display-artifact-plan" data-artifact-id="${esc(p.id)}">${parentVisible&&p.display?'隐藏此方案':'展示此方案'}</button><button type="button" class="subtle-action" data-rec-action="discard-artifact-plan" data-artifact-id="${esc(p.id)}">取消此方案修改</button><button type="button" class="subtle-action ae-remove" data-rec-action="remove-artifact-plan" data-artifact-id="${esc(p.id)}">移除此方案</button></div></details>`).join('');
  return `${plans}<button type="button" class="subtle-action" data-rec-action="add-artifact-plan" ${draft.artifactPlans.length>=40?'disabled':''}>增加圣遗物方案</button><div class="ae-fields">${['auto','skill','burst'].map((key,i)=>field(['普攻参考等级','战技参考等级','爆发参考等级'][i],draft.build.talent[key],`data-rec-talent="${key}"`,{min:1,max:10})).join('')}</div>${text('圣遗物建议（统一补充建议）',draft.artifactAdvice,'data-rec-artifact-advice',4,6000)}<button type="button" class="subtle-action" data-rec-action="save-artifact-advice">保存圣遗物建议</button>`;
}
function guideFields(draft,catalog,key,parentVisible){
  return `${text('角色用途、玩法与适用条件',draft.intro,'data-rec-intro',4,6000)}<details data-popup-disclosure="edit-weapons" open><summary>推荐武器与选择条件</summary>${draft.weapons.map((w,i)=>`<div class="ae-rec-row">${catalogChoiceHTML({label:'推荐武器',kind:'weapons',value:w.key,catalog,buttonAttributes:`data-rec-action="pick-weapon" data-index="${i}"`,inputAttributes:`data-rec-weapon="key" data-index="${i}"`})}${text('适用条件与说明',w.note,`data-rec-weapon="note" data-index="${i}"`)}<button class="subtle-action ae-remove" data-rec-action="remove-weapon" data-index="${i}">移除</button></div>`).join('')}<button class="subtle-action" data-rec-action="add-weapon" ${draft.weapons.length>=100?'disabled':''}>增加推荐武器</button></details><details data-popup-disclosure="edit-artifacts" open><summary>圣遗物、主词条与培养顺序</summary>${guideArtifactFields(draft,catalog,parentVisible)}</details><details data-popup-disclosure="edit-teams"><summary>四位置配队</summary>${draft.teams.map((t,i)=>`<fieldset class="ae-rec-team"><legend>配队 ${i+1}</legend>${text('队伍说明与适用条件',t.note??'',`data-rec-team="note" data-index="${i}"`)}<div class="ae-rec-team-grid">${t.slots.map((s,j)=>`<div>${catalogChoiceHTML({label:`位置 ${j+1} 的角色`,kind:"characters",value:s.characters[0]??'',catalog,buttonAttributes:`data-rec-action="pick-characters" data-team="${i}" data-slot="${j}"`,inputAttributes:`data-rec-slot="characters" data-team="${i}" data-slot="${j}"`})}</div>`).join('')}</div><button class="subtle-action ae-remove" data-rec-action="remove-team" data-index="${i}">移除此配队</button></fieldset>`).join('')}<button class="subtle-action" data-rec-action="add-team" ${draft.teams.length>=40?'disabled':''}>增加配队</button></details><details data-popup-disclosure="edit-source"><summary>参考来源与版本条件</summary><div class="ae-fields">${text('来源名称',draft.source.name,'data-rec-source="name"',1,200)}${text('参考链接',draft.source.url,'data-rec-source="url"',1,2000)}${text('适用版本 / 条件',draft.source.version??'','data-rec-source="version"',2,100)}</div></details>`;
}
function readGuideForm(c,draft,catalog){
  draft.intro=c.querySelector('[data-rec-intro]').value;
  for(const n of c.querySelectorAll('[data-rec-source]'))draft.source[n.dataset.recSource]=n.value;
  for(const n of c.querySelectorAll('[data-rec-talent]'))draft.build.talent[n.dataset.recTalent]=Number(n.value);
  draft.artifactAdvice=c.querySelector('[data-rec-artifact-advice]').value;
  for(const p of draft.artifactPlans){const card=c.querySelector(`[data-rec-artifact-plan="${p.id}"]`);p.name=card.querySelector('[data-rec-artifact-name]').value;p.sets=[...card.querySelectorAll('[data-rec-artifact-set]')].map(n=>n.value).filter(Boolean);for(const slot of ['sands','goblet','circlet'])p.mainStats[slot]=[...card.querySelectorAll(`[data-rec-artifact-main="${slot}"]:checked`)].map(n=>n.value);}
  syncGuideArtifactBuild(draft);
  for(const n of c.querySelectorAll('[data-rec-weapon]'))draft.weapons[Number(n.dataset.index)][n.dataset.recWeapon]=n.value;
  for(const n of c.querySelectorAll('[data-rec-team]'))draft.teams[Number(n.dataset.index)][n.dataset.recTeam]=n.value;
  for(const n of c.querySelectorAll('[data-rec-slot]')){
    const s=draft.teams[Number(n.dataset.team)].slots[Number(n.dataset.slot)];
    s.characters=n.value?[n.value]:[];s.label=catalog.characters[n.value]?.name??'';
  }
}
function goalFields(draft,catalog,focusWeights){
  return `${select('用途模板','data-rec-role',Object.entries(ROLES).map(([k,m])=>[k,m.name]),draft.role,false)}<details data-popup-disclosure="default-targets" ${focusWeights?'':'open'}><summary>评价目标</summary><div class="ae-fields">${field('目标角色等级',draft.level,'data-rec-goal="level"',{min:1,max:100})}${field('目标突破',draft.ascension,'data-rec-goal="ascension"',{max:6})}${field('目标武器等级',draft.weaponLevel,'data-rec-goal="weaponLevel"',{min:1,max:90})}${field('目标有效词条',draft.effectiveRolls,'data-rec-goal="effectiveRolls"',{max:100,step:.1})}</div>${buildFields(draft,catalog)}<div class="ae-fields">${['hp','atk','def','enerRech_','eleMas','critRate_','critDMG_'].map(k=>field(STAT_NAMES[k]+'面板目标',draft.panel[k]??0,`data-rec-panel="${k}"`,{max:1e7,step:.1})).join('')}</div>${text('用途、充能目标与说明',draft.notes,'data-rec-notes',3)}</details><details data-popup-disclosure="default-weights" open><summary>词条权重</summary><div class="ae-fields">${SUBSTATS.map(k=>field(STAT_NAMES[k],draft.weights[k]??0,`data-rec-weight="${k}"`,{max:2,step:.05})).join('')}</div></details>`;
}
function readGoalForm(c,draft){
  for(const n of c.querySelectorAll('[data-rec-goal]'))draft[n.dataset.recGoal]=Number(n.value);
  for(const n of c.querySelectorAll('[data-rec-weight]'))draft.weights[n.dataset.recWeight]=Number(n.value);
  for(const n of c.querySelectorAll('[data-rec-panel]')){const value=Number(n.value);if(value||Object.hasOwn(draft.panel,n.dataset.recPanel))draft.panel[n.dataset.recPanel]=value;}
  draft.notes=c.querySelector('[data-rec-notes]').value;readBuild(c,draft);
}

function openPlanEditor({root,key,kind,element='pyro',catalog,data,settings,current,focusWeights=false,onSave,onClose=()=>{},toast}){
  let saved=settings,collection=recommendationPlans(key,kind,saved,element),selected=collection.displayId,draft,draftName,showAfterSave=true,busy=false,confirmDelete=false,popup,choicePopup=null,dirty=false;
  const roleDrafts=new Map(),plan=()=>collection.plans.find(p=>p.id===selected);
  const resetDraft=()=>{draft=structuredClone(plan().value);draftName=plan().name;showAfterSave=true;confirmDelete=false;dirty=false;roleDrafts.clear();};resetDraft();
  const content=()=>popup.dialog.querySelector('[data-analysis-content]');
  const collect=(validate=true)=>{
    const c=content();if(validate)checkFields(c);
    if(!plan().builtin){if(kind==='guide')readGuideForm(c,draft,catalog);else readGoalForm(c,draft);}
    draftName=c.querySelector('[data-rec-name]').value;showAfterSave=c.querySelector('[data-rec-show-after-save]').checked;
    return {name:draftName,display:showAfterSave};
  };
  const nameFor=base=>{let name=base,n=2;while(collection.plans.some(p=>p.name===name))name=base+' '+n++;return name;};
  const html=()=>{
    const p=plan(),defaultPlan=collection.plans.find(p=>p.id===collection.defaultId),displayPlan=collection.plans.find(p=>p.id===collection.displayId);
    return `<div class="ae-rec-editor"><div class="ae-rec-planbar"><div class="ae-rec-plan-selection">${select('选择方案','data-rec-plan',collection.plans.map(p=>[p.id,p.name+(p.builtin?' · 只读':'')+(p.id===collection.defaultId?' · 默认':'')+(p.id===collection.displayId?' · 显示':'')]),selected,false)}<p class="ae-muted">默认：${esc(defaultPlan.name)}　显示：${esc(displayPlan.name)}</p></div><div class="ae-rec-plan-actions"><button class="subtle-action" data-rec-action="add">新增方案</button><button class="subtle-action" data-rec-action="copy">复制方案</button><button class="subtle-action" data-rec-action="default" ${selected===collection.defaultId?'disabled':''}>设为默认</button><button class="subtle-action" data-rec-action="display" ${selected===collection.displayId?'disabled':''}>显示此方案</button><button class="subtle-action ae-remove" data-rec-action="delete" ${p.builtin||selected===collection.defaultId?'disabled':''}>${confirmDelete?'确认删除':'删除方案'}</button><button class="subtle-action" data-rec-action="save" ${p.builtin?'disabled':''}>保存方案</button><button class="subtle-action" data-rec-action="discard">取消修改</button></div><label class="ae-rec-check"><input type="checkbox" data-rec-show-after-save ${showAfterSave?'checked':''} ${p.builtin?'disabled':''}>保存后显示此方案</label><span data-ae-hint="通用方案编辑规则" class="ae-muted" data-rec-edit-status>${p.builtin?'内置方案固定只读，可复制后编辑；内置和默认方案不能删除。':'通用方案，各账号共用；账号锁定不影响编辑。'}</span>${confirmDelete?'<p class="ae-warning">确认删除此方案？若它正在显示，删除后改为显示默认方案。</p>':''}</div><fieldset class="ae-rec-plan-content" ${p.builtin?'disabled':''}><label class="ae-field"><span>方案名称</span><input data-rec-name maxlength="100" value="${esc(draftName)}" required></label>${kind==='guide'?guideFields(draft,catalog,key,collection.displayId===selected):goalFields(draft,catalog,focusWeights)}</fieldset>${kind==='goal'?`<p data-ae-hint="默认与显示方案说明" class="ae-muted">默认方案用于新建角色、采用默认及恢复默认；显示方案供查看和按需采用。切换与编辑不会自动覆盖账号目标或实际装备。</p><button class="subtle-action" data-rec-action="copy-current">将当前评价另存为方案</button>`:''}</div>`;
  };
  const render=()=>{popup.setHTML(html());if(busy)for(const n of content().querySelectorAll('button,input,select,textarea'))n.disabled=true;};
  const cleanRequired=()=>{if(dirty)throw Error('当前方案有未保存修改，请先保存或取消修改。');};
  const refreshDirty=()=>{dirty=JSON.stringify(draft)!==JSON.stringify(plan().value)||draftName!==plan().name;};
  const saveArtifactPart=async(value,apply,{display=false}={})=>{
    validateGuideCatalog(value,key,catalog);busy=true;render();
    try{saved=await onSave({action:'save',id:selected,name:plan().name,value,display,revision:saved.revision});collection=recommendationPlans(key,kind,saved,element);apply();refreshDirty();}
    finally{busy=false;render();}
  };
  const commit=async(request,nextId=selected)=>{
    busy=true;render();
    try{saved=await onSave({...request,revision:saved.revision});collection=recommendationPlans(key,kind,saved,element);selected=nextId;resetDraft();}
    finally{busy=false;render();}
  };
  popup=openAssessmentDialog({root,title:catalog.characters[key].name+' · '+(kind==='guide'?'攻略方案':'评价目标与权重方案'),html:html(),onClose:()=>{choicePopup?.close();onClose();},onChange:async(event)=>{
    const target=event.target;if(busy)return;
    if(target.hasAttribute('data-rec-plan')){
      try{cleanRequired();selected=target.value;resetDraft();render();}catch(error){target.value=selected;toast(error.message);}return;
    }
    if(kind==='goal'&&target.hasAttribute('data-rec-role')){
      try{const old=draft.role;collect();roleDrafts.set(old,structuredClone(draft));draft=structuredClone(roleDrafts.get(target.value)??{...defaultGoal(target.value,element),effectiveRolls:0});dirty=true;render();}
      catch(error){target.value=draft.role;toast(error.message);}
    }
  },onClick:async(event)=>{
    const button=event.target.closest('[data-rec-action]');if(!button||button.disabled||busy)return;const action=button.dataset.recAction;
    try{
      if(action==='discard'){resetDraft();render();return;}
      if(['add','copy','default','display','delete','copy-current'].includes(action))cleanRequired();
      if(action==='save'){
        const fields=collect();if(kind==='guide')validateGuideCatalog(draft,key,catalog);else validateGoal(draft,key);
        await commit({action:'save',id:selected,value:structuredClone(draft),...fields});return;
      }
      if(action==='add'||action==='copy'||action==='copy-current'){
        const newId=crypto.randomUUID();let value;
        if(action==='add'){
          if(kind==='guide'){value=builtinPlanValue(key,kind,element);value.intro='';value.weapons=[];value.teams=[];value.source={name:'自定义整理',url:'',version:''};value.build={sets:[],mainStats:{sands:[],goblet:[],circlet:[]},talent:{auto:1,skill:1,burst:1}};value.artifactPlans=[];value.artifactAdvice=defaultArtifactAdvice(value.build);}
          else value={...defaultGoal('custom',element),effectiveRolls:0,mainStats:{sands:[],goblet:[],circlet:[]}};
        }else if(action==='copy-current')value=structuredClone(current);
        await commit({action:action==='copy'?'copy':'add',id:selected,newId,name:nameFor(action==='copy'?plan().name+'（副本）':action==='copy-current'?'当前评价':'新方案'),...(value?{value}:{})},newId);focusNameInput(content().querySelector('[data-rec-name]'));return;
      }
      if(action==='delete'){
        if(!confirmDelete){confirmDelete=true;render();return;}
        await commit({action,id:selected},collection.defaultId);return;
      }
      if(action==='default'||action==='display'){await commit({action,id:selected});return;}
      if(plan().builtin)return;
      const name=collect(false).name,show=content().querySelector('[data-rec-show-after-save]').checked;
      if(kind==='guide'&&['save-artifact-plan','remove-artifact-plan','display-artifact-plan','save-artifact-advice'].includes(action)){
        const id=button.dataset.artifactId,stored=normalizeGuideArtifactPlans(plan().value),item=draft.artifactPlans.find(p=>p.id===id),index=stored.artifactPlans.findIndex(p=>p.id===id);
        if(action==='save-artifact-advice'){
          checkFields(content().querySelector('[data-rec-artifact-advice]').parentElement);stored.artifactAdvice=draft.artifactAdvice;await saveArtifactPart(stored,()=>{draft.artifactAdvice=plan().value.artifactAdvice;});return;
        }
        if(action==='remove-artifact-plan'){
          if(index<0){draft.artifactPlans=draft.artifactPlans.filter(p=>p.id!==id);syncGuideArtifactBuild(draft);refreshDirty();render();return;}
          stored.artifactPlans.splice(index,1);syncGuideArtifactBuild(stored);await saveArtifactPart(stored,()=>{draft.artifactPlans=draft.artifactPlans.filter(p=>p.id!==id);syncGuideArtifactBuild(draft);});return;
        }
        if(action==='display-artifact-plan'){
          if(index<0)throw Error('请先保存这套圣遗物方案，再设置展示。');
          const display=collection.displayId!==selected||!stored.artifactPlans[index].display;stored.artifactPlans[index].display=display;
          await saveArtifactPart(stored,()=>{item.display=display;},{display});return;
        }
        checkFields(content().querySelector(`[data-rec-artifact-plan="${id}"]`));if(index<0)stored.artifactPlans.push(structuredClone(item));else stored.artifactPlans[index]=structuredClone(item);syncGuideArtifactBuild(stored);
        await saveArtifactPart(stored,()=>{const savedPlan=plan().value.artifactPlans.find(p=>p.id===id);draft.artifactPlans[draft.artifactPlans.findIndex(p=>p.id===id)]=structuredClone(savedPlan);syncGuideArtifactBuild(draft);});return;
      }
      if(kind==='guide'&&action==='add-artifact-plan'){
        const id=crypto.randomUUID();draft.artifactPlans.push({id,name:'圣遗物方案 '+(draft.artifactPlans.length+1),mode:'four',sets:[],mainStats:structuredClone(draft.build.mainStats),display:true});dirty=true;render();const card=content().querySelector(`[data-rec-artifact-plan="${id}"]`);card.open=true;focusNameInput(card.querySelector('[data-rec-artifact-name]'));return;
      }
      if(kind==='guide'&&action==='artifact-mode'){const item=draft.artifactPlans.find(p=>p.id===button.dataset.artifactId);item.mode=button.dataset.mode;if(item.mode==='four')item.sets=item.sets.slice(0,1);syncGuideArtifactBuild(draft);dirty=true;render();return;}
      if(kind==='guide'&&action==='discard-artifact-plan'){const id=button.dataset.artifactId,original=plan().value.artifactPlans.find(p=>p.id===id),index=draft.artifactPlans.findIndex(p=>p.id===id);if(original)draft.artifactPlans[index]=structuredClone(original);else draft.artifactPlans.splice(index,1);syncGuideArtifactBuild(draft);refreshDirty();render();return;}
      if(kind==='guide'&&action==='pick-artifact-set'){
        const item=draft.artifactPlans.find(p=>p.id===button.dataset.artifactId),index=Number(button.dataset.index);choicePopup?.close();choicePopup=openCatalogPicker({root,catalog,data,kind:'sets',selected:item.sets[index],allowEmpty:true,toast,onClose:()=>{choicePopup=null;},onChoose:value=>{if(value&&item.sets.some((key,i)=>i!==index&&key===value))throw Error('2+2 请选择两种不同套装。');item.sets[index]=value;syncGuideArtifactBuild(draft);dirty=true;return()=>render();}});return;
      }
      if(['pick-weapon','add-weapon','pick-set','pick-characters'].includes(action)){
        const index=Number(button.dataset.index),team=Number(button.dataset.team),slot=Number(button.dataset.slot),kind=action==='pick-set'?'sets':action==='pick-characters'?'characters':'weapons';
        choicePopup?.close();choicePopup=openCatalogPicker({root,catalog,data,kind,weaponType:kind==='weapons'?catalog.characters[key].weaponType:'',allowEmpty:kind==='sets'||kind==='characters',title:kind==='characters'?`位置 ${slot+1} · 选择角色`:undefined,selected:action==='pick-set'?draft.sets?.[index]??draft.build?.sets[index]:action==='pick-characters'?draft.teams[team].slots[slot].characters[0]:action==='pick-weapon'?draft.weapons[index].key:'',toast,onClose:()=>{choicePopup=null;},onChoose:value=>{
          if(action==='add-weapon')draft.weapons.push({key:value,note:''});
          else if(action==='pick-weapon')draft.weapons[index].key=value;
          else if(action==='pick-set'){const build=draft.build??draft;if(value&&build.sets.some((set,i)=>i!==index&&set===value))throw Error('二加二请选择两种不同套装。');build.sets[index]=value;}
          else{const position=draft.teams[team].slots[slot];position.characters=value?[value]:[];position.label=catalog.characters[value]?.name??'';}
          dirty=true;return ()=>render();
        }});return;
      }
      else if(action==='remove-weapon')draft.weapons.splice(Number(button.dataset.index),1);
      else if(action==='add-team')draft.teams.push({note:'',slots:Array.from({length:4},(_,i)=>({label:i?'':catalog.characters[key].name,characters:i?[]:[key]}))});
      else if(action==='remove-team')draft.teams.splice(Number(button.dataset.index),1);
      else return;
      dirty=true;render();content().querySelector('[data-rec-name]').value=name;content().querySelector('[data-rec-show-after-save]').checked=show;
    }catch(error){toast(error.message);}
  }});
  const markDirty=event=>{event.stopPropagation();if(!plan().builtin&&event.target.closest('[data-rec-plan-content],.ae-rec-plan-content')){dirty=true;const status=content().querySelector('[data-rec-edit-status]');if(status)status.textContent='当前方案有未保存修改';}};
  popup.dialog.addEventListener('input',markDirty);
  popup.dialog.addEventListener('change',markDirty);
  if(!plan().builtin&&!focusWeights)focusNameInput(content().querySelector('[data-rec-name]'));
  return popup;
}
export const openGuideEditor=options=>openPlanEditor({...options,kind:'guide'});
export const openGoalDefaultEditor=options=>openPlanEditor({...options,kind:'goal'});
