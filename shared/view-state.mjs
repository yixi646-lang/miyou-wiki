export function createViewMemory(name,{limit=100,storage=()=>globalThis.sessionStorage}={}){
  let fallback=new Map();
  const read=()=>{
    try{
      const target=storage();if(!target)return new Map(fallback);
      const entries=JSON.parse(target.getItem(name)??'[]');
      return new Map(Array.isArray(entries)?entries.filter(entry=>Array.isArray(entry)&&typeof entry[0]==='string').slice(-limit):[]);
    }catch{return new Map(fallback);}
  };
  return {
    get(key){return structuredClone(read().get(key));},
    set(key,value){const entries=read();entries.delete(key);entries.set(key,structuredClone(value));while(entries.size>limit)entries.delete(entries.keys().next().value);fallback=entries;try{storage()?.setItem(name,JSON.stringify([...entries]));}catch{}}
  };
}
export function readScrollPosition(){return {left:globalThis.window?.scrollX??0,top:globalThis.window?.scrollY??0};}
export function restoreScrollPosition(position){if(position)globalThis.window?.scrollTo?.({left:Math.max(0,Number(position.left)||0),top:Math.max(0,Number(position.top)||0),behavior:'instant'});}
