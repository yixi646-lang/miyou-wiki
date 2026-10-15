import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {signalSourceType,pairSignalBanners} from '../lib/signal-channels.mjs';
import {wikiText,template,plainFact,parameters,chineseNames,factKey,wikiSection,sourceVersion,poolFields,poolNames,normalizeBannerTime} from '../lib/wiki-facts.mjs';
const games={genshin:'genshin-impact',starrail:'honkai-star-rail',zenless:'zenless-zone-zero'},cutoff='2026-10-03';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const loadPages=async(game,name)=>{try{const j=await read(`data/sources/${game}/${name}.json`);return j.pages??j.query?.pages??[];}catch{return [];}};
const catalogs={},updates=[],banners=[],audit={cutoff,games:{},missing:[],unlinked:[]};
const source=(game,page,note)=>({name:`${game==='genshin'?'Genshin Impact':game==='starrail'?'Honkai: Star Rail':'Zenless Zone Zero'} Wiki · ${page.title}`,url:`https://${games[game]}.fandom.com/wiki/${encodeURIComponent(page.title.replaceAll(' ','_'))}`,note});
for(const game of Object.keys(games)){
  const catalog=catalogs[game]=await read(`data/catalog/${game}.json`),entries=catalog.entries;
  const pages=[...await loadPages(game,'acquisition-characters-pages'),...await loadPages(game,'acquisition-weapons-pages'),...await loadPages(game,'acquisition-supplement-pages')];
  const history=await loadPages(game,'history-pages'),shops=game==='starrail'?await loadPages(game,'shop-pages'):await loadPages(game,'acquisition-supplement-pages');
  const bannerNames=new Map((await loadPages(game,'banner-names')).map(p=>[factKey(p.title),{page:p,name:chineseNames(wikiText(p))[0]}]));
  const englishWeapons=game==='genshin'?Object.values((await read('data/sources/genshin/english-weapons.json')).data.English.weapons):[];
  const zzzIndex=game==='zenless'?await read('data/sources/zenless/nanoka-character-index.json'):{};
  const pageFor=new Map(),titleEntry=new Map(),titleChinese=new Map();
  const traveler=pages.find(p=>p.title===(game==='genshin'?'Traveler':'Trailblazer'));
  for(const page of pages){const t=wikiText(page),names=chineseNames(t);if(names[0])titleChinese.set(factKey(page.title),names[0]);}
  for(const entry of entries.filter(e=>['characters','weapons'].includes(e.category))){
    const english=game==='genshin'&&entry.category==='weapons'?englishWeapons.find(w=>String(w.id)===String(entry.sourceId))?.name:zzzIndex[entry.sourceId]?.en;
    let page=pages.find(p=>{const t=wikiText(p),inf=parameters(template(t,entry.category==='characters'?(game==='zenless'?'Agent Infobox':'Character Infobox'):game==='genshin'?'Weapon Infobox':game==='starrail'?'Light Cone Infobox':'W-Engine Infobox'));
      return inf.id&&String(inf.id)===String(entry.sourceId)||chineseNames(t).some(name=>[entry.name,...entry.aliases??[]].some(n=>factKey(n)===factKey(name)))||english&&(factKey(english)===factKey(p.title)||factKey(english)===factKey(inf.brief_name));
    });
    if(!page&&/^开拓者|^[空荧]$/.test(entry.name))page=traveler;
    if(!page&&entry.name==='三月七（巡猎）')page=pages.find(p=>p.title==='March 7th');
    if(!page&&game==='genshin'&&entry.name==='杜林')page=pages.find(p=>p.title==='Durin');
    if(!page&&game==='zenless'&&entry.id==='zenless-weapons-14162')page=pages.find(p=>p.title==='Crimson Moon Casket');
    if(page){pageFor.set(entry.id,page);const old=titleEntry.get(factKey(page.title));if(!old||entry.name==='三月七')titleEntry.set(factKey(page.title),entry);if(entry.name==='三月七')titleEntry.set(factKey('March 7th (Preservation)'),entry);if(entry.name==='三月七（巡猎）')titleEntry.set(factKey('March 7th (The Hunt)'),entry);}
  }
  const pools=history.map(page=>{const t=wikiText(page),inf=parameters(template(t,game==='genshin'?'Wish':game==='starrail'?'Warp':'Signal Search Infobox'));if(game==='zenless'){inf.raw_type=inf.type;inf.type=signalSourceType(page.title,inf.type);}inf.time_start=normalizeBannerTime(inf.time_start);inf.time_end=normalizeBannerTime(inf.time_end);let correction=null;if(game==='starrail'&&inf.time_start?.startsWith('2023-04-25')){inf.time_start='2023-04-26 10:00:00';correction='来源模板将开服日误写为前一天；按官方公测时间校正为 2023-04-26 10:00 UTC+8。';}return{page,t,inf,pool:poolFields(t,game),start:inf.time_start,correction};}).filter(x=>x.start&&x.start.slice(0,10)<=cutoff);
  const chronological=[...pools].sort((a,b)=>b.start.localeCompare(a.start));
  // 使用最近一期明确列出的普通池内容，区分限定与后来进入常驻池的角色。
  const ordinary=new Set();for(const x of chronological.filter(p=>/^(?:Character Event|Weapon Event|Light Cone Event|Exclusive Channel|W-Engine Channel|Standard|Stable Channel)$/.test(p.inf.type??'')).slice(0,20))for(const[key,value]of Object.entries(x.pool))if(/^(?:character|weapon|lightcone|agent|w-engine)_(?:[345]|[SAB])$/.test(key))for(const name of poolNames(value))ordinary.add(factKey(name));
  for(const x of pools){
    const {page,t,inf,pool}=x,start=inf.time_start,end=/^20\d\d-/.test(inf.time_end??'')?inf.time_end:null;
    if(game==='zenless'&&inf.type==='Bangboo Channel')continue;
    if(end&&end<start){audit.missing.push({game,page:page.title,error:'卡池起止时间冲突'});continue;}
    let version=sourceVersion(t);if(!version||Number(version)<1)version=['Standard','Beginner','Novice'].includes(inf.type)?'1.0':null;
    if(!version){audit.missing.push({game,page:page.title,error:'卡池缺少版本'});continue;}
    const permanent=!end&&/Standard|Beginner|Novice|Bangboo|Exclusive|Collaboration|Stable/.test(inf.type??'');
    const typeMap={genshin:{'Character Event':'角色活动祈愿','Character Event-2':'角色活动祈愿','Weapon Event':'武器活动祈愿','Chronicled':'集录祈愿','Standard':'常驻祈愿','Beginner':'新手祈愿'},starrail:{'Character Event':'角色活动跃迁','Light Cone Event':'光锥活动跃迁','Collaboration Character':'联动角色跃迁','Collaboration Light Cone':'联动光锥跃迁','Standard':'常驻跃迁','Beginner':'始发跃迁'},zenless:{'Exclusive Channel':'独家频道','W-Engine Channel':'音擎频道','Stable Channel':'常驻频道','Bangboo Channel':'邦布频道','Exclusive Rescreening':'独家重映','W-Engine Reverberation':'音擎回响'}};
    const type=inf.duration==='beginner'&&game==='starrail'?'始发跃迁':typeMap[game][inf.type]??({'Novice':'新手祈愿','Lightrace':'溯光祈愿','Character Collaboration':'联动角色跃迁','Light Cone Collaboration':'联动光锥跃迁','Permanent Channel':'常驻频道','Character Rerun':'角色复刻跃迁','Light Cone Rerun':'光锥复刻跃迁'}[inf.type])??inf.type;
    if(!type){audit.missing.push({game,page:page.title,error:'缺少卡池类型'});continue;}
    const groups=[];
    for(const[key,value]of Object.entries(pool)){
      if(!/_(?:[345]|[SAB])_F$/.test(key)&&!permanent&&!/Chronicled|Lightrace/.test(inf.type??''))continue;
      if(!/^(character|weapon|lightcone|agent|w-engine|bangboo)_/.test(key))continue;
      const names=poolNames(value);if(!names.length)continue;
      const isChar=/^(character|agent)_/.test(key),r=key.match(/_([345SAB])/)[1],rarity=({S:5,A:4,B:3}[r]??Number(r));
      const label=(game==='zenless'?({5:'S 级',4:'A 级',3:'B 级'}[rarity]):rarity+' 星')+' '+(key.startsWith('bangboo')?'邦布':isChar?(game==='zenless'?'代理人':'角色'):game==='genshin'?'武器':game==='starrail'?'光锥':'音擎');
      const items=names.map(name=>{const target=titleEntry.get(factKey(name));return{id:target?.id??null,name:target?.name??titleChinese.get(factKey(name))??name,rarity};});
      const selection=/Chronicled|Lightrace|Rescreening|Reverberation|Rerun/.test(inf.type??'');
      const standard=/^(Standard|Beginner|Novice|Bangboo Channel|Stable Channel|Permanent Channel)$/.test(inf.type??'');
      const role=selection&&rarity===5?'selectable':!standard&&key.endsWith('_F')?'up':'pool';
      groups.push({name:label,items,sourceKey:key,role});
    }
    if(!groups.length){audit.missing.push({game,page:page.title,error:'来源未提供卡池内容'});continue;}
    const mainGroup=groups.find(g=>g.items[0]?.rarity===5)??groups[0],rootName=bannerNames.get(factKey(page.title.split('/')[0])),featuredNames=mainGroup.items.map(i=>i.name).join(' / '),name=permanent?(type==='始发跃迁'?'始发跃迁':({'Standard':game==='genshin'?'奔行世间':'群星跃迁','Novice':'初行者推荐祈愿','Stable Channel':'热门卡司','Bangboo Channel':'卓越搭档'}[inf.type]??type)):rootName?.name?(rootName.name===featuredNames?rootName.name+' · '+type:rootName.name+' · '+featuredNames):featuredNames+' · '+type;
    const id=`${game}-banners-${createHash('sha256').update(page.title).digest('hex').slice(0,16)}`;
    const officialLink=inf.link?.match(/https:\/\/[^\s<>\]}]+/)?.[0];
    const sources=[source(game,page,'历史卡池起止时间、版本与当期提升概率的条目；公开 API 快照')];if(officialLink&&/hoyolab\.com|hoyoverse\.com|mihoyo\.com/.test(new URL(officialLink).hostname))sources.push({name:'来源页面引用的官方卡池公告',url:officialLink});
    if(rootName?.name)sources.push(source(game,rootName.page,'卡池名称的简体中文字段'));
    if(x.correction)sources.push({name:'HoYoLAB · 官方公测日期公告',url:'https://www.hoyolab.com/article/17235634',note:x.correction});
    banners.push({id,game,category:'banners',name,aliases:[page.title],rarity:null,type,releaseVersion:version,releaseDate:start.slice(0,10),fetchedAt:new Date().toISOString(),origin:'snapshot',sources,details:{title:page.title.split('/')[0],facts:{卡池类型:type}},banner:{mode:/^(Standard|Beginner|Novice|Bangboo Channel|Stable Channel|Permanent Channel)$/.test(inf.type??'')?'standard':/Chronicled|Lightrace|Rescreening|Reverberation|Rerun/.test(inf.type??'')?'selection':'event',sourceType:inf.type,rawSourceType:inf.raw_type??inf.type,start,end,timeZone:inf.time_start_offset==='GMT+8'?(end?'开始 UTC+8 / 结束服务器时间':'UTC+8'):'服务器时间',groups,note:x.correction??(permanent?(inf.duration==='beginner'?'新手卡池，完成限定抽数后关闭。':'长期开放的卡池；此处保留采集时的内容记录。'):/Chronicled|Lightrace|Rescreening|Reverberation|Rerun/.test(inf.type??'')?'该卡池支持复刻或选择目标，列出来源记录中的可选 / 提升概率条目。':'列出当期提升概率的角色或装备。')}});
  }
  for(const entry of entries.filter(e=>['characters','weapons'].includes(e.category))){
    const page=pageFor.get(entry.id),t=page?wikiText(page):'',inf=parameters(template(t,entry.category==='characters'?(game==='zenless'?'Agent Infobox':'Character Infobox'):game==='genshin'?'Weapon Infobox':game==='starrail'?'Light Cone Infobox':'W-Engine Infobox'));
    const avail=wikiSection(t,'Availability'),obtain=Object.entries(inf).filter(([k])=>/^(?:obtain\d*|how_to_obtain)$/.test(k)).map(([,v])=>v).join('\n'),proof=(obtain+'\n'+avail).replace(/<!--[\s\S]*?-->/g,''),channels=new Set(),sources=[];
    const add=value=>channels.add(value),nameKey=factKey(page?.title??'');
    const appearance=pools.filter(p=>Object.values(p.pool).some(v=>poolNames(v).some(n=>factKey(n)===nameKey)));
    const featured=appearance.filter(p=>Object.entries(p.pool).some(([k,v])=>k.endsWith('_F')&&poolNames(v).some(n=>factKey(n)===nameKey)));
    if(page)sources.push(source(game,page,'获取渠道；保留来源页面的事实快照'));
    if(game==='genshin'){
      if(/^空$|^荧$/.test(entry.name))add('游戏开局选择主角获得');
      else if(entry.name==='埃洛伊')add('联动邮件赠送（2.1–2.2 版本，历史渠道）');
      else{
        if(/Standard Wish|Wanderlust Invocation/.test(proof)||ordinary.has(nameKey))add('常驻祈愿（奔行世间）');
        if(/Character Event Wish/.test(proof)||entry.category==='characters'&&/Event Wish|Event-Exclusive/.test(proof+'\n'+inf.obtainType)||featured.some(p=>/Character/.test(p.inf.type)))add('角色活动祈愿');
        if(/Weapon Event Wish/.test(proof)||featured.some(p=>/Weapon/.test(p.inf.type)))add('武器活动祈愿');
        if(/Chronicled Wishes|chronicled=1/.test(proof)&&appearance.some(p=>/Chronicled/.test(p.inf.type)))add('集录祈愿（历史记录）');
        if(/Beginners' Wish/.test(proof))add('新手祈愿（初行者推荐祈愿）');
        if(/Paimon's Bargains/.test(proof))add('商店兑换（派蒙的珍品）');
        if(/Forging/.test(obtain))add('锻造（部分配方需要先解锁）');
        if(/Fishing/.test(obtain))add('钓鱼协会兑换');
        if(/Battle Pass/.test(obtain))add('纪行宝匣（购买珍珠纪行并达到 30 级）');
        if(/Chests/.test(obtain))add('宝箱获取');
        if(/Investigation/.test(obtain))add('调查点获取');
        if(/Shops/.test(obtain))add('商店购买');
        if(/Default/.test(obtain))add('角色初始装备');
        if(/Dialogue/.test(obtain))add('与 NPC 对话获得');
        if(/Quests|Complete the Quest|Quest Reward|Mission Reward/.test(proof))add('任务奖励');
        if(/Events|\]\]\s*event|\]\]\s*Event|Version [\w.]+ Event|event \(/i.test(proof))add('活动奖励（含历史活动）');
        if(/Stellar Reunion/.test(obtain))add('回归活动「星之归还」奖励');
        if(/Adventure Rank/.test(obtain))add('冒险等阶奖励');
        if(/stone in.*Guyun/.test(obtain))add('孤云阁场景拾取');
        if(/Mail|PS4\/PS5/.test(obtain))add('邮件赠送（对应平台 / 联动活动，历史渠道）');
        if(/Unreleased/.test(obtain))add('尚未开放获取（来源目录收录的未实装装备）');
      }
      const free={安柏:'序章魔神任务奖励',凯亚:'序章魔神任务奖励',丽莎:'序章魔神任务奖励',芭芭拉:'常驻活动「浅唱祈礼」奖励',香菱:'深境螺旋 3 层 3 间奖励',柯莱:'深境螺旋 4 层 3 间奖励',琳妮特:'冒险等阶 25 级常驻奖励',卡齐娜:'纳塔魔神任务奖励',爱诺:'挪德卡莱魔神任务奖励'};if(free[entry.name])add(free[entry.name]);
      if(/Stoking the Ancient Flames|Dragonspine's Glacial Secret/.test(obtain))add('任务 / 探索奖励');
    }else if(game==='starrail'){
      if(entry.name.startsWith('开拓者'))add(entry.type==='毁灭'?'游戏开局选择主角获得':`推进开拓任务解锁「${entry.type}」命途`);
      else if(entry.name==='三月七（巡猎）'){add('仙舟剧情任务解锁巡猎形态');}
      else{
        if(/Stellar Warp/.test(proof)||ordinary.has(nameKey))add('常驻跃迁（群星跃迁）');
        if(/Departure Warp/.test(proof))add('始发跃迁');
        if(/Character Event Warp/.test(proof)||featured.some(p=>/Character/.test(p.inf.type)))add('角色活动跃迁');
        if(/Light Cone Event Warp/.test(proof)||featured.some(p=>/Light Cone/.test(p.inf.type)))add('光锥活动跃迁');
        if(featured.some(p=>/Collab/.test(p.inf.type)))add('联动特别跃迁');
        if(/Nameless Honor/.test(proof))add('无名客的荣勋（付费档达到 30 级，自选光锥）');
        if(/Echo of War/.test(proof))add('历战余响奖励');
        if(/Mission Reward|Quest Reward|Obtained.*completing|Permanent reward for completing/.test(proof)||/\{\{Mission/.test(proof))add('任务奖励');
        if(/Simulated Universe/.test(proof))add('模拟宇宙通关 / 首通奖励');
        if(/Operation Briefing/.test(proof))add('行动摘要奖励');
        if(/Trailblaze Level/.test(proof))add('开拓等级奖励');
        if(/Origami Bird|Clockie's Offering|Aideen Park/.test(proof))add('匹诺康尼收集 / 探索奖励');
        if(/Limited reward|^={3,}\s*(?:Events|Expired)\s*=|\]\]\s*[Ee]vent/m.test(proof))add('活动奖励（含历史活动）');
        const free={三月七:'开拓任务奖励',丹恒:'开拓任务奖励',艾丝妲:'新手引导首次跃迁获得',希露瓦:'预注册奖励邮件（历史渠道）',娜塔莎:'雅利洛-VI 开拓任务奖励',黑塔:'模拟宇宙首次通关奖励',青雀:'忘却之庭回忆第三层奖励',玲可:'虚构叙事通关奖励',驭空:'忘却之庭仙舟回忆第一层奖励',Archer:'3.4 版本联动登录赠送（历史渠道）'};if(free[entry.name])add(free[entry.name]);
      }
      for(const shop of shops){const st=wikiText(shop);const itemRows=[...st.matchAll(/^\|\s*([^\n|]+?)\s*;;/gm)].map(m=>factKey(m[1]));if(!itemRows.includes(nameKey))continue;const cn=chineseNames(st)[0]??shop.title.split('/')[0];add(`商店兑换（${cn}）`);sources.push(source(game,shop,'兑换商店的实际商品条目'));
      }
    }else{
      if(/Star-Studded Cast/.test(proof)||ordinary.has(nameKey))add('常驻频道（热门卡司）');
      if(/Exclusive Channel/.test(proof)&&!/only available from/.test(proof)||featured.some(p=>/Exclusive/.test(p.inf.type)))add('独家频道');
      if(/W-Engine Channel/.test(proof)||/Dissonant Sonata|Dazzling Choir/.test(proof)||featured.some(p=>/W-Engine/.test(p.inf.type)))add('音擎频道');
      if(/Rescreening/.test(proof)||featured.some(p=>/Rescreening/.test(p.inf.type)))add('独家重映（历史记录）');
      if(appearance.some(p=>p.inf.type==='Bangboo Channel')){add('邦布频道（卓越搭档）');sources.push(source(game,appearance.find(p=>p.inf.type==='Bangboo Channel').page,'邦布频道列出的 B 级音擎'));
      }
      if(/Great Builder's Certificate|New Eridu City Fund/.test(proof))add('丽都城募（成长计划达到 30 级，自选音擎）');
      if(/Box Galaxy|Other Components/.test(proof))add('「盒」音像店兑换 / 购买');
      if(/Shop Availability/.test(proof)&&!/Other Components/.test(proof))add(/Agent Focus/.test(proof)?'调频商店兑换（代理人意象）':'调频商店兑换');
      if(/Prologue Chapter|Phaethon's Story|given for free/.test(proof))add('序章 / 主线任务奖励');
        if(/available during.*\bevent\b|reward.*\bevent\b|Interboo Expansion Plan/i.test(proof))add('活动奖励（含历史活动）');
        if(/Logistics Shop/.test(proof))add('后勤商店兑换（历史活动音擎）');
      const free={安比:'序章主线任务获得',妮可:'序章主线任务获得',比利:'序章主线任务获得',可琳:'预注册奖励邮件（历史渠道）',苍角:'式舆防卫战奖励',本:'主线任务奖励',悠真:'1.4 版本登录赠送（历史渠道）',潘引壶:'2.0 版本活动赠送（历史渠道）'};if(free[entry.name])add(free[entry.name]);
    }
    for(const p of appearance.slice(0,1))sources.push(source(game,p.page,'卡池内容作为获取渠道依据'));
    if(!channels.size)audit.missing.push({game,id:entry.id,name:entry.name,page:page?.title,error:'缺少获取渠道依据'});
    const next={id:entry.id,details:{acquisition:[...channels]},sources};
    if(game==='zenless'&&['12016','13017','13021'].includes(String(entry.sourceId))){next.releaseVersion=sourceVersion(t);next.releaseDate=inf.releaseDate;next.releaseDateBasis='来源条目的实装日期与 3.2 版本变更记录';}
    if(game==='zenless'&&entry.category==='weapons'){
      const raw=await read(`data/sources/zenless/weapons/${entry.sourceId}.json`),defense=raw.base_property.name.includes('防御'),key=defense?'defense':'attack',sub=raw.rand_property.value/(raw.rand_property.format.includes('%')?10000:1),lastStar=Object.values(raw.stars).at(-1),highest=entry.stats?.attack??entry.stats?.defense??raw.base_property.value;
      next.stats={[key]:highest,secondaryValue:Number((sub*(1+(lastStar?.rand_rate??0)/10000)).toFixed(4))};
      next.statsTable=[{level:1,[key]:raw.base_property.value,secondaryValue:sub},{level:60,...next.stats}];next.statsLevel=60;
      next.details.facts={副属性:raw.rand_property.name,[defense?'初始防御力':'初始攻击力']:raw.base_property.value};if(defense)next.removeFacts=['初始攻击力'];
    }
    updates.push(next);
  }
  audit.games[game]={acquisition:updates.filter(e=>e.id.startsWith(game+'-')&&e.details.acquisition.length).length,banners:banners.filter(e=>e.game===game).length};
}
pairSignalBanners(banners);
await writeFile('.codex_tmp/history-acquisition-plan.json',JSON.stringify({updates,banners,audit},null,2));
console.log(JSON.stringify(audit,null,2));
