import {equipment} from './model.mjs';
import {isCustom,managedInventory} from './managed-inventory.mjs';
// 无上下文沿用旧调用规则；统一库存仅允许编辑独立的自定义层。
const actualButtons=new Set(['apply-plan','choose-weapon','replace-weapon','new-weapon','custom-to-inventory','equip-artifact','equip-weapon','remove-artifact','remove-weapon','edit-artifact','new-artifact','new-custom','custom-from-artifact','edit-custom','remove-custom','artifact-mode','custom-tier','custom-clear-line','save-custom']);
const actualAE=new Set(['add','remove-character','choose-build-weapon','choose-build-set','convert-custom']);
const actualInputs=['data-char','data-talent','data-weapon','data-art','data-sub-key','data-sub-value','data-traveler-element','data-native-lock','data-native-art','data-native-sub','data-native-weapon','data-custom-name','data-custom-field','data-custom-line','data-custom-count','data-custom-value','data-custom-value-key'];
const customEditor=ctx=>ctx.customEditing?.sourceIndex===undefined||isCustom(ctx.state.good.artifacts[ctx.customEditing.sourceIndex]);
export function blocksLockedButton(node,ctx={}){
  if(managedInventory(ctx.state)){
    const action=node.dataset.native,ae=node.dataset.ae;
    if(ae==='add')return false;
    if(ae==='remove-character')return !isCustom(ctx.state.good.characters.find(c=>c.key===node.dataset.key));
    if(ae==='choose-build-weapon')return !isCustom(equipment(ctx.state.good,ctx.selected).weapon);
    if(ae==='choose-build-set')return !isCustom(equipment(ctx.state.good,ctx.selected).artifacts.find(a=>a.slotKey===node.dataset.slot));
    if(['new-weapon','new-artifact','new-custom','edit-custom','remove-custom','save-custom'].includes(action))return false;
    if(['artifact-mode','custom-tier','custom-clear-line','custom-to-inventory'].includes(action))return !customEditor(ctx);
    if(action==='choose-weapon')return ctx.weaponPicker?.index!==undefined&&!isCustom(ctx.state.good.weapons[ctx.weaponPicker.index]);
    if(['edit-artifact','custom-from-artifact','remove-artifact'].includes(action))return !isCustom(ctx.state.good.artifacts[Number(node.dataset.index)]);
    if(['edit-weapon','replace-weapon','remove-weapon'].includes(action))return !isCustom(ctx.state.good.weapons[Number(node.dataset.index)]);
  }
  return node.dataset.native==='apply-team-trial'||actualButtons.has(node.dataset.native)||actualAE.has(node.dataset.ae)||['remove','remove-confirm'].includes(node.dataset.accountAction);
}
export function blocksLockedInput(node,ctx={}){
  if(managedInventory(ctx.state)){
    if(node.hasAttribute('data-traveler-element'))return false;
    if(node.hasAttribute('data-char')||node.hasAttribute('data-talent')){
      if(['level','ascension'].includes(node.dataset.char)&&ctx.selected?.startsWith('Traveler')&&ctx.state.good.characters.some(c=>c.key.startsWith('Traveler')&&c.key.endsWith(ctx.selected.at(-1))&&!isCustom(c)))return true;
      return !isCustom(ctx.state.good.characters.find(c=>c.key===ctx.selected));
    }
    if(node.hasAttribute('data-weapon'))return !isCustom(equipment(ctx.state.good,ctx.selected).weapon);
    if(['data-art','data-sub-key','data-sub-value'].some(a=>node.hasAttribute(a)))return !isCustom(equipment(ctx.state.good,ctx.selected).artifacts.find(a=>a.slotKey===node.closest('[data-slot]')?.dataset.slot));
    if(node.dataset.nativeLock)return !isCustom(ctx.state.good[node.dataset.nativeLock][Number(node.dataset.index)]);
    if(node.hasAttribute('data-native-weapon'))return !isCustom(ctx.state.good.weapons[Number(node.closest('[data-native-weapon-index]')?.dataset.nativeWeaponIndex)]);
    if(node.hasAttribute('data-native-art')||node.hasAttribute('data-native-sub'))return !isCustom(ctx.state.good.artifacts[Number(node.closest('[data-native-art-index]')?.dataset.nativeArtIndex)]);
    if(actualInputs.filter(a=>a.startsWith('data-custom-')).some(a=>node.hasAttribute(a)))return !customEditor(ctx);
  }
  return actualInputs.some(a=>node.hasAttribute(a))||node.id==='ae-add-character';
}
