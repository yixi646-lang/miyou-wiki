// 固定源码构建；不使用 GO 网页、广告、路由或压缩产物中的变量名。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {syncNativeData} from './sync-native-data.mjs';
import {patchEngineSource} from './engine-patches.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const argument=name=>process.argv.find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const root=path.resolve(argument('--source-dir')??path.join(dir,'source'));
const output=path.resolve(argument('--output-dir')??path.join(dir,'../core'));
const upstream=JSON.parse(fs.readFileSync(path.join(dir,'../upstream.json'),'utf8'));
const commit=upstream.sourceCommit;
if(!/^[a-f0-9]{40}$/.test(commit))throw Error('构建必须固定完整源码提交');
const groups=['common/util','gi/consts','gi/keymap','gi/stats','gi/util','gi/wr','gi/wr-types','gi/uidata','gi/sheets','gi/solver','gi/solver-tc','gi/upopt'];
fs.mkdirSync(root,{recursive:true});
if(process.argv.includes('--fetch')){
  const response=await fetch(`https://api.github.com/repos/frzyc/genshin-optimizer/git/trees/${commit}?recursive=1`);
  if(!response.ok)throw Error(`源码目录 ${response.status}`);
  const tree=await response.json();if(tree.truncated)throw Error('源码目录不完整');
  const files=tree.tree.filter(t=>t.type==='blob'&&(groups.some(g=>t.path.startsWith(`libs/${g}/src/`))&&!/\/(?:executors|__tests__)\/|\.test\.|\.spec\./.test(t.path)||/^libs\/gi\/(?:dm-)?localization\/assets\/locales\/(?:chs|en)\/[^/]+\.json$/.test(t.path)));
  const previous=fs.existsSync(path.join(root,'provenance.json'))?JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8')):null;
  let index=0,count=0;await Promise.all(Array.from({length:20},async()=>{
    while(index<files.length){const item=files[index++],file=path.join(root,item.path);if(previous?.commit===commit&&fs.existsSync(file))continue;
      const r=await fetch(`https://raw.githubusercontent.com/frzyc/genshin-optimizer/${commit}/${item.path}`);if(!r.ok)throw Error(`${item.path}: ${r.status}`);
      const bytes=new Uint8Array(await r.arrayBuffer());fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);count++;
    }
  }));
  fs.writeFileSync(path.join(root,'provenance.json'),JSON.stringify({repository:'frzyc/genshin-optimizer',commit,license:'MIT',files:files.map(f=>f.path)},null,2));
  console.log(`计算源码 ${count} 个文件`);
}
fs.mkdirSync(output,{recursive:true});
syncNativeData({sourceDirectory:root,outputDirectory:output});
const {build}=process.env.WIKI_ESBUILD?await import(pathToFileURL(path.resolve(process.env.WIKI_ESBUILD)).href):await import('esbuild');
const aliases=Object.fromEntries(groups.map(g=>[`@genshin-optimizer/${g}`,path.join(root,`libs/${g}/src/index.ts`)]));
const externalNames=new Map();
function scan(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())scan(p);else if(/\.tsx?$/.test(p)){
  const text=fs.readFileSync(p,'utf8');for(const m of text.matchAll(/import\s+(?!type\s)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)){
    if(aliases[m[2]]||m[2].startsWith('.'))continue;const names=externalNames.get(m[2])??new Set();
    for(const v of (m[1].match(/\{([\s\S]*?)\}/)?.[1]??'').split(',')){const n=v.trim().split(/\s+as\s+/)[0];if(n&&!n.startsWith('type ')&&/^\w+$/.test(n))names.add(n);}
    externalNames.set(m[2],names);
  }
}}}
scan(root);
const plugin={name:'headless-sheets',setup(b){
  b.onLoad({filter:/\.tsx?$/,namespace:'file'},a=>{
    const contents=patchEngineSource(a.path,fs.readFileSync(a.path,'utf8'));
    return contents===null?undefined:{contents,loader:a.path.endsWith('.tsx')?'tsx':'ts'};
  });
  b.onResolve({filter:/^\.\/zh\.json$/},()=>({path:path.join(output,'zh.json')}));
  b.onResolve({filter:/^@genshin-optimizer\//},a=>aliases[a.path]?{path:aliases[a.path]}:{path:a.path,namespace:'metadata'});
  b.onResolve({filter:/^(?:react(?:\/.*)?|@mui\/.*)$/},a=>({path:a.path,namespace:'metadata'}));
  b.onLoad({filter:/.*/,namespace:'metadata'},a=>{
    const names=externalNames.get(a.path)??new Set();
    if(a.path==='@genshin-optimizer/gi/assets')return{contents:"const asset=new Proxy(()=>'',{get:()=>asset}); export const imgAssets=asset;"+[...names].filter(n=>n!=='imgAssets').map(n=>`export const ${n}=asset;`).join('\n'),loader:'js'};
    const pre="const node=(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}}); const component=name=>props=>node(name,props); export default component('component');";
    const exports=[...names].map(n=>n==='Translate'?"export const Translate='Translate';":n==='createElement'?"export const createElement=node;":n==='Fragment'?"export const Fragment='Fragment';":`export const ${n}=component('${n}');`).join('\n');
    return{contents:pre+'\n'+exports,loader:'js'};
  });
}};
const nodePaths=process.env.WIKI_ESBUILD?[path.dirname(path.dirname(path.dirname(path.resolve(process.env.WIKI_ESBUILD))))]:[];
await build({entryPoints:[path.join(dir,'../core/go-adapter.ts')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(output,'calculator.mjs'),nodePaths,minify:true,legalComments:'eof',plugins:[plugin],jsx:'transform',jsxFactory:'sheetNode',jsxFragment:'sheetFragment',inject:[path.join(dir,'jsx-metadata.mjs')],define:{'process.env':'{"NODE_ENV":"production","NX_SHOW_DEV_COMPONENTS":"false"}'},logLevel:'warning'});
fs.copyFileSync(path.join(root,'libs/gi/stats/src/allStat_gen.json'),path.join(output,'game-stats.json'));
console.log(`原生计算核心 ${(fs.statSync(path.join(output,'calculator.mjs')).size/1048576).toFixed(2)} MiB`);
