export function plain(value) {
  return String(value ?? '').replace(/\\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\{RUBY_B#[^}]*\}/g, '').replace(/\{RUBY_E#\}/g, '').replace(/\{F#([^}]*)\}\{M#[^}]*\}/g, '$1').replace(/\{M#([^}]*)\}\{F#[^}]*\}/g, '$1').replace(/&nbsp;/g, ' ').trim();
}

export function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const date = new Date(value * (value < 1e12 ? 1000 : 1));
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  const match = String(value).match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
}

export function hsrDescription(description, params = []) {
  return plain(description).replace(/#(\d+)\[(?:i|f\d*)\](%?)/g, (_, number, percent) => {
    const value = params[Number(number) - 1];
    if (!Number.isFinite(value)) return '〔数值未收录〕';
    return `${Number((value * (percent ? 100 : 1)).toFixed(4))}${percent}`;
  });
}

export function genshinStats(config, curves, levels) {
  if (!config?.base || !config?.promotion?.length) return [];
  const keys = ['hp', 'attack', 'defense'].filter(key => Number.isFinite(config.base[key]));
  const max = config.promotion.at(-1).maxlevel;
  return levels.filter(level => level <= max).map(level => {
    const promotion = config.promotion.find((p, index) => level <= p.maxlevel && (index === 0 || level > config.promotion[index - 1].maxlevel)) ?? config.promotion.at(-1);
    const row = { level };
    for (const key of keys) {
      const rate = curves?.[level]?.[config.curve[key]];
      if (Number.isFinite(rate)) row[key] = Math.round(config.base[key] * rate + (promotion[key] ?? 0));
    }
    if (config.base.specialized !== undefined && config.curve.specialized) {
      const rate = curves?.[level]?.[config.curve.specialized];
      if (Number.isFinite(rate)) row.secondaryValue = Number((config.base.specialized * rate).toFixed(4));
    } else if (config.specialized) row.secondaryValue = promotion.specialized ?? 0;
    return row;
  });
}

export function hsrStats(promotion) {
  if (!promotion?.values?.length) return [];
  return [1, 20, 30, 40, 50, 60, 70, 80].map(level => {
    const ascension = level <= 20 ? 0 : Math.min(6, Math.floor((level - 11) / 10));
    const values = promotion.values[ascension];
    const row = { level };
    for (const [source, target] of [['hp','hp'],['atk','attack'],['def','defense'],['spd','speed']]) {
      if (values[source]) row[target] = Math.floor(values[source].base + values[source].step * (level - 1));
    }
    return row;
  });
}

export function effectTags(text) {
  const words = ['攻击力','生命值','防御力','暴击率','暴击伤害','元素精通','元素充能效率','能量恢复','速度','击破特攻','效果命中','效果抵抗','治疗量','冲击力','异常精通','穿透率','物理伤害','冰属性','火属性','电属性','以太','水元素','火元素','冰元素','雷元素','风元素','岩元素','草元素'];
  return words.filter(word => String(text ?? '').includes(word));
}

export function genshinTalentLevels(skill, params) {
  const labels=skill?.attributes?.labels;
  if(!labels?.length||!params)return [];
  const count=Math.max(0,...Object.values(params).filter(Array.isArray).map(v=>v.length));
  return Array.from({length:count},(_,index)=>({level:index+1,description:plain(skill.description),specs:labels.map(label=>{
    const split=label.indexOf('|');const name=plain(split<0?label:label.slice(0,split));
    const template=split<0?'':label.slice(split+1);
    const value=plain(template.replace(/\{(param\d+):([A-Z\d]+)\}/g,(_,key,format)=>{
      const value=params[key]?.[index];if(!Number.isFinite(value))return '〔未收录〕';
      const percentage=format.endsWith('P'),digits=Number(format.match(/\d+/)?.[0]??0);
      return (value*(percentage?100:1)).toFixed(digits)+(percentage?'%':'');
    }));return{name,value};
  })}));
}
