export async function withResourceTimeout(load,{timeout=20000,signal,message='资料加载超时，请刷新后重试。'}={}){
  const controller=new AbortController();let timer,cancel;
  const interrupted=new Promise((_,reject)=>{
    const abort=error=>{controller.abort(error);reject(error);};
    cancel=()=>abort(signal.reason??new Error('已取消加载'));
    if(signal?.aborted)cancel();
    else{
      signal?.addEventListener('abort',cancel,{once:true});
      timer=setTimeout(()=>abort(new Error(message)),timeout);
    }
  });
  try{
    return await Promise.race([Promise.resolve().then(()=>{controller.signal.throwIfAborted();return load(controller.signal);}),interrupted]);
  }catch(error){controller.abort(error);throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
