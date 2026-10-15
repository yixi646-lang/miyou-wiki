import {attachSkillTerms} from '/shared/skill-terms.mjs';
import {applyWeaponChannelIndex} from '/shared/acquisition-channels.mjs';
import {withResourceTimeout} from '/shared/resource-loading.mjs';

let termsPromise,channelsPromise;
async function readIndex(path){return withResourceTimeout(async signal=>{const response=await fetch(path,{cache:'no-cache',signal});if(!response.ok)throw Error('本地补充资料读取失败：'+path);return response.json();},{message:'本地补充资料加载超时，请重试。'});}
export async function supplementSummaries(entries){
  const index=await (channelsPromise??=readIndex('/shared/weapon-channel-data.json').catch(error=>{channelsPromise=null;throw error;}));
  return entries.map(entry=>applyWeaponChannelIndex(entry,index));
}
export async function supplementCharacter(entry){
  if(entry.category!=='characters')return entry;
  const index=await (termsPromise??=readIndex('/shared/skill-term-data.json').catch(error=>{termsPromise=null;throw error;}));
  return attachSkillTerms(entry,index);
}
