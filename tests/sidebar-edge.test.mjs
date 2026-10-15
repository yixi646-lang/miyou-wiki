import test from 'node:test';
import assert from 'node:assert/strict';
import {installSidebarEdge} from '../public/sidebar-edge.mjs';

test('窄窗口边缘悬停呼出导航，移入侧栏保持，离开与恢复宽屏收起',async()=>{
 const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),previousMedia=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
 const viewport=new EventTarget();viewport.matches=true;
 const document=new EventTarget();document.activeElement=null;
 const sidebar=new EventTarget(),edge=new EventTarget(),classes=new Set(),attributes=new Map();let hovered=false,close;
 sidebar.classList={add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};
 sidebar.matches=()=>hovered;sidebar.contains=()=>false;
 edge.setAttribute=(key,value)=>attributes.set(key,value);
 Object.defineProperty(globalThis,'document',{value:document,configurable:true});Object.defineProperty(globalThis,'matchMedia',{value:()=>viewport,configurable:true});
 try{
  close=installSidebarEdge({sidebar,edge});assert.equal(edge.hidden,false);
  edge.dispatchEvent(new Event('pointerenter'));assert(classes.has('edge-open'));assert.equal(attributes.get('aria-expanded'),'true');
  edge.dispatchEvent(new Event('pointerleave'));hovered=true;sidebar.dispatchEvent(new Event('pointerenter'));
  await new Promise(resolve=>setTimeout(resolve,220));assert(classes.has('edge-open'));
  hovered=false;sidebar.dispatchEvent(new Event('pointerleave'));await new Promise(resolve=>setTimeout(resolve,220));assert(!classes.has('edge-open'));
  edge.dispatchEvent(new Event('focus'));assert(classes.has('edge-open'));
  viewport.matches=false;viewport.dispatchEvent(new Event('change'));assert(edge.hidden);assert(!classes.has('edge-open'));
  edge.dispatchEvent(new Event('pointerenter'));assert(!classes.has('edge-open'));
 }finally{
  close?.();for(const [key,descriptor] of [['document',previousDocument],['matchMedia',previousMedia]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 }
});
