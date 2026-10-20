import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAccountStore} from './accounts-store.mjs';
import {createRecommendationStore} from './recommendation-store.mjs';
const directory=fileURLToPath(new URL('./',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'};
export function createAssessmentRouter({storagePath,json,body,recommendationPath=resolve(directory,'core/recommendation-overrides.json')}){
  const accounts=createAccountStore(storagePath);let stats;
  let recommendations;
  const defaults=async()=>recommendations??=createRecommendationStore(recommendationPath,JSON.parse(await readFile(new URL('./core/catalog.json',import.meta.url),'utf8')));
  const data=async()=>stats??=JSON.parse(await readFile(new URL('./core/game-stats.json',import.meta.url),'utf8'));
  return{
    accounts, data, defaults,
    close(){accounts.close();},
    async handle(req,res,url){
      if(url.pathname==='/api/assessment/recommendations'){
        const store=await defaults();
        if(req.method==='GET')json(res,200,store.read());
        else if(req.method==='POST')json(res,200,store.write(await body(req)));
        else json(res,405,{error:'不支持的请求方法。'});return true;
      }
      if(url.pathname==='/api/assessment/state'){
        if(req.method==='GET'){json(res,200,accounts.read(url.searchParams.get('account')||undefined));return true;}
        if(req.method==='POST'){
          json(res,200,accounts.write(await body(req),await data()));return true;
        }
        json(res,405,{error:'不支持的请求方法。'});return true;
      }
      if(url.pathname==='/api/assessment/accounts'){
        if(req.method==='GET')json(res,200,accounts.list());
        else if(req.method==='POST')json(res,200,accounts.action(await body(req),await data()));
        else json(res,405,{error:'不支持的请求方法。'});return true;
      }
      if(url.pathname==='/api/assessment/accounts/export'&&req.method==='GET'){json(res,200,accounts.export());return true;}
      if(url.pathname==='/api/assessment/accounts/original'&&req.method==='GET'){json(res,200,accounts.original(url.searchParams.get('account')));return true;}
      if(url.pathname==='/api/assessment/accounts/recovery'&&req.method==='GET'){json(res,200,accounts.recovery(url.searchParams.get('account')));return true;}
      if(url.pathname==='/api/assessment/accounts/import'&&req.method==='POST'){json(res,200,accounts.import(await body(req),await data()));return true;}
      if(!url.pathname.startsWith('/assessment/'))return false;
      if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'不支持的请求方法。'});return true;}
      const decoded=decodeURIComponent(url.pathname.slice('/assessment/'.length));
      if(decoded.includes('\\')||decoded.split('/').includes('..')){json(res,403,{error:'路径不合法。'});return true;}
      // 只发布显式资源目录，服务代码及个人资料不可通过静态路由访问。
      if(!/^(?:ui\.mjs|ui\.css|import-matching\.mjs|workbench\.mjs|optimizer-ui\.mjs|optimizer-worker\.mjs|artifact-research-ui\.mjs|artifact-research-worker\.mjs|multitarget-ui\.mjs|artifact-ui\.mjs|analysis-dialog\.mjs|recommendation-editor\.mjs|trial-equipment-editor\.mjs|inventory-dialogs\.mjs|character-filters\.mjs|catalog-picker\.mjs|vendor\/LICENSE[^/]*\.txt|core\/(?:optimizer\.mjs|optimizer-search\.mjs|artifact-research\.mjs|multitarget\.mjs|artifact-triggers\.mjs|artifact-trigger-data\.mjs|undo\.mjs|managed-inventory\.mjs|model\.mjs|import-sync\.mjs|equipment-matching\.mjs|artifacts\.mjs|artifact-order\.mjs|actions\.mjs|workspace\.mjs|teams\.mjs|combat\.mjs|evaluate\.mjs|profiles\.mjs|recommendation-data\.mjs|recommendation-settings\.mjs|recommendation-plans\.mjs|permissions\.mjs|inventory\.mjs|calculator\.mjs|game-stats\.json|catalog\.json)|upstream\.json)$/.test(decoded)){json(res,404,{error:'资源不存在。'});return true;}
      const path=resolve(directory,decoded);if(!path.startsWith(resolve(directory)+sep)||decoded.includes('\0')){json(res,403,{error:'路径不合法。'});return true;}
      let info;try{info=await stat(path);}catch{json(res,404,{error:'资源不存在。'});return true;}if(!info.isFile()){json(res,404,{error:'资源不存在。'});return true;}
      // 源码计算使用解释器，主页面与模块均不需要 unsafe-eval 或 iframe。
      res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
      res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);return true;
    }
  };
}
