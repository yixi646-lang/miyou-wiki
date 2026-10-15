import {readFile,writeFile,mkdir} from 'node:fs/promises';
const jobs=[
 ['genshin','growth-character-sample','https://static.nanoka.cc/gi/7.1/zh/character/10000089.json'],
 ['genshin','growth-weapon-sample','https://static.nanoka.cc/gi/7.1/zh/weapon/11513.json'],
 ['starrail','growth-character-sample','https://static.nanoka.cc/hsr/4.6/zh/character/1001.json'],
 ['starrail','growth-weapon-sample','https://static.nanoka.cc/hsr/4.6/zh/lightcone/20000.json'],
 ['starrail','growth-item-sample','https://static.nanoka.cc/hsr/4.6/zh/item/211.json'],
 ['zenless','growth-item-sample','https://static.nanoka.cc/zzz/3.2/zh/item/110501.json'],
];
const gi=JSON.parse(await readFile('data/catalog/genshin.json','utf8'));
for(const e of gi.entries.filter(e=>e.category==='characters'))jobs.push(['genshin',`growth/characters/${e.sourceId}`,`https://static.nanoka.cc/gi/7.1/zh/character/${e.sourceId}.json`]);
for(const rarity of [1,2,3,4]){const e=gi.entries.find(e=>e.category==='weapons'&&e.rarity===rarity);jobs.push(['genshin',`growth-weapon-rarity-${rarity}`,`https://static.nanoka.cc/gi/7.1/zh/weapon/${e.sourceId}.json`]);}
for(const [game,host,titles]of [
 ['starrail','honkai-star-rail.fandom.com',['Character EXP','Light Cone EXP']],
 ['zenless','zenless-zone-zero.fandom.com',['Agent Level','W-Engine Level','Investigator Log','W-Engine Power Supply']],
 ['genshin','genshin-impact.fandom.com',['Character EXP','Weapon EXP']]
])jobs.push([game,'growth-exp-wiki',`https://${host}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(titles.join('|'))}&format=json&formatversion=2`]);
let next=0,done=0;const failures=[];
async function worker(){while(next<jobs.length){const [game,name,url]=jobs[next++],path=`data/sources/${game}/${name}.json`;try{await readFile(path);continue;}catch{}try{const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('HTTP '+res.status);const data=await res.json();await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,JSON.stringify(data,null,2),{flag:'wx'});done++;if(done%30===0||name.includes('exp-wiki'))console.log('已保存',game,name,done);}catch(e){failures.push({game,name,url,error:e.message});}}}
await Promise.all(Array.from({length:5},worker));console.log(JSON.stringify({downloaded:done,failures}));
