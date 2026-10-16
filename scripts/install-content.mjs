import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyContentUpdate } from '../lib/content-install.mjs';
import { writeJSON } from '../lib/release-common.mjs';

export function installContentCLI(args = process.argv.slice(2)) {
  const positional = args.filter(arg => !arg.startsWith('--'));
  const option = name => args.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  try {
    if (positional.length !== 2) throw Error('用法：node scripts/install-content.mjs <Wiki目录> <解压后的资料包目录>');
    const result = applyContentUpdate(path.resolve(positional[0]), path.resolve(positional[1]), { onProgress: value => { if (option('status')) writeJSON(option('status'), value); } });
    if (option('result')) writeJSON(option('result'), { status: 'success', ...result });
    console.log(`资料 ${result.revision} 安装完成；个人资料保留${result.conflicts ? `，${result.conflicts} 项冲突已保留本地值` : ''}。`);
  } catch (error) { if (option('result')) writeJSON(option('result'), { status: 'failed', message: error.message }); console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) installContentCLI();
