import test from 'node:test';
import assert from 'node:assert/strict';
import {createPageMemory,pageKey,installScrollStability} from '../public/page-state.mjs';
import {createViewMemory} from '../shared/view-state.mjs';

function fixture(){
  const values=new Map(),storage=()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const window={location:{href:'http://wiki.local/?game=genshin'},scrollX:0,scrollY:0,scrollTo({left,top}){this.scrollX=left;this.scrollY=top;}};
  return {window,storage,values,memory:createPageMemory({window,storage})};
}

test('切换与返回沿用当前页面位置，筛选页码仍按游戏记住',async()=>{
  const {window,memory}=fixture(),list='/?game=genshin&category=weapons&f_rarity=5&sort=name&page=3';
  await memory.restore(memory.begin(list));window.scrollY=1840;
  await memory.restore(memory.begin('/?game=genshin&entry=sword'));assert.equal(window.scrollY,1840);
  window.scrollY=420;const returning=memory.begin(list);window.scrollY=0;
  await memory.restore(returning);assert.equal(window.scrollY,420);
  assert.equal(memory.destination('/?game=genshin&category=weapons'),list);
  assert.equal(memory.destination('/?game=starrail&category=weapons'),'/?game=starrail&category=weapons');
  await memory.restore(memory.begin('/?game=starrail&category=weapons'));window.scrollY=760;
  await memory.restore(memory.begin(list));assert.equal(window.scrollY,760);
  assert.equal(pageKey('/?game=genshin&screen=assessment'),'genshin:assessment');
});

test('加载中的短页面不会覆盖原位置，刷新后仍恢复，排序重绘可保持当前滚动',async()=>{
  const {window,memory,storage}=fixture(),url='/?game=genshin&category=sets';
  await memory.restore(memory.begin(url));window.scrollY=900;memory.remember();
  const position=memory.begin(url);window.scrollY=0;memory.remember();
  await memory.restore(position);assert.equal(window.scrollY,900);
  const reloaded=createPageMemory({window,storage});window.scrollY=0;
  await reloaded.restore(reloaded.begin(url));assert.equal(window.scrollY,900);
  const sortPosition=reloaded.begin(url+'&sort=name',{position:{left:0,top:900}});window.scrollY=0;
  await reloaded.restore(sortPosition);assert.equal(window.scrollY,900);
});

test('过期的异步页面恢复不会把新页面拉回旧位置',async()=>{
  const {window,memory}=fixture();
  let generation=1;
  const oldGeneration=generation;generation=2;
  await memory.restore({left:0,top:300},()=>generation===2);
  await memory.restore({left:0,top:1500},()=>generation===oldGeneration);assert.equal(window.scrollY,300);
});

test('短内容自然限制当前滚动，切回长页面不重新跳到历史位置',async()=>{
  const {window,memory,values}=fixture();let maximum=3000;
  window.scrollTo=function({left,top}){this.scrollX=left;this.scrollY=Math.min(top,maximum);};
  values.set('wiki.page-positions.v1',JSON.stringify([['/?game=genshin&category=weapons',{left:0,top:2500}]]));
  await memory.restore(memory.begin('/?game=genshin'));window.scrollY=900;
  const shorter=memory.begin('/?game=genshin&category=weapons');maximum=200;
  await memory.restore(shorter);assert.equal(window.scrollY,200);
  const longer=memory.begin('/?game=genshin');maximum=3000;
  await memory.restore(longer);assert.equal(window.scrollY,200);
});

test('短栏目补足当前视口所需高度，向上滚动后同步缩减，不反复拉回旧位置',async()=>{
  const {window,storage}=fixture(),properties=new Map(),listeners=new Map();let naturalHeight=2500;
  window.innerHeight=800;window.getComputedStyle=()=>({minHeight:'0px'});
  window.addEventListener=(event,listener)=>listeners.set(event,listener);window.removeEventListener=event=>listeners.delete(event);
  const host={style:{minHeight:'',setProperty:(key,value)=>properties.set(key,value),removeProperty:key=>properties.delete(key)},getBoundingClientRect:()=>({top:76-window.scrollY})};
  window.scrollTo=function({left,top}){this.scrollX=left;this.scrollY=Math.min(top,Math.max(0,76+Math.max(naturalHeight,parseFloat(properties.get('--wiki-viewport-floor'))||0)-this.innerHeight));};
  const stability=installScrollStability({window,host}),memory=createPageMemory({window,storage,prepareScroll:stability.prepare});
  try{
    await memory.restore(memory.begin('/?game=genshin&screen=assessment'));window.scrollY=900;listeners.get('scroll')();
    const target=memory.begin('/?game=genshin&category=weapons');naturalHeight=300;
    await memory.restore(target);assert.equal(window.scrollY,900);assert.equal(properties.get('--wiki-viewport-floor'),'1624px');
    window.scrollY=280;listeners.get('scroll')();assert.equal(properties.get('--wiki-viewport-floor'),'1004px');
    const next=memory.begin('/?game=genshin&screen=assessment');naturalHeight=2500;
    await memory.restore(next);assert.equal(window.scrollY,280);
  }finally{stability.dispose();assert.equal(listeners.size,0);assert.equal(host.style.minHeight,'');}
});

test('存储不可用时当前会话仍记忆；视图数据与账号隔离并限制数量',()=>{
  const memory=createViewMemory('fixture',{limit:2,storage:()=>{throw Error('不可用');}});
  memory.set('a',{filter:'水',page:2});memory.set('b',{filter:'火',page:4});
  const copy=memory.get('a');copy.page=99;assert.equal(memory.get('a').page,2);assert.equal(memory.get('b').page,4);
  memory.set('c',{page:1});assert.equal(memory.get('a'),undefined);assert.equal(memory.get('b').page,4);
});
