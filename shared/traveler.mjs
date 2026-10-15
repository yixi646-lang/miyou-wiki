export const TRAVELER_ELEMENTS = ['冰','风','岩','雷','草','水','火'];
export function travelerVariant(entry, element = '冰') {
  const data=entry?.game==='genshin'&&entry.category==='characters'?entry.details?.traveler:null;
  return data?.elements?.[element]??data?.elements?.[data.defaultElement??'冰']??null;
}
export function detailEntry(entry, element = '冰') {
  const variant=travelerVariant(entry,element);if(!variant)return entry;
  return {...entry,element:variant.element,details:{...entry.details,skills:variant.skills,upgrades:variant.upgrades},sources:[...(entry.sources??[]),...(variant.sources??[])]};
}
