import {mkdtemp,mkdir,rm,realpath} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const testRoot=resolve(root,'.codex_tmp','tests');
const owned=new Set();
export async function createTestWorkspace(name){
 if(!/^[a-z0-9-]+$/i.test(name))throw Error('测试目录名称不合法');
 await mkdir(testRoot,{recursive:true});
 const directory=await mkdtemp(join(testRoot,name+'-'));owned.add(directory);return directory;
}
export async function cleanupTestWorkspace(directory){
 if(!owned.has(directory))throw Error('只能清理本轮创建的测试目录');
 const resolved=resolve(directory);
 if(!resolved.startsWith(testRoot+sep))throw Error('测试清理路径超出范围');
 const actual=await realpath(resolved).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(actual&&!actual.startsWith(await realpath(testRoot)+sep))throw Error('测试清理路径指向范围之外');
 await rm(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:200});owned.delete(directory);
 // 只移除空的 tests 父目录，绝不递归清理其他运行的目录。
 const {rmdir}=await import('node:fs/promises');await rmdir(testRoot).catch(error=>{if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code))throw error;});
}
export async function stopTestProcess(child){
 if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
 const exited=new Promise(resolve=>child.once('exit',resolve));
 if(process.platform==='win32'&&/chrome(?:\.exe)?$/i.test(child.spawnfile)){
  const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  const code=await new Promise(resolve=>{killer.once('error',()=>resolve(-1));killer.once('exit',resolve);});
  if(code!==0&&child.exitCode===null&&child.signalCode===null)child.kill();
 }else child.kill();
 let timer;
 try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('测试进程未停止，未清理其目录')),5000);})]);}finally{clearTimeout(timer);}
}
