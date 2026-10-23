import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const definitions = {
  search: { name: '搜索与术语', pattern: /^(?:unified-search|skill-terms|wiki-improvements(?:-dom)?\.test)/ },
  catalog: { name: '图鉴与资料', pattern: /^(?:catalog|data|normalize|character-materials|material-(?!usage-api)|growth|synthesis|banner-|version-|wiki-facts|wiki-103|key-dates|planner-schedule|content-completion)/ },
  updates: { name: '资料更新与分发', pattern: /^(?:release|online-updates|content-(?:updates|status)|wiki-maintenance|wiki-improvements-integration|maintenance-)/ },
  accounts: { name: '账号与库存', pattern: /^assessment-(?:accounts|scan-sync|import-matching|editing|managed-inventory|inventory|roster-planner)/ },
  assessment: { name: '养成与配装', pattern: /^assessment/ },
  ui: { name: '界面与交互', pattern: /^(?:responsive-layout|column-layout|sidebar-edge|page-state|assessment-(?:layout|controls|hints-ui|research-ui|module-loading|pickers|team-view)|unified-search-dom|wiki-improvements-dom)/ },
};
export async function testGroups(directory = root) {
  const files = (await readdir(resolve(directory, 'tests'))).filter(file => file.endsWith('.test.mjs')).sort();
  const groups = Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, { name: value.name, files: files.filter(file => value.pattern.test(file)).map(file => 'tests/' + file) }]));
  const covered = new Set(Object.values(groups).flatMap(group => group.files));
  groups.core = { name: '接口与启动', files: files.map(file => 'tests/' + file).filter(file => !covered.has(file)) };
  groups.all = { name: '全部测试', files: files.map(file => 'tests/' + file) };
  return groups;
}
export async function runTestGroup(args = process.argv.slice(2)) {
  const groups = await testGroups(), selected = args.filter(arg => !arg.startsWith('--'));
  if (args.some(arg => arg.startsWith('--') && arg !== '--list' && !arg.startsWith('--name=') && !arg.startsWith('--skip='))) throw Error('支持 --list、--name=正则、--skip=正则。');
  const filters = args.filter(arg => /^--(?:name|skip)=/.test(arg)).map(arg => {
    const [key, ...parts] = arg.split('='), pattern = parts.join('=');
    new RegExp(pattern);
    return (key === '--name' ? '--test-name-pattern=' : '--test-skip-pattern=') + pattern;
  });
  if (selected.some(group => !Object.hasOwn(groups, group))) throw Error('未知测试分组，可使用 npm run test:list 查看。');
  if (args.includes('--list')) {
    for (const [key, group] of Object.entries(groups)) {
      if (selected.length && !selected.includes(key)) continue;
      console.log(`${key} · ${group.name} · ${group.files.length} 个文件`);
      if (selected.length) console.log(group.files.join('\n'));
    }
    return 0;
  }
  if (!selected.length) throw Error('请选择测试分组，可使用 npm run test:list 查看。');
  const files = [...new Set(selected.flatMap(group => groups[group].files))].sort();
  if (!files.length) throw Error('所选分组没有测试文件。');
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', ...filters, ...files], { cwd: root, stdio: 'inherit', windowsHide: true });
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runTestGroup(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
