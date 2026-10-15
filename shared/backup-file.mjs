const limit=32*1024*1024;
export async function parseBackupFile(file,{maxBytes=limit}={}){
 if(file.size>maxBytes)throw Error(`文件超过 ${maxBytes/1024/1024} MB。`);
 const header=new Uint8Array(await file.slice(0,2).arrayBuffer());
 const compressed=header[0]===0x1f&&header[1]===0x8b;
 let stream=file.stream();
 if(compressed)stream=stream.pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.getReader(),decoder=new TextDecoder(),parts=[];let size=0;
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error(`解压后的资料超过 ${maxBytes/1024/1024} MB。`);parts.push(decoder.decode(value,{stream:true}));}
  parts.push(decoder.decode());return JSON.parse(parts.join(''));
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
