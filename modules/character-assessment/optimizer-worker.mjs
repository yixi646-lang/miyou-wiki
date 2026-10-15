import {optimizeArtifactInventory as optimizeInventory} from './core/optimizer-search.mjs';
let stop=false;
self.onmessage=async event=>{if(event.data.type==='cancel'){stop=true;return;}if(event.data.type!=='start')return;stop=false;try{const result=await optimizeInventory(event.data.input,{cancelled:()=>stop,progress:value=>self.postMessage({type:'progress',value})});self.postMessage({type:'done',value:result});}catch(error){self.postMessage({type:'error',message:error.message});}};
