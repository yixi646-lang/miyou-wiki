import {optimizeTheory,artifactPotential} from './core/artifact-research.mjs';
self.onmessage=async event=>{try{const {kind,request,items}=event.data;
 if(kind==='potential-batch'){
  let pending=[],lastUpdate=performance.now();const flush=()=>{if(pending.length){self.postMessage({type:'items',items:pending});pending=[];lastUpdate=performance.now();}};
  for(const {id,...item}of items){try{pending.push({id,value:artifactPotential({...request,...item,...(request.mode==='define'?{}:{sourceIndex:Number(id)})})});}catch(error){pending.push({id,message:error.message});}
   if(pending.length>=8||performance.now()-lastUpdate>=60){flush();await new Promise(resolve=>setTimeout(resolve,0));}}
  flush();
  self.postMessage({type:'done'});
 }else self.postMessage({type:'done',value:kind==='theory'?optimizeTheory(request):artifactPotential(request)});
}catch(error){self.postMessage({type:'error',message:error.message});}};
