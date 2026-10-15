export const BANNER_PHASES={upper:'上半',lower:'下半',full:'全版本',multi:'多期 / 跨期',selection:'特殊自选',collaboration:'联动安排',permanent:'常驻 / 新手',unknown:'安排待确认'};
const day=value=>String(value??'').slice(0,10);
const duration=b=>b.end?(Date.parse(day(b.end))-Date.parse(day(b.start)))/86400000:null;
const primary={genshin:'Character Event',starrail:'Character Event',zenless:'Exclusive Channel'};

// 依据实际记录归类，不用固定版本周期生成日期；可显式维护 schedule 覆盖派生结果。
export function withBannerSchedules(entries) {
 const versions=new Map();
 for(const e of entries){if(e.category!=='banners'||e.banner?.sourceType!==primary[e.game]||e.banner.mode==='selection')continue;
  const key=e.game+':'+e.releaseVersion;if(!versions.has(key))versions.set(key,[]);versions.get(key).push(e.banner);
 }
 return entries.map(e=>{
  if(e.category!=='banners'||!e.banner||e.banner.schedule&&!e.banner.schedule.derived)return e;
  const b=e.banner,anchors=versions.get(e.game+':'+e.releaseVersion)??[],starts=[...new Set(anchors.map(a=>day(a.start)))].sort();
  let key='unknown',label=BANNER_PHASES.unknown,basis='缺少可对照的同版本常规角色卡池，暂不判断上下半。';
  if(b.mode==='standard'){key='permanent';label=e.type??BANNER_PHASES.permanent;basis='来源标记为常驻或新手卡池。';}
  else if(/Collaboration/i.test(b.sourceType??'')){key='collaboration';label='特殊安排 · 联动';basis='来源卡池类型为联动，不并入常规上下半。';}
  else if(b.mode==='selection'){key='selection';label='特殊安排 · '+(e.type??'自选');basis='来源标记为特殊自选卡池，保留独立安排。';}
  else if(starts.length){
   const index=starts.indexOf(day(b.start));
   if(duration(b)>=28&&day(b.start)===starts[0]&&(starts.length===1||day(b.end)>=day(anchors.reduce((a,c)=>day(a.end)>day(c.end)?a:c).end))){key='full';label='全版本开放';basis='该池实际开放区间覆盖本版本已收录的常规卡池阶段。';}
   else if(starts.length>2){key='multi';label=index<0||starts[index+1]&&day(b.end)>starts[index+1]?'特殊安排 · 跨期':'特殊安排 · 第 '+(index+1)+' 期';basis='同版本常规角色池记录超过两期；装备池跨越多个阶段或未与阶段起点一致时标为跨期。';}
   else if(index>=0){key=index===0?'upper':'lower';label=BANNER_PHASES[key]+(starts.length===1?'（当前首期）':'');basis=starts.length===1?'当前只收录本版本首期；按已收录首期展示，不推定后续日期。':'按同版本常规角色池实际开启先后归为上半、下半。';}
   else {key='multi';label='特殊安排 · 非同期';basis='实际开启日不对应本版本常规上下半起点。';}
  }
  return {...e,banner:{...b,schedule:{key,label,basis,derived:true}}};
 });
}
