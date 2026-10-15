import {preferredColumns,normalizeColumnSetting} from '../shared/column-layout.mjs';

const sessionSettings=new Map();
export function layoutSetting(key){if(sessionSettings.has(key))return sessionSettings.get(key);try{return normalizeColumnSetting(localStorage.getItem(key));}catch{return 'auto';}}
export function saveLayoutSetting(key,value){const setting=normalizeColumnSetting(value);sessionSettings.set(key,setting);try{localStorage.setItem(key,setting);}catch{}return setting;}
export function columnOptions(setting,max=6){return `<option value="auto" ${setting==='auto'?'selected':''}>自动</option>`+Array.from({length:max},(_,i)=>i+1).map(n=>`<option value="${n}" ${String(n)===String(setting)?'selected':''}>${n} 个</option>`).join('');}
export function gridLayout(key,base,{max=6,minCell=190,variable='columns',reference='catalog'}={}){
 return `data-responsive-columns data-layout-key="${key}" data-column-base="${base}" data-column-max="${max}" data-column-min="${minCell}" data-column-var="${variable}" data-column-reference="${reference}"`;
}

// 以此电脑全屏的可用宽度作基准；窗口、边栏变化只重算展示，不改手动偏好。
export function installResponsiveLayout(host){
 let calibration;try{calibration=JSON.parse(localStorage.getItem('wiki-layout-reference-v3')??'null');}catch{}
 if(!Number.isFinite(calibration?.catalog)||calibration.catalog<=0||!Number.isFinite(calibration?.basic)||calibration.basic<=0){
  const style=getComputedStyle(host),sidebar=document.querySelector('#sidebar');
  const sidebarWidth=document.documentElement.dataset.sidebar==='wide'?sidebar?.getBoundingClientRect().width??228:228;
  const padding=Math.max(64,(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0));
  const full=(screen.availWidth||window.innerWidth)-sidebarWidth-padding-16;
  calibration={catalog:Math.max(600,full-28),basic:Math.max(400,full-296)};
  try{localStorage.setItem('wiki-layout-reference-v3',JSON.stringify(calibration));}catch{}
 }
 const observed=new Set();
 function update(grid){
  if(!host.contains(grid))return;
  const d=grid.dataset,style=getComputedStyle(grid),width=grid.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0);
  if(width<=0)return;
  const setting=layoutSetting(d.layoutKey);
  const policy={base:Number(d.columnBase),reference:calibration[d.columnReference],minCell:Number(d.columnMin),max:Number(d.columnMax)};
  const n=preferredColumns(width,{...policy,preferred:setting}),automatic=preferredColumns(width,policy);
  grid.style.setProperty('--'+d.columnVar,n);grid.dataset.columns=String(n);
  // 由同一个控制器确定最终网格，避免历史媒体查询覆盖用户选择。
  grid.style.setProperty('grid-template-columns',`repeat(${n}, minmax(0, 1fr))`,'important');
  for(const control of host.querySelectorAll('select[data-layout-key]')){
   if(control.dataset.layoutKey!==d.layoutKey)continue;
   const option=control.querySelector('option[value=auto]'),label=`自动（${automatic} 个）`;
   if(option&&option.textContent!==label)option.textContent=label;
  }
 }
 const resize=new ResizeObserver(entries=>entries.forEach(({target})=>update(target)));
 function sync(){
  for(const grid of observed)if(!host.contains(grid)){resize.unobserve(grid);observed.delete(grid);}
  for(const grid of host.querySelectorAll('[data-responsive-columns]')){if(!observed.has(grid)){observed.add(grid);resize.observe(grid);}update(grid);}
 }
 const change=event=>{
  const control=event.target;if(!control.matches('select[data-layout-key]'))return;
  saveLayoutSetting(control.dataset.layoutKey,control.value);
  for(const grid of observed)if(grid.dataset.layoutKey===control.dataset.layoutKey)update(grid);
 };
 host.addEventListener('change',change);
 const mutation=new MutationObserver(sync);mutation.observe(host,{childList:true,subtree:true});sync();
 return ()=>{resize.disconnect();mutation.disconnect();host.removeEventListener('change',change);observed.clear();};
}
