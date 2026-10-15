// JSX 只保留字段和翻译描述，不挂载 React，不加载上游美术素材。
export const sheetFragment='Fragment';
export function sheetNode(type,props,...children){return{type,props:{...props,children:children.length?children:props?.children}};}
