import { spawn } from 'node:child_process';

export function openBrowser(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(url)) throw new Error('百科地址不正确。');
  return new Promise((resolve, reject) => {
    // Windows 的协议处理交给 Start-Process，避免 cmd start 持续等待。
    const child = process.platform === 'win32'
      ? spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; Start-Process -FilePath '${url}'`], { windowsHide: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('默认浏览器没有及时响应。')); }, 8000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`打开默认浏览器失败（${code}）。`)); });
  });
}
