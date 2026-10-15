import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),catalog=JSON.parse(await readFile(new URL('modules/character-assessment/core/catalog.json',root)));
const clean=html=>html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/<(?:br|\/p|\/tr|\/h[1-6]|\/li)[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&(?:rsquo|#8217);/g,"'").replace(/&(?:ge|geq);/g,'≥').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
const fetchText=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return r.text();};
const html=await fetchText('https://keqingmains.com/'),links=[...html.matchAll(/href="([^"]+)"[^>]*>([^<]*(?:Quick Guide|Extended Guide))</g)].map(m=>new URL(m[1],'https://keqingmains.com/').href);
const aliases={KamisatoAyaka:'ayaka',KamisatoAyato:'ayato',KaedeharaKazuha:'kazuha',SangonomiyaKokomi:'kokomi',RaidenShogun:'raiden',AratakiItto:'itto',KujouSara:'sara',YumemizukiMizuki:'mizuki',ShikanoinHeizou:'heizou',HuTao:'hu-tao',YaeMiko:'yae',KukiShinobu:'shinobu',LanYan:'lan-yan'};
const previous=process.argv.includes('--missing-only')?JSON.parse((await import('node:zlib')).gunzipSync(await readFile(new URL('data/sources/assessment-recommendations/kqm-2026-10-07.json.gz',root)))):{records:{},pages:{}};
const records=previous.records,pages=previous.pages,queue=Object.entries(catalog.characters).filter(([k])=>(!k.startsWith('Traveler')||k.endsWith('F'))&&records[k]?.status!=='guide-reviewed');
async function worker(){while(queue.length){const[key,meta]=queue.shift();const slug=key.startsWith('Traveler')?meta.element+'-traveler':aliases[key]??key.toLowerCase();const found=links.filter(u=>u.includes('/'+slug+'-quickguide/')||u.endsWith('/'+slug+'/'));const url=found.find(u=>u.includes('/q/'))??found[0];
  if(!url){records[key]={name:meta.name,status:'local-template',reason:'攻略索引未找到对应角色；使用明确标注的本地用途模板。'};continue;}
  try{const raw=await fetchText(url),text=clean(raw);pages[url]={url,retrievedAt:'2026-10-07',text};const snippets=[];
    for(const pattern of [/Talent Priority/gi,/Stat Priorit(?:y|ies)/gi,/Substat Priorit(?:y|ies)/gi,/Mainstat Priorit(?:y|ies)/gi,/Energy Recharge Requirements/gi])for(const m of text.matchAll(pattern)){const excerpt=text.slice(m.index,m.index+1200);if(!snippets.some(s=>s.startsWith(excerpt.slice(0,50))))snippets.push(excerpt);if(snippets.length>=14)break;}
    const tables=[...raw.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m=>clean(m[0])).filter(t=>/Sands/i.test(t)&&/Goblet/i.test(t)&&/Circlet/i.test(t)).slice(0,5);
    records[key]={name:meta.name,status:'guide-reviewed',url,tables,evidence:snippets};
  }catch(e){records[key]={name:meta.name,url,status:'local-template',reason:e.message};console.log(key+' | FAILED '+e.message);}
}}
await Promise.all(Array.from({length:4},worker));
for(const[key,meta]of Object.entries(catalog.characters))if(key.startsWith('Traveler')&&key.endsWith('M'))records[key]={...records[key.slice(0,-1)+'F'],name:meta.name};
await mkdir(new URL('data/sources/assessment-recommendations/',root),{recursive:true});
await writeFile(new URL('data/sources/assessment-recommendations/kqm-2026-10-07.json.gz',root),gzipSync(JSON.stringify({retrievedAt:'2026-10-07',records,pages}),{level:9}));
await writeFile(new URL('modules/character-assessment/core/recommendation-sources.json',root),JSON.stringify({retrievedAt:'2026-10-07',records},null,2)+'\n');
console.log(JSON.stringify({total:Object.keys(records).length,reviewed:Object.values(records).filter(r=>r.status==='guide-reviewed').length,fallback:Object.entries(records).filter(([,r])=>r.status!=='guide-reviewed').map(([k])=>k)}));
