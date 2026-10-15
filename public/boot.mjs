// 子模块下载或解析失败时，也必须结束首页的等待画面。
const showFailure=message=>{
  const host=document.querySelector('#content');
  if(!host?.querySelector('.loading'))return;
  const panel=document.createElement('div');panel.className='panel empty';
  const title=document.createElement('strong');title.textContent='Wiki 暂时无法加载';
  const note=document.createElement('p');note.textContent=message;
  const hint=document.createElement('p');hint.textContent='请关闭 Wiki 页面后重新启动 Wiki，再刷新页面。';
  panel.append(title,note,hint);host.replaceChildren(panel);
  const count=document.querySelector('#local-count');if(count)count.textContent='资料尚未载入';
};
const timer=setTimeout(()=>showFailure('加载超时，本地服务可能已经退出。'),20000);
try{await import('./app.mjs');}catch(error){showFailure(error.message);}finally{clearTimeout(timer);}
