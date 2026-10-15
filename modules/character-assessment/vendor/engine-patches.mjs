// 针对固定开发提交的机制适配。保留上游源码原文，重建时应用并核对锚点。
export function patchEngineSource(filename,raw){
  const file=filename.replaceAll('\\','/');
  // 只标注最终输出类型，不改变公式；元素标记也用于护盾和增益，不能据此猜伤害。
  if(file.endsWith('/Characters/dataUtil.tsx')||file.endsWith('/gi/wr/src/reaction/special.ts')){
    let text=raw;
    const constructors=file.endsWith('/Characters/dataUtil.tsx')
      ?[['customDmgNode','damage'],['customHealNode','heal'],['customShieldNode','shield']]
      :[['specialReactionDmgNode','damage']];
    for(const [name,kind]of constructors){
      const anchor=`export function ${name}(`;
      if(text.split(anchor).length!==2)throw Error(`GO 输出类型标注锚点已变化：${name}`);
      text=text.replace(anchor,`function wiki_${name}(`);
      text+=`\nexport function ${name}(...args: Parameters<typeof wiki_${name}>) {\n  return infoMut(wiki_${name}(...args), {wikiResultType: '${kind}'} as any)\n}\n`;
    }
    return text;
  }
  if(file.endsWith('/gi/wr/src/optimization.ts')){
    const anchor='  // res copied from the code above';
    if(raw.split(anchor).length!==2)throw Error('GO 求解器解释执行适配锚点已变化');
    // 保留固定版本的公式和剪枝；将 Function 编译替换成一次预编译的指令表，兼容 Wiki CSP。
    return raw.replace(anchor,()=>`  const instructions: any[] = [], indices = new Map<any, number>();
  forEachNodes(formulas, () => {}, (node) => {
    indices.set(node, instructions.length);
    instructions.push({op: node.operation, value: node.value, key: node.operation === 'read' ? binding(node) : '', args: node.operands.map(n => indices.get(n)!)});
  });
  const output = formulas.map(n => indices.get(n)!);
  return (build: any) => {
    const values: number[] = [];
    for (const n of instructions) {
      if(n.op === 'const') values.push(n.value);
      else if(n.op === 'read') values.push((initial[n.key] ?? 0) + build.reduce((s: number, b: any) => s + (b.values[n.key] ?? 0), 0));
      else values.push(allOperations[n.op](n.args.map((i: number) => values[i])));
    }
    return output.map(i => values[i]);
  };
  // res copied from the code above`);
  }
  if(!/\/Characters\/(?:Vesna|Vodyanitsa)\/index\.tsx$/.test(file))return null;
  let text=raw.replaceAll('\r\n','\n');
  const replace=(from,to)=>{
    if(text.split(from).length!==2)throw Error(`7.1 机制适配锚点已变化：${filename}`);
    text=text.replace(from,to);
  };
  if(file.endsWith('/Characters/Vesna/index.tsx')){
    // 整肃只强化灵剑，不强化翔风剑本体的前两阶攻击。
    for(const tier of [1,2])replace(
      `sword${tier}Dmg: dmgNode(\n      'atk',\n      dm.skill.sword${tier}Dmg,\n      'skill',\n      undefined,\n      a1Stacks_spiritMult_\n    ),`,
      `sword${tier}Dmg: dmgNode('atk', dm.skill.sword${tier}Dmg, 'skill'),`
    );
    // 二命强化依赖已解锁的一破天赋。
    replace(
      "equal(condA1Stacks, dm.passive1.maxStacks.toFixed(), dm.constellation2.atk_)",
      "greaterEq(input.asc, 1, equal(condA1Stacks, dm.passive1.maxStacks.toFixed(), dm.constellation2.atk_))"
    );
  }else{
    // 有流荡风旋时，领唱/重唱改为增益星扩散，不能同时增益普通水冰伤害。
    replace(
      "const [condA4LeadVocalPath, condA4LeadVocal] = cond(key, 'a4LeadVocal')",
      `const [condA4VortexPath, condA4Vortex] = cond(key, 'a4Vortex')
const [condA4LeadVocalPath, condA4LeadVocal] = cond(key, 'a4LeadVocal')`
    );
    for(const ele of ['hydro','cryo'])replace(
      `${ele}_dmgInc: sum(a4LeadVocal_${ele}_dmgInc, a4Chorus_${ele}_dmgInc),`,
      `${ele}_dmgInc: equal(condA4Vortex, undefined, sum(a4LeadVocal_${ele}_dmgInc, a4Chorus_${ele}_dmgInc)),`
    );
    replace(
      `stellarswirl_dmgInc: sum(\n        a4LeadVocal_stellarswirl_dmgInc,\n        a4Chorus_stellarswirl_dmgInc\n      ),`,
      `stellarswirl_dmgInc: equal(condA4Vortex, 'on', sum(a4LeadVocal_stellarswirl_dmgInc, a4Chorus_stellarswirl_dmgInc)),`
    );
    replace(
      "passive2: ct.talentTem('passive2', [",
      `passive2: ct.talentTem('passive2', [
    ct.condTem('passive2', {
      path: condA4VortexPath, value: condA4Vortex,
      name: ct.ch('a4VortexCond'), teamBuff: true,
      states: { on: { fields: [] } },
    }),`
    );
  }
  return text;
}
