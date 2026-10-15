import {createViewMemory} from '../shared/view-state.mjs';

export function pageKey(href,game='genshin'){
  const url=new URL(href,'http://wiki.local'),q=url.searchParams;
  if(!q.size)return 'home';
  game=q.get('game')??game;
  if(q.has('entry'))return game+':entry:'+q.get('entry');
  const screen=q.get('screen')??'list';
  return game+':'+screen+(['list','favorites'].includes(screen)?':'+(q.get('category')??(screen==='favorites'?'all':'characters')):'');
}
export function installScrollStability({window,host}){
  const minimum=host.style.minHeight,baseline=window.getComputedStyle(host).minHeight;
  host.style.minHeight=`max(${baseline==='auto'?'0px':baseline}, var(--wiki-viewport-floor, 0px))`;
  const prepare=(position={top:window.scrollY??0})=>{
    const top=host.getBoundingClientRect().top+(window.scrollY??0);
    host.style.setProperty('--wiki-viewport-floor',Math.max(0,(Number(position.top)||0)+window.innerHeight-top)+'px');
  };
  const sync=()=>prepare(),events=['scroll','resize','pointerdown','click','keydown','change'];
  for(const event of events)window.addEventListener(event,sync,{capture:true,passive:true});
  prepare();
  return {prepare,dispose(){for(const event of events)window.removeEventListener(event,sync,true);host.style.minHeight=minimum;host.style.removeProperty('--wiki-viewport-floor');}};
}
export function createPageMemory({window,storage=()=>globalThis.sessionStorage,prepareScroll=()=>{}}={}){
  const viewport=createViewMemory('wiki.current-viewport.v1',{limit:1,storage});
  const pages=createViewMemory('wiki.last-pages.v1',{limit:50,storage});
  let active='',ready=false,activeGame='genshin',pendingPosition=null;
  const path=href=>{const url=new URL(href,window.location.href);return url.pathname+url.search;};
  const position=()=>({left:window.scrollX??0,top:window.scrollY??0});
  function remember(){
    const current=position();
    if(ready&&active){viewport.set('position',current);pages.set(pageKey(active,activeGame),active);}
    if(!ready&&pendingPosition)return pendingPosition;
    if(!active&&!current.top&&!current.left)return viewport.get('position')??current;
    return current;
  }
  return {
    remember,
    destination(href,game){const target=path(href),saved=pages.get(pageKey(target,game));return typeof saved==='string'&&pageKey(saved,game)===pageKey(target,game)?saved:target;},
    retarget(href){remember();active=path(href);},
    begin(href,{game='genshin',position:requested}={}){const current=remember();active=path(href);activeGame=game;ready=false;pendingPosition=requested??current;return pendingPosition;},
    async restore(target,isActive=()=>true){
      if(!isActive())return;
      const value=target==='top'?{left:0,top:0}:target;
      prepareScroll(value);
      const apply=()=>window.scrollTo({left:Math.max(0,Number(value?.left)||0),top:Math.max(0,Number(value?.top)||0),behavior:'instant'});
      apply();ready=true;pendingPosition=null;
    }
  };
}
