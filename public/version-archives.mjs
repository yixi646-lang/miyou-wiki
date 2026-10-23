import {VERSION_SECTIONS,selectVersions,returneeChanges,versionAssociations} from '/shared/version-archive.mjs';
import {withBannerSchedules} from '/shared/banner-schedule.mjs';
import {groupBannerPeriods,bannerHistoryLayout} from '/shared/banner-history.mjs';
import {bannerPeriodHTML} from './banner-history.mjs';
import {isLocalImage} from '/shared/asset-image.mjs';
import {loadArtworkIndex} from './artwork-gallery.mjs';
import {columnOptions,layoutSetting,gridLayout} from './responsive-layout.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
const searchRequests=new Map();
export async function loadVersionArchive(game){
 if(cache.has(game))return cache.get(game);
 if(!searchRequests.has(game))searchRequests.set(game,load(game).finally(()=>searchRequests.delete(game)));
 return searchRequests.get(game);
}
const selectedDetailTabs=new Map();
const href=(game,version='',options={})=>{const q=new URLSearchParams({game,screen:'versions'});if(version)q.set('version',version);for(const [k,v] of Object.entries(options))if(v)q.set(k,v);return '/?'+q;};
const entryHref=e=>`/?game=${e.game}&entry=${encodeURIComponent(e.id)}`;
const labels={'official-notes':'官方更新说明','official-overview':'官方预告 + 社区索引','launch-index':'开服内容索引'};
async function load(game){
 const response=await fetch(`/api/versions/${game}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('版本档案暂时无法读取，请重新启动 Wiki 后重试');
 const data=await response.json();cache.set(game,data);return data;
}
function outfitArtworks(item,game,index,entries){
 if(!index)return [];
 const title=String(item.name??'').trim(),quoted=[...title.matchAll(/[「『“"\[]([^」』”"\]]+)[」』”"\]]/g)].map(match=>match[1]);
 const characters=[...new Map([...entries,...index.entries??[]].filter(entry=>entry.game===game&&entry.category==='characters').map(entry=>[entry.id,entry])).values()];
 const owner=characters.find(entry=>['——','—','-','·'].some(mark=>title.startsWith(entry.name+mark)));
 const matches=[];
 for(const entry of characters){
  if(owner&&entry.id!==owner.id)continue;
  for(const choice of index.variants?.[entry.id]??[]){
   if(choice.type!=='skin'||!isLocalImage(choice.image))continue;
   const name=String(choice.label??'').replace(/^皮肤[·:：]\s*/,''),base=name.split('·')[0];
   const names=[name,base],matched=names.find(name=>quoted.length?quoted.includes(name):title===name||title.endsWith('·'+name)||title.endsWith(' · '+name));
   if(matched)matches.push({...choice,entryId:entry.id,alt:entry.name+' · '+name,variant:name===matched?'':name.slice(matched.length).replace(/^·/,'')});
  }
 }
 if(!owner&&new Set(matches.map(choice=>choice.entryId)).size>1)return [];
 return [...new Map(matches.map(choice=>[choice.image,choice])).values()];
}
function itemHTML(item,artworks){
 const attributes=[...(item.explanation?[`<p class="version-explanation">${escape(item.explanation)}</p>`]:[]),...(item.times??[]).map(t=>`<div class="version-fact"><b>时间</b><span>${escape(t)}</span></div>`),...(item.requirements??[]).map(t=>`<div class="version-fact"><b>条件</b><span>${escape(t)}</span></div>`),...(item.facts??[]).map(t=>`<p>${escape(t)}</p>`)];
 if(item.values?.length)attributes.push(`<div class="version-fact"><b>公告数值</b><span>${escape(item.values.join(' · '))}</span></div>`);
 if(item.changes?.length)attributes.push(`<div class="version-fact"><b>调整值</b><span>${escape(item.changes.join(' · '))}</span></div>`);
 if(item.issueCount)attributes.push(`<p>公告列出 ${item.issueCount} 项修复${item.targets?.length?'，涉及：'+escape(item.targets.join(' / ')):''}。具体问题与修复条件以对应公告为准。</p>`);
 const artworkImages=Array.isArray(artworks)&&artworks.length?`<div class="version-outfit-artworks">${artworks.map(choice=>`<figure><img src="${escape(choice.image)}" alt="${escape(choice.alt)}" loading="lazy" decoding="async">${artworks.length>1?`<figcaption>${escape(choice.variant||choice.label.replace(/^皮肤·/,''))}</figcaption>`:''}</figure>`).join('')}</div>`:'';
 return `<article class="version-fact-card"><div class="version-item-title"><strong>${escape(item.name)}</strong>${item.availability?`<span class="tag">${item.availability==='permanent'?'永久开放':item.availability==='limited'?'限时内容':''}</span>`:''}</div>${item.group?`<small class="version-item-group">${escape(item.group)}</small>`:''}${item.sourceKind==='community'?'<small class="version-item-group">开服主要内容</small>':''}${attributes.join('')}${artworkImages}</article>`;
}
function sectionHTML(section,game,heading=false,artworkIndex=null,entries=[]){
 const key=`wiki-version-columns:${game}:${section.key}`;
 return `<section class="version-section version-tab-section" id="version-${section.key}">${heading?`<div class="version-section-header"><h3>${escape(section.label)}</h3></div>`:''}<div class="version-section-body"><div class="version-section-tools"><span class="version-item-count">${section.items.length} 项</span><label>每行 <select data-layout-key="${key}" aria-label="${escape(section.label)}每行数量">${columnOptions(layoutSetting(key),4)}</select></label></div>${section.key==='outfits'&&artworkIndex?.error?'<p class="version-note">立绘暂时无法读取，请刷新后重试。</p>':''}<div class="version-facts-grid" ${gridLayout(key,2,{max:4,minCell:270})}>${section.items.map(item=>itemHTML(item,section.key==='outfits'?outfitArtworks(item,game,artworkIndex,entries):[])).join('')}</div></div></section>`;
}
function associatedHTML(association){
 const cards=items=>items.map(e=>`<a class="version-entity" href="${entryHref(e)}">${e.image?`<img src="${escape(e.image)}" loading="lazy" alt="">`:''}<span>${escape(e.name)}<small>${escape([e.element,e.type].filter(Boolean).join(' · '))}${e.releaseDate?' · 首次可获取 '+escape(e.releaseDate):''}</small></span></a>`).join('');
 return [['characters','已收录新增角色'],['equipment','已收录新增装备与套装']].filter(([key])=>association[key].length).map(([key,label])=>`<section class="version-overview-section" id="version-linked-${key}"><div class="version-section-header"><h3>${label}</h3><small>${association[key].length} 条</small></div><div class="version-section-body version-linked-grid">${cards(association[key])}</div></section>`).join('');
}
function bannerHTML(banners,game,entries){
 if(!banners.length)return '<p class="version-note">当前资料库没有该版本的卡池记录。</p>';
 const periods=groupBannerPeriods(banners),policy=bannerHistoryLayout(banners),key=`wiki-version-columns:${game}:${policy.scope}`;
 const context={entries:new Map(entries.map(entry=>[`${entry.game}:${entry.id}`,entry])),escape,href:entryHref,asOf:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})};
 return `<div class="version-section-tools"><span class="version-item-count">共 ${banners.length} 个卡池 · ${periods.length} 组安排</span><label>每行 <select data-layout-key="${key}" aria-label="卡池安排每行数量">${columnOptions(layoutSetting(key),2)}</select></label></div><div class="banner-history-grid version-banner-history" ${gridLayout(key,policy.base,{max:2,minCell:600})}>${periods.map(period=>bannerPeriodHTML(period,context)).join('')}</div>`;
}
function detailHTML(data,v,game,entries,listOptions,artworkIndex=null){
 const scheduledEntries=withBannerSchedules(entries),association=versionAssociations(v.version,scheduledEntries,game),index=data.versions.indexOf(v),next=data.versions[index-1],prev=data.versions[index+1];
 const timing=v.maintenance??{};
 const overview=`<section class="version-overview-section" id="version-maintenance"><div class="version-section-header"><h3>版本更新安排</h3></div><div class="version-timing"><div><small>更新 / 开服日</small><strong>${escape(v.releaseDate??'尚未核实')}</strong></div>${timing.start?`<div><small>维护开始 · ${escape(timing.timeZone)}</small><strong>${escape(timing.start)}</strong></div>`:''}${timing.estimatedHours?`<div><small>公告预计维护时长</small><strong>${timing.estimatedHours} 小时</strong></div>`:''}${timing.end?`<div><small>公告明示版本结束 · UTC+8</small><strong>${escape(timing.end)}</strong></div>`:''}</div></section>${associatedHTML(association)}${v.sections.filter(s=>['characters','equipment'].includes(s.key)&&s.items.length).map(s=>sectionHTML(s,game,true)).join('')}`;
 const tabs=[{key:'overview',label:'版本概览',body:overview},
  {key:'banners',label:'卡池安排',body:`<div id="version-banners">${bannerHTML(association.banners,game,scheduledEntries)}<p class="version-note">按已收录的实际起止记录展示；上下半与多期分类沿用卡池判断依据。</p></div>`},
  ...v.sections.filter(s=>!['characters','equipment'].includes(s.key)&&s.items.length).map(s=>({key:s.key,label:s.label,body:sectionHTML(s,game,false,artworkIndex,entries)})),
  ...(v.gaps?.length?[{key:'gaps',label:'待补齐项',body:`<ul id="version-gaps" class="version-gap-list">${v.gaps.map(t=>`<li>${escape(t)}</li>`).join('')}</ul>`}]:[])];
 return `<div class="version-navigation"><a class="detail-back" href="${href(game,'',listOptions)}">← 返回版本档案</a><div>${prev?`<a href="${href(game,prev.version,listOptions)}">← ${escape(prev.alias??prev.version)}</a>`:''}${next?`<a href="${href(game,next.version,listOptions)}">${escape(next.alias??next.version)} →</a>`:''}</div></div><div class="version-detail"><article class="panel article version-detail-article"><div class="version-detail-head"><h1>${escape(v.title)}</h1><div class="meta"><span>${escape(v.version)} 版本${v.alias?' · '+escape(v.alias):''}</span><span>${escape(v.releaseDate??'上线日期待核查')}</span><span>${labels[v.coverage]??'版本资料'}</span></div></div><div class="version-detail-tabs" role="tablist" aria-label="版本详情栏目" data-disclosure-ignore>${tabs.map((tab,i)=>`<button type="button" class="version-detail-tab ${i?'':'active'}" role="tab" id="version-tab-${escape(tab.key)}" data-version-tab="${escape(tab.key)}" aria-controls="version-panel-${escape(tab.key)}" aria-selected="${!i}" tabindex="${i?-1:0}">${escape(tab.label)}</button>`).join('')}</div>${tabs.map((tab,i)=>`<section class="version-tab-panel" role="tabpanel" id="version-panel-${escape(tab.key)}" data-version-panel="${escape(tab.key)}" aria-labelledby="version-tab-${escape(tab.key)}" tabindex="0" ${i?'hidden':''}>${tab.body}</section>`).join('')}</article></div>`;
}
function bindVersionTabs(root,{game,version,hash=location.hash}){
 const buttons=[...root.querySelectorAll('[data-version-tab]')],panels=[...root.querySelectorAll('[data-version-panel]')];
 if(!buttons.length)return ()=>null;
 const memoryKey=`${game}:${version}`;
 function select(key,{focus=false,updateHash=false}={}){
  const selected=buttons.find(button=>button.dataset.versionTab===key);if(!selected)return false;
  for(const button of buttons){const active=button===selected;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  for(const panel of panels)panel.hidden=panel.dataset.versionPanel!==key;
  selectedDetailTabs.set(memoryKey,key);
  if(focus)selected.focus({preventScroll:true});
  if(updateHash)history.replaceState(history.state,'',`#${selected.getAttribute('aria-controls')}`);
  return true;
 }
 function reveal(anchor){
  let id;try{id=decodeURIComponent(String(anchor).replace(/^#/,''));}catch{return null;}
  const target=[...root.querySelectorAll('[id]')].find(element=>element.id===id),panel=target?.closest('[data-version-panel]');
  if(panel)select(panel.dataset.versionPanel);return panel?target:null;
 }
 const target=reveal(hash);
 if(!target&&!select(selectedDetailTabs.get(memoryKey)))select('overview');
 if(target)requestAnimationFrame(()=>{if(root.isConnected)target.scrollIntoView({block:'start'});});
 root.addEventListener('click',event=>{const button=event.target.closest('[data-version-tab]');if(button&&root.contains(button))select(button.dataset.versionTab,{updateHash:true});});
 root.addEventListener('keydown',event=>{
  const button=event.target.closest('[data-version-tab]');if(!button||!root.contains(button))return;
  const index=buttons.indexOf(button),next=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;
  if(next<0)return;event.preventDefault();select(buttons[next].dataset.versionTab,{focus:true,updateHash:true});
 });
 return reveal;
}
export function versionCardHTML(v,{game,entries=[],targetHref}={}){const linked=versionAssociations(v.version,entries,game);return `<a class="version-card" href="${targetHref??href(game,v.version)}"><div class="version-card-top"><strong>${escape(v.version)}</strong>${v.alias?`<span>${escape(v.alias)}</span>`:''}<time>${escape(v.releaseDate??'日期待核查')}</time></div><h2>${escape(v.title)}</h2><div class="version-card-tags">${v.sections.filter(section=>!['characters','equipment','fixes','collection','enemies'].includes(section.key)).map(section=>`<span>${escape(section.label)}</span>`).join('')}</div><div class="version-card-meta">${linked.characters.length} 角色 · ${linked.equipment.length} 装备 / 套装 · ${linked.banners.length} 卡池记录</div><small>${labels[v.coverage]}${v.gaps?.length?' · 有待补齐项':''}</small></a>`;}
function listHTML(data,game,gameName,entries,s){
 const options={search:s.search,major:s.archiveMajor,section:s.archiveSection,direction:s.direction,since:s.since,until:s.until};
 const selected=selectVersions(data.versions,options),majors=[...new Set(data.versions.map(v=>v.version.split('.')[0]))],keys=Object.keys(VERSION_SECTIONS).filter(k=>data.versions.some(v=>v.sections.some(section=>section.key===k)));
 const key=`wiki-version-columns:${game}:index`,notes=data.versions.filter(v=>v.coverage==='official-notes').length;
 const cards=selected.map(v=>versionCardHTML(v,{game,entries,targetHref:href(game,v.version,{q:s.search,major:s.archiveMajor,topic:s.archiveSection,direction:s.direction==='asc'?'asc':'',since:s.since,until:s.until})})).join('');
 const versionOptions=(value,empty)=>`<option value="">${empty}</option>`+data.versions.map(v=>`<option value="${v.version}" ${value===v.version?'selected':''}>${escape(v.alias?v.alias+'（'+v.version+'）':v.version)} · ${escape(v.title)}</option>`).join('');
 const returnees=s.since&&s.until?returneeChanges(data.versions,s.since,s.until):null;
 return `<div class="heading version-index-heading"><div><h1>版本档案</h1></div><div class="version-overview"><div><b>${data.versions.length}</b><span>历史版本</span></div><div><b>${notes}</b><span>有官方更新说明</span></div><div><b>${data.versions.filter(v=>v.gaps?.length).length}</b><span>有明确待补齐项</span></div></div></div><div class="panel version-index-panel"><div class="version-filters" data-disclosure-ignore><label>大版本 <select id="archive-major"><option value="">全部</option>${majors.map(m=>`<option value="${m}" ${s.archiveMajor===m?'selected':''}>${m}.x${game==='genshin'&&m==='6'?' / 月之系列':''}</option>`).join('')}</select></label><label>内容 <select id="archive-topic"><option value="">全部内容</option>${keys.map(k=>`<option value="${k}" ${s.archiveSection===k?'selected':''}>${VERSION_SECTIONS[k]}</option>`).join('')}</select></label><label>排序 <select id="archive-direction"><option value="desc" ${s.direction!=='asc'?'selected':''}>最新在前</option><option value="asc" ${s.direction==='asc'?'selected':''}>最早在前</option></select></label><label>每行 <select data-layout-key="${key}" aria-label="版本档案每行数量">${columnOptions(layoutSetting(key),5)}</select></label><span class="version-result-count">${selected.length} / ${data.versions.length} 个版本</span></div><div class="version-returnee-controls" data-disclosure-ignore><strong>回坑补课</strong><label>上次玩到 <select id="archive-since" aria-label="上次玩到的版本">${versionOptions(s.since,'选择版本')}</select></label><label>查看到 <select id="archive-until" aria-label="回坑查看到的版本">${versionOptions(s.until,'选择版本')}</select></label>${s.since||s.until?'<button type="button" id="archive-reset-range" class="subtle-action">清空范围</button>':''}</div>${returnees?`<div class="version-returnee"><div class="version-returnee-heading"><h2>${escape(s.since)} 之后 → ${escape(s.until)}</h2><div data-page-fold-target></div></div>${returnees.length?returnees.map(v=>`<details open class="version-section"><summary><span>${escape(v.alias??v.version)} · ${escape(v.title)}</span><small>${v.sections.reduce((n,s)=>n+s.items.length,0)} 项</small></summary><div class="version-section-body"><a href="${href(game,v.version)}">查看完整版本档案 ↗</a>${v.sections.map(section=>`<h3>${escape(section.label)}</h3><div class="version-facts-grid">${section.items.map(itemHTML).join('')}</div>`).join('')}</div></details>`).join(''):'<p class="version-note">此范围没有提取到明确永久开放的新增内容。若起止顺序相反，请调整选择。</p>'}</div>`:''}<div class="version-card-grid" ${gridLayout(key,3,{max:5,minCell:280})}>${cards||'<p class="empty">没有符合条件的版本，试试其他关键词或内容筛选。</p>'}</div></div>`;
}
export async function mountVersionArchives({host,game,gameName,entries,state,navigate}){
 const marker=document.createElement('div');marker.className='version-archive-root';marker.innerHTML='<p class="panel empty">正在读取版本档案…</p>';host.replaceChildren(marker);
 try{
  const data=await load(game);if(!marker.isConnected)return;
  const v=state.archiveVersion?data.versions.find(v=>v.version===state.archiveVersion):null;
  const artworkIndex=v?.sections.some(section=>section.key==='outfits'&&section.items.length)?await loadArtworkIndex().catch(error=>({error:error.message})):null;
  if(!marker.isConnected)return;
  marker.innerHTML=state.archiveVersion?(v?detailHTML(data,v,game,entries,{q:state.search,major:state.archiveMajor,topic:state.archiveSection,direction:state.direction==='asc'?'asc':'',since:state.since,until:state.until},artworkIndex):`<div class="panel empty"><strong>未收录 ${escape(state.archiveVersion)} 版本</strong><p><a href="${href(game)}">返回版本档案</a></p></div>`):listHTML(data,game,gameName,entries,state);
  const reveal=v?bindVersionTabs(marker,{game,version:v.version}):()=>null;
  marker.addEventListener('click',event=>{const link=event.target.closest('a[href^="#version-"]');if(!link)return;const target=reveal(link.getAttribute('href'));if(!target)return;event.preventDefault();history.replaceState(history.state,'',link.href);target.scrollIntoView({block:'start'});});
  marker.addEventListener('change',event=>{const fields={'archive-major':'archiveMajor','archive-topic':'archiveSection','archive-direction':'direction','archive-since':'since','archive-until':'until'},field=fields[event.target.id];if(!field)return;const patch={[field]:event.target.value};if(field==='since'&&!state.until)patch.until=data.versions[0].version;navigate(patch,{scroll:false});});
  marker.querySelector('#archive-reset-range')?.addEventListener('click',()=>navigate({since:'',until:''},{scroll:false}));
 }catch(error){if(marker.isConnected)marker.innerHTML=`<div class="panel empty"><strong>版本档案读取失败</strong><p>${escape(error.message)}</p></div>`;}
}
export async function mountVersionSources(host,game){
 try{const data=cache.get(game)??await load(game);if(!host.isConnected)return;
  host.innerHTML=`<label class="entry-source-search">版本 <select aria-label="查看版本来源">${data.versions.map(v=>`<option value="${v.version}">${escape(v.alias??v.version)} · ${escape(v.title)}</option>`).join('')}</select></label><div class="version-source-content"></div><p class="version-note">档案位于 data/versions；压缩原始快照位于 data/sources/version-archive。条目备份不包含这些工作区文件，完整迁移请一并保留。</p>`;
  const show=()=>{const v=data.versions.find(v=>v.version===host.querySelector('select').value);host.querySelector('.version-source-content').innerHTML=`<ul class="source-list source-compact">${v.sourceRefs.map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)} ↗</a><small>${escape(s.language==='zh-tw'?'官方繁体原文 · 档案转简体':s.language==='zh-cn'?'官方简体资料':'英语社区版本索引')}${s.revision?' · 修订 '+s.revision:''}${s.sourceUpdatedAt?' · 来源修订时间 '+escape(s.sourceUpdatedAt):''}</small><code>${escape(s.snapshot)}</code></li>`).join('')}</ul><p class="version-note">${escape(v.dateBasis)}${v.gaps?.length?' · '+escape(v.gaps.join('；')):''}</p>`;};host.querySelector('select').addEventListener('change',show);show();
 }catch(error){if(host.isConnected)host.textContent=error.message;}
}
