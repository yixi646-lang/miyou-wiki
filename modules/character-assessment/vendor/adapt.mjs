// 本次固定构建的唯一适配脚本。更新上游构建时先重新核对这些锚点。
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../',import.meta.url),main=new URL('./go/assets/index-Bt51vV7-.js',import.meta.url);
let source=await readFile(main,'utf8');
const replace=(from,to)=>{const occurrences=source.split(from).length-1;if(occurrences!==1)throw Error(`上游锚点变更：${from} (${occurrences})`);source=source.replace(from,to);};
if(!source.includes('wikiAssessmentRegister')){
  replace('this.displayArchive.follow(a)}get dataManagers()', 'this.displayArchive.follow(a),globalThis.wikiAssessmentRegister?.(this)}get dataManagers()');
  replace('KGe.initialize(Osa.NX_GA_TRACKINGID,{testMode:kGe});','for(const method of ["initialize","send","event","pageview","set","ga","gtag"])KGe[method]=()=>{};');
  // 固定构建中这些是广告容器和外层导航；功能路由与计算公式保持原实现。
  for(const name of ['Pse','Fse','dsa','$oa']){
    const start=source.indexOf(`function ${name}(`);if(start<0)throw Error('缺少界面适配锚点 '+name);
    let cursor=start,depth=0,body=-1;
    // 参数解构可能包含花括号，函数体位于最外层参数闭括号之后。
    const paren=source.indexOf('(',start);cursor=paren;for(;cursor<source.length;cursor++){if(source[cursor]==='(')depth++;if(source[cursor]===')'&&!--depth){body=source.indexOf('{',cursor);break;}}
    if(body<0)throw Error('函数体边界不正确');source=source.slice(0,body+1)+'return null;'+source.slice(body+1);
  }
  await writeFile(main,source);
}
let html=await readFile(new URL('./go/index.html',import.meta.url),'utf8');
html=html.replace('<html lang="en">','<html lang="zh-CN">').replace(/<script\b[^>]*src="https:\/\/pagead2[^\"]*"[^>]*>\s*<\/script>/g,'').replace(/<title>[^<]*<\/title>/,'<title>原神配装与伤害</title>');
html=html.replace(/<script type="module"[^>]*><\/script>/,'');
if(!html.includes('engine-bridge.js'))html=html.replace('</head>','<link rel="stylesheet" href="/assessment/engine.css"><script src="/assessment/engine-bridge.js"></script></head>');
if(!html.includes('engine-language.js'))html=html.replace('</head>','<script src="/assessment/engine-language.js"></script></head>');
await writeFile(new URL('./go/index.html',import.meta.url),html);
const locales=new URL('./go/assets/locales/chs/',import.meta.url);
const characters=JSON.parse(await readFile(new URL('charNames_gen.json',locales),'utf8')),weapons=JSON.parse(await readFile(new URL('weaponNames_gen.json',locales),'utf8')),sets=JSON.parse(await readFile(new URL('artifactNames_gen.json',locales),'utf8'));
const stats=JSON.parse(await readFile(new URL('core/game-stats.json',base),'utf8'));
const wiki=JSON.parse(await readFile(new URL('../../data/catalog/genshin.json',base),'utf8')).entries;
const byName=(name,category)=>wiki.find(e=>e.name===name&&e.category===category);
const rows={characters:{},weapons:{},sets:{}};
for(const [key,name]of Object.entries(characters)){
  if(key==='Somnia'||key==='Traveler'||/^Traveler[MF]$/.test(key))continue;
  const traveler=key.match(/^Traveler(Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)([MF])$/),entry=byName(traveler?(traveler[2]==='M'?'空':'荧'):name,'characters');
  const metadata=stats.char.data[key]??(traveler?stats.char.data.Traveler:undefined);if(!metadata)continue;
  rows.characters[key]={name,element:traveler?traveler[1].toLowerCase():metadata.ele,weaponType:metadata.weaponType,rarity:metadata.rarity,wikiId:entry?.id??null,image:entry?.image??null};
}
for(const [key,name]of Object.entries(weapons)){const entry=byName(name,'weapons');if(stats.weapon.data[key])rows.weapons[key]={name,wikiId:entry?.id??null,weaponType:stats.weapon.data[key].weaponType,rarity:stats.weapon.data[key].rarity};}
for(const [key,name]of Object.entries(sets)){const entry=byName(name,'sets');if(stats.art.data[key])rows.sets[key]={name,wikiId:entry?.id??null};}
await writeFile(new URL('core/catalog.json',base),JSON.stringify(rows));
await writeFile(new URL('upstream.json',base),JSON.stringify({name:'Genshin Optimizer',version:'10.38.1',buildCommit:'f3f7642614a9bb8c07b663aba921a342dc5a5dd8',sourceCommit:'984d82cda1e37a3a634ab14d2059b6ad91b90a4a',deployedAt:'2026-08-22T20:33:34Z',source:'https://github.com/frzyc/genshin-optimizer',license:'MIT',localChanges:['移除广告及统计初始化','简体中文默认语言','Wiki 内嵌导航','独立存储及 GOOD 桥接'],coverage:{characters:Object.keys(rows.characters).length,weapons:Object.keys(rows.weapons).length,sets:Object.keys(rows.sets).length}},null,2));
console.log('已适配本地引擎与中文索引');
