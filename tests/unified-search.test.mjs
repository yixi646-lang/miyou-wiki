import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSearchDocuments,searchDocuments,groupSearchResults} from '../shared/unified-search.mjs';

const entries=[
 {id:'genshin-furina',game:'genshin',category:'characters',name:'芙宁娜',aliases:['水神'],element:'水',releaseDate:'2023-11-08'},
 {id:'genshin-material',game:'genshin',category:'materials',name:'正义的教导',type:'天赋材料',releaseVersion:'4.0'},
 {id:'starrail-furina',game:'starrail',category:'characters',name:'水神',aliases:[]}
];
const versions=[{version:'4.2',title:'罪人舞步旋',sections:[{key:'systems',label:'系统与体验优化',items:[{name:'圣遗物锁定',explanation:'可以快速锁定'}]},{key:'characters',label:'新增角色',items:[{name:'芙宁娜'}]}]}];
const artwork={images:{'genshin-furina':'/assets/furina.png'},variants:{'genshin-furina':[{key:'main',label:'主立绘',image:'/assets/furina.png'},{key:'skin',label:'皮肤·示例时装',type:'skin',image:'/assets/furina-skin.png'},{key:'remote',label:'远程图片',image:'https://example.com/remote.png'}]},entries:[{id:'genshin-gallery',game:'genshin',category:'characters',name:'展示角色'}]};

test('当前游戏名称与别名优先，材料摘要可检索，不合并跨游戏资料',()=>{
 const docs=buildSearchDocuments({game:'genshin',entries,versions,artwork}),copy=structuredClone(docs);
 const result=searchDocuments(docs,'水神');assert.equal(result[0].id,'genshin-furina');assert.equal(result[0].type,'entries');assert.equal(result.length,3);assert(!docs.some(d=>d.id==='starrail-furina'));
 assert.equal(searchDocuments(docs,'正义 天赋')[0].id,'genshin-material');assert.equal(searchDocuments(docs,'４.２')[0].id,'4.2');assert.deepEqual(docs,copy);assert.deepEqual(searchDocuments(docs,'  '),[]);
});

test('版本内容定位到原分栏，皮肤结果选择对应立绘，不发送或预加载图片',()=>{
 const docs=buildSearchDocuments({game:'genshin',entries,versions,artwork});
 const result=searchDocuments(docs,'快速 锁定',{type:'versions'});assert.equal(result.length,1);assert(result[0].href.endsWith('#version-systems'));assert.match(result[0].excerpt,/快速锁定/);
 const skin=searchDocuments(docs,'示例时装',{type:'artwork'});assert.equal(skin.length,1);const q=new URL(skin[0].href,'http://localhost').searchParams;assert.equal(q.get('variant'),'skin');assert.equal(q.get('artwork'),'genshin-furina');assert.equal(q.get('q'),'芙宁娜');
 assert(!JSON.stringify(docs).includes('/assets/'));assert(!JSON.stringify(docs).includes('remote.png'));assert.equal(docs.filter(d=>d.type==='artwork').length,2);
});

test('兼容原始立绘索引的独立展示角色，排除不收录的邦布条目',()=>{
 const docs=buildSearchDocuments({game:'zenless',entries:[{id:'bangboo',name:'邦布',game:'zenless',category:'bangboo'},{id:'bangboo-banner',name:'邦布频道',game:'zenless',category:'banners',banner:{sourceType:'Bangboo Channel'}}],artwork:{images:{proxy:'/assets/proxy.png'},galleryEntries:[{id:'proxy',name:'哲',game:'zenless',category:'characters'}]}});
 assert.equal(docs.length,1);assert.equal(searchDocuments(docs,'哲')[0].type,'artwork');
});

test('全部游戏按类别和游戏分组，同版本号不串档，匹配立绘合并到同一角色卡片',()=>{
 const docs=['genshin','starrail','zenless'].flatMap(game=>buildSearchDocuments({game,entries:[{id:game+'-character',game,category:'characters',name:'共同角色',aliases:[]}],versions:[{version:'4.2',title:'共同版本',sections:[]}]}));
 const groups=groupSearchResults(searchDocuments(docs,'共同'));assert.deepEqual(groups.map(g=>[g.category,g.game]),[['characters','genshin'],['characters','starrail'],['characters','zenless'],['versions','genshin'],['versions','starrail'],['versions','zenless']]);
 for(const group of groups.filter(g=>g.category==='versions'))assert.equal(new URL(group.items[0].href,'http://localhost').searchParams.get('game'),group.game);
 const arts=groupSearchResults(searchDocuments(buildSearchDocuments({game:'genshin',entries,artwork}),'水神',{type:'artwork'}));assert.equal(arts[0].items.length,1);assert.equal(arts[0].matches.length,2);assert.equal(arts[0].items[0].matches.length,2);
});

test('分类筛选及名称、时间、稀有度排序支持方向，未知值始终放后，相关度先匹配名称和别名',()=>{
 const docs=buildSearchDocuments({game:'genshin',entries:[
  {id:'a',game:'genshin',category:'characters',name:'测试甲',aliases:['完整名称'],rarity:4,releaseDate:'2022-01-01'},
  {id:'b',game:'genshin',category:'characters',name:'完整名称',rarity:5,releaseDate:'2024-01-01'},
  {id:'c',game:'genshin',category:'characters',name:'测试乙',type:'完整名称'},
  {id:'d',game:'genshin',category:'weapons',name:'测试武器',rarity:3,releaseDate:'2025-01-01'}
 ]});
 assert.deepEqual(searchDocuments(docs,'测试',{type:'weapons'}).map(r=>r.id),['d']);
 assert.deepEqual(searchDocuments(docs,'测试',{type:'characters',sort:'release',direction:'asc'}).map(r=>r.id),['a','c']);
 assert.deepEqual(searchDocuments(docs,'完整名称',{sort:'rarity'}).map(r=>r.id),['b','a','c']);
 assert.deepEqual(searchDocuments(docs,'完整名称',{sort:'rarity',direction:'asc'}).map(r=>r.id),['a','b','c']);
 assert.deepEqual(searchDocuments(docs,'完整名称').map(r=>r.id),['b','a','c']);
 const asc=searchDocuments(docs,'测试',{sort:'name',direction:'asc'}),desc=searchDocuments(docs,'测试',{sort:'name',direction:'desc'});assert.deepEqual(desc.map(r=>r.id),asc.map(r=>r.id).reverse());
});

test('搜索角色名称可匹配已收录的卡池名单，列表摘要不包含完整获取说明',()=>{
 const docs=buildSearchDocuments({game:'genshin',entries:[{id:'banner',game:'genshin',category:'banners',name:'众水的颂诗',banner:{groups:[{items:[{name:'芙宁娜'}]}]},details:{acquisition:['不应传入搜索索引的获取原文']}}]});
 assert.equal(searchDocuments(docs,'芙宁娜',{type:'banners'})[0].id,'banner');assert(!JSON.stringify(docs).includes('获取原文'));
});
