import test from 'node:test';
import assert from 'node:assert/strict';
import {installResponsiveLayout,gridLayout,layoutSetting,saveLayoutSetting} from '../public/responsive-layout.mjs';
import {plannerLayout} from '../shared/planner-view.mjs';

test('各页面控件改动网格并保留选择，列表模式及旧样式不再压成一列',()=>{
  const originals=new Map(['localStorage','getComputedStyle','document','screen','window','ResizeObserver','MutationObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const stored=new Map(),observers=[],listeners=new Map();let blocked=false;
  const host={grids:[],controls:[],contains:grid=>host.grids.includes(grid),querySelectorAll:selector=>selector==='[data-responsive-columns]'?host.grids:host.controls,
    addEventListener:(type,callback)=>listeners.set(type,callback),removeEventListener:type=>listeners.delete(type)};
  class Observer {constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}disconnect(){this.targets.clear();}}
  function add(key,base,options={},compact=false){
    const attributes=gridLayout(key,base,options),dataset={};
    for(const [,name,value] of attributes.matchAll(/data-([\w-]+)="([^"]*)"/g))dataset[name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;
    const properties=new Map(),grid={dataset,clientWidth:850,style:{setProperty:(key,value,priority='')=>properties.set(key,[String(value),priority])},closest:()=>compact?{}:null,properties};
    const option={textContent:'自动'},control={dataset:{layoutKey:key},value:'auto',matches:selector=>selector==='select[data-layout-key]',querySelector:()=>option};
    host.grids.push(grid);host.controls.push(control);return {grid,control,option};
  }
  let dispose;
  try{
    const globals={localStorage:{getItem:key=>{if(blocked)throw Error('存储被禁用');return stored.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('存储被禁用');stored.set(key,value);}},getComputedStyle:()=>({paddingLeft:'0px',paddingRight:'0px'}),document:{documentElement:{dataset:{sidebar:'wide'}},querySelector:()=>({getBoundingClientRect:()=>({width:228})})},screen:{availWidth:1920},window:{innerWidth:1920},ResizeObserver:Observer,MutationObserver:Observer};
    for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    const cases=[];
    for(const game of ['genshin','starrail','zenless']){
      for(const [page,base,minCell] of [['characters',5,190],['weapons',game==='starrail'?3:4,260],['sets',4,260],['materials',5,190],['banners',2,190],['all',2,190]])cases.push(add(`test:${game}:${page}`,base,{minCell},page==='characters'||page==='materials'));
      for(const page of ['basic','skills','upgrades'])cases.push(add(`test:${game}:${page}`,page==='basic'?4:2,{max:4,minCell:page==='basic'?180:260,reference:'basic',variable:page==='basic'?'basic-columns':'skill-columns'}));
      for(const page of ['banner-units','banner-versions'])cases.push(add(`test:${game}:${page}`,page==='banner-versions'?3:2,{max:4,minCell:300,variable:'stat-columns'}));
    }
    dispose=installResponsiveLayout(host);
    for(const {grid,control,option} of cases){
      const automatic=option.textContent,max=Number(grid.dataset.columnMax);
      for(let count=1;count<=max;count++){
        control.value=String(count);listeners.get('change')({target:control});
        assert.equal(grid.dataset.columns,String(count),control.dataset.layoutKey);
        assert.deepEqual(grid.properties.get('grid-template-columns'),[`repeat(${count}, minmax(0, 1fr))`,'important']);
        assert.equal(layoutSetting(control.dataset.layoutKey),String(count));
        assert.equal(option.textContent,automatic,'自动选项应显示自动计算的列数');
      }
      grid.clientWidth=320;observers[0].callback([{target:grid}]);assert.equal(grid.dataset.columns,String(max));
      control.value='auto';listeners.get('change')({target:control});assert.equal(grid.dataset.columns,'1');
    }
    const old=cases[0],key=old.control.dataset.layoutKey;
    old.control.value='3';listeners.get('change')({target:old.control});
    host.grids=host.grids.filter(grid=>grid!==old.grid);host.controls=host.controls.filter(control=>control!==old.control);
    const replacement=add(key,5);observers[1].callback([]);
    assert.equal(replacement.grid.dataset.columns,'3','筛选、翻页或页面重建保留数量');
    assert.ok(!observers[0].targets.has(old.grid),'旧网格停止监听');
    stored.set('test:legacy','"4"');assert.equal(layoutSetting('test:legacy'),'4');
    const transient=add('test:storage-blocked',5);observers[1].callback([]);blocked=true;
    transient.control.value='4';listeners.get('change')({target:transient.control});assert.equal(transient.grid.dataset.columns,'4');
    assert.equal(layoutSetting('test:storage-blocked'),'4');
    saveLayoutSetting('test:planner',2);assert.equal(Number(layoutSetting('test:planner')),2);
    const two=plannerLayout(1900,Number(layoutSetting('test:planner')),[4,2]);assert.equal(two.columns,2);assert.equal(two.cardWidth,420);
    saveLayoutSetting('test:planner',1);const one=plannerLayout(1900,Number(layoutSetting('test:planner')),[4,2]);assert.equal(one.columns,1);assert.ok(one.materialColumns>two.materialColumns);
  }finally{
    dispose?.();
    for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
  assert.equal(listeners.size,0);assert.ok(observers.every(observer=>observer.targets.size===0));
});
