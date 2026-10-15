import {openAssessmentDialog} from './analysis-dialog.mjs';
import {customArtifactHTML} from './artifact-ui.mjs';
import {MAIN_STATS,SUBSTATS,STAT_NAMES,SLOT_NAMES,validateGOOD} from './core/model.mjs';
import {createArtifactEditor,switchArtifactMode,artifactEditorSnapshot,artifactMaxLevel,artifactInitialCounts,substatTiers,inspectDraft} from './core/artifacts.mjs';
import {weaponBaseStats} from './core/inventory.mjs';
import {catalogChoiceHTML,openCatalogPicker,filterButtonsHTML,refreshFilterButtons} from './analysis-dialog.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(v,n,current)=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(n)}</option>`;
const field=(n,html)=>`<label class="ae-field"><span>${esc(n)}</span>${html}</label>`;
const number=(n,k,v,min,max)=>field(n,`<input type="number" data-trial-weapon="${k}" value="${v}" min="${min}" max="${max}" step="1">`);

export function openTrialEquipmentEditor({root,member,kind,slot,current,catalog,data,weights={},weaponChoices,onApply,onStore,onClose,toast,purpose='trial',initialFilters={}}){
  const weapon=kind==='weapons',filters={search:'',rarity:'',stat:'',type:'',...initialFilters};let popup,choicePopup=null,page=1,composing=false;
  const first=weapon?weaponChoices(filters)[0]?.[0]:null;
  let item=weapon?structuredClone(current??{key:first,level:purpose==='inventory'?1:catalog.weapons[first]?.rarity<3?70:90,ascension:purpose==='inventory'?0:catalog.weapons[first]?.rarity<3?4:6,refinement:1,location:'',lock:false}):null;
  const set=weapon?null:Object.keys(catalog.sets).find(k=>data.art.data[k]?.slots.includes(slot)&&data.art.data[k]?.rarities.includes(5))??Object.keys(catalog.sets).find(k=>data.art.data[k]?.slots.includes(slot));
  const rarity=weapon?0:Math.max(...data.art.data[set].rarities);
  const editor=weapon?null:createArtifactEditor(current??{setKey:set,slotKey:slot,rarity,level:artifactMaxLevel(rarity),mainStatKey:MAIN_STATS[slot][0],substats:[],location:'',lock:false},data,{name:''});
  function artifactHTML(){
    // 复用次数 / 数值编辑器；此窗口使用独立事件前缀，只有写入试算的按钮。
    const base=customArtifactHTML(editor,data,catalog,weights),footer=base.lastIndexOf('<div class="ae-inline-actions">');
    return (base.slice(0,footer)+`<p class="ae-muted" data-trial-live-preview></p><div class="ae-inline-actions"><button class="subtle-action" data-native="apply-trial">用于队伍试算</button>${onStore?'<button class="subtle-action" data-native="store-custom">存入自定义库存</button>':''}<button class="subtle-action" data-native="cancel-trial">取消</button></div></section>`)
      .replace('<select data-custom-field="slotKey">','<select data-custom-field="slotKey" disabled>')
      .replaceAll('可写入实际库存','可用于队伍试算').replaceAll('data-custom-','data-trial-custom-').replaceAll('data-native=','data-trial-action=');
  }
  function weaponHTML(){
    return `<div class="ae-fields ae-filter-fields">${field('搜索武器',`<input type="search" data-trial-filter="search" value="${esc(filters.search)}" placeholder="武器名称或关键词">`)}${filterButtonsHTML('星级',[['','全部'],...[5,4,3,2,1].map(n=>[n,n+' 星'])],filters.rarity,'data-trial-filter="rarity"')}${filterButtonsHTML('副属性',[['','全部'],...Object.entries(STAT_NAMES).filter(([k])=>Object.values(data.weapon.data).some(w=>w.subStat?.type===k)),['none','无副属性']],filters.stat,'data-trial-filter="stat"')}</div>${purpose==='inventory'?filterButtonsHTML('武器类型',[['','全部'],['sword','单手剑'],['claymore','双手剑'],['polearm','长柄武器'],['bow','弓'],['catalyst','法器']],filters.type,'data-trial-filter="type"'):''}<div data-trial-weapon-choices></div><div class="ae-trial-weapon-settings"><h3>${esc(catalog.weapons[item.key]?.name??'请选择武器')}</h3><div class="ae-fields">${number('等级','level',item.level,1,catalog.weapons[item.key]?.rarity<3?70:90)}${field('突破',`<select data-trial-weapon="ascension">${Array.from({length:catalog.weapons[item.key]?.rarity<3?5:7},(_,n)=>opt(n,n+' 阶',item.ascension)).join('')}</select>`)}${number('精炼','refinement',item.refinement,1,5)}</div><p class="ae-muted" data-trial-live-preview></p><div class="ae-inline-actions"><button class="subtle-action" data-trial-action="apply-trial">${purpose==='inventory'?'加入自定义库存':'用于队伍试算'}</button>${onStore?'<button class="subtle-action" data-trial-action="store-custom">存入自定义库存</button>':''}<button class="subtle-action" data-trial-action="cancel-trial">取消</button></div></div>`;
  }
  function refreshWeaponChoices(){
    const choices=weaponChoices(filters),pages=Math.max(1,Math.ceil(choices.length/16));page=Math.min(page,pages);
    popup.dialog.querySelector('[data-trial-weapon-choices]').innerHTML=`<div class="ae-inventory-toolbar"><span>${choices.length} 把候选 · 第 ${page} / ${pages} 页</span><button class="subtle-action" data-trial-action="page" data-direction="-1" ${page<=1?'disabled':''}>上一页</button><button class="subtle-action" data-trial-action="page" data-direction="1" ${page>=pages?'disabled':''}>下一页</button></div><div class="ae-member-picker-candidates">${choices.slice((page-1)*16,page*16).map(([k,m])=>`<button class="ae-member-picker-choice ${k===item.key?'ae-member-picker-current':''}" data-trial-action="choose-weapon" data-key="${k}">${m.image?`<img class="ae-item-image" src="${esc(m.image)}" alt="" loading="lazy">`:''}<span><strong>${esc(m.name)}</strong><small>${m.rarity} 星 · ${STAT_NAMES[data.weapon.data[k]?.subStat?.type]??'无副属性'}</small></span></button>`).join('')||'<p class="ae-muted">没有匹配的武器，请调整筛选。</p>'}</div>`;
  }
  function preview(){
    const node=popup.dialog.querySelector('[data-trial-live-preview]');
    if(weapon){const values=weaponBaseStats(item,data),sub=data.weapon.data[item.key]?.subStat?.type;node.textContent=`基础攻击力 ${(values?.atk??0).toFixed(1)}${sub?' · '+STAT_NAMES[sub]+' '+(values?.[sub]??0).toFixed(1):''}`;}
    else{const r=inspectDraft(editor.draft,data);node.textContent=editor.mode==='rolls'?`已分配 ${r.total} 次 · 正常参考 ${r.expected} 次；本配置仅用于队伍试算。`:'直接使用填写的副词条数值，仅用于队伍试算。';}
  }
  function render(){popup.setHTML(weapon?weaponHTML():artifactHTML());if(weapon)refreshWeaponChoices();preview();}
  function edit(t){
    if(t.dataset.trialFilter){filters[t.dataset.trialFilter]=t.dataset.value??t.value;page=1;refreshWeaponChoices();refreshFilterButtons(popup.dialog,'data-trial-filter',filters);return;}
    if(t.type==='number'&&(t.value===''||!t.checkValidity()))return;
    if(t.dataset.trialWeapon){const k=t.dataset.trialWeapon;item[k]=Number(t.value);if(k==='level')item.ascension=[20,40,50,60,70,80,90].findIndex(n=>item.level<=n);if(k==='ascension')item.level=Math.max([1,20,40,50,60,70,80][item.ascension],Math.min(item.level,[20,40,50,60,70,80,90][item.ascension]));if(k==='refinement'||k==='level')preview();else render();return;}
    if(t.hasAttribute('data-trial-custom-name')){editor.name=t.value;return;}
    if(t.hasAttribute('data-trial-custom-value')||t.hasAttribute('data-trial-custom-value-key')){
      const i=Number(t.dataset.trialCustomValue??t.dataset.trialCustomValueKey);while(editor.values.substats.length<=i)editor.values.substats.push({key:'',value:0});
      editor.values.substats[i][t.hasAttribute('data-trial-custom-value')?'value':'key']=t.hasAttribute('data-trial-custom-value')?Number(t.value):t.value;editor.valuesChanged=true;
    }else if(t.dataset.trialCustomField||t.hasAttribute('data-trial-custom-line')||t.hasAttribute('data-trial-custom-count')){
      const d=editor.draft,k=t.dataset.trialCustomField;
      if(k){if(k==='slotKey')return;d[k]=['rarity','level','initialCount'].includes(k)?Number(t.value):t.value;if(k==='setKey'||k==='rarity'){const set=data.art.data[d.setKey];if(!set.rarities.includes(d.rarity))d.rarity=Math.max(...set.rarities);d.level=Math.min(d.level,artifactMaxLevel(d.rarity));if(!artifactInitialCounts(d.rarity).includes(d.initialCount))d.initialCount=artifactInitialCounts(d.rarity).at(-1);for(const l of d.lines)l.counts=substatTiers(data,d.rarity,l.key||'atk_').map((_,i)=>l.counts[i]??0);}for(const l of d.lines)if(l.key===d.mainStatKey){l.key='';l.counts=l.counts.map(()=>0);}}
      else if(t.hasAttribute('data-trial-custom-line')){const l=d.lines[Number(t.dataset.trialCustomLine)];l.key=t.value;l.counts=substatTiers(data,d.rarity,l.key||'atk_').map(()=>0);}
      else d.lines[Number(t.dataset.trialCustomCount)].counts[Number(t.dataset.tier)]=Number(t.value);
      if(editor.mode==='values'){for(const k of ['setKey','slotKey','rarity','level','mainStatKey'])editor.values[k]=d[k];editor.values.substats=editor.values.substats.filter(l=>l.key!==d.mainStatKey);editor.valuesChanged=true;}
      else{editor.countsChanged=true;if(t.hasAttribute('data-trial-custom-line')||t.hasAttribute('data-trial-custom-count'))editor.changedLines=[...new Set([...editor.changedLines,Number(t.dataset.trialCustomLine??t.dataset.trialCustomCount)])];}
    }else return;
    if(t.type==='number')preview();else render();
  }
  function action(button){
    const a=button.dataset.trialAction;
    if(a==='cancel-trial'){popup.close();return;}
    if(a==='choose-custom-set'){
      choicePopup?.close();choicePopup=openCatalogPicker({root,catalog,data,kind:'sets',slot:editor.draft.slotKey,selected:editor.draft.setKey,toast,onClose:()=>{choicePopup=null;},onChoose:value=>{const input=popup.dialog.querySelector('[data-trial-custom-field="setKey"]');input.value=value;return()=>edit(input);}});return;
    }
    if(a==='apply-trial'||a==='store-custom'){
      if([...popup.dialog.querySelectorAll('input[type=number]')].some(n=>n.value===''||!n.checkValidity()))throw Error('请填写完整且在允许范围内的数值。');
      const raw=weapon?structuredClone(item):artifactEditorSnapshot(editor,data).values;
      if(!weapon)raw.substats=raw.substats.filter(s=>s.key);
      const r=validateGOOD({format:'GOOD',version:3,[kind]:[raw]},data);if(r.errors.length)throw Error(r.errors[0]);
      const after=a==='store-custom'?onStore(raw):onApply(raw);popup.close();after?.();return;
    }
    if(a==='page'){page+=Number(button.dataset.direction);refreshWeaponChoices();return;}
    if(a==='choose-weapon'){const k=button.dataset.key;item={key:k,level:purpose==='inventory'?1:catalog.weapons[k].rarity<3?70:90,ascension:purpose==='inventory'?0:catalog.weapons[k].rarity<3?4:6,refinement:1,location:'',lock:false};render();return;}
    if(a==='artifact-mode')switchArtifactMode(editor,button.dataset.mode,data);
    else if(a==='custom-tier'){const i=Number(button.dataset.line),l=editor.draft.lines[i],total=l.counts.reduce((n,v)=>n+v,0);l.counts=l.counts.map((_,j)=>j===Number(button.dataset.tier)?total:0);editor.countsChanged=true;editor.changedLines=[...new Set([...editor.changedLines,i])];}
    else if(a==='custom-clear-line'){const i=Number(button.dataset.line);editor.draft.lines[i].counts.fill(0);editor.countsChanged=true;editor.changedLines=[...new Set([...editor.changedLines,i])];}
    else return;render();
  }
  const onEdit=event=>{try{edit(event.target);}catch(error){toast(error.message);}};
  popup=openAssessmentDialog({root,title:purpose==='inventory'?'添加自定义武器':catalog.characters[member].name+' · 自定义'+(weapon?'武器':SLOT_NAMES[slot]),subtitle:purpose==='inventory'?'先选择武器并填写养成数值，点击加入后保存到自定义库存。':onStore?'可用于队伍试算，或单独保存到自定义库存。':'仅用于队伍配装方案与伤害对比，不加入账号库存。',onClose:()=>{choicePopup?.close();onClose?.();},onChange:onEdit,onClick:event=>{const filter=event.target.closest('[data-trial-filter]');if(filter){onEdit({target:filter});return;}const button=event.target.closest('[data-trial-action]');if(!button||button.disabled)return;try{action(button);}catch(error){toast(error.message);}}});
  render();
  popup.dialog.addEventListener('input',event=>{event.stopPropagation();if(event.target.type==='search'&&(composing||event.isComposing))return;if(event.target.type==='number'||event.target.type==='search'||event.target.hasAttribute('data-trial-custom-name'))onEdit(event);});
  popup.dialog.addEventListener('compositionstart',event=>{event.stopPropagation();composing=true;});popup.dialog.addEventListener('compositionend',event=>{event.stopPropagation();composing=false;onEdit(event);});
  return popup;
}
