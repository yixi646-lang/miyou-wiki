// 合成只使用直接养成需求之外的富余库存。所有费用在批量汇总后统一扣库存。
export function calculateSynthesis(costs,inventory={},recipes={},enabled=true) {
 const rows=new Map(costs.map(item=>[item.id,{...item,have:Math.max(0,Math.floor(Number(inventory[item.id])||0)),crafted:0,spent:0,fee:0,auxiliary:false}]));
 const depth=new Map(),visiting=new Set();
 function recipeDepth(id){if(depth.has(id))return depth.get(id);if(visiting.has(id))throw Error('合成配方存在循环');visiting.add(id);const recipe=recipes[id];const value=recipe?1+Math.max(0,...recipe.inputs.map(i=>recipeDepth(i.id))):0;visiting.delete(id);depth.set(id,value);return value;}
 function ensure(id){if(!rows.has(id))rows.set(id,{id,count:0,have:Math.max(0,Math.floor(Number(inventory[id])||0)),crafted:0,spent:0,fee:0,auxiliary:true});}
 if(!enabled)return {costs:[...rows.values()].map(row=>({...row,missing:Math.max(0,row.count-row.have)})),steps:[],fees:[]};
 function ancestors(id,seen=new Set()){if(seen.has(id))return;seen.add(id);const recipe=recipes[id];if(!recipe)return;recipeDepth(id);for(const input of recipe.inputs){ensure(input.id);ancestors(input.id,seen);}if(recipe.currency?.count>0)ensure(recipe.currency.id);}
 for(const id of [...rows.keys()])ancestors(id);
 const available=new Map([...rows].map(([id,row])=>[id,Math.max(0,row.have-row.count)])),steps=new Map(),fees=new Map();
 function capacity(id){const recipe=recipes[id];return (available.get(id)??0)+(recipe?Math.min(...recipe.inputs.map(i=>Math.floor(capacity(i.id)/i.count)))*recipe.outputCount:0);}
 function produce(id,want){const recipe=recipes[id];if(!recipe||want<=0)return 0;const batches=Math.min(Math.ceil(want/recipe.outputCount),...recipe.inputs.map(i=>Math.floor(capacity(i.id)/i.count)));if(!batches)return 0;
  for(const input of recipe.inputs){const count=input.count*batches,have=available.get(input.id)??0;if(have<count)produce(input.id,count-have);available.set(input.id,(available.get(input.id)??0)-count);rows.get(input.id).spent+=count;}
  const made=recipe.outputCount*batches;rows.get(id).crafted+=made;available.set(id,(available.get(id)??0)+made);steps.set(id,(steps.get(id)??0)+batches);
  if(recipe.currency?.count>0){const fee=recipe.currency.count*batches;fees.set(recipe.currency.id,(fees.get(recipe.currency.id)??0)+fee);}
  return made;
 }
 for(const row of [...rows.values()].sort((a,b)=>recipeDepth(a.id)-recipeDepth(b.id)||a.id.localeCompare(b.id))){const missing=Math.max(0,row.count-row.have);if(missing){const made=produce(row.id,missing);available.set(row.id,(available.get(row.id)??0)-Math.min(made,missing));}}
 for(const [id,count]of fees){const row=rows.get(id);row.count+=count;row.fee=count;row.auxiliary=false;}
 return {costs:[...rows.values()].map(row=>({...row,missing:Math.max(0,row.count+row.spent-row.have-row.crafted)})),steps:[...steps].map(([id,batches])=>({id,batches,output:recipes[id].outputCount*batches,inputs:recipes[id].inputs.map(i=>({...i,count:i.count*batches})),currency:recipes[id].currency?{...recipes[id].currency,count:recipes[id].currency.count*batches}:null,feeStatus:recipes[id].feeStatus??'verified',source:recipes[id].source})),fees:[...fees].map(([id,count])=>({id,count}))};
}
