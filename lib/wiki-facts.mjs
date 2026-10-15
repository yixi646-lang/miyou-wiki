// 提取公开 Wiki 模板中的事实字段，不渲染或执行来源代码。
export const wikiText=page=>page.revisions?.[0]?.slots?.main?.content??'';
export function template(text,name){
  const start=text.toLowerCase().indexOf('{{'+name.toLowerCase());if(start<0)return '';
  let depth=0;for(let i=start;i<text.length-1;i++){if(text.slice(i,i+2)==='{{'){depth++;i++;}else if(text.slice(i,i+2)==='}}'){depth--;if(depth===0)return text.slice(start,i+2);i++;}}
  return '';
}
export function plainFact(text){return String(text??'').replace(/<!--[\s\S]*?-->/g,'').replace(/&shy;|\u00ad/g,'').replace(/&mdash;|&ndash;/g,'—').replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label)=>label??target).replace(/'{2,5}/g,'').trim();}
export function parameters(text){const body=text.replace(/<!--[\s\S]*?-->/g,'').replace(/^\{\{|\}\}$/g,'');return Object.fromEntries([...body.matchAll(/^\|\s*([\w:-]+)\s*=[ \t]*([\s\S]*?)(?=^\|\s*[\w:-]+\s*=|(?![\s\S]))/gm)].map(([,k,v])=>[k,plainFact(v)]));}
export function chineseNames(text){const p=parameters(template(text,'Other Languages'));return Object.entries(p).filter(([key])=>/^(?:\d+_)?zhs$/.test(key)).map(([,value])=>value).filter(Boolean);}
export const factKey=text=>plainFact(text).toLowerCase().replace(/\band\b/g,'').replace(/[\s·•'’"&「」\[\]()-]/g,'');
export function wikiSection(text,name){const match=text.match(new RegExp(`^==[ \\t]*${name}[ \\t]*==[^\\n]*\\n`,'m'));if(!match)return '';const rest=text.slice(match.index+match[0].length),end=rest.search(/^==[^=]/m);return end<0?rest:rest.slice(0,end);}
export function sourceVersion(text){const numeric=text.match(/\[\[Version\s+([\d.]+)\]\]/)?.[1]??text.match(/\{\{Change History\|([\d.]+)/)?.[1];if(numeric)return numeric;const luna=text.match(/(?:Version\s+["']?|Change History\|)Luna\s+(VIII|VII|VI|IV|III|II|V|I)/)?.[1];return luna?'6.'+['I','II','III','IV','V','VI','VII','VIII'].indexOf(luna):null;}
export function poolFields(text,game){const pool=parameters(template(text,game==='genshin'?'Wish Pool':game==='starrail'?'Warp Pool':'Signal Search Pool'));if(game==='genshin'&&!Object.keys(pool).length&&/Lightrace Wish/.test(text))for(const line of text.split('\n')){const match=line.match(/^\*\* ([45])-Star (Characters|Weapons): (.*)$/);if(match)pool[(match[2]==='Characters'?'character':'weapon')+'_'+match[1]]= [...match[3].matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(m=>m[1]).join(';');}return pool;}
export function poolNames(value){return String(value??'').split(';').map(plainFact).filter(Boolean);}
export function normalizeBannerTime(value){const match=String(value??'').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);if(!match)return null;const[,y,m,d,h='00',min='00',sec='00']=match,date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||Number(h)>23||Number(min)>59||Number(sec)>59)return null;return `${date} ${h.padStart(2,'0')}:${min}:${sec}`;}
