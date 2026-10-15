import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { applyUpdate } from '../lib/release-install.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const [action, directory] = process.argv.slice(2);
  if (action !== 'apply' || !directory) throw Error('使用：node scripts/update-wiki.mjs apply 更新目录');
  const result = applyUpdate(root, resolve(directory));
  console.log(`更新完成：Wiki ${result.release.version} / ${result.release.releaseId}`);
  console.log(`处理公共文件 ${result.files} 个，合并条目 ${result.entries} 条。个人收藏、材料计划与评估账号保留。`);
  if (result.conflicts) console.log(`保留本地编辑的冲突 ${result.conflicts} 条，记录：${result.conflictFile}`);
  if (result.recoveredInterruptedUpdate) console.log('已先恢复上次中断的更新事务。');
} catch (error) { console.error(`操作未完成：${error.message}`); process.exitCode = 1; }
