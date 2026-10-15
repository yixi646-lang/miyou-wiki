// 只采集百科公开 API 的条目事实；按游戏保留来源快照，可重复运行。
import {readFile,writeFile} from 'node:fs/promises';
const sites={genshin:'genshin-impact',starrail:'honkai-star-rail',zenless:'zenless-zone-zero'};
async function api(game,params){const u=new URL(`https://${sites[game]}.fandom.com/api.php`);for(const[k,v]of Object.entries({action:'query',format:'json',formatversion:'2',...params}))u.searchParams.set(k,v);const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${game}: API ${r.status}`);return r.json();}
for(const game of Object.keys(sites)){
  const categories=game==='genshin'?['Playable Characters','Weapons','Wish']:game==='starrail'?['Playable Characters','Light Cones','Warps']:['Playable Agents','W-Engines','Signal Searches'];
  for(const category of categories){
    const name=category===categories[2]?'history':'acquisition-'+(category===categories[0]?'characters':'weapons'),path=`data/sources/${game}/${name}-pages.json`;
    let saved={pages:[],fetchedAt:new Date().toISOString(),site:`https://${sites[game]}.fandom.com`,category};try{saved=JSON.parse(await readFile(path,'utf8'));}catch{}
    const members=[];let more={};do{const j=await api(game,{list:'categorymembers',cmtitle:'Category:'+category,cmlimit:'500',cmnamespace:'0',...more});members.push(...j.query.categorymembers);more=j.continue;}while(more);
    const done=new Set(saved.pages.map(p=>p.title));const pending=members.filter(x=>!done.has(x.title));console.log(game,category,'total',members.length,'pending',pending.length);
    for(let i=0;i<pending.length;i+=40){const j=await api(game,{titles:pending.slice(i,i+40).map(x=>x.title).join('|'),prop:'revisions',rvprop:'ids|content',rvslots:'main',redirects:'1'});saved.pages.push(...j.query.pages);await writeFile(path,JSON.stringify(saved,null,2));console.log(game,name,Math.min(i+40,pending.length)+'/'+pending.length);}
    await writeFile(path,JSON.stringify(saved,null,2));
  }
}
