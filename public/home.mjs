import {GAMES} from '/shared/catalog.mjs';
import {gameMediaHTML} from './visual-assets.mjs';

const themes={
  genshin:{position:'50% center',accent:'#a9dfca'},
  starrail:{position:'61% center',accent:'#c9baf3'},
  zenless:{position:'52% center',accent:'#ffe0a4'}
};
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';

export function homeHTML(){
  const games=Object.entries(GAMES);
  return `<section class="home-stage" aria-label="游戏入口">
    <h1 class="visually-hidden">游戏百科</h1>
    <svg class="home-curve-defs" aria-hidden="true"><defs>${games.map(([game])=>`<clipPath id="home-curve-${game}" clipPathUnits="userSpaceOnUse"><path /></clipPath>`).join('')}</defs></svg>
    <div class="home-panels">${games.map(([game,info])=>`<article class="home-panel" data-home-game="${game}" aria-label="${info.short}" style="--home-position:${themes[game].position};--home-accent:${themes[game].accent}">
      <div class="home-visual-shell"><div class="home-visual" style="clip-path:url(#home-curve-${game})">${gameMediaHTML(game)}<div class="home-shade"></div></div></div>
      <a class="home-image-link" href="/?game=${game}" aria-label="进入${info.short}图鉴" style="clip-path:url(#home-curve-${game})"></a>
      <div class="home-panel-body"><div class="home-accent"></div><h2>${info.short}</h2><div class="home-actions"><a class="home-enter" href="/?game=${game}">进入图鉴${arrow}</a>${game==='genshin'?'<a class="home-assessment" href="/?game=genshin&screen=assessment">养成与评估</a>':''}</div></div>
    </article>`).join('')}</div>
    <div id="wiki-content-version" class="home-status" role="status" title="版本表示本地已收录条目的最高版本，不表示该版本全部内容均已收齐。">正在读取资料版本…</div>
  </section>`;
}

export function updateHomeStatus(label,status){
  const versions=document.createElement('div');versions.className='home-versions';
  for(const [game,info] of Object.entries(GAMES)){
    const item=document.createElement('span');item.textContent=`${info.short} ${status.versions?.[game]??'未标注'}`;versions.append(item);
  }
  const updated=document.createElement('span');updated.className='home-updated';
  updated.textContent=status.updatedDate?`资料更新 ${status.updatedDate}`:'';
  label.replaceChildren(versions,updated);
}

export function mountHome(host){
  const grid=host.querySelector('.home-panels'),panels=[...grid.children];
  const lifetime=new AbortController(),options={signal:lifetime.signal};
  let frame=0;
  const activate=panel=>{
    if(panel)grid.dataset.active=panel.dataset.homeGame;else delete grid.dataset.active;
    for(const item of panels)item.classList.toggle('is-active',item===panel);
  };
  const focusedPanel=()=>panels.find(panel=>panel.contains(document.activeElement));
  const paths=panels.map(panel=>host.querySelector(`#home-curve-${panel.dataset.homeGame} path`));
  const updateCurves=()=>{
    frame=0;if(!grid.isConnected)return;
    panels.forEach((panel,index)=>{
      const width=panel.getBoundingClientRect().width,height=panel.clientHeight,edge=width+84,bend=Math.min(70,Math.max(24,width*.12));
      const path=index===panels.length-1?`M0 0H${width+168}V${height}H0Z`:`M0 0H${edge}C${edge+bend} ${height*.28} ${edge+bend} ${height*.72} ${edge} ${height}H0Z`;
      paths[index].setAttribute('d',path);
    });
  };
  const observer=new ResizeObserver(()=>{if(!frame)frame=requestAnimationFrame(updateCurves);});
  for(const panel of panels){
    observer.observe(panel);
    panel.querySelector('img').draggable=false;
    panel.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')activate(panel);},options);
    panel.addEventListener('focusin',()=>activate(panel),options);
  }
  grid.addEventListener('pointerleave',()=>activate(focusedPanel()),options);
  grid.addEventListener('focusout',()=>queueMicrotask(()=>{
    if(!lifetime.signal.aborted&&!grid.contains(document.activeElement)&&!grid.matches(':hover'))activate(null);
  }),options);
  host.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(grid.contains(document.activeElement))document.activeElement.blur();
      activate(null);
    }
  },options);
  updateCurves();
  return ()=>{lifetime.abort();observer.disconnect();cancelAnimationFrame(frame);};
}
