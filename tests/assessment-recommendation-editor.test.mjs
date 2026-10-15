import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openGuideEditor,openGoalDefaultEditor} from '../modules/character-assessment/recommendation-editor.mjs';
import {characterGuideHTML,goalHelpHTML,recommendedGoal} from '../modules/character-assessment/core/profiles.mjs';
import {recommendationPlans} from '../modules/character-assessment/core/recommendation-plans.mjs';
import {createRecommendationStore} from '../modules/character-assessment/recommendation-store.mjs';
import {createTestWorkspace,cleanupTestWorkspace} from '../scripts/test-resources.mjs';
const catalog=JSON.parse(readFileSync(new URL('../modules/character-assessment/core/catalog.json',import.meta.url)));

// 使用临时安装的 DOM 运行实际编辑器与事件；不启动服务、不触碰正式资料。
test('攻略实际编辑面板：复制只读内置、保存后显示、独立默认切换及原默认删除', {skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE));
  const {document,window}=parseHTML('<html><body><main><div data-visible></div></main></body></html>'),prior=globalThis.document;
  const folder=await createTestWorkspace('recommendation-editor');let popup;
  try{
    // DOM 环境不提供模态窗口、原生表单校验；数据校验使用真实保存实现。
    Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
    Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){if(v)this.setAttribute('checked','');else this.removeAttribute('checked');},configurable:true});
    Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
    Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===v;},configurable:true});
    const create=document.createElement.bind(document);document.createElement=tag=>{
      const node=create(tag);if(tag==='dialog'){node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new window.Event('close'));};}return node;
    };
    globalThis.document=document;document.body.style.overflow='auto';
    const root=document.querySelector('main'),store=createRecommendationStore(join(folder,'recommendations.json'),catalog),messages=[];let settings=store.read();
    const show=()=>root.querySelector('[data-visible]').innerHTML=characterGuideHTML('Shenhe',catalog,undefined,{settings});show();
    popup=openGuideEditor({root,key:'Shenhe',catalog,settings,onSave:async request=>{settings=store.write({key:'Shenhe',kind:'guide',...request});show();return settings;},toast:message=>messages.push(message)});
    const query=s=>popup.dialog.querySelector(s),act=async(action,attributes='')=>{const b=query(`[data-rec-action="${action}"]${attributes}`);assert.ok(b,action);assert.equal(b.disabled,false,action);b.dispatchEvent(new window.Event('click',{bubbles:true}));await new Promise(setImmediate);assert.deepEqual(messages,[]);};
    const choose=async id=>{const s=query('[data-rec-plan]');s.value=id;s.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(setImmediate);assert.deepEqual(messages,[]);};
    assert.ok(query('.ae-rec-plan-content').hasAttribute('disabled'));assert.equal(query('[data-rec-action="save"]').disabled,true);assert.equal(query('[data-rec-action="delete"]').disabled,true);
    await act('copy');const custom=query('[data-rec-plan]').value;assert.notEqual(custom,'builtin');assert.equal(query('.ae-rec-plan-content').hasAttribute('disabled'),false);
    const intro=query('[data-rec-intro]');intro.value='DOM交互保存后的申鹤攻略';intro.dispatchEvent(new window.Event('input',{bubbles:true}));query('[data-rec-name]').value='申鹤辅助方案';
    assert.equal(query('select[data-rec-weapon]'),null);assert.equal(query('select[data-rec-set]'),null);assert.equal(query('select[data-rec-slot="characters"]'),null);
    const picker=()=>[...root.querySelectorAll('dialog')].at(-1),pickerClick=async selector=>{const button=picker().querySelector(selector);assert(button,selector);button.dispatchEvent(new window.Event('click',{bubbles:true}));await new Promise(setImmediate);assert.deepEqual(messages,[]);};
    const search=async text=>{const input=picker().querySelector('[data-catalog-search]');input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));await new Promise(setImmediate);assert.equal(picker().querySelector('select'),null);};
    await act('pick-weapon');await pickerClick('[data-catalog-filter="rarity"][data-value="5"]');await search('息灾');await pickerClick('[data-catalog-choice="CalamityQueller"]');assert.equal(query('[data-rec-weapon="key"]').value,'CalamityQueller');
    const firstArtifact=query('[data-rec-artifact-plan]').dataset.recArtifactPlan,artifactAttr=id=>`[data-artifact-id="${id}"]`,storedGuide=()=>recommendationPlans('Shenhe','guide',settings).plans.find(p=>p.id===custom).value;
    const originalAdvice=storedGuide().artifactAdvice;assert.match(originalAdvice,/^培养顺序参考：/);assert.equal(query('[data-rec-artifact-advice]').value,originalAdvice);
    await act('pick-artifact-set',artifactAttr(firstArtifact));await search('昔日宗室');await pickerClick('[data-catalog-choice="NoblesseOblige"]');assert.equal(query('[data-rec-artifact-set="0"]').value,'NoblesseOblige');
    await act('save-artifact-plan',artifactAttr(firstArtifact));assert.equal(storedGuide().artifactPlans[0].sets[0],'NoblesseOblige');assert.notEqual(storedGuide().intro,'DOM交互保存后的申鹤攻略');assert.equal(query('[data-rec-intro]').value,'DOM交互保存后的申鹤攻略');
    await act('add-artifact-plan');const secondArtifact=[...popup.dialog.querySelectorAll('[data-rec-artifact-plan]')].at(-1).dataset.recArtifactPlan;
    query(`[data-rec-artifact-plan="${secondArtifact}"] [data-rec-artifact-name]`).value='2+2 备用方案';await act('artifact-mode',artifactAttr(secondArtifact)+'[data-mode="two-two"]');
    await act('pick-artifact-set',artifactAttr(secondArtifact)+'[data-index="0"]');await search('冰风');await pickerClick('[data-catalog-choice="BlizzardStrayer"]');
    await act('pick-artifact-set',artifactAttr(secondArtifact)+'[data-index="1"]');await search('角斗士');await pickerClick('[data-catalog-choice="GladiatorsFinale"]');
    await act('save-artifact-plan',artifactAttr(secondArtifact));assert.equal(storedGuide().artifactPlans.length,2);assert.deepEqual(storedGuide().artifactPlans[1].sets,['BlizzardStrayer','GladiatorsFinale']);
    await act('display-artifact-plan',artifactAttr(firstArtifact));assert.equal(root.querySelectorAll('.ae-guide-artifact-plan').length,2);
    await act('display-artifact-plan',artifactAttr(secondArtifact));assert.equal(root.querySelectorAll('.ae-guide-artifact-plan').length,1);
    const advice='培养顺序参考：自由编辑的圣遗物建议\n<script>仅显示文字</script>';query('[data-rec-artifact-advice]').value=advice;await act('save-artifact-advice');assert.equal(storedGuide().artifactAdvice,advice);assert.match(root.querySelector('.ae-guide-artifact-advice').innerHTML,/&lt;script&gt;/);assert.equal(query('[data-rec-intro]').value,'DOM交互保存后的申鹤攻略');
    await act('remove-artifact-plan',artifactAttr(firstArtifact));assert.equal(storedGuide().artifactPlans.length,1);await act('display-artifact-plan',artifactAttr(secondArtifact));assert.equal(root.querySelectorAll('.ae-guide-artifact-plan').length,1);assert.equal(root.querySelector('.ae-guide-artifact-plan').querySelectorAll('.ae-guide-equipment').length,2);
    await act('pick-characters');await search('班尼特');assert.equal(picker().querySelector('[data-catalog-confirm]'),null);await pickerClick('[data-catalog-choice="Bennett"]');assert.equal(query('[data-rec-slot="characters"]').value,'Bennett');assert.equal(query('[data-rec-slot="label"]'),null);assert.equal(document.body.style.overflow,'hidden');
    const chosen=query('[data-rec-weapon="key"]').value;await act('pick-weapon');await pickerClick('[data-analysis-close]');assert.equal(query('[data-rec-weapon="key"]').value,chosen);
    await act('save');assert.match(root.querySelector('[data-visible]').innerHTML,/DOM交互保存后的申鹤攻略/);assert.equal(recommendationPlans('Shenhe','guide',settings).defaultId,'builtin');
    await act('default');await choose('builtin');await act('display');assert.equal(recommendationPlans('Shenhe','guide',settings).defaultId,custom);assert.equal(recommendationPlans('Shenhe','guide',settings).displayId,'builtin');
    await act('copy');const other=query('[data-rec-plan]').value;await act('default');await choose(custom);assert.equal(query('[data-rec-action="delete"]').disabled,false);await act('delete');await act('delete');
    assert.equal(recommendationPlans('Shenhe','guide',settings).plans.some(p=>p.id===custom),false);assert.equal(recommendationPlans('Shenhe','guide',settings).defaultId,other);
    const bytes=readFileSync(join(folder,'recommendations.json'));await act('add');const newId=query('[data-rec-plan]').value;query('[data-rec-intro]').value='取消时丢弃此句';query('[data-rec-intro]').dispatchEvent(new window.Event('input',{bubbles:true}));await act('discard');assert.equal(query('[data-rec-intro]').value,'');assert.equal(store.read().records.Shenhe.guidePlans.plans.find(p=>p.id===newId).value.intro,'');
    assert.ok(bytes.length);popup.close();assert.equal(document.body.style.overflow,'auto');assert.equal(root.querySelector('dialog'),null);
  }finally{popup?.close();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;await cleanupTestWorkspace(folder);}
});

test('评价实际编辑面板：目标与权重保存后显示，默认保持独立且内置不可编辑', {skip:!process.env.WIKI_TEST_DOM_PACKAGE},async()=>{
  const {parseHTML}=await import(pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)),{document,window}=parseHTML('<html><body><main><div data-visible></div></main></body></html>'),prior=globalThis.document;
  const folder=await createTestWorkspace('recommendation-goal-editor');let popup;
  try{
    Object.defineProperty(window.HTMLElement.prototype,'checkValidity',{value(){return true;},configurable:true});
    Object.defineProperty(window.HTMLInputElement.prototype,'checked',{get(){return this.hasAttribute('checked');},set(v){if(v)this.setAttribute('checked','');else this.removeAttribute('checked');},configurable:true});
    Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{get(){return this.hasAttribute('selected');},set(v){if(v)this.setAttribute('selected','');else this.removeAttribute('selected');},configurable:true});
    Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){for(const o of this.options)o.selected=o.value===v;},configurable:true});
    const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;n.dispatchEvent(new window.Event('close'));};}return n;};
    globalThis.document=document;
    const root=document.querySelector('main'),store=createRecommendationStore(join(folder,'recommendations.json'),catalog),messages=[];let settings=store.read();const original=recommendedGoal('Shenhe');
    popup=openGoalDefaultEditor({root,key:'Shenhe',element:'cryo',catalog,settings,current:original,onSave:async request=>{settings=store.write({key:'Shenhe',kind:'goal',...request});root.querySelector('[data-visible]').innerHTML=goalHelpHTML('Shenhe',settings);return settings;},toast:m=>messages.push(m)});
    const query=s=>popup.dialog.querySelector(s),act=async action=>{const b=query(`[data-rec-action="${action}"]`);assert.ok(b);assert.equal(b.disabled,false);b.dispatchEvent(new window.Event('click',{bubbles:true}));await new Promise(setImmediate);assert.deepEqual(messages,[]);};
    assert.ok(query('.ae-rec-plan-content').hasAttribute('disabled'));await act('copy');
    query('[data-rec-name]').value='申鹤新评价';query('[data-rec-goal="level"]').value='80';query('[data-rec-weight="atk_"]').value='1.25';query('[data-rec-weight="enerRech_"]').value='0.35';query('[data-rec-notes]').value='新的评价目标依据';query('[data-rec-notes]').dispatchEvent(new window.Event('input',{bubbles:true}));
    await act('save');const c=recommendationPlans('Shenhe','goal',settings),shown=c.plans.find(p=>p.id===c.displayId);assert.equal(c.defaultId,'builtin');assert.equal(shown.value.level,80);assert.equal(shown.value.weights.atk_,1.25);assert.equal(shown.value.weights.enerRech_,.35);assert.equal(shown.value.notes,'新的评价目标依据');
    assert.match(root.querySelector('[data-visible]').innerHTML,/申鹤新评价|角色80级/);assert.deepEqual(recommendedGoal('Shenhe','cryo',settings),original);
    await act('default');assert.equal(recommendedGoal('Shenhe','cryo',settings).level,80);assert.equal(query('[data-rec-action="delete"]').disabled,true);
  }finally{popup?.close();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;await cleanupTestWorkspace(folder);}
});
