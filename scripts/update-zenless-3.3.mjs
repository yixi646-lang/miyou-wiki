// 绝区零 3.3 正式版补充；公开快照独立保存，仅新增条目及合并材料使用关系。
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {plain} from '../lib/normalize.mjs';
import {openLibrary} from '../lib/database.mjs';
import {buildCoreStats} from '../shared/core-stats.mjs';
import {resolveTermMarkup, normalizeSkillTerm, attachSkillTerms} from '../shared/skill-terms.mjs';
import {acquisitionChannels} from '../shared/acquisition-channels.mjs';
import {validateEntry, isExcludedEntry} from '../shared/catalog.mjs';
import {buildArtworkIndex} from './build-artwork-index.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const batch='data/sources/zenless/update-3.3-2026-10-22';
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const snapshot=async p=>JSON.parse(gunzipSync(await readFile(join(root,batch,p+'.json.gz'))));
const save=async(p,j)=>writeFile(join(root,p),JSON.stringify(j,null,2));
const source=(name,url,note)=>({name,url,...(note?{note}:{})});
const official=source('绝区零官网 · 3.3版本更新公告','https://zenless.hoyoverse.com/zh-cn/news/166963');
const current=source('绝区零官网 · 3.3版本限时频段（上期）','https://zenless.hoyoverse.com/zh-cn/news/166926');
const fetchedAt=(await snapshot('manifest')).fetchedAt;
const live=(await snapshot('manifest')).data.zzz;
assert.equal(live.live,'3.3');
assert.deepEqual(live.new.character,[1631,1641]);
assert.deepEqual(live.new.weapon,[13022,14163,14164]);
const [catalog,growth,archives,terms,channels,variants]=await Promise.all([
  'data/catalog/zenless.json','data/growth/zenless.json','data/versions/zenless.json',
  'shared/skill-term-data.json','shared/weapon-channel-data.json','data/character-artwork-variants.json'
].map(read));
const oldFiles={catalog:structuredClone(catalog),growth:structuredClone(growth),archives:structuredClone(archives),
  termCharacters:Object.fromEntries(['zenless-characters-1631','zenless-characters-1641'].map(id=>[id,terms.characters[id]??null])),
  commonTerms:structuredClone(terms.common.zenless),channels:structuredClone(channels),variants:structuredClone(variants)};
const charIndex=(await snapshot('character')).data, weaponIndex=(await snapshot('weapon')).data;
const items=(await snapshot('zh-item')).data;
const nouns=(await snapshot('noun')).data;
const avatars=(await snapshot('official-wiki-avatars')).data.data.list[0].list;
const nounSource=source('Nanoka · 3.3正式版名词目录','https://static.nanoka.cc/zzz/3.3/zh/noun.json');
const icons={Icon_Normal:'普通攻击键',Icon_Evade:'闪避键',Icon_Special:'特殊技键',
  Icon_SpecialReady:'强化特殊技键',Icon_UltimateReady:'终结技键',Icon_Switch:'切换键'};
const text=(value,level=1)=>plain(resolveTermMarkup(String(value??''),nouns)
  .replace(/<IconMap:([^>]+)>/g,(_,key)=>icons[key]??'')
  .replace(/\{CAL:(\d+)\+(\d+)\*\(AvatarSkillLevel\(\d+\)-1\),1,2\}/g,(_,base,step)=>String(Number(base)+Number(step)*(level-1))));
const nameValue=obj=>obj&&typeof obj==='object'?plain(obj.name??Object.values(obj)[0]):plain(obj);
const nounTerms=Object.values(nouns).map(n=>normalizeSkillTerm({name:plain(n.title)||plain(n.name),description:text(n.desc),source:nounSource})).filter(t=>t&&t.description);
const knownTerms=new Set(terms.common.zenless.map(t=>t.name));
terms.common.zenless.push(...nounTerms.filter(t=>!knownTerms.has(t.name)));
const cost=raw=>Object.entries(raw??{}).map(([id,count])=>({id:'zenless-materials-'+id,count:Number(count)}));
const groups=(rows,label)=>rows.map((row,i)=>({name:`${label} ${i+1}`,items:row.map(m=>({...m,name:items[m.id.split('-materials-')[1]]?.name}))}));
const added=[],newProfiles={},media=[],newVariants={};
const base=(category,id,name,extra={})=>({id:`zenless-${category}-${id}`,sourceId:String(id),game:'zenless',category,name,
  aliases:[],rarity:null,element:null,type:null,region:null,kind:null,secondary:[],tags:[],releaseVersion:'3.3',releaseDate:null,
  fetchedAt,origin:'snapshot',sources:[official],details:{},...extra});
function profile(entry,raw){
  const character=entry.category==='characters';
  const result={id:entry.id,entryId:entry.id,name:entry.name,category:entry.category,element:entry.element,type:entry.type,rarity:entry.rarity,
    minLevel:character?1:0,maxLevel:60,caps:[10,20,30,40,50,60],currencyId:'zenless-materials-10',currencyPerExp:0,
    expItem:{id:`zenless-materials-${character?300003:301003}`,value:3000},ascensions:[],tracks:[],
    sources:[source('Nanoka · 3.3正式版养成数据',`https://static.nanoka.cc/zzz/3.3/zh/${character?'character':'weapon'}/${entry.sourceId}.json`)]};
  if(character){
    result.xp=raw.level_exp.slice(0,59);
    result.ascensions=Object.values(raw.level).filter(l=>Object.keys(l.materials).length).map(l=>cost(l.materials));
    const labels={basic:'普通攻击',dodge:'闪避',special:'特殊技',chain:'连携技 / 终结技',assist:'支援技'};
    for(const [key,value]of Object.entries(raw.skill)){
      const levels=Object.keys(value.material??{}).filter(k=>Object.keys(value.material[k]).length).sort((a,b)=>a-b);
      if(levels.length)result.tracks.push({id:key,name:labels[key]??key,group:'技能',min:1,max:Math.max(...levels.map(Number))+1,
        steps:levels.map(k=>cost(value.material[k]))});
    }
    result.tracks.push({id:'core',name:'核心技',group:'核心技',min:0,max:6,labels:['未强化','A','B','C','D','E','F'],
      steps:Object.entries(raw.passive.materials).sort((a,b)=>a[0]-b[0]).map(([,v])=>cost(v))});
  }else{
    result.xp=Array.from({length:60},(_,i)=>Number(raw.level[i].exp));
    result.ascensions=raw.materials.split('|').filter(Boolean).map(t=>cost(Object.fromEntries(t.split(',').map(v=>v.split(':')))));
  }
  assert.equal(result.xp.length,character?59:60);
  assert(result.xp.every(v=>Number.isFinite(v)&&v>0));
  assert.equal(result.ascensions.length,5);
  return result;
}
function skillSpecs(row,level){
  return (row?.param??[]).map(p=>({name:text(p.name),value:text(p.desc,level).replace(/\{Skill:(\d+), Prop:\d+\}/g,(_,id)=>{
    const v=p.param[id];assert(v&&Number.isFinite(v.main)&&Number.isFinite(v.growth));
    return String(Number(((v.main+v.growth*(level-1))/(v.format==='%'?100:1)).toFixed(4)))+(v.format??'');
  })}));
}
for(const id of live.new.character){
  const raw=(await snapshot('zh-character-'+id)).data,index=charIndex[id];
  const avatar=avatars.find(a=>a.alias_name===raw.name);
  assert(avatar?.icon,`缺少官方头像 ${raw.name}`);
  const officialCamp=JSON.parse(JSON.parse(avatar.ext).c_43.filter.text).find(s=>s.startsWith('阵营/'))?.split('/')[1];
  const entry=base('characters',id,text(raw.name),{rarity:Number(raw.rarity)+1,element:nameValue(raw.special_element_type)||nameValue(raw.element_type),
    type:nameValue(raw.weapon_type),region:officialCamp??nameValue(raw.camp),aliases:[index.en,raw.partner_info.full_name]});
  // 首次获取日期仅采用已公布的对应频段，不以版本日替代后半代理人的日期。
  if(id===1641){entry.releaseDate='2026-10-21';entry.sources.push(current);}
  const rawSource=source('Nanoka · 3.3正式版角色资料',`https://static.nanoka.cc/zzz/3.3/zh/character/${id}.json`);
  entry.sources.push(rawSource,source('米游社 · 绳网情报站',`https://baike.mihoyo.com/zzz/wiki/content/${avatar.content_id}/detail`,'名称、阵营与独立头像'));
  const skills=[],labels={basic:'普通攻击',dodge:'闪避',assist:'支援技',special:'特殊技',chain:'连携技'};
  for(const [key,value]of Object.entries(raw.skill))for(const detail of value.description??[]){
    if(!detail.desc)continue;
    const parameters=value.description.find(row=>row.name===detail.name&&row.param);
    const levels=Array.from({length:16},(_,i)=>({level:i+1,description:text(detail.desc,i+1),specs:skillSpecs(parameters,i+1)}));
    skills.push({name:text(detail.name),type:labels[key],description:text(detail.desc),levels});
  }
  const passives=Object.values(raw.passive.level),last=passives.at(-1);
  for(let i=0;i<last.name.length;i++)skills.push({name:text(last.name[i]),type:'核心技',description:text(last.desc[i]),
    levels:passives.map((p,j)=>({level:j+1,description:text(p.desc[i])}))});
  const upgrades=Object.values(raw.talent).map((v,i)=>({name:text(v.name),type:`影画 ${i+1}`,description:text(v.desc)}));
  assert.equal(upgrades.length,6);
  const p=profile(entry,raw);newProfiles[entry.id]=p;
  const skin=Object.values(raw.skin)[0];
  entry.details={skills,upgrades,coreStats:buildCoreStats(raw),
    facts:{全名:text(raw.partner_info.full_name),生日:raw.partner_info.birthday,身高:raw.partner_info.stature+' cm',伤害类型:nameValue(raw.hit_type)},
    materials:groups(p.ascensions,'突破'),acquisition:[id===1641?'限定独家频段「倾掷浮生」':'限定独家频段「答案在风中」'],
    artwork:{image:`/assets/zenless/characters/${id}.webp`,source:source('Nanoka · 游戏角色立绘',`https://static.nanoka.cc/assets/zzz/${skin.image}.webp`)}};
  entry.image=`/assets/zenless/wiki-avatars/${id}.png`;entry.imageRemote=avatar.icon;
  const values=raw.stats;
  entry.statsTable=[1,10,20,30,40,50,60].map(level=>{
    const promotion=Object.values(raw.level).find(p=>level>p.level_min&&level<=p.level_max)??Object.values(raw.level).at(-1);
    return{level,hp:Math.floor(values.hp_max+values.hp_growth/10000*(level-1)+(promotion.hp_max??0)),
      attack:Math.floor(values.attack+values.attack_growth/10000*(level-1)+(promotion.attack??0)),
      defense:Math.floor(values.defence+values.defence_growth/10000*(level-1)+(promotion.defence??0))};
  });
  entry.stats=entry.statsTable.at(-1);entry.statsLevel=60;
  const definitions={};for(const s of [...skills,...upgrades]){
    const body=JSON.stringify(s);const used=nounTerms.filter(t=>body.includes(t.name));if(used.length)definitions[s.name]=used;
  }
  terms.characters[entry.id]={source:rawSource,skills:definitions};
  added.push(attachSkillTerms(entry,terms));
  media.push({id:entry.id,name:entry.name,game:'zenless',image:entry.details.artwork.image,url:entry.details.artwork.source.url,
    sourceName:'Nanoka · 游戏角色立绘',status:'saved',avatar:{image:entry.image,url:entry.imageRemote,sourceName:'米游社 · 绳网情报站头像',sourceUrl:`https://baike.mihoyo.com/zzz/wiki/content/${avatar.content_id}/detail`}});
  newVariants[entry.id]=Object.entries(raw.skin).slice(1).map(([key,s])=>({key:'skin-'+key,label:text(s.name).split('·').slice(1).join('·'),type:'skin',
    image:`/assets/zenless/artwork-extra/${id}-${key}.webp`,source:source('Nanoka · 3.3正式版时装立绘',`https://static.nanoka.cc/assets/zzz/${s.image}.webp`)}));
}
for(const id of live.new.weapon){
  const raw=(await snapshot('zh-weapon-'+id)).data,index=weaponIndex[id];
  const entry=base('weapons',id,text(raw.name),{rarity:Number(raw.rarity)+1,type:nameValue(raw.weapon_type),secondary:[text(raw.rand_property.name)],aliases:[index.en]});
  entry.sources.push(source('Nanoka · 3.3正式版音擎资料',`https://static.nanoka.cc/zzz/3.3/zh/weapon/${id}.json`));
  if(id===14164){entry.releaseDate='2026-10-21';entry.sources.push(current);}
  if(id!==13022){entry.signatureIds=[`zenless-characters-${id===14163?1631:1641}`];entry.signatureNote='对应代理人的专属音擎。';}
  const p=profile(entry,raw);newProfiles[entry.id]=p;
  const defense=raw.base_property.name.includes('防御'),key=defense?'defense':'attack';
  const sub=raw.rand_property.value/(raw.rand_property.format.includes('%')?10000:1),star=Object.values(raw.stars).at(-1);
  entry.stats={[key]:Number(index.atk),secondaryValue:Number((sub*(1+star.rand_rate/10000)).toFixed(4))};
  entry.statsTable=[{level:1,[key]:raw.base_property.value,secondaryValue:sub},{level:60,...entry.stats}];entry.statsLevel=60;
  entry.details={effects:Object.entries(raw.talents).map(([rank,v])=>({rank:Number(rank),name:text(v.name),description:text(v.desc)})),
    facts:{副属性:raw.rand_property.name,[defense?'初始防御力':'初始攻击力']:raw.base_property.value},materials:groups(p.ascensions,'改造'),
    acquisition:[id===13022?'活动奖励：3.3版本限时活动「怪奇诡屋惊魂记」':`限定音擎频道「${entry.name}」`]};
  assert.equal(entry.details.effects.length,5);
  entry.image=`/assets/zenless/weapons/${id}.webp`;entry.imageRemote=`https://static.nanoka.cc/assets/zzz/${index.icon}.webp`;
  channels[entry.id]=acquisitionChannels(entry);added.push(entry);
  media.push({id:entry.id,name:entry.name,image:entry.image,url:entry.imageRemote,sourceName:'Nanoka · 游戏音擎图标'});
}
const materialLinks=new Map();
for(const p of Object.values(newProfiles)){
  const groups=[['等级经验',[p.expItem]],['characters'===p.category?'角色突破':'装备突破',p.ascensions.flat()],
    ...p.tracks.map(t=>[t.group==='核心技'?'核心技强化':'天赋 / 技能升级',t.steps.flat()])];
  for(const [purpose,costs]of groups)for(const m of costs){
    assert(growth.materials[m.id],`尚未收录的养成材料 ${m.id}`);
    const a=materialLinks.get(m.id)??{characters:[],weapons:[],elements:[],paths:[],specialties:[],purposes:[]};
    a[p.category].push(p.entryId);a.purposes.push(purpose);if(p.category==='characters'){a.elements.push(p.element);a.specialties.push(p.type);}
    materialLinks.set(m.id,a);
  }
}
function patchMaterial(entry){
  const extra=materialLinks.get(entry.id);if(!extra)return entry;
  const applicability={...entry.applicability};
  for(const [k,v]of Object.entries(extra))applicability[k]=[...new Set([...(applicability[k]??[]),...v])].sort();
  const facts={...entry.details?.facts,用途:applicability.purposes.join('、')};
  if(applicability.elements.length)facts.适用角色属性=applicability.elements.join(' / ');
  if(applicability.specialties.length)facts.适用特性=applicability.specialties.join(' / ');
  const sources=[...entry.sources];if(!sources.some(s=>s.url==='https://static.nanoka.cc/zzz/3.3/zh/item.json'))sources.push(source('Nanoka · 3.3正式版养成关联','https://static.nanoka.cc/zzz/3.3/zh/item.json'));
  let summary=entry.details?.summary;
  if(/^用于[^。]+。适用于[^。]+特性的相关养成项目。$/.test(summary??''))summary=`用于${applicability.purposes.join('、')}。适用于${applicability.specialties.join('、')}特性的相关养成项目。`;
  return {...entry,applicability,details:{...entry.details,...(summary?{summary}:{}),facts},sources};
}
const newByName=new Map(added.map(e=>[e.category+':'+e.name,e.id]));
function patchBanner(entry){
  if(entry.game!=='zenless'||entry.category!=='banners'||!entry.banner)return entry;
  const groups=entry.banner.groups.map(g=>({...g,items:g.items.map(item=>!item.id&&newByName.has(item.category+':'+item.name)?{...item,id:newByName.get(item.category+':'+item.name)}:item)}));
  return {...entry,banner:{...entry.banner,groups}};
}
for(const e of added){validateEntry(e);assert(!isExcludedEntry(e));assert(!JSON.stringify(e).match(/<Term:|\{CAL:|\{Skill:|名词 \d+ 待补充/));}
const archive={version:'3.3',alias:null,title:'重返天空的旅程',titleOriginal:null,releaseDate:'2026-10-21',dateBasis:'官方维护开始时间',
  maintenance:{start:'2026-10-21 06:00',timeZone:'UTC+8',estimatedHours:5,end:'2026-12-02 06:00'},coverage:'official-notes',gaps:[],
  sections:[
    {key:'story',label:'剧情与任务',items:[
      {name:'主线第三季第四章「重返天空的旅程」',group:'全新剧情',availability:'permanent',times:['3.3版本更新后永久开放。'],requirements:['完成主线第三季第三章「她与她的隐秘往事」。'],facts:['完成主线第一季第一章·幕间晋升后，可通过「超前点映」提前体验第三季主线。']},
      {name:'菲欧妮、赛维里安信赖事件与「密友同行」',group:'全新剧情',availability:'permanent',requirements:['获取对应代理人，并完成工作台「合作者档案」所列前置剧情。']}]},
    {key:'map',label:'地图与探索',items:['[管制区]宁息屿','[管制区]空域总控塔'].map(name=>({name:'罗斯凯利法 · '+name,group:'全新地区',requirements:['在主线第三季第四章「重返天空的旅程」期间解锁。']}))},
    {key:'outfits',label:'时装与外观',items:[{name:'菲欧妮 · 病名为生',group:'全新时装'},{name:'菲欧妮 · 空想症候',group:'全新时装'},{name:'赛维里安 · 肃仪无犯',group:'全新时装',times:['2026-11-11 12:00（服务器时间）起上架。']}]},
    {key:'systems',label:'系统与体验优化',items:[
      {name:'邦布机甲',explanation:'在主线剧情和宁息屿探索中通过交互驾驶机甲；近战与远程射击模式具有不同技能，可在战斗中自由切换。'},
      {name:'代理人攻略与 Fairy 推荐配队',explanation:'可从代理人主界面、功能导览、快捷手册或绳匠指南打开。推荐配队按实际拥有情况生成，提供配队思路与操作介绍，并支持一键应用预备编队；该推荐功能处于测试阶段。部分代理人另有战斗资源与操作手法教学视频。'},
      {name:'战前挑战提示',explanation:'恶名狩猎、专业挑战室等常驻玩法在编队时评估上阵人数与养成情况，并可查看培养优先级；部分挑战还评估配队并提供指引。可自行开关挑战提示。'},
      {name:'绳匠晋升指引',explanation:'绳匠档案展示声望晋升权益；满足晋升条件后，代理人、音擎养成界面及实战模拟室、区域巡防界面提供提醒与晋升任务跳转。'},
      {name:'零号空洞 · 战术棱镜',explanation:'新增菲欧妮、赛维里安的战术棱镜方案和对应探索任务。'},
      {name:'迷宫诡域 · 拟态单质合成',explanation:'高危调查中可从随机容器、特定怪物或 UP 调查事件获取三种拟态单质。每次拾取获得仅本局生效的随机侵蚀症状，拾取越多越易出现重度侵蚀；集齐三种自动合成贵重成品，单局可重复合成。'},
      {name:'迷宫诡域 · 地图排名与物品操作',explanation:'图鉴记录每赛季不同地图的最佳数据与排名；键鼠拖拽物品时仍可用滚轮滚动列表；移动端可设置非战斗普攻键与物品交互；物资箱支持一键快捷丢弃与使用。'}]}
  ],sourceRefs:[{...official,kind:'official',snapshot:batch+'/official-166963.json.gz',language:'zh-cn'},
    {name:'Nanoka · 3.3正式版目录',kind:'community',url:'https://static.nanoka.cc/zzz/3.3/character.json',snapshot:batch+'/character.json.gz',language:'zh-cn'}]};

if(!process.argv.includes('--apply')){
  console.log(JSON.stringify({additions:added.map(e=>({id:e.id,name:e.name,date:e.releaseDate})),profiles:Object.keys(newProfiles),materialRelations:materialLinks.size,
    archive:archive.version,skins:Object.values(newVariants).flat().map(v=>v.label),apply:'--apply'},null,2));
  process.exit(0);
}
async function download(record){
  const path=join(root,record.image.slice(1));let bytes;
  try{bytes=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;
    for(let attempt=0;attempt<2;attempt++)try{
      const r=await fetch(record.url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${r.status} ${record.url}`);
      bytes=Buffer.from(await r.arrayBuffer());break;
    }catch(error){if(attempt===1)throw Error(`图片下载失败 ${record.url}: ${error.message}`);}
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    assert((png||webp)&&bytes.length>128&&bytes.length<16*1024*1024,'无效图像 '+record.url);
    await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});
  }
  record.bytes=bytes.length;
}
const downloads=media.flatMap(r=>[r,...r.avatar?[r.avatar]:[]]).concat(Object.values(newVariants).flat().map(v=>({image:v.image,url:v.source.url})));
let cursor=0;
const downloaded=await Promise.allSettled(Array.from({length:3},async()=>{while(cursor<downloads.length)await download(downloads[cursor++]);}));
for(const result of downloaded)if(result.status==='rejected')throw result.reason;
const mediaPath=batch+'/media.json';await save(mediaPath,{fetchedAt,records:media});
for(const [id,choices]of Object.entries(newVariants)){
  variants.variants[id]??=[];
  for(const choice of choices)if(!variants.variants[id].some(v=>v.key===choice.key))variants.variants[id].push(choice);
}
const library=openLibrary(join(root,'data/library/wiki.sqlite'));
try{
  const personal=()=>JSON.stringify({favorites:library.favorites(),metadata:library.db.prepare("SELECT * FROM metadata WHERE key!='seed-fingerprint:v2' ORDER BY key").all()});
  const beforePersonal=personal(),beforeRows=library.all();
  const existing=new Map(beforeRows.map(e=>[e.id,e]));
  const newEntries=added.filter(e=>!existing.has(e.id));
  const patches=beforeRows.map(e=>patchBanner(patchMaterial(e))).filter(e=>JSON.stringify(e)!==JSON.stringify(existing.get(e.id)));
  const backupDirectory=join(root,'data/backups');await mkdir(backupDirectory,{recursive:true});
  const beforePath=join(backupDirectory,'zenless-3.3-before-2026-10-22.json.gz');
  try{await access(beforePath);}catch{await writeFile(beforePath,gzipSync(JSON.stringify({...oldFiles,entries:patches.map(e=>existing.get(e.id))})),{flag:'wx'});}
  library.db.exec('BEGIN IMMEDIATE');
  try{
    for(const e of newEntries)library.create(e);
    for(const e of patches)if(JSON.stringify(e)!==JSON.stringify(existing.get(e.id)))library.update(e.id,e,e.revision);
    assert.equal(personal(),beforePersonal,'个人资料发生非预期变化');
    library.db.exec('COMMIT');
  }catch(error){library.db.exec('ROLLBACK');throw error;}
  for(const e of added)if(!catalog.entries.some(c=>c.id===e.id))catalog.entries.push(e);
  catalog.entries=catalog.entries.map(e=>patchBanner(patchMaterial(e)));catalog.fetchedAt=fetchedAt;
  const bannerFile='data/catalog/banner-updates-2026-10-20.json',bannerBatch=await read(bannerFile);
  const beforeBannerEntries=bannerBatch.entries.filter(e=>JSON.stringify(e)!==JSON.stringify(patchBanner(e)));
  if(beforeBannerEntries.length){
    await writeFile(join(backupDirectory,'zenless-3.3-banner-links-before-2026-10-22.json.gz'),gzipSync(JSON.stringify({initializer:beforeBannerEntries,entries:beforeRows.filter(e=>beforeBannerEntries.some(b=>b.id===e.id))})),{flag:'wx'});
    bannerBatch.entries=bannerBatch.entries.map(patchBanner);await save(bannerFile,bannerBatch);
  }
  for(const [id,p]of Object.entries(newProfiles))growth.profiles[id]??=p;
  for(const [id,links]of materialLinks)growth.materials[id].purposes=[...new Set([...growth.materials[id].purposes,...links.purposes])].sort();
  growth.version='3.3';growth.fetchedAt=fetchedAt;
  if(!archives.versions.some(v=>v.version==='3.3'))archives.versions.unshift(archive);
  archives.updatedAt=fetchedAt;archives.sourceFetchedAt=fetchedAt;
  await save('data/catalog/zenless.json',catalog);await save('data/growth/zenless.json',growth);await save('data/versions/zenless.json',archives);
  await writeFile(join(root,'shared/skill-term-data.json'),JSON.stringify(terms));await writeFile(join(root,'shared/weapon-channel-data.json'),JSON.stringify(channels));await save('data/character-artwork-variants.json',variants);
  const artwork=await buildArtworkIndex();
  const outcome={version:'3.3',fetchedAt,additions:added.map(e=>({id:e.id,name:e.name,releaseDate:e.releaseDate})),
    profiles:Object.keys(newProfiles),materialRelations:materialLinks.size,newMaterials:0,newSets:0,media:mediaPath,artwork,
    dateGaps:added.filter(e=>!e.releaseDate).map(e=>({id:e.id,name:e.name,reason:'未核实首次可获取日；不以版本或活动开始日替代。'})),
    identity:{'zenless-characters-1631':{name:'赛维里安',region:'都市秩序部',basis:'官方绳网情报站名称与阵营。'}},
    sources:batch,personalDataUnchanged:personal()===beforePersonal};
  await save(batch+'/manifest.json',outcome);console.log(JSON.stringify(outcome,null,2));
}finally{library.close();}
