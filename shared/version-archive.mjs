// 版本档案与现有图鉴、真实卡池记录的只读关联。
export const VERSION_SECTIONS = {
  story:'剧情与任务', map:'地图与探索', gameplay:'玩法与挑战', characters:'新增角色',
  equipment:'装备与套装', outfits:'时装与外观', events:'版本活动', systems:'系统与体验优化',
  enemies:'敌人与挑战对象', collection:'收集与其他新增', fixes:'问题修复范围'
};
export const normalizeVersion = value => String(value??'').match(/^\d+\.\d+/)?.[0]??null;
export function compareVersions(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);return (x[0]-y[0])||(x[1]-y[1]);}
export function versionAssociations(version,entries,game){
  const selected=entries.filter(e=>e.game===game&&normalizeVersion(e.releaseVersion)===version);
  return {
    characters:selected.filter(e=>e.category==='characters'),
    equipment:selected.filter(e=>['weapons','sets'].includes(e.category)),
    banners:selected.filter(e=>e.category==='banners'&&e.banner).sort((a,b)=>String(a.banner.start).localeCompare(String(b.banner.start))||a.name.localeCompare(b.name,'zh-CN'))
  };
}
export function selectVersions(versions,{search='',major='',section='',direction='desc',since='',until=''}={}){
  const terms=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return versions.filter(v=>{
    if(major&&v.version.split('.')[0]!==major)return false;
    if(section&&!v.sections.some(s=>s.key===section&&s.items.length))return false;
    if(since&&compareVersions(v.version,since)<=0)return false;
    if(until&&compareVersions(v.version,until)>0)return false;
    const text=JSON.stringify([v.version,v.alias,v.title,v.releaseDate,v.sections,v.maintenance]).toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  }).sort((a,b)=>(direction==='asc'?1:-1)*compareVersions(a.version,b.version));
}
export function returneeChanges(versions,since,until){
  return selectVersions(versions,{since,until}).map(v=>({...v,sections:v.sections.filter(s=>!['events','fixes','characters','equipment','outfits','collection','enemies'].includes(s.key)).map(s=>({...s,items:s.items.filter(i=>i.availability==='permanent'||(s.key==='systems'&&i.availability!=='limited'))})).filter(s=>s.items.length)})).filter(v=>v.sections.length);
}
export function htmlLines(html){
  const named={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",middot:'·',bull:'•',hellip:'…',ge:'≥',le:'≤',mdash:'—',times:'×',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
  return String(html??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?:br|\/?p|\/?div|\/?h[1-6]|\/?li|\/?tr)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(m,k)=>k[0]==='#'?String.fromCodePoint(Number(k[1]?.toLowerCase()==='x'?'0x'+k.slice(2):k.slice(1))):named[k.toLowerCase()]??m).split('\n').map(l=>l.replace(/[\u200b\ufeff]/g,'').trim()).filter(Boolean);
}
