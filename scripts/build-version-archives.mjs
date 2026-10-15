// 从固定来源批次生成事实索引；不修改 SQLite、个人资料或来源原文。
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {htmlLines,compareVersions,VERSION_SECTIONS} from '../shared/version-archive.mjs';
import {curateSections,launchSections,outsideArchive} from './version-archive-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const batch=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}-[a-f\d]{8}$/.test(batch??''))throw Error('请指定来源批次，例如 2026-10-04-4603c579');
const base=join(root,'data/sources/version-archive',batch),outputArg=process.argv.find(a=>a.startsWith('--output='));
const out=outputArg?resolve(root,outputArg.slice('--output='.length)):join(root,'data/versions');
if(!out.startsWith(resolve(root)+sep))throw Error('候选档案须保存在工作区内');
const readJSON=async file=>JSON.parse(gunzipSync(await readFile(join(base,file))));
const manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));
const characters=new Map(),phrases=new Map();
for(const [file,map] of [['TSCharacters.txt',characters],['TSPhrases.txt',phrases]]){
 for(const line of (await readFile(join(base,file),'utf8')).split('\n')){if(!line||line.startsWith('#'))continue;const [key,values]=line.trim().split('\t');if(key&&values)map.set(key,values.split(' ')[0]);}
}
const phrasePattern=new RegExp([...phrases.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
const simplify=text=>String(text).replace(phrasePattern,s=>phrases.get(s)).split('').map(c=>characters.get(c)??c).join('');
const datePattern=/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/;
const dateValue=text=>{const m=String(text??'').match(datePattern);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}${m[4]?' '+m[4].padStart(2,'0')+':'+m[5]:''}`;const value=String(text??'').match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d{2}/)?.[0];return value?new Date(value+' UTC').toISOString().slice(0,10):null;};
const clean=text=>String(text).replace(/^[•●◆◇▶※\s]+/,'').replace(/^\d+[.、](?!\d)\s*/,'').trim();
const quotes=text=>[...String(text).matchAll(/[「“\[]([^」”\]\n]{1,90})[」”\]]/g)].map(m=>m[1]);
const excluded=text=>/邦布|Bangboo/i.test(text);
function classify(text){
 if(/角色|代理人/.test(text)&&/全新|新增|New|Playable/.test(text))return 'characters';
 if(/武器|装备|光锥|音擎|圣遗物|遗器|驱动盘/.test(text))return 'equipment';
 if(/时装|装扮|衣装|服装|穿搭|外观|Outfit/.test(text))return 'outfits';
 if(/剧情|任务|故事|委托|Missions|Quests|Commissions|Story|Stories/.test(text))return 'story';
 if(/地区|区域|场景|地图|Locations|Regions|Area/.test(text))return 'map';
 if(/活动|Events/.test(text))return 'events';
 if(/敌人|敌方|怪物|Monsters|Bosses|Enemies/.test(text))return 'enemies';
 if(/系统|调整|优化|Optimizations/.test(text))return 'systems';
 if(/玩法|关卡|挑战|秘境|Domains|Game.?modes|七圣|螺旋|剧诗|奇域/.test(text))return 'gameplay';
 if(/元素反应|战斗机制|命途/.test(text))return 'systems';
 if(/修复|Fixes/.test(text))return 'fixes';
 return 'collection';
}
function extractOfficial(html,game){
 const lines=htmlLines(simplify(html)),sections=new Map(),fixes=new Map();
 let key=null,sub='',item=null,mode='meta',requirements=false,suppressed=false,blockedMajor=false,blockedMinor=false;
 const push=(name,extra={})=>{
  name=clean(name).replace(/^[■▌]/,'').trim();if(!name||excluded(name))return null;
  const list=sections.get(key)??[];sections.set(key,list);
  const existing=list.find(i=>i.name===name&&i.group===sub);
  if(existing)return item=existing;
  item={name,group:sub||undefined,availability:key==='events'?'limited':undefined,...extra};list.push(item);return item;
 };
 const detail=(field,value)=>{if(!item||suppressed)return;const values=item[field]??=[];if(!values.includes(value))values.push(value);};
 for(const [lineIndex,raw] of lines.entries()){
  const t=clean(raw);
  if(!/补偿/.test(t)&&(/^[〓▌【].*(?:问题修复|修复内容|BUG修复)/i.test(raw)||/^问题修复$/.test(t)))break;
  const major=/^[一二三四五六七八九十百]+[、.]/.test(raw)||game==='starrail'&&/^\d{1,2}[、.]\s*(?:全新|其他内容)/.test(raw);
  const boundary=/^[〓▌【].*(?:更新内容|全新内容|版本全新内容|调整|优化|改善|修复)/.test(raw);
  const minor=/^[■▶]\s*/.test(raw)&&t.length<100||/^\d{1,2}[.、](?!\d)\s*/.test(raw)&&t.length<60&&!/[。，；]/.test(t);
  if(major||boundary){blockedMajor=outsideArchive(t,game)||/限时活动|全新活动|版本活动|问题修复|修复内容/.test(t);blockedMinor=false;}
  else if(minor)blockedMinor=outsideArchive(t,game);
  if(blockedMajor||blockedMinor){item=null;requirements=false;continue;}
  if(excluded(t)){if(key==='events'&&item&&/邦布券/.test(t)){const list=sections.get(key);list.splice(list.indexOf(item),1);item=null;suppressed=true;}continue;}
  if(/^[〓▌【].*(问题修复|修复内容|BUG修复)/i.test(raw)||/^问题修复$/.test(raw)){mode='fixes';key='fixes';sub='其他';item=null;continue;}
  if(/^[〓▌【].*(调整.{0,3}(?:优化|改善)|(?:优化|改善).{0,3}调整)/.test(raw)||/^调整及(?:优化|改善)$/.test(raw)||/^▶.*优化/.test(raw)){mode='systems';key='systems';sub='其他';item=null;continue;}
  if(/^[〓▌【].*(本次更新内容|版本全新内容|更新内容|全新内容)/.test(raw)){mode='content';key='collection';item=null;continue;}
  if(/^[一二三四五六七八九十百]+[、.]|^\d{1,2}[、.]\s*(?:全新|新增|其他|新地图|新角色|新装备|新系统)/.test(raw)&&t.length<65){key=classify(t);mode=/调整|改善|改良|优化/.test(t)?'systems':'content';sub=t.replace(/^[一二三四五六七八九十百]+[、.]\s*/,'');item=null;requirements=false;suppressed=false;if(quotes(t).length)push(sub);continue;}
  if(mode==='meta')continue;
  // 1.6 的衣装位于“全新系统”内，单独归入时装，避免被系统优化筛选遗漏。
  if(mode==='content'&&/^(?:装扮|时装)系统(?:新增|开放)/.test(t)&&classify(t)==='outfits'){key='outfits';sub='新增衣装';item=null;requirements=false;suppressed=false;continue;}
  if(/^[▶■▌]\s*(?:全新|新增)(?:代理人|角色|装备|武器|音擎|光锥|剧情|地区|地图|场景|时装|活动|玩法)/.test(raw)&&t.length<30){key=classify(t);mode='content';sub=t;item=null;requirements=false;suppressed=false;continue;}
  if((/^[■▶]/.test(raw)&&t.length<100||/^[●◆◇]\s*(?:系统|音频|任务|场景|战斗|角色|怪物|玩法|其他|秘境|多人|敌人|装备|关卡|七圣)/.test(raw)&&t.length<25&&!quotes(t).length)&&!t.includes('条件')){
   if(mode==='fixes'){sub=t;continue;}
   if(mode==='systems'){sub=t;item=null;continue;}
   if(t==='敌方'){key='enemies';sub=t;item=null;continue;}
   if(['系统','其他','玩法','关卡','遗器'].includes(t)){key=classify(t);sub=t;item=null;continue;}
   sub='';push(t);requirements=false;suppressed=false;continue;
  }
  if(mode==='fixes'){
   if(!/修复|修正|解决/.test(t))continue;const record=fixes.get(sub)??{name:sub,issueCount:0,targets:[]};record.issueCount++;
   for(const q of quotes(t))if(!record.targets.includes(q)&&!excluded(q))record.targets.push(q);fixes.set(sub,record);continue;
  }
  // 维护说明以后的调整段：保存对象、动作与明确数值，不复制整段公告。
  if(mode==='systems'){
   if(/^[●◆◇]|^[^、]{1,20}$/.test(raw)&&!/[。，；]/.test(t)){sub=t;item=null;continue;}
   if(/新增|增加|优化|改善|调整|提高|降低|上限|移除|支持|提升|减少|下调/.test(t)){
    const action=t.match(/新增|增加|优化|调整|提高|降低|移除|提升|减少|支持/)?.[0]??'调整';
    const targets=quotes(t);const target=targets.length?targets.join(' / '):t.replace(/^.*?(?:新增|增加|优化|调整|提高|降低|移除|提升|减少|支持)(?:了)?/,'').split(/[，。；：]/)[0].slice(0,68);
    const values=[...t.matchAll(/\d+(?:\.\d+)?(?:%|点|个|次|级|小时|分钟|秒|天)/g)].map(m=>m[0]);
    const changes=[...t.matchAll(/(?:从|由)\s*(?:lv\.)?\s*(\d+(?:\.\d+)?)\s*(?:点|个|级|次)?\s*(?:提升|提高|增加|调整|降低|减少|上调|下调)(?:至|到|为)\s*(?:lv\.)?\s*(\d+(?:\.\d+)?)/gi)].map(m=>`${m[1]} → ${m[2]}`);
    push(`${action} · ${target||sub}`,{explanation:t,values:[...new Set(values)],changes,availability:/限时|活动期间|本期/.test(t)?'limited':undefined});
   }else if(item&&t.length>18&&!outsideArchive(t,game))detail('facts',t);
   continue;
  }
  if(mode==='content'&&['characters','equipment','story','map','outfits','events'].includes(key)&&/^[•●]/.test(raw)&&t.length<100&&!/[。；]/.test(t)&&!(/^(?:冒险|开拓|绳网|完成|获得|获取|等级|拥有|达到|解锁|该任务)/.test(t)||requirements&&/等级达到/.test(t))){push(t);requirements=false;suppressed=false;continue;}
  if(suppressed)continue;
  if(key==='map'&&/^[•●]/.test(raw)&&/^([^：:]{1,50})[:：](.+)/.test(t)){
   const [,name,description]=t.match(/^([^：:]{1,50})[:：](.+)/);push(name,{explanation:description});continue;
  }
  if(/限时开放|活动阶段开启|活动期间(?:开放|任务)/.test(t)&&item)item.availability='limited';
  if(/(?:开放|开启|活动|更新|解锁|获取|领取|参与|特惠|上线|结束|上架)时间\s*[:：]/.test(t)||/20\d{2}[/-]\d{1,2}[/-]\d{1,2}/.test(t)&&(/UTC|服务器时间/.test(t)||t.length<95)||/(?:版本更新后|版本更新完成后).*(永久开放|开启)|(?:将于|于)\d{1,2}月\d{1,2}日.*更新/.test(t)){
   detail('times',t.replace(/^.*?时间\s*[:：]/,''));if(item&&/永久|常驻/.test(t))item.availability='permanent';if(item&&item.availability!=='permanent'&&/限时|~|～/.test(t)&&!/折扣|时装|衣装|快速体验|超前点映|终末视界/.test(t))item.availability='limited';requirements=false;continue;
  }
  if(/(?:开放|开启|活动|解锁|参与|领取|购买)条件\s*[:：]/.test(t)){
   const named=t.match(/^[「“]([^」”]+)[」”].*?(?:开启|解锁)条件/);
   if(key==='story'&&named)push(`世界任务「${named[1]}」`);
   const value=t.replace(/^.*?条件\s*[:：]/,'');requirements=true;if(value)detail('requirements',value);continue;
  }
  if(/^完成.*(?:后|将|会).*(?:获得|能力|解锁|提升|汲取)/.test(t)){detail('facts',t);requirements=false;continue;}
  if(/^(?:冒险等阶|开拓等级|绳网等级|完成|该任务|「.*等级达到)/.test(t)||requirements&&/^(?:获得|获取|等级|拥有|达到|解锁)/.test(t)){detail('requirements',t);continue;}
  requirements=false;
  if(key==='events'){
   if((/^[•●■]/.test(raw)&&t.length<90&&!/[。；]/.test(t))||game==='genshin'&&t.length<50&&quotes(t).length&&!/[。？?]/.test(t)&&!/^本|建议|更多|累计|活动|参与|请|获得|完成|下一站|「绳匠|「没|「要|「战况/.test(t)&&lines.slice(lineIndex+1,lineIndex+4).some(l=>/活动时间|参与条件/.test(l))){push(t);continue;}
   if(/登录\d+天|累计.{0,8}登录|奖励|可获得|可获取|翻倍|双倍/.test(t)){
    const reward=[...t.matchAll(/(?:原石|星琼|菲林|纠缠之缘|星轨专票|加密母带|古老梦华|时装)[\s×x*：]*\d+|\d+\s*(?:个|张|枚|次|天)/g)].map(m=>m[0]);
    if(reward.length)detail('facts','奖励 / 要求数值：'+reward.join(' · '));
    if(/翻倍|双倍/.test(t))detail('facts','指定挑战奖励翻倍');
    if(/常驻|常时传略/.test(t))detail('facts','含可持续体验内容；限时奖励与活动期限分别计算');
   }continue;
  }
  if(/^\d{1,2}[.、]\s*[^。，；]{1,40}$/.test(raw)||/^(?:魔神任务|传说任务|世界任务|邀约|同行任务|开拓任务|委托|■)/.test(t)&&t.length<65){sub=t;item=null;if(quotes(t).length)push(t);continue;}
  if(/^位于/.test(t)){detail('facts',t);continue;}
  if(key==='enemies'&&item&&/首领|征讨领域|冒险之证「快速挑战」/.test(t)){item.group='新增首领';detail('facts',t);continue;}
  if(key==='enemies'&&item&&t.length>35&&/伤害|护盾|战斗/.test(t)){detail('facts',t);continue;}
  if(key==='story'&&item&&/新增代理人.*信赖/.test(t)){detail('facts','新增关联：'+quotes(t).join(' / '));continue;}
  if(['story','map','gameplay','systems'].includes(key)&&t.length<140&&/^(?:「[^」]+」|“[^”]+”|\[[^\]]+\])(?:[、，](?:「[^」]+」|“[^”]+”|\[[^\]]+\]))*$/.test(t)){push(t);continue;}
  if(['story','map','gameplay','systems'].includes(key)&&quotes(t).length&&t.length<140&&/(?:幕|章|任务|委托|反应)/.test(t)&&/[」”\]]$/.test(t)&&!/条件|完成|解锁|适用|^新增/.test(t)){push(t);continue;}
  if(key==='story'&&quotes(t).length&&/系列任务.*等。$|[」”]等。$/.test(t)){
   const names=quotes(t);push('世界任务：'+names.slice(0,3).join('、'),{explanation:'新增世界任务：'+names.join('、')+'。',availability:'permanent'});continue;
  }
  if(/^[「“\[]/.test(raw)&&t.length<100&&!/[。；？?！!…]/.test(t)||t.length<38&&!/[。，；：？?！!…]/.test(t)&&!/^亲爱的|旅行者|开拓者|绳匠|预计/.test(t)){
   if(/神之眼|武器：|星之楔|定位：/.test(t)){detail('facts',t);continue;}
   push(t,{availability:/永久|常驻/.test(t)?'permanent':/限时/.test(t)?'limited':undefined});continue;
  }
  if(/新增|增加|解锁|上架|开放|扩展|调整|优化|改善/.test(t)){
   const targets=quotes(t);if(targets.length){const action=t.match(/新增|增加|解锁|上架|开放|扩展|调整|优化|改善/)?.[0]??'新增';const oldKey=key;if(key==='collection'&&/优化|改善|调整|系统|界面/.test(t))key='systems';else if(key==='collection'&&/新增.*敌人/.test(t))key='enemies';push(`${action} · ${targets.join(' / ')}`,{explanation:t,availability:/限时|活动期间|新增活动/.test(t)?'limited':/永久|常驻/.test(t)?'permanent':undefined});key=oldKey;}
   else if(['collection','systems'].includes(key)&&/世界等级|命途|属性|树脂|电量|背包|上限/.test(t)){const oldKey=key;key='systems';push(t.split(/[，。；]/)[0],{explanation:t});key=oldKey;}
   else if(item)detail('facts',t);
  }else if(item&&['map','gameplay','systems'].includes(key)&&t.length>=12&&/可(?:以|通过|使用|前往|在|进行|随时|自由|完成|恢复|获取)|支持|用于|将|能够|上限|挑战|队伍|体力|树脂|电量|触发|引发|伤害|每\d|离线/.test(t)){
   detail('facts',t);
  }
 }
 if(fixes.size)sections.set('fixes',[...fixes.values()].map(f=>({...f,targets:f.targets.slice(0,60)})));
 return {lines,sections:[...sections].filter(([,items])=>items.length).map(([key,items])=>({key,label:VERSION_SECTIONS[key],items}))};
}
const launchNames={
 'Mondstadt':'蒙德','Liyue':'璃月','Dragonspine':'龙脊雪山','Golden Apple Archipelago':'金苹果群岛',
 'Herta Space Station':'空间站「黑塔」','Jarilo-VI':'雅利洛-VI','The Xianzhou Luofu':'仙舟「罗浮」','Astral Express':'星穹列车',
 'Sixth Street':'六分街','Brant Street Construction Site':'黑雁工地旧址','Scott Outpost':'斯科特哨站','Lumina Square':'光映广场','Ballet Twins Road':'芭莱大厦','HIA Club':'HIA俱乐部','Metro Station':'地铁站',
 'Simulated Universe':'模拟宇宙','Forgotten Hall':'忘却之庭','Hollow Zero':'零号空洞','Shiyu Defense':'式舆防卫','Combat Simulation':'实战模拟','Routine Cleanup':'定期清剿','Expert Challenge':'专业挑战室','Notorious Hunt':'恶名狩猎',
 'Spiral Abyss':'深境螺旋','Daily Commissions':'每日委托','Frostbearing Tree':'忍冬之树','Serenitea Pot':'尘歌壶','Stellar Reunion':'星之归还','Subzero Climate':'严寒环境'
};
function wikiFacts(text,catalog){
 const sections=new Map();let key=null,active=false,group='';
 const mapped=name=>launchNames[name]??catalog.find(e=>(e.aliases??[]).some(a=>String(a).toLowerCase().replace(/[^a-z\d]/g,'')===name.toLowerCase().replace(/[^a-z\d]/g,'')))?.name??name;
 for(const line of text.split('\n')){
  if(/^==[^=]/.test(line)){active=/Released Content|New Content|New Additions/.test(line);key=null;}
  if(!active||excluded(line))continue;
  if(/^===|^;/.test(line)){
   const heading=line.replace(/^=+|=+$/g,'').replace(/^;/,'').replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,(_,a,b)=>b??a).trim();
   const inferred=classify(heading);if(!/^====/.test(line)||inferred!=='collection')key=inferred;if(/Playable|Characters|Agents/.test(heading))key='characters';if(/Weapons|Light Cones|Artifacts|Relics|Drive Discs|W-Engines/.test(heading))key='equipment';
   if(/Wish|Warp|Search|Channels/.test(heading)){key=null;continue;}group=heading;continue;
  }
  if(!key||!line.startsWith('*'))continue;
  const names=[...line.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)].map(m=>m[2]??m[1]).filter(n=>!/^File:|Category:/.test(n));
  for(const m of line.matchAll(/\{\{Intro\/(?:Agent|Character|W-Engine|Light Cone)\/(?:Full|List)\|([^}|]+)/g))names.push(m[1]);
  for(const name of names){if(excluded(name))continue;const display=mapped(name);const list=sections.get(key)??[];sections.set(key,list);if(!list.some(i=>i.name===display))list.push({name:display,originalName:display!==name?name:undefined,group,sourceKind:'community',availability:key==='events'?'limited':undefined});}
 }
 return [...sections].map(([key,items])=>({key,label:VERSION_SECTIONS[key],items}));
}
function maintenance(lines){
 const startAt=lines.findIndex(l=>/^[〓■【].*更新(?:开始)?时间/.test(l));
 const start=startAt>=0?dateValue(lines.slice(startAt,startAt+3).join(' ')):null;
 const duration=lines.slice(Math.max(0,startAt),startAt+4).join(' ').match(/预计\s*(\d+)\s*(?:个)?小时/);
 const text=lines.join('\n');
 const endText=text.match(/版本(?:结束时间(?:为|是)?|的持续时间为)[^\n]*/)?.[0];
 return {start,timeZone:start?'UTC+8':undefined,estimatedHours:duration?Number(duration[1]):undefined,end:dateValue(endText)};
}
const files=await readdir(base);
await mkdir(out,{recursive:true});
for(const game of ['genshin','starrail','zenless']){
 const catalog=JSON.parse(await readFile(join(root,'data/catalog',game+'.json'),'utf8')).entries;
 const official=(await readJSON(game+'-official.json.gz')).archives.map(r=>({...r,snapshot:game+'-official.json.gz'}));
 if(game==='genshin'&&files.includes('genshin-early-index.json.gz')){
  const early=await readJSON('genshin-early-index.json.gz');
  for(const id of [103799,104016]){const r=early.data.list.find(i=>i.iInfoId===id);official.push({...r,language:'zh-tw',sourceURL:`https://genshin.hoyoverse.com/zh-tw/news/detail/${id}`,snapshot:'genshin-early-index.json.gz',overview:true});}
 }
 if(game==='starrail')for(const v of ['1.1','1.2']){if(!files.includes(`starrail-${v}.json.gz`))continue;const r=await readJSON(`starrail-${v}.json.gz`);official.push({...r.data,language:'zh-cn',sourceURL:`https://hsr.hoyoverse.com/zh-cn/news/${r.data.iInfoId}`,snapshot:`starrail-${v}.json.gz`});}
 if(game==='zenless'&&files.includes('zenless-2.0-official-site.json.gz')){
  const r=await readJSON('zenless-2.0-official-site.json.gz');
  for(const p of r.archives)official.push({...p,language:'zh-cn',sourceURL:`https://zenless.hoyoverse.com/zh-cn/news/${p.iInfoId}`,snapshot:'zenless-2.0-official-site.json.gz'});
 }
 const versions=[];
 for(const file of files.filter(f=>new RegExp(`^${game}-wiki-\\d+\\.json\\.gz$`).test(f))){
  const wiki=await readJSON(file);
  for(const page of wiki.query.pages){
   const revision=page.revisions?.[0],text=revision?.slots.main.content;if(!text)throw Error('缺失来源正文 '+page.title);
   const version=text.match(/^\|\s*(?:number|version)\s*=\s*([\d.]+)/m)?.[1]??wiki.query.redirects?.find(r=>r.to===page.title)?.from.split('/')[1]??page.title.split('/')[1];
   const minor=Number(version.split('.')[1]);const alias=game==='genshin'&&version.startsWith('6.')?['月之一','月之二','月之三','月之四','月之五','月之六','月之七','月之八'][minor]:null;
   const doc=official.find(r=>new RegExp(`(?:^|[^\\d])${version.replace('.','\\.')}\\s*(?:版本|Version)?`).test(r.sTitle))??(alias?official.find(r=>r.sTitle.includes(alias)):null);
   const indexDate=dateValue(text.match(/^\|\s*(?:date|release_date)\s*=\s*(.+)/m)?.[1]);
   const originalTitle=text.match(/^\|\s*title\s*=\s*(.+)/m)?.[1]?.trim();
   const sourceRefs=[{name:'社区版本索引',kind:'community',url:`https://${({genshin:'genshin-impact',starrail:'honkai-star-rail',zenless:'zenless-zone-zero'})[game]}.fandom.com/wiki/Version/${version}`,snapshot:`data/sources/version-archive/${batch}/${file}`,revision:revision.revid,sourceUpdatedAt:revision.timestamp}];
   let title='公测开服',titleOriginal=originalTitle,sections=[],timing={};
   const gaps=[];
   if(doc){
    const titleText=simplify(doc.sTitle);title=titleText.match(/[「“]([^」”]+)[」”]/)?.[1]??originalTitle;
    const parsed=extractOfficial(doc.sContent,game);sections=parsed.sections;timing=maintenance(parsed.lines);
    sourceRefs.unshift({name:doc.overview?'官方维护预告':'官方更新说明',kind:'official',url:doc.sourceURL,snapshot:`data/sources/version-archive/${batch}/${doc.snapshot}`,language:doc.language});
    if(game==='zenless'&&version==='2.2'&&files.includes('supplement-40841471.json.gz')){
     const notice=await readJSON('supplement-40841471.json.gz');title=notice.data.post.post.subject.match(/「([^」]+)」/)?.[1]??title;
     sourceRefs.push({name:'官方版本预下载通知（主题名）',kind:'official',url:'https://www.hoyolab.com/article/40841471',snapshot:`data/sources/version-archive/${batch}/supplement-40841471.json.gz`,language:'zh-cn'});
    }
    if(doc.overview)gaps.push('官方来源为维护预告，重要系统变化的详细说明仍待对应更新公告补充');
    if(title===originalTitle&&/[a-z]{3}/i.test(title))gaps.push('版本中文主题名尚待对应官方专题核查');
   }else{
    sections=launchSections(game);gaps.push('开服版本按社区目录整理主要章节、区域与玩法；重要系统的初始规则尚待官方中文资料补充');
   }
   sections=curateSections(sections,game);
   if(!indexDate&&!timing.start)gaps.push('版本上线日期待核查');
   if(timing.start&&indexDate&&timing.start.slice(0,10)!==indexDate.slice(0,10))gaps.push(`官方维护日期 ${timing.start.slice(0,10)} 与社区日期 ${indexDate.slice(0,10)} 不同，分别保留`);
   // 以官方维护开始日期作为更新日；开服日只记录索引明示日期。
   const releaseDate=timing.start?.slice(0,10)??indexDate?.slice(0,10)??null;
   versions.push({version,alias,title,titleOriginal,releaseDate,dateBasis:timing.start?'官方维护开始时间':'社区版本索引明示日期',maintenance:timing,sections,coverage:doc?(doc.overview?'official-overview':'official-notes'):'launch-index',gaps,sourceRefs});
  }
 }
 versions.sort((a,b)=>compareVersions(b.version,a.version));
 const data={schemaVersion:1,game,updatedAt:new Date().toISOString(),sourceFetchedAt:manifest.fetchedAt,sourceBatch:batch,scope:'档案用于快速了解主要剧情、地图、常驻玩法及重要系统变化；保留具体规则、开放条件与明确数值。新增角色、装备与套装仅关联已收录图鉴，卡池沿用实际记录。版本固定补偿、限时活动、问题修复及指定周期挑战不收录；完整公告保存在来源快照。',versions};
 const path=resolve(out,game+'.json');
 // 首次创建保护已有手动维护的档案，后续更新另选新文件供合并。
 if(process.argv.includes('--replace-same-batch')){const old=JSON.parse(await readFile(path,'utf8'));if(old.sourceBatch!==batch)throw Error('不能覆盖其他批次的已维护档案');await writeFile(path,JSON.stringify(data,null,2)+'\n');}
 else await writeFile(path,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({game,versions:versions.length,official:versions.filter(v=>v.coverage.startsWith('official')).length,sections:versions.reduce((n,v)=>n+v.sections.length,0),items:versions.reduce((n,v)=>n+v.sections.reduce((k,s)=>k+s.items.length,0),0),gaps:versions.filter(v=>v.gaps.length).map(v=>({version:v.version,gaps:v.gaps}))}));
}
