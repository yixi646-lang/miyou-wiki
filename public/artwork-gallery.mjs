import {isLocalImage} from '/shared/asset-image.mjs';
import {facetLabel,rarityLabel} from '/shared/catalog.mjs';

let indexPromise;
let closeActivePreview;
const selectedVariants=new Map();
function savedVariant(entryId){
 if(selectedVariants.has(entryId))return selectedVariants.get(entryId);
 try{return localStorage.getItem('wiki-artwork-variant:'+entryId);}catch{return null;}
}
function saveVariant(entryId,key){
 selectedVariants.set(entryId,key);
 try{localStorage.setItem('wiki-artwork-variant:'+entryId,key);}catch{}
}
export function galleryVariants(entry,index,variants={}){
 const main=index[entry.id],choices=[],seen=new Set();
 if(isLocalImage(main)){choices.push(variants[entry.id]?.find(choice=>choice.image===main)??{key:'main',label:'主立绘',image:main});seen.add(main);}
 for(const choice of variants[entry.id]??[]){
  if(!isLocalImage(choice.image)||seen.has(choice.image)||choices.some(item=>item.key===choice.key))continue;
  choices.push(choice);seen.add(choice.image);
 }
 return choices;
}
export function showArtworkPreview(image,alt,trigger){
 if(!isLocalImage(image))return;
 closeActivePreview?.();
 const dialog=document.createElement('dialog'),picture=document.createElement('img');
 dialog.className='artwork-gallery-preview';dialog.setAttribute('aria-label','角色立绘大图');
 picture.src=image;picture.alt=alt;picture.decoding='async';dialog.append(picture);
 const previousOverflow=document.body.style.overflow;let closed=false;
 const close=()=>{
  if(closed)return;closed=true;
  picture.removeAttribute('src');if(dialog.open)dialog.close();dialog.remove();
  document.body.style.overflow=previousOverflow;window.removeEventListener('popstate',close);
  closeActivePreview=null;if(trigger.isConnected)trigger.focus({preventScroll:true});
 };
 closeActivePreview=close;
 dialog.addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',close);
 window.addEventListener('popstate',close,{once:true});
 document.body.append(dialog);document.body.style.overflow='hidden';
 try{dialog.showModal();}catch(error){close();throw error;}
}

export async function loadArtworkIndex(){
 if(!indexPromise)indexPromise=fetch('/character-artwork-index.json',{cache:'no-cache',signal:AbortSignal.timeout(20000)}).then(async response=>{
  if(!response.ok)throw Error('无法读取立绘目录，请刷新后重试。');
  const data=await response.json();
  return {images:data.images??{},variants:data.variants??{},entries:data.galleryEntries??[]};
 }).catch(error=>{indexPromise=null;throw error;});
 return indexPromise;
}

export function galleryEntries(entries,index,game,search='',filters={},variants={}){
 const terms=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const rarities=(filters.rarity??[]).map(String),elements=(filters.element??[]).map(String);
 return entries.filter(entry=>{
  if(entry.game!==game||entry.category!=='characters'||!isLocalImage(index[entry.id]))return false;
  if(filters.hasSkin?.includes('true')&&!galleryVariants(entry,index,variants).some(choice=>choice.type==='skin'))return false;
  if(rarities.length&&!rarities.includes(String(entry.rarity)))return false;
  if(elements.length&&!elements.includes(String(entry.element)))return false;
  const names=[entry.name,...entry.aliases??[]].join(' ').toLocaleLowerCase();
  return terms.every(term=>names.includes(term));
 }).sort((a,b)=>(b.releaseDate??'').localeCompare(a.releaseDate??'')||a.name.localeCompare(b.name,'zh-CN'));
}

export function galleryFiltersHTML(entries,index,game,filters,escape){
 const available=galleryEntries(entries,index,game);
 return ['rarity','element'].map(key=>{
  const selected=(filters[key]??[]).map(String);
  const values=[...new Set(available.map(entry=>String(entry[key]??'')).filter(Boolean))].sort((a,b)=>key==='rarity'?Number(b)-Number(a):a.localeCompare(b,'zh-CN'));
  const options=values.map(value=>`<button type="button" class="chip ${selected.includes(value)?'active':''}" data-action="facet" data-key="${key}" data-value="${escape(value)}" aria-pressed="${selected.includes(value)}">${escape(key==='rarity'?rarityLabel({game,rarity:Number(value)}):value)}</button>`).join('');
  return `<div class="artwork-gallery-filter-row"><span class="artwork-gallery-filter-label">${escape(facetLabel(key,game,'characters'))}</span><div class="artwork-gallery-filter-options"><button type="button" class="chip ${selected.length?'':'active'}" data-action="facet-clear" data-key="${key}" aria-pressed="${!selected.length}">全部</button>${options}</div></div>`;
 }).join('')+`<div class="artwork-gallery-filter-row"><span class="artwork-gallery-filter-label">皮肤</span><div class="artwork-gallery-filter-options"><button type="button" class="chip ${filters.hasSkin?.length?'':'active'}" data-action="facet-clear" data-key="hasSkin" aria-pressed="${!filters.hasSkin?.length}">全部</button><button type="button" class="chip ${filters.hasSkin?.includes('true')?'active':''}" data-action="facet" data-key="hasSkin" data-value="true" aria-pressed="${Boolean(filters.hasSkin?.includes('true'))}">有皮肤</button></div></div>`;
}

export function galleryCards(entries,index,escape,variants={},options={}){
 return entries.map(entry=>{
  const choices=galleryVariants(entry,index,variants),selected=choices.find(choice=>choice.key===(options.selected?.[entry.id]??savedVariant(entry.id)))??choices[0];
  if(!selected)return '';
  const alt=entry.name+' · '+selected.label;
  const buttons=choices.length>1?`<div class="artwork-gallery-choices" role="group" aria-label="${escape(entry.name)}立绘选择">${choices.map(choice=>`<button type="button" class="chip ${choice.key===selected.key?'active':''}" data-artwork-choice="${escape(choice.key)}" aria-pressed="${choice.key===selected.key}">${escape(choice.label)}</button>`).join('')}</div>`:'';
  const name=entry.galleryOnly?`<span>${escape(entry.name)}</span>`:`<a href="/?game=${entry.game}&entry=${encodeURIComponent(entry.id)}">${escape(entry.name)}</a>`;
  const tag=options.hrefFor?'a':'button',attributes=options.hrefFor?`href="${escape(options.hrefFor(entry,selected))}"`:'type="button"';
  return `<figure class="artwork-gallery-card" data-entry-id="${escape(entry.id)}"><${tag} ${attributes} class="artwork-gallery-image artwork-gallery-trigger" data-artwork="${escape(selected.image)}" aria-label="查看${escape(alt)}${options.hrefFor?'立绘':'大图'}"><img src="${escape(selected.image)}" alt="${escape(alt)}" loading="lazy" decoding="async"></${tag}><figcaption>${name}${buttons}</figcaption></figure>`;
 }).join('');
}

export function switchGalleryCard(button,entry,images,variants,{hrefFor}={}){
 const selected=entry&&galleryVariants(entry,images,variants).find(choice=>choice.key===button.dataset.artworkChoice);if(!selected)return;
 saveVariant(entry.id,selected.key);
 const card=button.closest('.artwork-gallery-card'),trigger=card.querySelector('.artwork-gallery-trigger'),picture=trigger.querySelector('img'),alt=entry.name+' · '+selected.label;
 picture.src=selected.image;picture.alt=alt;trigger.dataset.artwork=selected.image;trigger.setAttribute('aria-label','查看'+alt+(hrefFor?'立绘':'大图'));
 if(hrefFor)trigger.setAttribute('href',hrefFor(entry,selected));
 for(const choice of card.querySelectorAll('[data-artwork-choice]')){const active=choice.dataset.artworkChoice===selected.key;choice.classList.toggle('active',active);choice.setAttribute('aria-pressed',String(active));}
}

export async function mountArtworkGallery({host,entries,game,search,filters={},escape,gameName,footer='',artworkId='',variantKey=''}){
 host.innerHTML=`<div class="heading artwork-gallery-heading"><div><h1>角色立绘展示</h1><p>${escape(gameName)} · <span class="artwork-gallery-count">正在读取立绘…</span></p></div><div class="artwork-gallery-filters" aria-label="立绘筛选"></div></div><div class="artwork-gallery-root" data-game="${escape(game)}" aria-label="角色立绘"><div class="loading">正在读取立绘…</div></div>${footer}`;
 const root=host.querySelector('.artwork-gallery-root'),count=host.querySelector('.artwork-gallery-count'),filterArea=host.querySelector('.artwork-gallery-filters');
 let images={},variants={};
 let byId=new Map(entries.map(entry=>[entry.id,entry]));
 root.addEventListener('click',event=>{
  const choiceButton=event.target.closest('[data-artwork-choice]');
  if(choiceButton&&root.contains(choiceButton)){
   const card=choiceButton.closest('.artwork-gallery-card'),entry=byId.get(card.dataset.entryId);
   switchGalleryCard(choiceButton,entry,images,variants);
   return;
  }
  const trigger=event.target.closest('.artwork-gallery-trigger');
  if(trigger&&root.contains(trigger))showArtworkPreview(trigger.dataset.artwork,trigger.querySelector('img').alt,trigger);
 });
 try{
  const data=await loadArtworkIndex();if(!root.isConnected)return;
  images=data.images;variants=data.variants;
  const catalog=[...entries,...data.entries.filter(entry=>!byId.has(entry.id))];
  byId=new Map(catalog.map(entry=>[entry.id,entry]));
  const index=images;
  const linked=byId.get(artworkId);
  if(linked?.game===game&&galleryVariants(linked,index,variants).some(choice=>choice.key===variantKey))saveVariant(linked.id,variantKey);
  const shown=galleryEntries(catalog,index,game,search,filters,variants);
  filterArea.innerHTML=galleryFiltersHTML(catalog,index,game,filters,escape);
  const total=shown.reduce((sum,entry)=>sum+galleryVariants(entry,index,variants).length,0);
  count.textContent=`${shown.length} 个角色 · ${total} 张立绘`;
  const filtered=search||filters.rarity?.length||filters.element?.length;
  root.innerHTML=shown.length?`<div class="artwork-gallery-grid">${galleryCards(shown,index,escape,variants)}</div>`:`<div class="panel empty"><strong>${filtered?'没有匹配的角色':'暂无本地立绘'}</strong>${filtered?'<p>试试其他角色名称或调整筛选。</p>':''}</div>`;
 }catch(error){if(root.isConnected){count.textContent='加载失败';root.innerHTML=`<div class="panel empty"><p>${escape(error.message)}</p></div>`;}}
}
