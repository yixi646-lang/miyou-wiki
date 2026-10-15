const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const own=(v,k)=>v&&Object.hasOwn(v,k);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const unpack=state=>{const copy=structuredClone(state),native=copy.engineStorage?.['wiki.native.v1'];if(native)copy.engineStorage['wiki.native.v1']=JSON.parse(native);delete copy.updatedAt;return copy;};
function differences(before,after,path=[],out=[]){
 if(equal(before,after))return out;
 if(object(before)&&object(after)){for(const k of new Set([...Object.keys(before),...Object.keys(after)]))differences(before[k],after[k],[...path,k],out);}
 else out.push({path,before:structuredClone(before),after:structuredClone(after)});
 return out;
}
export function deletionUndo(before,after,accountId,now=Date.now()){
 return{accountId,expires:now+30000,changes:differences(unpack(before),unpack(after))};
}
export function restoreDeletion(current,record,{accountId,locked=false,now=Date.now()}={}){
 if(!record||now>record.expires)throw Error('撤销时间已过。');if(record.accountId!==accountId)throw Error('请回到原账号撤销。');
 const next=unpack(current);
 for(const change of record.changes){let owner=next;for(const part of change.path.slice(0,-1)){if(!own(owner,part))throw Error('相关资料已改变，无法撤销；当前修改已保留。');owner=owner[part];}const key=change.path.at(-1);if(!equal(owner[key],change.after))throw Error('相关资料已改变，无法撤销；当前修改已保留。');if(change.before===undefined)delete owner[key];else owner[key]=structuredClone(change.before);}
 if(locked&&!equal(next.good,current.good))throw Error('原有资料已锁定，请先解锁再撤销。');
 if(object(next.engineStorage?.['wiki.native.v1']))next.engineStorage['wiki.native.v1']=JSON.stringify(next.engineStorage['wiki.native.v1']);
 return next;
}
