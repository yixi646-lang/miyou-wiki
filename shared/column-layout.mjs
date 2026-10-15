export function preferredColumns(width,{base,reference,minCell=190,gap=14,max=6,preferred='auto'}){
 const manual=Number(preferred);
 // 最小卡宽只约束自动布局，手动选择须实际显示对应列数。
 if(Number.isInteger(manual)&&manual>0)return Math.min(max,manual);
 const capacity=Math.max(1,Math.floor((width+gap)/(minCell+gap)));
 const desired=Math.round(base*width/reference);
 return Math.max(1,Math.min(max,capacity,desired));
}

export function normalizeColumnSetting(value){
 if(typeof value==='string'&&value.startsWith('"'))try{value=JSON.parse(value);}catch{}
 const number=Number(value);
 return Number.isInteger(number)&&number>=1&&number<=6?String(number):'auto';
}
