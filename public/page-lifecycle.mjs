export function trackPageLifetime(token){
  let socket,retry,away=false;
  const connect=()=>{
    if(away)return;
    if(socket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState))return;
    clearTimeout(retry);
    const url=new URL('/api/page-session',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('token',token);
    const connection=new WebSocket(url);socket=connection;connection.addEventListener('error',()=>{});
    connection.addEventListener('close',()=>{if(!away&&socket===connection)retry=setTimeout(connect,2000);});
  };
  // pagehide 在实际离开时触发，刷新、取消关闭确认以及 BFCache 返回均可正确处理。
  window.addEventListener('pagehide',()=>{away=true;clearTimeout(retry);if(socket?.readyState===WebSocket.OPEN)socket.close(1000);else if(socket?.readyState===WebSocket.CONNECTING)socket.close();});
  window.addEventListener('pageshow',()=>{if(away){away=false;connect();}});
  connect();
}
