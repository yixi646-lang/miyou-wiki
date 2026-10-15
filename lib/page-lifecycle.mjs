import {createHash} from 'node:crypto';

// 只处理页面存活连接所需的 WebSocket 控制帧，不承载业务数据。
const frame=(opcode,payload=Buffer.alloc(0))=>Buffer.concat([Buffer.from([0x80|opcode,payload.length]),payload]);
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
export function createPageLifecycle({port,token,onIdle,enabled=false,idleMs=15000,startupMs=90000}={}) {
  idleMs=bounded(idleMs,15000,200,60000);startupMs=bounded(startupMs,90000,500,300000);
  const pages=new Set();let timer,stopped=false;
  const arm=delay=>{clearTimeout(timer);if(enabled&&!stopped&&!pages.size)timer=setTimeout(()=>{if(!pages.size&&!stopped)onIdle();},delay);};
  const enable=()=>{enabled=true;arm(startupMs);};
  const reject=socket=>{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');};
  function upgrade(req,socket,head){
    const hosts=[`127.0.0.1:${port}`,`localhost:${port}`],origins=hosts.map(h=>`http://${h}`);
    let url;try{url=new URL(req.url,origins[0]);}catch{return reject(socket);}
    const key=req.headers['sec-websocket-key'];
    if(stopped||url.pathname!=='/api/page-session'||url.searchParams.get('token')!==token||!hosts.includes(req.headers.host)||!origins.includes(req.headers.origin)||req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13'||typeof key!=='string'||Buffer.from(key,'base64').length!==16)return reject(socket);
    const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setTimeout(0);socket.setNoDelay(true);pages.add(socket);clearTimeout(timer);
    let buffer=Buffer.alloc(0),ending=false;
    const read=chunk=>{
      if(ending)return;buffer=Buffer.concat([buffer,chunk]);if(buffer.length>512)return socket.destroy();
      while(buffer.length>=2){
        const opcode=buffer[0]&15,n=buffer[1]&127;
        // 浏览器发送的控制帧必须掩码、完整且不超过 125 字节。
        if((buffer[0]&0xf0)!==0x80||!(buffer[1]&0x80)||n>125||![8,9,10].includes(opcode))return socket.destroy();
        if(buffer.length<n+6)return;
        const payload=Buffer.from(buffer.subarray(6,n+6));for(let i=0;i<n;i++)payload[i]^=buffer[2+i%4];buffer=buffer.subarray(n+6);
        if(opcode===8){ending=true;socket.end(frame(8,payload));return;}
        if(opcode===9)socket.write(frame(10,payload));
      }
    };
    socket.on('data',read);socket.on('error',()=>socket.destroy());socket.once('close',()=>{pages.delete(socket);arm(idleMs);});
    if(head.length)read(head);
  }
  const ping=setInterval(()=>{for(const socket of pages)if(!socket.destroyed&&!socket.writableEnded)socket.write(frame(9));},20000);ping.unref();
  arm(startupMs);
  return {upgrade,enable,info:()=>({supported:true,enabled,activePages:pages.size,idleMs}),stop(){stopped=true;clearTimeout(timer);clearInterval(ping);for(const socket of pages)socket.destroy();pages.clear();}};
}
