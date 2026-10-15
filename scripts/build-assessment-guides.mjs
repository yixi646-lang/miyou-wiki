import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {recommendationData} from '../modules/character-assessment/core/recommendation-data.mjs';

const root=new URL('../',import.meta.url),base=new URL('modules/character-assessment/core/',root);
const catalog=JSON.parse(await readFile(new URL('catalog.json',base))),archive=JSON.parse(gunzipSync(await readFile(new URL('data/sources/assessment-recommendations/kqm-2026-10-07.json.gz',root))));
const gameData=JSON.parse(await readFile(new URL('game-stats.json',base))),dataStat=key=>gameData.weapon.data[key]?.subStat?.type;
const norm=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const english=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2');
const aliases={KamisatoAyaka:['Ayaka'],KamisatoAyato:['Ayato'],KaedeharaKazuha:['Kazuha'],SangonomiyaKokomi:['Kokomi'],RaidenShogun:['Raiden'],AratakiItto:['Itto'],KujouSara:['Sara'],YumemizukiMizuki:['Mizuki'],ShikanoinHeizou:['Heizou'],YaeMiko:['Yae'],KukiShinobu:['Shinobu','Kuki'],Tartaglia:['Childe'],LanYan:['Lan Yan']};
const labels=Object.entries(catalog.characters).filter(([k])=>!k.startsWith('Traveler')).flatMap(([k,m])=>[english(k),...(aliases[k]??[])].map(n=>[n,k,m.name])).sort((a,b)=>b[0].length-a[0].length);
const generic={Flex:'灵活位',Healer:'治疗位',Shielder:'护盾位',Support:'辅助位','On-Field DPS':'站场输出','Off-Field DPS':'后台输出','Pyro DPS':'火系输出','Cryo DPS':'冰系输出','Hydro DPS':'水系输出','Electro DPS':'雷系输出','Anemo DPS':'风系输出',Pyro:'火系',Cryo:'冰系',Hydro:'水系',Electro:'雷系',Dendro:'草系',Anemo:'风系',Geo:'岩系',Hexerei:'魔导角色','Cryo Traveler':'冰旅行者','Dendro Traveler':'草旅行者','Electro Traveler':'雷旅行者','Geo Traveler':'岩旅行者','Pyro Traveler':'火旅行者','Hydro Traveler':'水旅行者','Anemo Traveler':'风旅行者'};
// 多用途角色优先列出与本地用途相符的选择，避免把另一玩法的武器混作统一排名。
const preferred=Object.fromEntries(`
Jean|FavoniusSword,AmenomaKageuchi,FreedomSworn
Barbara|ThrillingTalesOfDragonSlayers,PrototypeAmber,EverlastingMoonglow
Venti|ElegyForTheEnd,TheStringless,FavoniusWarbow
Zhongli|BlackTassel,FavoniusLance
Bennett|SapwoodBlade,SkywardBlade,AquilaFavonia,FavoniusSword
Qiqi|SacrificialSword,FavoniusSword,FreedomSworn
Diona|SacrificialBow,FavoniusWarbow,ElegyForTheEnd
Sucrose|SacrificialFragments,ThrillingTalesOfDragonSlayers,MagicGuide,AThousandFloatingDreams
KaedeharaKazuha|FavoniusSword,XiphosMoonlight,IronSting,FreedomSworn
Thoma|FavoniusLance,KitainCrossSpear,BlackTassel
RaidenShogun|EngulfingLightning,TheCatch,StaffOfHoma,WavebreakersFin
Sayu|FavoniusGreatsword,KatsuragikiriNagamasa,SkywardPride
SangonomiyaKokomi|PrototypeAmber,ThrillingTalesOfDragonSlayers,EverlastingMoonglow
Gorou|FavoniusWarbow,SacrificialBow,ElegyForTheEnd
Kirara|KeyOfKhajNisut,TheDockhandsAssistant,FavoniusSword,SapwoodBlade
Shenhe|CalamityQueller,FavoniusLance,SkywardSpine,MissiveWindspear
YunJin|FavoniusLance,FootprintOfTheRainbow,PrototypeStarglitter
KukiShinobu|IronSting,ToukabouShigure,XiphosMoonlight,FreedomSworn,KeyOfKhajNisut
Dori|FavoniusGreatsword,SacrificialGreatsword,KatsuragikiriNagamasa
Nilou|KeyOfKhajNisut,TheDockhandsAssistant,SerenitysCall,FavoniusSword
Layla|KeyOfKhajNisut,TheDockhandsAssistant,FavoniusSword
Faruzan|FavoniusWarbow,ElegyForTheEnd,EndOfTheLine
Yaoyao|BlackTassel,FavoniusLance,DialoguesOfTheDesertSages
Mika|FavoniusLance,DialoguesOfTheDesertSages,RightfulReward
Baizhu|JadefallsSplendor,PrototypeAmber,FavoniusCodex,ThrillingTalesOfDragonSlayers
Charlotte|PrototypeAmber,FavoniusCodex,ThrillingTalesOfDragonSlayers
Furina|SplendorOfTranquilWaters,FleuveCendreFerryman,FavoniusSword,FesteringDesire
Chevreuse|BlackTassel,FavoniusLance,DialoguesOfTheDesertSages,RightfulReward
Xianyun|CranesEchoingCall,SkywardAtlas,OathswornEye,FavoniusCodex,ThrillingTalesOfDragonSlayers
Sigewinne|SilvershowerHeartstrings,RecurveBow,SacrificialBow,ElegyForTheEnd
Kachina|FavoniusLance,FootprintOfTheRainbow
Xilonen|PeakPatrolSong,FavoniusSword,FluteOfEzpitzal
Citlali|StarcallersWatch,ThrillingTalesOfDragonSlayers,FavoniusCodex,SacrificialFragments
LanYan|ThrillingTalesOfDragonSlayers,FavoniusCodex,StarcallersWatch,PrototypeAmber
YumemizukiMizuki|SunnyMorningSleepIn,SacrificialFragments,AThousandFloatingDreams,BlackmarrowLantern
Iansan|FavoniusLance,SymphonistOfScents,MissiveWindspear
Ifa|SacrificialFragments,WanderingEvenstar,AThousandFloatingDreams,SunnyMorningSleepIn
Dahlia|FavoniusSword,TheDockhandsAssistant,KeyOfKhajNisut,SacrificialSword
Lauma|NightweaversLookingGlass,EtherlightSpindlelute,FruitOfFulfillment,FavoniusCodex
Aino|FavoniusGreatsword,MakhairaAquamarine,ForestRegalia,SacrificialGreatsword
Jahoda|FavoniusWarbow,ElegyForTheEnd,SnareHook
Illuga|DragonsBane,FavoniusLance,KitainCrossSpear
Nicole|AngelosHeptades,SkywardAtlas,OathswornEye,FlowingPurity,ThrillingTalesOfDragonSlayers
Prune|OathswornEye,FlowingPurity,FavoniusCodex,SkywardAtlas
Vodyanitsa|HymnOfTheMaelstrom,ThrillingTalesOfDragonSlayers,PrototypeAmber,SacrificialJade
Alyosha|SymphonistOfScents,FavoniusLance,Frostbreath,TheCatch
TravelerAnemo|FreedomSworn,FavoniusSword,IronSting,SacrificialSword
TravelerGeo|PrimordialJadeCutter,HarbingerOfDawn,AmenomaKageuchi,FavoniusSword
TravelerElectro|FavoniusSword,SacrificialSword,SkyriderSword
TravelerDendro|FavoniusSword,SacrificialSword,SapwoodBlade
`.trim().split('\n').map(line=>{const[k,values]=line.split('|');return[k,values.split(',')];}));
const weaponNotes={
  ThrillingTalesOfDragonSlayers:'辅助选择：将增攻交给下一位登场角色，注意切人顺序与冷却；不适用于主要依赖生命或防御倍率的输出。',
  PrototypeAmber:'兼顾自身回能与全队治疗，适合需要爆发循环或配合芙宁娜的辅助玩法。',
  HarbingerOfDawn:'低成本双暴选择，需要维持被动要求的生命比例；持续扣血或承伤时检查覆盖率。',
  TheCatch:'爆发输出备选，爆发暴击加成不计入常驻面板，注意实际暴击溢出。',
  FinaleOfTheDeep:'攻击输出备选，需要治疗清除生命之契，才能发挥完整被动。',
  SacrificialJade:'需控制单次站场时间以保留被动；精炼等级和队伍会改变收益。',
  SerpentSpine:'需要保留被动层数；护盾或避免受击有助于稳定收益。',
  FavoniusSword:'队伍循环选择：需要持有者在场触发暴击并产生微粒，适当配置暴击率。',
  FavoniusLance:'队伍循环选择：需要持有者在场触发暴击并产生微粒，适当配置暴击率。',
  FavoniusWarbow:'队伍循环选择：需要持有者在场触发暴击并产生微粒，适当配置暴击率。',
  FavoniusCodex:'队伍循环选择：需要持有者在场触发暴击并产生微粒，适当配置暴击率。',
  FavoniusGreatsword:'队伍循环选择：需要持有者在场触发暴击并产生微粒，适当配置暴击率。'
};
const manualTeams={Lisa:[['Lisa','RaidenShogun','Bennett','KaedeharaKazuha'],['Lisa','Eula','Fischl','Mika'],['Lisa','Neuvillette','Furina','Xilonen']],Vesna:[['Vesna','Vodyanitsa','Odette','TravelerCryoF'],['Vesna','TravelerCryoF','Diona','Faruzan']],TravelerCryo:[['TravelerCryoF','YaeMiko','Vodyanitsa','灵活增益位'],['TravelerCryoF','Sandrone','Electro','灵活增益位']]};
function translateSlot(s,key){
  let value=s.trim().replace(/:$/,'').replace(/^[^:]{1,40}:\s*/,'');const ids=[];
  if(key.startsWith('Traveler'))value=value.replace(/\b(?:DMC|AMC|GMC|EMC|PMC|HMC|Traveler)\b/g,catalog.characters[key].name);
  for(const[n,k,zh]of labels){const escaped=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');value=value.replace(new RegExp('\\b'+escaped+'\\b','gi'),()=>{ids.push(k);return zh;});}
  for(const[n,zh]of Object.entries(generic).sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(n,zh);
  value=value.replace(/\bC([0-6])\b/g,'$1命').replace(/\bAny\b/gi,'任意').replace(/\bDPS\b/g,'输出');
  if(key.startsWith('Traveler')&&value.includes(catalog.characters[key].name))ids.push(key);
  return !value.trim()||/[a-z]{3,}/i.test(value)?null:{label:value,characters:[...new Set(ids)]};
}
const missing=[],records={};
for(const[key,rec]of Object.entries(recommendationData.records)){
  const text=archive.pages[rec.source.url]?.text??'',sections=[...text.matchAll(/\n[^\n]{0,45}\bWeapons[^\n]{0,30}\n/g)].filter(m=>m.index>5000);
  const start=sections[0]?.index??-1,weaponsText=sections.map(m=>{const tail=text.slice(m.index),end=tail.search(/\n\s*(?:Teams|Team[- ]Building|Team Compositions|Example Teams|Notable Teammates|Credits)\s*\n/);return end>=0?tail.slice(0,end):tail;}).join('\n');
  const normalized=norm(weaponsText),weapons=Object.entries(catalog.weapons).filter(([k,m])=>m.weaponType===catalog.characters[key].weaponType&&normalized.includes(norm(k))).map(([k,m])=>({key:k,rarity:m.rarity,position:normalized.indexOf(norm(k))})).sort((a,b)=>a.position-b.position);
  if(catalog.characters[key].weaponType==='catalyst'&&/\bTTDS\b/.test(weaponsText)&&!weapons.some(w=>w.key==='ThrillingTalesOfDragonSlayers'))weapons.push({key:'ThrillingTalesOfDragonSlayers',rarity:3,position:weaponsText.indexOf('TTDS')});
  const teamStart=[...text.matchAll(/\n\s*(?:Teams|Team[- ]Building|Team Compositions)\s*\n/g)].at(-1)?.index??Math.floor(text.length*.55),teamText=text.slice(teamStart),teams=[];
  for(const line of teamText.split('\n')){
    const parts=line.trim().split(/\s*[—–]\s*|,\s*/);if(parts.length!==4||line.length>220)continue;
    const slots=parts.map(s=>translateSlot(s,key));if(slots.some(s=>!s)||!slots.some(s=>s.characters.includes(key)||key.startsWith('Traveler')&&s.label.includes('旅行者')))continue;
    const label=slots.map(s=>s.label).join(' / ');if(!teams.some(t=>t.label===label))teams.push({label,slots,concrete:slots.every(s=>s.characters.length>0)});
  }
  const configKey=key.startsWith('Traveler')?key.slice(0,-1):key;
  let choices=preferred[configKey]?.filter(k=>normalized.includes(norm(k))||k==='ThrillingTalesOfDragonSlayers'&&/\bTTDS\b/.test(weaponsText))??[...weapons.filter(w=>w.rarity===5).slice(0,4),...weapons.filter(w=>w.rarity<5).slice(0,4)].map(w=>w.key);
  if(key==='Vesna')choices=['BeyondTheChrysalis','WhitelakeFrostfeather','NewBough','HereticsMoltenBlade','Emberwell'];
  if(configKey==='TravelerCryo')choices=['ExaiphanesBlade','FinaleOfTheDeep','MistsplitterReforged','PrimordialJadeCutter'];
  const common=choices.map(k=>({key:k,category:catalog.weapons[k].rarity===5?'五星备选':'四星及三星备选',note:weaponNotes[k]??(dataStat(k)==='enerRech_'?'充能副属性可帮助循环，达到队伍充能需求后再比较输出或辅助收益。':dataStat(k)==='eleMas'?'精通副属性适合反应玩法，需确认持有者实际触发的反应。':'按当前玩法比较副属性与被动覆盖，收益还取决于精炼、队伍增益和充能需求。')}));
  let selectedTeams=[...teams.filter(t=>t.concrete),...teams.filter(t=>!t.concrete)].slice(0,6).map(({label,slots})=>({label,slots}));
  if(manualTeams[configKey])selectedTeams=manualTeams[configKey].map(row=>{const slots=row.map(k=>k.startsWith('Traveler')?{label:catalog.characters[key.startsWith('Traveler')?key:k].name,characters:[key.startsWith('Traveler')?key:k]}:catalog.characters[k]?{label:catalog.characters[k].name,characters:[k]}:{label:generic[k]??k,characters:[]});return{label:slots.map(s=>s.label).join(' / '),slots};});
  if(key==='Vesna')selectedTeams[1].note='此替代组合的迪奥娜与珐露珊需要六命；低命时参考图解中的其他替代位。';
  if(configKey==='TravelerCryo')for(const t of selectedTeams)t.note='星超导需要雷系成员；灵活位按生存和增益补齐。';
  if(key==='Lisa')for(const t of selectedTeams)t.note='这里展示爆发辅助用途：保证爆发循环；不同队伍选择讨龙、试作金珀或输出武器。';
  records[key]={weapons:common,teams:selectedTeams,source:{...rec.source,version:text.match(/Updated for Version\s*([\d.]+)/i)?.[1]??null},intro:rec.source.basis};
  if(!common.length||!selectedTeams.length)missing.push({key,weapons:common.map(w=>w.key),teams:selectedTeams.length,section:start});
}
await writeFile(new URL('recommendation-guides.json',base),JSON.stringify({checkedAt:'2026-10-07',records},null,2)+'\n');
console.log(JSON.stringify({total:Object.keys(records).length,gaps:missing},null,2));
