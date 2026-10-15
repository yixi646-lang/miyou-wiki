// 版本档案只保留重大、可持续体验的变化；原始公告仍保存在来源快照。
import {VERSION_SECTIONS} from '../shared/version-archive.mjs';

const excluded={
 genshin:/千星|奇域|七[胜圣]召唤|牌局|牌组|角色牌|天赋牌|牌手|行动牌|支援牌|装备牌|幽境危战|幻想真境剧诗|幽境螺旋|深境螺旋|深廊终曲|尘歌壶|壶中洞天|洞天百宝|洞天珍物|摆设|成就|小动物|可捕捉|捕捉动物|动物图鉴|动物捕捉|动物生物|Spiral Abyss|Genius Invokation|Serenitea Pot|Achievement/i,
 starrail:/王棋|忘却之庭|虚构叙事|混沌[会回][议忆]|末日幻影|Pure Fiction|Memory of Chaos|Apocalyptic Shadow/i,
 zenless:/式舆防卫(?:战)?|剧变节点|激变节点|突入禁区|式舆守卫者|我即式舆|危局强袭战|Shiyu Defense|Deadly Assault/i
};
export const outsideArchive=(text,game)=>/邦布|Bangboo|停服.{0,4}补偿|问题修复|BUG修复/i.test(text)||excluded[game].test(text);
const feature=/体力|树脂|电量|开拓力|储备|储蓄|以太电池|背包|圣遗物|遗器|驱动盘|词条|合成|分解|拆解|自塑尘脂|启圣之尘|锁定|弃置|筛选|预备编队|编队|配队|队伍|养成|强化|培养|特训|喧响|属性异常|紊乱|元素反应|月曜|月感电|月绽放|月结晶|地图|传送|导航|追踪|专注模式|剧情回顾|跳过|回顾|终末视界|快速体验|快速挑战|扫荡|快速代行|Fairy代行|勘域|历程|冒险之证|历练点|支援角色|好友支援|模拟宇宙|差分宇宙|货币战争|零号空洞|潜能影像|丽都周纪|绳匠前哨站|天赋|命途|旅行者.*元素|欢愉|阿哈时刻|世界等级|冒险等阶|区域巡防|恶名狩猎|定期清剿|实战模拟|专业挑战|难度|存档|队伍配置/;
const trivia=/语音|音频|音效|台词|本地化|韩语|日语|英语|表情|名片|头像|合影|拍照|光效|光照|全局照明|图像质量|模型显示|美术表现|显示顺序|仅.*文本|文本.*(?:修正|描述)|不影响.*实际|不涉及.*实际|文本描述|时装预览|动态高精度|分数上限展示|红点|入口排布|人群密度|防盗标识|音量|光线追踪|实时阴影|反应区|摇杆|拉杆|生效提示|推送|Fairy精选|邂逅|妮可-\[|铭记之谷|切换.*背景|成就|角色牌|天赋牌|牌手名录|酒馆牌局|调频动画|异常失效|修复|修正|\b调整[前后]：|\b新增[前后]：/;
const effect=/可以|支持|能够|一键|批量|自动|新增|增加|开放|解锁|上限|从.+(?:至|到|为)|由.+(?:至|到|为)|将.+(?:改|为)|会持续|可(?:以|在|通过|选择|使用|设置|将|获得|直接|快速)|无需|不再|消耗|降低|提升|提高|减少|返还|重置|推荐|调整为|调整至|扩充|扩展|移除|保存|跳过|缩短|保留|取消|分配|回收|刷新|超出/;
const normalize=text=>String(text??'').replace(/^[•●◆◇▶※■▌\s]+/,'').replace(/^\d+[.、](?!\d)\s*/,'').trim();
function systemName(item){
 const text=item.explanation??item.facts?.[0]??'';
 if(/还圣奥迹/.test(item.name))return '还圣奥迹：新增可兑换套装';
 if(/至\d/.test(item.name)&&/背包|可收纳/.test(text))return '背包容量与堆叠上限';
 if(/至\d/.test(item.name)&&/地图.*标记/.test(text))return '地图标记数量上限';
 if(/至\d/.test(item.name)&&/单次武器强化/.test(text))return '武器强化素材数量上限';
 if(/至\d/.test(item.name)&&/浓缩树脂/.test(text))return '浓缩树脂持有上限';
 if(/动态变化/.test(item.name)&&/试用角色/.test(text))return '试用角色养成等级适配世界等级';
 if(item.name==='系统')return /编队总览/.test(text)?'编队总览':/遗器/.test(text)?'遗器替换与合成入口':'系统功能更新';
 const parts=item.name.split(' · ');
 if(parts.length===2){const names=[...new Set(parts[1].split(' / '))];return parts[0]+' · '+names.slice(0,3).join(' / ');}
 return item.name;
}
function important(item){
 const explanation=[item.explanation,...(item.facts??[])].filter(Boolean).join(' ');
 const subject=item.explanation??item.facts?.[0]??'';
 return feature.test(item.name+' '+subject)&&!trivia.test(subject)&&(subject.length>=20||subject.length>=12&&/(?:从|由)\d+.*(?:至|到|为)\d+/.test(subject))&&effect.test(subject)
  &&!/详情可关注官方公告|调整了大量|部分其他内容|^增加了领取活动奖励/.test(subject)
  &&!/^(?:优化|改善|调整)(?:了)?[^。；]{0,100}(?:体验|表现|显示|逻辑|方式|效果|顺序|布局|规则)[。；;.]?$/.test(explanation)
  &&!/^(?:调整|新增)[前后]：/.test(subject);
}
function cleanItem(item,key,game){
 const result={...item};
 delete result.issueCount;delete result.targets;delete result.values;delete result.changes;
 for(const field of ['facts','times','requirements'])if(result[field]){
  result[field]=result[field].map(normalize).filter(t=>!outsideArchive(t,game)&&!/(?:修复|修正|限时(?:活动|开放|奖励|出售|玩法|挑战|获取|折扣|内容)|活动期间|活动结束|折扣|限购|登录即可|累计登录|赠送|限时频段|活动场景|本版本期间)/.test(t));
  if(!result[field].length)delete result[field];
 }
 if(result.explanation){result.explanation=normalize(result.explanation);if(outsideArchive(result.explanation,game))delete result.explanation;}
 for(const field of ['name','group','explanation'])if(result[field])result[field]=result[field].replace(/Random Play/g,'录像店');
 if(result.facts)result.facts=result.facts.filter(t=>t!==result.explanation);
 if(result.group==='其他'||result.group===result.name)delete result.group;
 // 常驻皮肤仍收录；限时获取活动和版本折扣不写入档案。
 if(key==='outfits')delete result.availability;
 return result;
}
export function curateSections(sections,game){
 const result=new Map();
 for(const section of sections){
  if(['characters','equipment','events','fixes'].includes(section.key))continue;
  let key=section.key;
  if(key==='collection')key='systems';
  for(const original of section.items){
   if(outsideArchive([original.name,original.group].filter(Boolean).join(' '),game))continue;
   if(original.availability==='limited'&&key!=='outfits')continue;
   const item=cleanItem(original,key,game);
   if(/(?:限时(?:活动|开放|奖励|出售|玩法|挑战|获取|内容)|活动期间|本期|赛季活动|活动场景|领取.*信件|信件.*发放|版本固定补偿)/.test(item.name+' '+(item.explanation??'')))continue;
   if(key==='systems'&&!important(item))continue;
   if(key==='enemies'&&!/首领|强敌|征讨|Boss|boss/.test([item.group,...(item.facts??[])].join(' ')))continue;
   if(!/[\u3400-\u9fff]/.test(item.name))continue;
   if(/^(?:新增|开放|解锁|扩展|增加|调整|优化|改善) · /.test(item.name)&&!item.explanation&&!item.requirements?.length&&!item.times?.length)continue;
   if(key==='outfits'&&(/^(?:上架|新增|开放|解锁) · |系统|世界任务|新鲜出炉|你砸|导览套件/.test(item.name)||!/[—·\[「]/.test(item.name)))continue;
   if(['story','map','gameplay'].includes(key)&&(/^(?:全新(?:魔神|传说|世界|开拓|同行)?任务|新增世界任务|全新区域|新区域开放|全新魔神任务|全新传说任务|全新世界任务|同行任务|开拓任务|系统|其他|开启条件|进入「.*范围内)$/.test(item.name)||/全新机制$|全新系统$|解锁条件|系统规则|^全新秘境$/.test(item.name)))continue;
   if(['story','map','gameplay'].includes(key)&&(/[？?!！~～…]|吧$/.test(item.name)&&!item.times?.length&&!item.requirements?.length&&!item.explanation))continue;
   if(key==='map'&&/^(?:解锁|开放) · /.test(item.name)&&!/聚所|地图|区域|场景|地区|系统/.test(item.explanation??''))continue;
   if(key==='systems'){
    item.facts=item.facts?.filter(t=>t.length>=15&&effect.test(t)&&!trivia.test(t)&&!outsideArchive(t,game));
    if(item.facts&&!item.facts.length)delete item.facts;
    if(!item.explanation&&!item.facts?.length)continue;
    item.name=systemName(item);
    if(item.group&&/其他更新|^○|^■|^新增内容|调整前|调整后|控制器/.test(item.group))delete item.group;
    if(/^(?:新增|增加) · /.test(item.name)&&/培养素材|升级素材|技能材料|突破素材/.test(item.explanation??'')&&!/批量|上限|一键|机制|合成|分解/.test(item.explanation))continue;
   }
   if(/说明》|调整说明|^(?:更多|详情|可通过|挑战秘境|完成|预计|新增角色|新增装备|全新活动)/.test(item.name)||item.name.length>150)continue;
   const list=result.get(key)??[];result.set(key,list);
   // 同一标题的“开放/解锁”说明合并回标题卡片，保留条件和实际说明。
   const signature=s=>s.replace(/^(?:新增|开放|解锁|增加) · /,'').replace(/[「」“”\[\]：: \-—·]/g,'');
   const existing=list.find(i=>signature(i.name)===signature(item.name));
   if(existing){for(const field of ['facts','times','requirements'])if(item[field])existing[field]=[...new Set([...(existing[field]??[]),...item[field]])];existing.explanation??=item.explanation;existing.availability??=item.availability;}
   else list.push(item);
  }
 }
 return [...result].map(([key,items])=>({key,label:VERSION_SECTIONS[key],items}));
}

// 开服英文目录用中文概述展示主要章节与区域，不展开支线子任务和小怪清单。
// 依据：同批次 Version/1.0 社区索引对应章节、地区和玩法目录。
export function launchSections(game){
 const entry=(name,explanation)=>({name,explanation,availability:'permanent',sourceKind:'community'});
 const sections={
  genshin:{
   story:[entry('魔神任务：蒙德序章与璃月第一章前两幕','开服主线包含蒙德序章，以及璃月第一章的第一幕、第二幕；后续主线章节按各自版本收录。')],
   map:[entry('蒙德、璃月','开放蒙德和璃月的初始区域；龙脊雪山、层岩巨渊等后续区域按实际开放版本另行收录。')],
   gameplay:[entry('初始秘境与周本','开放圣遗物、武器突破素材、天赋素材秘境及一次性秘境；可挑战风魔龙周本。')]
  },
  starrail:{
   story:[entry('空间站「黑塔」、雅利洛-VI、仙舟「罗浮」开拓任务','开服包含空间站序章、雅利洛-VI主线，以及仙舟「罗浮」首批主线；罗浮后续章节按实际开放版本收录。')],
   map:[entry('空间站「黑塔」','初始区域包括主控舱段、基座舱段、收容舱段、支援舱段。'),entry('雅利洛-VI','开放贝洛伯格地上与地下的初始探索区域。'),entry('仙舟「罗浮」','初始探索区域包括星槎海中枢、长乐天、流云渡、迴星港、太卜司、工造司。')],
   gameplay:[entry('模拟宇宙','通过随机祝福与奇物组合进行多轮战斗；初始模拟宇宙与后续扩充玩法分版本记录。')]
  },
  zenless:{
   story:[entry('主线序章至第三章','开服主线涵盖序章、第一章、第二章及其间章、第三章；按章节推进解锁街区、委托与功能。'),entry('首批代理人秘闻','开放11号、猫又、格莉丝、珂蕾妲、莱卡恩、丽娜的代理人故事。')],
   map:[entry('初始街区与设施','开放六分街、光映广场、黑雁工地旧址、芭莱大厦、斯科特哨站及HIA俱乐部。')],
   gameplay:[entry('零号空洞','通过空洞探索、战斗及鸣徽组合推进挑战。'),entry('常驻养成挑战','实战模拟室提供基础养成材料，专业挑战室提供核心技材料，定期清剿提供驱动盘，恶名狩猎提供高阶核心技材料。')]
  }
 };
 return Object.entries(sections[game]).map(([key,items])=>({key,label:VERSION_SECTIONS[key],items}));
}
