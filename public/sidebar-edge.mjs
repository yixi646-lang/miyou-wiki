// 窄窗口自动隐藏的导航临时呼出；不改写用户的侧栏宽度或显示偏好。
export function installSidebarEdge({sidebar,edge,onClose}){
 const viewport=matchMedia('(max-width:1000px)');let timer;
 const eligible=()=>viewport.matches;
 const cancel=()=>clearTimeout(timer);
 const close=()=>{cancel();sidebar.classList.remove('edge-open');edge.setAttribute('aria-expanded','false');};
 const open=()=>{if(!eligible())return;cancel();sidebar.classList.add('edge-open');edge.setAttribute('aria-expanded','true');};
 const schedule=()=>{cancel();timer=setTimeout(()=>{if(!sidebar.matches(':hover')&&!sidebar.contains(document.activeElement))close();},180);};
 const sync=()=>{edge.hidden=!eligible();if(!eligible())close();};
 edge.addEventListener('pointerenter',open);edge.addEventListener('focus',open);edge.addEventListener('click',open);edge.addEventListener('pointerleave',schedule);
 sidebar.addEventListener('pointerenter',cancel);sidebar.addEventListener('pointerleave',schedule);
 sidebar.addEventListener('focusin',cancel);sidebar.addEventListener('focusout',schedule);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('edge-open')){close();onClose?.();}});
 viewport.addEventListener('change',sync);sync();
 return close;
}
