export function effectTags(text) {
 const words=['攻击力','生命值','防御力','暴击率','暴击伤害','元素精通','元素充能效率','能量恢复','能量回复','速度','击破特攻','效果命中','效果抵抗','治疗量','冲击力','异常精通','异常掌控','穿透率','穿透值','物理伤害','物理属性','冰属性','火属性','电属性','雷属性','风属性','量子属性','虚数属性','以太','水元素','火元素','冰元素','雷元素','风元素','岩元素','草元素'];
 return words.filter(word=>String(text??'').includes(word));
}
export function setEffectTags(entry,pieces) {
 const effects=entry.listEffects??entry.details?.effects??[];
 return [...new Set(effects.filter(effect=>Number(String(effect.name??'').match(/([124])\s*件/)?.[1])===pieces).flatMap(effect=>effectTags(effect.description)))];
}
