// 从已固定并保存的上游构建提取原始数值，不使用 Wiki 的四舍五入展示数值。
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./go/assets/index-Bt51vV7-.js',import.meta.url),'utf8'),data={};
for(const [key,symbol]of [['art','Xit'],['char','Jit'],['weapon','Yit']]){
  let start=source.indexOf(symbol+'=JSON.parse(');if(start<0)throw Error('上游数值锚点变更：'+symbol);start+=symbol.length+1;
  let cursor=start+'JSON.parse('.length;const quote=source[cursor++];if(!['"',"'"].includes(quote))throw Error('数值资料不是字符串字面量');
  let escaped=false;for(;cursor<source.length;cursor++){if(escaped){escaped=false;continue;}if(source[cursor]==='\\'){escaped=true;continue;}if(source[cursor]===quote)break;}
  if(source[cursor+1]!==')')throw Error('数值资料边界不正确');
  // 表达式仅包含 JSON.parse 和一个有完整边界的字符串，不执行上游应用。
  data[key]=vm.runInNewContext(source.slice(start,cursor+2),{}, {timeout:5000});
}
await writeFile(new URL('../core/game-stats.json',import.meta.url),JSON.stringify(data));
