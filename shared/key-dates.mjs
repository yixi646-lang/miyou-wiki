import {withBannerSchedules} from './banner-schedule.mjs';
import {isExcludedEntry} from './catalog.mjs';

export const DAY=86400000;
export const dateAt=(date,time='06:00')=>Date.parse(`${date}T${time}:00+08:00`);
export const dayKey=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
export const monthKey=ms=>dayKey(ms).slice(0,7);
export const addDays=(ms,days)=>ms+days*DAY;
const atTime=(ms,time)=>dateAt(dayKey(ms),time);
export function horizon(now){const day=dayKey(now),date=new Date(day+'T00:00:00+08:00');date.setUTCFullYear(date.getUTCFullYear()+1);return {start:now,end:date.getTime(),firstDay:day,lastDay:dayKey(date.getTime()-DAY)};}
export function countdown(ms,now){
  const seconds=Math.max(0,Math.floor((ms-now)/1000));if(!seconds)return {text:'时间已到',short:'已到时间'};
  const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
  return {text:d?`还有 ${d} 天 ${h} 小时`:h?`还有 ${h} 小时 ${m} 分钟`:`还有 ${m} 分 ${String(s).padStart(2,'0')} 秒`,short:d?`${d}天 ${h}小时`:h?`${h}小时 ${m}分`:`${m}分 ${String(s).padStart(2,'0')}秒`};
}
export function validRule(r){return !!r&&Number.isInteger(r.cycle)&&r.cycle>=28&&r.cycle<=70&&Number.isInteger(r.phase)&&r.phase>0&&r.phase<r.cycle&&Number.isInteger(r.liveLead)&&r.liveLead>0&&r.liveLead<=28&&Number.isInteger(r.shift)&&Math.abs(r.shift)<=28&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.phaseTime)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.liveTime);}
function forecastVersion(game,offset){
  const [major,minor]=game.nextVersion.split('.').map(Number),count=(game.lastMinor??8)+1,step=minor+offset;
  return `${major+Math.floor(step/count)}.${step%count}`;
}

function bannerTime(value,zone){
  if(typeof value!=='string')return NaN;
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return Date.parse(value);
  if(!['服务器时间','UTC+8','UTC+08:00','Asia/Shanghai','Asia/Hong_Kong','开始 UTC+8 / 结束服务器时间'].includes(zone))return NaN;
  if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value))return NaN;
  return Date.parse(value.replace(' ','T')+(value.length===16?':00':'')+'+08:00');
}
// 只提取已录入的实际时间；同期开启的角色池、装备池合并为一个节点。
export function catalogConfirmed(entries){
  const groups=new Map();
  for(const e of withBannerSchedules(entries)){
    if(e.category!=='banners'||!e.banner||isExcludedEntry(e)||e.banner.mode==='standard')continue;
    const b=e.banner,slot=b.schedule?.key??'unknown';
    if(slot!=='lower')continue;
    for(const kind of ['phase']){
      const at=bannerTime(b.start,b.timeZone);if(!Number.isFinite(at))continue;
      const key=[e.game,e.releaseVersion,kind,slot,at].join(':');
      if(!groups.has(key))groups.set(key,{id:'catalog-'+key,game:e.game,version:e.releaseVersion,kind,phase:slot,time:new Date(at).toISOString(),status:'confirmed',title:`${e.releaseVersion?e.releaseVersion+' ':''}下半开启`,names:[],sources:[],entryIds:[],basis:'来自 Wiki 已收录下半卡池的实际开启时间；服务器时间按国服 UTC+8 展示。',checkedAt:''});
      const item=groups.get(key);item.names.push(e.name);item.entryIds.push(e.id);
      for(const source of e.sources??[])if(source.url&&!item.sources.some(s=>s.url===source.url))item.sources.push(source);
      const checked=String(e.fetchedAt??e.updatedAt??'').slice(0,10);if(checked>item.checkedAt)item.checkedAt=checked;
    }
  }
  return [...groups.values()];
}

export function buildEvents(data,rules={},now=Date.now()){
  const range=horizon(now),events=[];
  const official=(data.confirmed??[]).filter(e=>['update','live','phase'].includes(e.kind)).map((e,i)=>({...e,id:e.id??`official-${i}`,at:Date.parse(e.time),status:'confirmed',names:e.names??[],sources:e.sources??[]}));
  const push=e=>{if(Number.isFinite(e.at)&&e.at>range.start&&e.at<range.end)events.push(e);};
  for(const e of official)push(e);
  for(const game of data.games){
    const r={cycle:game.cycle,phase:game.phase,liveLead:game.liveLead,shift:0,phaseTime:game.phaseTime,liveTime:game.liveTime,...(validRule(rules[game.id])?rules[game.id]:{})};
    const anchor=addDays(dateAt(game.anchor),r.shift);
    const make=(kind,at,version,cycle,basis,extra={})=>{
      // 公布的同版本节点优先，改期后也不保留旧预计时间；特殊跨期卡池仍独立展示。
      if(official.some(e=>e.game===game.id&&e.kind===kind&&(e.at===at||(e.version&&e.version===version))))return;
      push({id:`forecast-${game.id}-${cycle}-${kind}-${extra.phase??''}`,game:game.id,kind,at,version,status:'estimated',sources:game.sources,checkedAt:data.builtDate,basis:`${game.basis}\n${basis}`,names:[],...extra});
    };
    const currentPhase=addDays(dateAt(game.currentStart,r.phaseTime),r.phase);
    make('phase',currentPhase,game.currentVersion,-1,`当前版本起点 ${game.currentStart} + ${r.phase} 天，开启时刻按 ${r.phaseTime} 推算。`,{title:`${game.currentVersion} 下半开启`});
    const first=Math.max(0,Math.floor((now-anchor)/(r.cycle*DAY))-1);
    for(let i=first;i<first+40;i++){
      const update=addDays(anchor,i*r.cycle);if(update>range.end+r.liveLead*DAY)break;
      const version=forecastVersion(game,i),prefix=version+' ';
      const base=`下一次更新基准 ${game.anchor}${r.shift?`，整体偏移 ${r.shift>0?'+':''}${r.shift} 天`:''}；后续每 ${r.cycle} 天顺推。\n版本号从 ${game.nextVersion} 依次推算，暂按 x.${game.lastMinor??8} 后进入下一大版本。`;
      make('update',update,version,i,base,{title:`${prefix}版本更新`,note:'维护开始 06:00 · 预计完成 11:00'});
      make('live',atTime(addDays(update,-r.liveLead),r.liveTime),version,i,`${base}\n前瞻按更新日前 ${r.liveLead} 天 ${r.liveTime} 推算。`,{title:`${prefix}前瞻直播`});
      const phase=atTime(addDays(update,r.phase),r.phaseTime);
      make('phase',phase,version,i,`${base}\n下半按更新日后 ${r.phase} 天 ${r.phaseTime} 推算。`,{title:`${prefix}下半开启`});
    }
  }
  return events.sort((a,b)=>a.at-b.at||a.game.localeCompare(b.game)||a.kind.localeCompare(b.kind));
}
export function toICS(events){
  const escape=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const stamp=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const fold=line=>{const parts=[];let chunk='',bytes=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(bytes+size>73){parts.push(chunk);chunk=' '+c;bytes=1+size;}else{chunk+=c;bytes+=size;}}parts.push(chunk);return parts.join('\r\n');};
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wiki//Key Dates//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const e of events)lines.push('BEGIN:VEVENT','UID:'+escape(e.id)+'@wiki-local','DTSTAMP:'+stamp(Date.now()),'DTSTART:'+stamp(e.at),'SUMMARY:'+escape(`${e.status==='estimated'?'[预计] ':''}${e.gameName} · ${e.title}`),'DESCRIPTION:'+escape(`${e.status==='estimated'?'推算日期，可能调整。':'已公布日期。'}\n${e.basis}\n${e.sources.map(s=>s.url).join('\n')}`),'END:VEVENT');
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
