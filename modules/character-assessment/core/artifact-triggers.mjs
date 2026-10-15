import {equipment} from './model.mjs';
import {teamKeys,calculateTeam} from './combat.mjs';
import {ARTIFACT_TRIGGER_SETS as sets,ARTIFACT_TRIGGER_PROFILES as profiles} from './artifact-trigger-data.mjs';

export const ARTIFACT_TRIGGER_VERSION='2026-10-11-v1';
const enabled=v=>v!==undefined&&v!==null&&v!==''&&v!=='off'&&v!=='0'&&v!==false;
const elementalReactions={vaporize:['pyro','hydro'],melt:['pyro','cryo'],overloaded:['pyro','electro'],superconduct:['cryo','electro'],electrocharged:['hydro','electro'],burning:['pyro','dendro'],bloom:['hydro','dendro'],hyperbloom:['hydro','dendro','electro'],burgeon:['hydro','dendro','pyro'],aggravate:['dendro','electro'],spread:['dendro','electro'],lunarcharged:['hydro','electro'],lunarbloom:['hydro','dendro'],lunarcrystallize:['hydro','geo'],stellarconduct:['cryo','electro']};
const healE=new Set(['Barbara','KukiShinobu','SangonomiyaKokomi','Yaoyao','Qiqi','Sigewinne','Chevreuse','Baizhu','YumemizukiMizuki','Ifa']);
const healQ=new Set(['Jean','Bennett','Diona','Charlotte','Xianyun','Mika','Dori','Sayu','Baizhu','Yaoyao','SangonomiyaKokomi','Escoffier','Noelle','Xilonen']);

// 仅生成圣遗物条件。角色/武器条件、队伍、敌人、额外增益和实际GOOD均不写回。
export function prepareArtifactScenario(good,key,saved={},context={}){
  const scenario=structuredClone(saved),members=teamKeys(good,key,saved),active=saved.active??key,audit=[];
  const own=k=>k===key?saved:saved.characters?.[k]??{};
  const phase=k=>{
    const p=profiles[k]??{},s=own(k),character=good.characters.find(c=>c.key===k),c=Object.fromEntries(Object.entries(s.conditional?.[k]??{}).filter(([f])=>!/^c\d/.test(f)||Number(f.match(/^c(\d)/)[1])<=(character?.constellation??0))),target=k===(context.targetKey??key)?context.objective??'':'';
    const actions=(saved.combo??[]).filter(a=>(a.owner??key)===k&&a.count>0).map(a=>a.path);
    const paths=[target,...actions],group=target.split('.')[0];
    // Q准备与是否仍处于Q增益状态分开；显式未启用的持续Q状态不补全。
    const qState=['inBurst','burst','burstMode','afterBurst','c2AfterBurst'].some(f=>enabled(c[f]));
    const q=paths.some(path=>path?.startsWith('burst.'))||qState||p.burst;
    const xiaoQ=k==='Xiao'&&k===active&&enabled(c.inBurst),normal=k==='Skirk'?group==='skill':group==='normal',charged=group==='charged';
    const sustainedHP=k==='Neuvillette'?charged:k==='Wriothesley'?normal||charged:k==='Lyney'?charged:k==='Xiao'?xiaoQ:k==='Gaming'?group==='skill'||group==='plunging':false;
    const ns=p.nightSoul&&k===active&&(p.signals?.some(signal=>/夜魂加持/.test(signal.title)&&enabled(c[signal.field]))||['Mualani','Kinich','Kachina','Chasca','Ifa','Iansan','Varesa'].includes(k));
    return {p,s,c,target,group,q,xiaoQ,normal,charged,sustainedHP,ns,paths};
  };
  const phases=new Map(members.map(k=>[k,phase(k)])),furina=phases.get('Furina');
  const furinaDrain=!!furina&&Number(furina.c.skillHpConsumeStacks)>0&&!enabled(furina.c.c6Pneuma);
  const recovery=members.some(k=>healE.has(k)||healQ.has(k)&&phases.get(k).q||k==='Neuvillette'&&phases.get(k).charged||k==='Clorinde'&&k===active);
  const furinaCycle=furinaDrain&&recovery;
  for(const member of members){
    const {p,s,c,target,group,q,xiaoQ,normal,charged,sustainedHP,ns,paths}=phases.get(member),onField=member===active;
    scenario.characters??={};
    const destination=member===key?scenario:(scenario.characters[member]??={});
    destination.conditional=structuredClone(s.conditional??{});
    for(const set of Object.keys(sets))delete destination.conditional[set];
    const counts={};for(const a of equipment(good,member).artifacts)counts[a.setKey]=(counts[a.setKey]??0)+1;
    const reaction=s.reaction??'',reactionElements=elementalReactions[reaction]??[];
    const reactionProof=!!reaction&&reactionElements.includes(p.element)||reaction==='swirl'&&p.element==='anemo'||reaction==='crystallize'&&p.element==='geo'||reaction==='stellarswirl'&&p.element==='anemo';
    // 本人保存的扩散字段可证明准备阶段发生过指定扩散，不能从队友元素集合推导。
    const swirls=['hydro','pyro','cryo','electro'].filter(e=>p.element==='anemo'&&(c['swirl'+e]===e||c['swirl'+e]==='on'||s.conditional?.ViridescentVenerer?.['swirl'+e]===e||s.conditional?.ViridescentVenerer?.['swirl'+e]==='on'));
    const recordedElements=Object.entries(s.conditional?.ScrollOfTheHeroOfCinderCity??{}).filter(([f,v])=>f.startsWith('react_')&&(v===f.slice(6)||v==='on')).map(([f])=>f.slice(6));
    const reacting=reactionProof||swirls.length>0||recordedElements.length>0;
    const qConflict=member==='Xiao'&&Object.hasOwn(c,'inBurst')&&!xiaoQ;
    const usedQ=q&&!qConflict;
    for(const [set,count]of Object.entries(counts)){
      const definition=sets[set];if(!definition)continue;
      const entry={member,set,name:definition.name,count,conditions:{},conditionLabels:{},notes:[]},old=s.conditional?.[set]??{};
      const put=(field,value,reason)=>{if(definition.conditions[field]?.includes(String(value))){entry.conditions[field]=String(value);entry.conditionLabels[field]={title:definition.labels[field].title,value:definition.labels[field].values[value]};entry.notes.push(reason);}};
      const has4=count>=4,manual=field=>enabled(old[field])?String(old[field]):'';
      // 未获批的累计治疗、拾晶、受击/附着等具体状态仅认定已保存的明确证据。
      if(has4)switch(set){
        case 'NoblesseOblige':if(usedQ)put('set4','on','本人Q准备，12秒内');break;
        case 'VermillionHereafter':
          if(onField&&usedQ){put('afterBurst','on','本人先Q且未退场，16秒内');let stacks=0;
            if(xiaoQ)stacks=4;else if(furinaCycle)stacks=4;else if(sustainedHP)stacks=4;else if(manual('stacks'))stacks=Number(manual('stacks'));
            if(stacks)put('stacks',String(Math.min(4,stacks)),furinaCycle?'后台芙宁娜掉血＋有效恢复；四次间隔至少0.8秒':'本人Q后生命降低，按准备阶段计层');
          }else entry.notes.push(onField?'未确认本人Q准备，不触发':'装备者已退场，潜光消失');break;
        case 'GoldenTroupe':if(!onField)put('set4','on','稳定后台阶段；不假定登场2秒残留');break;
        case 'AubadeOfMorningstarAndMoon':if(!onField)put('set4','on','稳定后台阶段，排除刚切换3秒窗口');break;
        case 'MarechausseeHunter':{const stacks=(onField&&(sustainedHP||furinaCycle)||member==='Furina'&&furinaCycle)?3:onField&&member==='HuTao'?1:Number(manual('set4'))||0;if(stacks)put('set4',String(Math.min(3,stacks)),'5秒内生命变化准备；芙宁娜扣血须有持续贡献和恢复');break;}
        case 'VourukashasGlow':if(member==='Dehya'&&(enabled(c.c2InField)||manual('set4')))put('set4','5','已确认E领域承伤阶段；芙宁娜生命消耗不等于受伤');else if(manual('set4'))put('set4',manual('set4'),'保存的实际承伤证据，非单纯生命消耗');break;
        case 'FinaleOfTheDeepGalleries':if(member==='Skirk'){if(normal)put('0EnergyNoBurst','on','丝柯克零能量普攻阶段，关闭互斥Q阶段');else if(group==='burst')put('0EnergyNoNormal','on','丝柯克零能量Q阶段，关闭互斥普攻阶段');}break;
        case 'LongNightsOath':if(onField&&(member==='Xiao'&&xiaoQ||member==='Varesa')&&group==='plunging')put('stacks','5','持续下落准备，6秒内五层');else if(manual('stacks'))put('stacks',manual('stacks'),'保存的下落/重击动作层数');break;
        case 'FragmentOfHarmonicWhimsy':if(onField&&['Arlecchino','Clorinde'].includes(member)&&Object.entries(c).some(([f,v])=>/bond|skill|night|hunt/i.test(f)&&enabled(v)))put('stacks','3','已确认本人生命之契变化阶段');else if(manual('stacks'))put('stacks',manual('stacks'),'已保存的生命之契变化层数');break;
        case 'NymphsDream':{const classes=new Set(['skill',...(usedQ&&member!=='Barbara'?['burst']:[]),...paths.map(path=>path?.split('.')[0]).filter(g=>['normal','charged','plunging','skill','burst'].includes(g)&&(g!=='burst'||member!=='Barbara'))]);if(member==='Tartaglia'&&onField)classes.add('normal').add('charged');put('set4',String(Math.min(3,classes.size)),'E准备＋目标攻击类别，均按8秒内命中比较');break;}
        case 'DeepwoodMemories':put('set4','on',p.sustainedSkill?'本人持续E命中，8秒窗口':'本人E准备命中，比较8秒窗口内后续输出');break;
        case 'TenacityOfTheMillelith':put('skill','cast',p.sustainedSkill?'本人持续E命中，3秒窗口':'本人E准备命中，仅比较3秒内输出');break;
        case 'HeartOfDepth':put('skill','cast','本人E准备，15秒内');break;
        case 'MaidenBeloved':put('state','on','本人E准备，10秒内');break;
        case 'MartialArtist':put('state','on','本人E准备，8秒内');break;
        case 'ADayCarvedFromRisingWinds':put('set4','on','本人E命中准备；魔女门控仍由原引擎判断');break;
        case 'SilkenMoonsSerenade':if(p.element)put('4GleamingMoon','on','本人E元素命中准备，月辉门控由引擎处理');break;
        case 'NightOfTheSkysUnveiling':if(onField&&reaction.startsWith('lunar')&&reactionProof)put('4GleamingMoon','on','本人已触发月曜反应且在场');break;
        case 'HeartOfTheFurnace':if(reaction.startsWith('stellar')&&reactionProof||Object.entries(c).some(([f,v])=>/stellar/i.test(f)&&enabled(v)))put('4Stellar','on','本人保存状态证明星烁阶段');break;
        case 'ScarletProof':if(reaction==='stellarswirl'&&reactionProof||c.a0StellarRadiance==='ss')put('4Ss','on','本人明确星扩散阶段');break;
        case 'DisenchantmentInDeepShadow':if(['superconduct','stellarconduct'].includes(reaction))put('state','on','保存的超导/星超导阶段');break;
        case 'CelestialGift':if(Object.entries(c).some(([f,v])=>/hexerei|homework|witch/i.test(f)&&enabled(v))||manual('set4'))put('set4','on','已确认魔女课业及E准备；升级仍由引擎判断');break;
        case 'GildedDreams':if(reacting)put('passive','on','本人反应准备，队友同异元素数量由引擎计算');break;
        case 'Instructor':if(reacting)put('set4','on','本人反应准备，8秒内');break;
        case 'FlowerOfParadiseLost':if(reactionProof&&['bloom','hyperbloom','burgeon'].includes(reaction))put('stacks','4','本人持续触发草原核反应的准备阶段');break;
        case 'UnfinishedReverie':if(reaction==='burning'||manual('stacks'))put('stacks',manual('stacks')||'5','已确认附近维持燃烧；不模拟离战首轮');break;
        case 'DesertPavilionChronicle':if(charged||onField&&member==='Wanderer'||paths.some(p=>p.startsWith('charged.')))put('set4','on','本人重击准备命中后，15秒内');else if(manual('set4'))put('set4','on','已保存的本人重击准备');break;
        case 'EchoesOfAnOffering':if(normal)put('mode','avg','普攻阶段使用原引擎平均触发率');break;
        case 'HuskOfOpulentDreams':if(!onField||p.element==='geo'&&(p.sustainedSkill||member==='AratakiItto'&&enabled(c.burst)||member==='Noelle'&&enabled(c.SweepingTime)||member==='Ningguang'&&(normal||charged)))put('stack','4',onField?'已确认持续岩命中准备':'后台预备12秒，四层');else if(manual('stack'))put('stack',manual('stack'),'已保存的有效层数；不因岩角色就推断满层');break;
        case 'ShimenawasReminiscence':if(!usedQ&&['normal','charged','plunging'].includes(group)&&manual('usedEnergy'))put('usedEnergy','used','已保存E扣能证据，目标不是同阶段Q');break;
        case 'PaleFlame':put('stacks',p.sustainedSkill||member==='Eula'?'2':'1',p.sustainedSkill||member==='Eula'?'7秒内本人重复E命中准备':'单次E准备命中');break;
        case 'CrimsonWitchOfFlames':put('stack',member==='Diluc'?'3':member==='Klee'&&manual('stack')==='2'?'2':'1','10秒内个人E准备次数，不改变固定反应加成');break;
        case 'ViridescentVenerer':for(const e of swirls)put('swirl'+e,e,'本人在场准备扩散的明确元素，10秒内；不从队友元素猜测');break;
        case 'ScrollOfTheHeroOfCinderCity':for(const e of [...new Set([...reactionElements,...swirls,...recordedElements])].filter(e=>e!==p.element))if(reacting){put('react_'+e,e,'本人保存反应涉及的元素');if(ns||p.nightSoul&&(enabled(c.nsBlessing)||old['nightsoul_'+e]===e||old['nightsoul_'+e]==='on'))put('nightsoul_'+e,e,'同一反应已确认处于夜魂加持');}break;
        case 'NighttimeWhispersInTheEchoingWoods':put('afterSkill','on','本人E准备，10秒内');if(manual('crystallize')||reaction==='lunarcrystallize')put('crystallize','on','保存的结晶护盾/明确月笼状态');break;
        case 'BlizzardStrayer':if(manual('state'))put('state',manual('state'),'已保存敌人冰附着/冻结，未从冰水队伍自动推断');break;
        case 'RetracingBolide':case 'Lavawalker':case 'Thundersoother':if(manual('state'))put('state',manual('state'),'保存的当前护盾/敌人附着证据');break;
        case 'ArchaicPetra':if(manual('element'))put('element',manual('element'),'保存的本人拾取晶片元素，非后台结晶推断');break;
        case 'BloodstainedChivalry':if(manual('defeat'))put('defeat','hit','保存的击败敌人阶段');break;
        case 'SongOfDaysPast':entry.notes.push('不自动填满累计治疗；6秒治疗量尚未建模');break;
        case 'TinyMiracle':if(manual('element'))put('element',manual('element'),'保存的实际承受元素伤害');break;
        case 'BraveHeart':if(manual('hp'))put('hp',manual('hp'),'保存的敌人生命状态');break;
      }
      if(set==='ObsidianCodex'&&count>=2&&ns){put('2NightsoulBlessing','on','夜魂角色已确认在场E夜魂阶段');if(has4)put('4NightsoulConsume','on','本人在场输出消耗夜魂，6秒内');}
      if(set==='Berserker'&&count>=4&&manual('hp'))put('hp','70','保存的本人低生命状态');
      if(set==='OceanHuedClam'&&has4)entry.notes.push('引擎海染伤害为治疗上限参考，不是实测累计治疗');
      if(has4&&Object.keys(definition.conditions).length&&!Object.keys(entry.conditions).length)entry.notes.push('缺少本阶段触发证据，条件增益未启用；固有加成仍由引擎计入');
      if(Object.keys(entry.conditions).length)destination.conditional[set]=entry.conditions;
      audit.push(entry);
    }
  }
  return {scenario,audit,version:ARTIFACT_TRIGGER_VERSION};
}
export function calculatePreparedTeam(good,key,scenario,context){const prepared=prepareArtifactScenario(good,key,scenario,context);return {...calculateTeam(good,key,prepared.scenario),scenario:prepared.scenario,artifactAudit:prepared.audit,artifactTriggerVersion:prepared.version};}
