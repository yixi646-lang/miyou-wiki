// 筛选只使用简短渠道分类，原始获取说明仍留在详情中。
export function applyWeaponChannelIndex(entry,index){
  if(entry.category!=='weapons'||entry.acquisitionChannels?.length)return entry;
  return {...entry,acquisitionChannels:index[entry.id]??['待补充']};
}
export function acquisitionChannels(entry) {
  if (entry.category !== 'weapons') return [];
  if (Array.isArray(entry.acquisitionChannels)) return entry.acquisitionChannels;
  const channels = new Set();
  for (const value of entry.details?.acquisition ?? []) {
    const text = String(value);
    if (/邦布/.test(text)) continue;
    const rules = [
      [/武器活动祈愿|光锥活动跃迁|音擎频道/, '限定武器池'],
      [/角色活动祈愿|角色活动跃迁|独家频道/, '角色活动池'],
      [/常驻祈愿|常驻跃迁|常驻频道/, '常驻池'],
      [/新手祈愿|始发跃迁/, '新手池'],
      [/集录祈愿/, '集录祈愿'], [/联动特别跃迁/, '联动跃迁'],
      [/锻造/, '锻造'], [/纪行|无名客的荣勋|丽都城募/, '纪行 / 通行证'],
      [/活动奖励|回归活动|历史活动音擎/, '活动奖励'],
      [/商店|兑换|购买/, '商店 / 兑换'], [/钓鱼协会/, '钓鱼兑换'],
      [/任务|序章/, '任务奖励'], [/宝箱|调查点|探索|场景拾取|收集/, '探索获取'],
      [/NPC/, 'NPC 对话'], [/邮件/, '邮件 / 联动赠送'],
      [/冒险等阶|开拓等级|行动摘要/, '等级 / 进度奖励'],
      [/历战余响/, '历战余响'], [/初始装备/, '角色初始装备']
    ];
    let found = false;
    for (const [pattern, label] of rules) if (pattern.test(text)) { channels.add(label); found = true; }
    if (!found) channels.add('其他渠道');
  }
  return channels.size ? [...channels] : ['待补充'];
}
