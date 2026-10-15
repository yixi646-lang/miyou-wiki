import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
export function serviceLock(databasePath, root, instance = {}) {
  const updateLock=join(root,'.updates/operation.lock');
  if(existsSync(updateLock)){
    const task=JSON.parse(readFileSync(updateLock,'utf8'));
    try{process.kill(task.pid,0);throw Error('Wiki 正在安装更新，请等更新完成后再启动。');}
    catch(error){if(error.code!=='ESRCH')throw error;}
  }
  const filename = databasePath + '.service.json';
  if(existsSync(filename)){
    const task=JSON.parse(readFileSync(filename,'utf8'));
    // 复制目录可能带来原目录的运行记录，不能把它当成本目录的服务。
    if(!task.instanceId||!instance.instanceId||task.instanceId===instance.instanceId){
      try{process.kill(task.pid,0);throw Error('此 Wiki 资料库已有服务在运行。');}
      catch(error){if(error.code!=='ESRCH')throw error;}
    }
  }
  mkdirSync(dirname(filename),{recursive:true});
  writeFileSync(filename, JSON.stringify({ ...instance, app: 'local-wiki', pid: process.pid }));
  const release = () => {
    try { if (JSON.parse(readFileSync(filename, 'utf8')).pid === process.pid) unlinkSync(filename); } catch {}
  };
  process.once('exit', release);
  return release;
}
