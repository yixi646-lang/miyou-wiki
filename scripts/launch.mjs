import { fileURLToPath } from 'node:url';
import {mkdir,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import { openBrowser } from '../lib/open-browser.mjs';
import { resolveLaunchTarget } from '../lib/wiki-instance.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let url;
const noOpen=process.argv.includes('--no-open')||process.env.WIKI_NO_OPEN==='1';
const log=async message=>{await mkdir(join(root,'data','logs'),{recursive:true});await appendFile(join(root,'data','logs','startup.log'),`${new Date().toISOString()} ${message}\n`);};
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('需要 Node.js 24 或更高版本。');
  const databasePath=process.env.WIKI_DB_PATH?resolve(process.env.WIKI_DB_PATH):join(root,'data','library','wiki.sqlite');
  const portArg=process.argv.find(arg=>arg.startsWith('--port='));
  const target=await resolveLaunchTarget({root,databasePath,requestedPort:portArg?.slice(7)??process.env.WIKI_PORT});
  url=`http://127.0.0.1:${target.port}`;
  if (target.reuse) {
    const bootstrap=await(await fetch(`${url}/api/bootstrap`,{signal:AbortSignal.timeout(3000)})).json();
    const enabled=await fetch(`${url}/api/page-session/enable`,{method:'POST',headers:{'X-Wiki-Token':bootstrap.token},signal:AbortSignal.timeout(3000)});
    if(!enabled.ok)throw Error('未能开启随页面关闭自动退出。');
    console.log(`百科已经在运行，正在打开：${url}`);
    if(!noOpen)await openBrowser(url);
    if(process.connected)process.send({type:'wiki-ready'});
  } else {
    process.env.WIKI_PORT=String(target.port);
    // 显式端口与环境变量保持一致，避免服务再次读取到旧的端口参数。
    process.argv=process.argv.filter(arg=>!arg.startsWith('--port='));
    console.log(`正在启动 Wiki，浏览器地址：${url}`);
    if(!noOpen)process.argv.push('--open');
    process.argv.push('--auto-close');
    // 使用脚本自身的位置加载服务，双击时不依赖当前目录。
    await import(new URL('../server.mjs', import.meta.url).href);
  }
} catch (error) {
  console.error(`启动失败：${error.message}`);
  if(url)console.error(`浏览器地址：${url}`);
  console.error(`工作区：${fileURLToPath(new URL('../', import.meta.url))}`);
  if(process.connected)process.send({type:'wiki-error',message:error.message});
  await log(`启动失败：${error.message}；地址：${url}`);
  process.exitCode = 1;
}
