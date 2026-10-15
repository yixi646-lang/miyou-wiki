import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plain, normalizeDate, hsrDescription, genshinStats, hsrStats, effectTags } from '../lib/normalize.mjs';
import { validateEntry } from '../shared/catalog.mjs';
import { buildCoreStats } from '../shared/core-stats.mjs';
import {attachSkillTerms} from '../shared/skill-terms.mjs';

import {loadRegisteredMedia,applyRegisteredMedia} from '../lib/catalog-media.mjs';
const registeredMedia=await loadRegisteredMedia();
const root = fileURLToPath(new URL('../', import.meta.url));
let skillTermData={characters:{}};
try{skillTermData=JSON.parse(await readFile(join(root,'shared/skill-term-data.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const read = async (game, name) => JSON.parse(await readFile(join(root, 'data', 'sources', game, `${name}.json`), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'data', 'sources', 'manifest.json'), 'utf8'));
const fetchedAt = manifest.fetchedAt;
const cutoff = '2026-10-03';
const elements = { Physical: '物理', Fire: '火', Ice: '冰', Thunder: '雷', Electric: '电', Wind: '风', Quantum: '量子', Imaginary: '虚数' };
const professions = { Attack: '强攻', Stun: '击破', Anomaly: '异常', Support: '支援', Defense: '防护', Rupture: '命破', Guard: '锋御', Vanguard: '锋御' };
const indexes = {};
const sourceRepos = { genshin: 'theBowja/genshin-db-dist', starrail: 'Mar-7th/StarRailRes', zenless: 'EnkaNetwork/API-docs' };

for (const game of ['genshin', 'starrail', 'zenless']) {
  const index = new Map();
  for (const name of ['bwiki-release-date', 'bwiki-release-version']) {
    const data = await read(game, name);
    for (const entry of Object.values(data.query?.results ?? {})) {
      if (entry.namespace !== 0 || entry.fulltext.includes('/')) continue;
      const previous = index.get(entry.fulltext) ?? {};
      index.set(entry.fulltext, {
        date: normalizeDate(entry.printouts['实装日期']?.[0]) ?? previous.date ?? null,
        version: String(entry.printouts['实装版本']?.[0] ?? previous.version ?? '').trim() || null,
        url: entry.fullurl, title: entry.fulltext
      });
    }
  }
  indexes[game] = index;
}

function base(game, category, rawId, name, aliases = [], extra = {}) {
  const index = indexes[game];
  const release = [name, ...aliases].map(alias => index.get(alias)).find(Boolean);
  const sources = [{ name: sourceRepos[game], url: manifest.repositories[sourceRepos[game]].url, note: `来源快照 ${manifest.repositories[sourceRepos[game]].date.slice(0,10)}` }];
  if (release) sources.push({ name: `BWIKI · ${release.title}`, url: release.url, note: '实装版本与日期的结构化资料' });
  return { id: `${game}-${category}-${rawId}`, sourceId: String(rawId), game, category, name: plain(name), aliases: aliases.map(plain).filter(Boolean), rarity: null, element: null, type: null, region: null, kind: null, secondary: [], tags: [], releaseVersion: release?.version ?? null, releaseDate: release?.date ?? null, fetchedAt, origin: 'snapshot', sources, details: {}, ...extra };
}
function summarizeStats(entry, rows) { entry.statsTable = rows; entry.stats = rows.at(-1) ?? {}; entry.statsLevel = rows.at(-1)?.level ?? null; }
function materialGroups(game, costs, items, stageLabel = '突破') {
  return Object.entries(costs ?? {}).filter(([,values]) => Array.isArray(values) && values.length).map(([stage, values], index) => ({
    name: `${stageLabel} ${index + 1}`,
    items: values.map(item => ({ id: `${game}-materials-${item.id}`, name: item.name ?? items?.[item.id]?.name ?? `材料 ${item.id}`, count: item.count ?? item.num ?? 0 }))
  }));
}
function addSkills(raw) {
  const labels = { combat1: '普通攻击', combat2: '元素战技', combat3: '元素爆发', passive1: '固有天赋', passive2: '固有天赋', passive3: '固有天赋', passive4: '固有天赋' };
  return Object.entries(raw ?? {}).filter(([key,value]) => labels[key] && value?.name).map(([key, value]) => ({ name: plain(value.name), type: labels[key], description: plain(value.description) }));
}

const catalogs = { genshin: [], starrail: [], zenless: [] };
const materialIds = { genshin: new Set(), starrail: new Set(), zenless: new Set() };
const trackMaterials = entry => { for (const group of entry.details.materials ?? []) for (const item of group.items) materialIds[entry.game].add(item.id.split('-materials-')[1]); };

// 原神：使用 genshin-db 的简体中文资料与成长曲线，保留其稳定条目编号。
const gi = Object.fromEntries(await Promise.all(['characters','weapons','artifacts','talents','constellations','materials'].map(async name => [name, await read('genshin', name)])));
const giIndex = await read('genshin', 'nanoka-character-index');
const giData = name => gi[name].data.ChineseSimplified[name];
const giMaterialMap = Object.fromEntries(Object.values(giData('materials')).map(item => [item.id, item]));
for (const [key, character] of Object.entries(giData('characters'))) {
  if (['manekin','manekina'].includes(key)) continue;
  const entry = base('genshin', 'characters', character.id, character.name, [key], { rarity: character.rarity, element: character.elementText === '无' ? null : character.elementText, type: character.weaponText, region: character.region || null });
  entry.releaseVersion ??= gi.characters.version.characters[key] ?? null;
  entry.releaseDate ??= normalizeDate(giIndex[character.id]?.release);
  entry.imageRemote = gi.characters.image.characters[key]?.mihoyo_icon ?? null;
  entry.details = { summary: plain(character.description), title: character.title, facts: { 生日: character.birthday, 所属: character.affiliation, 命之座: character.constellation, 中文配音: character.cv?.chinese, 突破属性: character.substatText }, skills: addSkills(giData('talents')[key]), upgrades: Object.entries(giData('constellations')[key] ?? {}).filter(([k,v])=>/^c\d$/.test(k)&&v.name).map(([k,v])=>({name:plain(v.name),type:`命之座 ${k.slice(1)}`,description:plain(v.description)})), materials: materialGroups('genshin', character.costs, giMaterialMap) };
  summarizeStats(entry, genshinStats(gi.characters.stats.characters[key], gi.characters.curve.characters, [1,20,40,50,60,70,80,90]));
  trackMaterials(entry); catalogs.genshin.push(entry);
}
const signatureGI = { '静水流涌之辉':'芙宁娜','薙草之稻光':'雷电将军','雾切之回光':'神里绫华','护摩之杖':'胡桃','千夜浮梦':'纳西妲','苍古自由之誓':'枫原万叶','裁叶萃光':'艾尔海森','碧落之珑':'白术','若水':'夜兰','赤角石溃杵':'荒泷一斗','冬极白星':'达达利亚','神乐之真意':'八重神子','波乱月白经津':'神里绫人','赤沙之杖':'赛诺','圣显之钥':'妮露','图莱杜拉的回忆':'流浪者','苇海信标':'迪希雅','最初的大魔术':'林尼','万世流涌大典':'那维莱特','金流监督':'莱欧斯利','裁断':'娜维娅','鹤鸣余音':'闲云','有乐御簾切':'千织','赤月之形':'阿蕾奇诺','赦罪':'克洛琳德','白雨心弦':'希格雯','柔灯挽歌':'艾梅莉埃','山王长牙':'基尼奇','冲浪时光':'玛拉妮','岩峰巡歌':'希诺宁','星鹫赤羽':'恰斯卡','焚曜千阳':'玛薇卡','祭星者之望':'茜特菈莉','溢彩心念':'瓦雷莎','香韵奏者':'爱可菲','苍耀':'丝柯克' };
for (const [key, weapon] of Object.entries(giData('weapons'))) {
  if (/prizedisshinblade/.test(key)) continue;
  const entry = base('genshin', 'weapons', weapon.id, weapon.name, [key], { rarity: weapon.rarity, type: weapon.weaponText, secondary: weapon.mainStatText ? [weapon.mainStatText] : [] });
  entry.releaseVersion ??= gi.weapons.version.weapons[key] ?? null;
  entry.imageRemote = gi.weapons.image.weapons[key]?.mihoyo_icon ?? null;
  entry.details = { effects: [1,2,3,4,5].filter(rank=>weapon[`r${rank}`]).map(rank=>({ rank, name: plain(weapon.effectName), description: plain(weapon[`r${rank}`].description) })), materials: materialGroups('genshin', weapon.costs, giMaterialMap), facts: { 副属性: weapon.mainStatText, 初始副属性: weapon.baseStatText } };
  summarizeStats(entry, genshinStats(gi.weapons.stats.weapons[key], gi.weapons.curve.weapons, [1,20,40,50,60,70,80,90]));
  const character = catalogs.genshin.find(item=>item.category==='characters'&&item.name===signatureGI[weapon.name]);
  if (character) { entry.signatureIds = [character.id]; entry.signatureNote = '仅记录明确的专武对应关系；不列通用适配角色。'; }
  trackMaterials(entry); catalogs.genshin.push(entry);
}
for (const [key, set] of Object.entries(giData('artifacts'))) {
  const entry = base('genshin', 'sets', set.id, set.name, [key], { rarity: Math.max(...set.rarityList), kind: '圣遗物', secondary: effectTags(`${set.effect2Pc ?? ''} ${set.effect4Pc ?? ''}`) });
  entry.releaseVersion ??= gi.artifacts.version.artifacts[key] ?? null;
  const images = gi.artifacts.image.artifacts[key];
  entry.imageRemote = images?.mihoyo_flower ?? images?.flower ?? images?.mihoyo_circlet ?? images?.circlet ?? null;
  entry.details = { effects: [['effect1Pc','1 件套'],['effect2Pc','2 件套'],['effect4Pc','4 件套']].filter(([field])=>set[field]).map(([field,name])=>({ name, description:plain(set[field]) })), parts: ['flower','plume','sands','goblet','circlet'].filter(part=>set[part]).map(part=>({name:set[part].name,type:set[part].relicText})), facts: { 可获取稀有度: set.rarityList.map(r=>`${r} 星`).join(' / ') } };
  catalogs.genshin.push(entry);
}
for (const [key, item] of Object.entries(giData('materials'))) {
  if (!materialIds.genshin.has(String(item.id))) continue;
  const entry = base('genshin','materials',item.id,item.name,[key],{rarity:item.rarity ?? null,kind:item.typeText || '养成材料'});
  entry.imageRemote = gi.materials.image.materials[key]?.mihoyo_icon ?? gi.materials.image.materials[key]?.icon ?? null;
  entry.details = { acquisition: (item.sources ?? []).map(plain) };
  catalogs.genshin.push(entry);
}

// 星穹铁道：公开资源快照与当前正式版目录取交集，排除未实装测试条目。
const sr = Object.fromEntries(await Promise.all(['characters','character_skills','character_ranks','character_promotions','character_skill_trees','light_cones','light_cone_ranks','light_cone_promotions','relic_sets','relics','items','paths','elements'].map(async name=>[name,await read('starrail',name)])));
const srIndex = await read('starrail','nanoka-character-index');
const srAssetBase = `https://raw.githubusercontent.com/Mar-7th/StarRailRes/${manifest.repositories['Mar-7th/StarRailRes'].commit}/`;
for (const [id, character] of Object.entries(sr.characters)) {
  if (!srIndex[id]) continue;
  const type = sr.paths[character.path]?.name ?? character.path;
  const player = /player|trailblazer/i.test(character.tag ?? '') || /开拓者|NICKNAME/.test(character.name);
  const name = player ? `开拓者（${Number(id)%2===0?'女':'男'}·${type}）` : plain(character.name);
  const entry = base('starrail','characters',id,name,[character.name,`${character.name}·${type}`,player?`开拓者·${type}`:'',player?'开拓者':'',character.tag],{rarity:character.rarity,element:sr.elements[character.element]?.name ?? elements[character.element] ?? character.element,type});
  entry.releaseDate ??= normalizeDate(srIndex[id].release);
  entry.imageRemote = srAssetBase + character.icon;
  entry.details = { skills: (character.skills ?? []).map(id=>sr.character_skills[id]).filter(Boolean).map(skill=>({name:plain(skill.name),type:skill.type_text,description:hsrDescription(skill.desc,skill.params?.at(-1)),levels:(skill.params??[]).map((params,i)=>({level:i+1,description:hsrDescription(skill.desc,params)}))})), upgrades:(character.ranks??[]).map(id=>sr.character_ranks[id]).filter(Boolean).map((rank,i)=>({name:plain(rank.name),type:`星魂 ${i+1}`,description:hsrDescription(rank.desc,rank.params??[])})), materials:materialGroups('starrail',sr.character_promotions[id]?.materials,sr.items,'晋阶'),facts:{终结技能量:character.max_sp} };
  const extraTraces=(character.skill_trees??[]).map(id=>sr.character_skill_trees[id]).filter(trace=>trace&&trace.desc&&trace.name&&!/普攻|战技|终结技|天赋|秘技/.test(trace.name)).map(trace=>({name:plain(trace.name),type:'行迹',description:hsrDescription(trace.desc,trace.params?.at(-1)??[])}));
  entry.details.skills.push(...extraTraces.filter((trace,i,a)=>a.findIndex(other=>other.name===trace.name)===i));
  summarizeStats(entry,hsrStats(sr.character_promotions[id]));trackMaterials(entry);catalogs.starrail.push(entry);
}
const signatureSR={'于夜色中':'希儿','拂晓之前':'景元','棺的回响':'罗刹','到不了的彼岸':'刃','雨一直下':'银狼','只需等待':'卡芙卡','比阳光更明亮的':'丹恒•饮月','她已闭上双眼':'符玄','此身为剑':'镜流','烦恼着，幸福着':'托帕&账账','惊魂夜':'藿藿','片刻，留在眼底':'银枝','镜中故我':'阮·梅','纯粹思维的洗礼':'真理医生','重塑时光之忆':'黑天鹅','游戏尘寰':'花火','行于流逝的岸':'黄泉','命运从未公平':'砂金','夜色流光溢彩':'知更鸟','驶向第二次生命':'波提欧','梦应归于何处':'流萤','偏偏希望无价':'翡翠','那无数个春天':'椒丘','我将，巡征追猎':'飞霄','唯有香如故':'灵砂','忍法帖•缭乱破魔':'乱破','回到大地的飞行':'星期日','长路终有归途':'忘归人','向着不可追问处':'大黑塔'};
for(const [id,weapon] of Object.entries(sr.light_cones)){
  const entry=base('starrail','weapons',id,weapon.name,[],{rarity:weapon.rarity,type:sr.paths[weapon.path]?.name ?? weapon.path});entry.imageRemote=srAssetBase+weapon.icon;
  const rank=sr.light_cone_ranks[id];entry.details={effects:rank?(rank.params??[]).map((params,i)=>({rank:i+1,name:plain(rank.skill),description:hsrDescription(rank.desc,params)})):[],materials:materialGroups('starrail',sr.light_cone_promotions[id]?.materials,sr.items,'晋阶')};
  const target=signatureSR[entry.name];const character=catalogs.starrail.find(item=>item.category==='characters'&&item.name.replace(/[•·]/g,'')===String(target??'').replace(/[•·]/g,''));
  if(character){entry.signatureIds=[character.id];entry.signatureNote='对应角色首次推出时的专属光锥，不列通用适配角色。';entry.releaseDate??=character.releaseDate;entry.releaseVersion??=character.releaseVersion;}
  summarizeStats(entry,hsrStats(sr.light_cone_promotions[id]));trackMaterials(entry);catalogs.starrail.push(entry);
}
for(const [id,set] of Object.entries(sr.relic_sets)){
  const planar=Number(id)>=300;const entry=base('starrail','sets',id,set.name,[],{rarity:5,kind:planar?'位面饰品':'隧洞遗器',secondary:effectTags(set.desc.join(' '))});entry.imageRemote=srAssetBase+set.icon;
  entry.details={effects:set.desc.map((desc,i)=>({name:i===0?'2 件套':'4 件套',description:plain(desc)})),parts:Object.values(sr.relics).filter(relic=>String(relic.set_id)===id&&Number(relic.rarity)===5).map(relic=>({name:relic.name,type:relic.type})).filter((p,i,a)=>a.findIndex(other=>other.name===p.name)===i)};catalogs.starrail.push(entry);
}
for(const [id,item] of Object.entries(sr.items)){
  if(!materialIds.starrail.has(id))continue;const entry=base('starrail','materials',id,item.name,[],{rarity:item.rarity??null,kind:plain(item.type_text??item.type??'养成材料')});entry.imageRemote=item.icon?srAssetBase+item.icon:null;entry.details={};catalogs.starrail.push(entry);
}

// 绝区零：只使用 Nanoka 的 live 正式版资料，跳过策略、推荐配装和教学字段。
const zzIndex=await read('zenless','nanoka-character-index'),zzWeapons=await read('zenless','nanoka-weapon-index'),zzSets=await read('zenless','nanoka-equipment-index'),zzItems=await read('zenless','nanoka-items'),enkaAvatars=await read('zenless','avatars');
for(const [id,index] of Object.entries(zzIndex)){
  const raw=await read('zenless',`characters/${id}`);const name=plain(raw.name??index.zh);const nameValue=obj=>obj&&typeof obj==='object'?plain(obj.name??Object.values(obj)[0]):obj?plain(obj):'';
  const entry=base('zenless','characters',id,name,[index.zh,index.en,index.code],{rarity:Number(raw.rarity)+1,element:nameValue(raw.special_element_type)||nameValue(raw.element_type),type:nameValue(raw.weapon_type),region:nameValue(raw.camp)});
  entry.imageRemote=`https://static.nanoka.cc/assets/zzz/${index.icon}.webp`;
  const skills=[];const skillLabels={basic:'普通攻击',dodge:'闪避',assist:'支援技',special:'特殊技',chain:'连携技'};
  for(const [key,value] of Object.entries(raw.skill??{})){for(const detail of value.description??[]){if(!detail.desc)continue;skills.push({name:plain(detail.name),type:skillLabels[key]??key,description:plain(detail.desc)});}}
  const passive=Object.values(raw.passive?.level??{}).at(-1);if(passive)for(let i=0;i<(passive.name?.length??0);i++)skills.push({name:plain(passive.name[i]),type:'核心技',description:plain(passive.desc[i]),levels:Object.values(raw.passive.level).map((p,j)=>({level:j+1,description:plain(p.desc[i])}))});
  const groups=Object.entries(raw.level??{}).filter(([,v])=>Object.keys(v.materials??{}).length).map(([,value],i)=>({name:`突破 ${i+1}`,items:Object.entries(value.materials).map(([materialId,count])=>({id:`zenless-materials-${materialId}`,name:zzItems[materialId]?.name??`材料 ${materialId}`,count}))}));
  entry.details={skills,coreStats:buildCoreStats(raw),upgrades:Object.values(raw.talent??{}).filter(v=>v.name&&v.desc).map((v,i)=>({name:plain(v.name),type:`影画 ${i+1}`,description:plain(v.desc)})),materials:groups,facts:{伤害类型:nameValue(raw.hit_type)}};
  const values=raw.stats;const rows=[1,10,20,30,40,50,60].map(level=>{const promotion=Object.values(raw.level).find(p=>level>p.level_min&&level<=p.level_max)??Object.values(raw.level).at(-1);return{level,hp:Math.round(values.hp_max+values.hp_growth/10000*(level-1)+(promotion?.hp_max??0)),attack:Math.round(values.attack+values.attack_growth/10000*(level-1)+(promotion?.attack??0)),defense:Math.round(values.defence+values.defence_growth/10000*(level-1)+(promotion?.defence??0))};});summarizeStats(entry,rows);trackMaterials(entry);catalogs.zenless.push(entry);
}
for(const [id,index] of Object.entries(zzWeapons)){
  const raw=await read('zenless',`weapons/${id}`);const entry=base('zenless','weapons',id,raw.name??index.zh,[index.en],{rarity:Number(raw.rarity)+1,type:typeof raw.weapon_type==='object'?plain(Object.values(raw.weapon_type)[0]):plain(raw.weapon_type),secondary:raw.rand_property?.name?[plain(raw.rand_property.name)]:[]});
  entry.imageRemote=`https://static.nanoka.cc/assets/zzz/${index.icon}.webp`;
  entry.details={effects:Object.entries(raw.talents??{}).map(([rank,v])=>({rank:Number(rank),name:plain(v.name),description:plain(v.desc)})),facts:{初始攻击力:raw.base_property?.value,副属性:raw.rand_property?.name}};
  if(raw.base_property?.value)entry.stats={attack:Number(index.atk??raw.base_property.value)},entry.statsLevel=index.atk?60:1;
  const character=catalogs.zenless.find(item=>item.category==='characters'&&String(enkaAvatars[item.sourceId]?.WeaponId)===id);
  if(character){entry.signatureIds=[character.id];entry.signatureNote='依据公开资源中的角色专属音擎编号记录。';entry.releaseDate??=character.releaseDate;entry.releaseVersion??=character.releaseVersion;}
  catalogs.zenless.push(entry);
}
for(const [id,set] of Object.entries(zzSets)){
  const entry=base('zenless','sets',id,set.zh.name,[],{rarity:5,kind:'驱动盘',secondary:effectTags(`${set.zh.desc2} ${set.zh.desc4}`)});
  const enkaSets=(await read('zenless','equipments')).Suits;entry.imageRemote=enkaSets[id]?.Icon?`https://enka.network${enkaSets[id].Icon}`:null;
  entry.details={effects:[{name:'2 件套',description:plain(set.zh.desc2)},{name:'4 件套',description:plain(set.zh.desc4)}],parts:[1,2,3,4,5,6].map(slot=>({name:`分区 ${slot}`,type:'驱动盘'}))};catalogs.zenless.push(entry);
}
for(const [id,item] of Object.entries(zzItems)){
  if(!materialIds.zenless.has(id))continue;const entry=base('zenless','materials',id,item.name,[],{rarity:Math.min(5,Math.max(1,Number(item.rank)+1)),kind:id==='10'?'通用货币':'养成材料'});entry.details={};catalogs.zenless.push(entry);
}

for(const [game,entries] of Object.entries(catalogs)){
  const valid=entries.filter(entry=>!entry.releaseDate||entry.releaseDate<=cutoff).map(entry=>attachSkillTerms(entry,skillTermData));
  const knownIds=new Set(valid.map(entry=>entry.id));
  for(const entry of valid){applyRegisteredMedia(entry,registeredMedia);if(entry.signatureIds)entry.signatureIds=entry.signatureIds.filter(id=>knownIds.has(id));if(!entry.signatureIds?.length)delete entry.signatureIds;validateEntry(entry);}
  catalogs[game]=valid;
  const path=join(root,'data','catalog',`${game}.json`);await mkdir(join(root,'data','catalog'),{recursive:true});
  try{await access(path);throw new Error(`目录文件已存在，未覆盖：${path}`);}catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(path,JSON.stringify({game,fetchedAt,entries:valid},null,2),{flag:'wx'});
  console.log(JSON.stringify({game,entries:valid.length,characters:valid.filter(e=>e.category==='characters').length,weapons:valid.filter(e=>e.category==='weapons').length,sets:valid.filter(e=>e.category==='sets').length,materials:valid.filter(e=>e.category==='materials').length,knownDates:valid.filter(e=>e.releaseDate).length,knownVersions:valid.filter(e=>e.releaseVersion).length}));
}
