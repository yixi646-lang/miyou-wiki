// 名称编辑入口打开时放到末尾；普通重绘继续保留用户自己的选区。
export function focusNameInput(input){
  if(!input||input.disabled||input.readOnly||input.closest?.('fieldset[disabled]'))return;
  input.focus({preventScroll:true});
  const end=input.value.length;
  input.setSelectionRange?.(end,end);
  if(typeof input.scrollWidth==='number')input.scrollLeft=input.scrollWidth;
}
