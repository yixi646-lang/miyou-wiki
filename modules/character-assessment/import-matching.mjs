import {SLOT_NAMES,STAT_NAMES,statDisplay} from './core/model.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyOf=match=>`${match.kind}:${match.incomingIndex}`;
const labels={update:'更新旧件',new:'保留为新件',skip:'本次跳过'};
const pageSize=8;
export function importMatchDecision(match,action,targetIndex){
  if(!['update','new','skip'].includes(action))throw Error('装备处理方式不正确。');
  const decision={kind:match.kind,incomingIndex:match.incomingIndex,fingerprint:match.fingerprint,action};
  if(action==='update'){
    const candidate=match.candidates.find(c=>c.targetIndex===targetIndex&&!c.claimed);
    if(!candidate)throw Error('请选择尚未使用的旧装备。');
    Object.assign(decision,{targetIndex,targetFingerprint:candidate.fingerprint});
  }
  return decision;
}
export function chooseImportMatch(pending,preview,{kind,incomingIndex,action,targetIndex}){
  const match=preview.matches.find(m=>m.kind===kind&&m.incomingIndex===incomingIndex);if(!match)throw Error('导入预览已变化，请重新选择。');
  const decision=importMatchDecision(match,action,targetIndex);
  pending.decisions=(pending.decisions??[]).filter(d=>d.kind!==kind||d.incomingIndex!==incomingIndex);pending.decisions.push(decision);
}
function rowsFor(kind,before,after,data){
  if(kind==='weapons')return [['等级',before?.level??'—',after.level],['突破阶段',before?.ascension??'—',after.ascension],['精炼',before?.refinement??'—',after.refinement]];
  const main=item=>item?`${STAT_NAMES[item.mainStatKey]} ${statDisplay((data.art.main[item.rarity]?.[item.mainStatKey]?.[item.level]??0)*(item.mainStatKey.endsWith('_')?100:1),item.mainStatKey)}`:'—';
  const keys=[...new Set([...(before?.substats??[]),...after.substats].filter(s=>s.key).map(s=>s.key))];
  return [['强化等级',before?`+${before.level}`:'—',`+${after.level}`],['主属性',main(before),main(after)],...keys.map(key=>{
    const value=item=>{const s=item?.substats.find(s=>s.key===key);return s?statDisplay(s.value,key):'—';};return [STAT_NAMES[key],value(before),value(after)];
  })];
}
export function importMatchingHTML(preview,pending,catalog,data){
  if(!preview?.matches?.length)return '';
  const total=preview.matches.length,pages=Math.ceil(total/pageSize),page=Math.max(0,Math.min(pages-1,pending.matchPage??0));pending.matchPage=page;
  const owner=item=>item?.location?(catalog.characters[item.location]?.name??item.location):'未装备';
  return `<section class="ae-import-matching" aria-label="疑似装备确认"><div class="ae-import-match-toolbar"><h4>可能是同一件装备 · 待确认 ${preview.unresolved} / ${total}</h4>${preview.unresolved?'<button class="subtle-action" data-import-match-new-all>其余全部保留为新件</button>':''}</div>
    <div class="ae-import-match-list">${preview.matches.slice(page*pageSize,(page+1)*pageSize).map(match=>{
      const key=keyOf(match),selected=match.decision?.action==='update'?match.decision.targetIndex:pending.matchTargets?.[key]??match.candidates.find(c=>!c.claimed)?.targetIndex;
      const candidate=match.candidates.find(c=>c.targetIndex===selected),old=candidate?.item,name=match.kind==='weapons'?(catalog.weapons[match.item.key]?.name??match.item.key):`${catalog.sets[match.item.setKey]?.name??match.item.setKey} · ${SLOT_NAMES[match.item.slotKey]}`;
      const attrs=`data-import-match-kind="${match.kind}" data-import-match-index="${match.incomingIndex}"`,action=match.decision?.action;
      return `<article class="ae-import-match" data-import-match="${key}"><div class="ae-import-match-title"><strong>${escape(name)} · ${match.kind==='weapons'?'武器':'圣遗物'}第 ${match.incomingIndex+1} 件</strong><span>${action?labels[action]:'待确认'}</span></div>
        <div class="ae-import-match-columns"><div><span class="ae-muted">本次导入</span><p>${escape(name)}${match.kind==='artifacts'?` · ${match.item.rarity}星`:''}</p><p>装备角色：${escape(owner(match.item))}</p></div><label class="ae-field"><span>可能对应的旧装备（${match.candidates.length} 件）</span><select data-import-match-target ${attrs} aria-label="选择旧装备">${match.candidates.map(c=>`<option value="${c.targetIndex}" ${c.targetIndex===selected?'selected':''} ${c.claimed?'disabled':''}>旧件 ${c.targetIndex+1} · ${match.kind==='artifacts'?'+':''}${c.item.level}${match.kind==='weapons'?`级 · 精炼${c.item.refinement}`:''} · ${escape(owner(c.item))}${c.claimed?' · 已被其他项选用':''}</option>`).join('')}</select>${candidate?`<small>${escape(candidate.reason)}</small>`:''}</label></div>
        <div class="ae-table-wrap"><table class="ae-table ae-import-match-table"><thead><tr><th>属性</th><th>旧装备</th><th>本次导入</th></tr></thead><tbody>${[...rowsFor(match.kind,old,match.item,data),['装备角色',old?owner(old):'—',owner(match.item)],['锁定状态',old?(old.lock?'已锁定':'未锁定'):'—',match.item.lock?'已锁定':'未锁定']].map(([label,a,b])=>`<tr${String(a)!==String(b)?' class="is-changed"':''}><th>${escape(label)}</th><td>${escape(a)}</td><td>${escape(b)}</td></tr>`).join('')}</tbody></table></div>
        <div class="ae-inline-actions"><button class="subtle-action" data-import-match-action="update" ${attrs} aria-pressed="${action==='update'}" ${!candidate||candidate.claimed?'disabled':''}>更新这件旧装备</button><button class="subtle-action" data-import-match-action="new" ${attrs} aria-pressed="${action==='new'}">作为新装备保留两件</button><button class="subtle-action" data-import-match-action="skip" ${attrs} aria-pressed="${action==='skip'}">本次跳过</button></div></article>`;
    }).join('')}</div>${pages>1?`<div class="ae-inline-actions ae-import-match-pages"><button class="subtle-action" data-import-match-page="${page-1}" ${page===0?'disabled':''}>上一页</button><span>${page+1} / ${pages}</span><button class="subtle-action" data-import-match-page="${page+1}" ${page===pages-1?'disabled':''}>下一页</button></div>`:''}</section>`;
}
