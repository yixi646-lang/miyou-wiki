export const isLocalImage=path=>typeof path==='string'&&/^\/assets\/[\w./-]+$/.test(path);
export function imageHTML(entry,escape,{detail=false,alt=entry.name??''}={}){
 if(!isLocalImage(entry.image))return '';
 const frame=entry.imageFrame;
 if(frame&&['x','y','width','height','atlasWidth','atlasHeight'].every(key=>Number.isFinite(frame[key]))&&frame.width>0&&frame.height>0&&frame.x>=0&&frame.y>=0&&frame.x+frame.width<=frame.atlasWidth&&frame.y+frame.height<=frame.atlasHeight){
  const size=`${frame.atlasWidth/frame.width*100}% ${frame.atlasHeight/frame.height*100}%`;
  const position=`${frame.atlasWidth===frame.width?0:frame.x/(frame.atlasWidth-frame.width)*100}% ${frame.atlasHeight===frame.height?0:frame.y/(frame.atlasHeight-frame.height)*100}%`;
  return `<span class="asset-frame" role="img" aria-label="${escape(alt)}" style="background-image:url('${entry.image}');background-size:${size};background-position:${position}"></span>`;
 }
 return `<img src="${escape(entry.image)}" alt="${escape(alt)}" ${detail?'':'loading="lazy"'} decoding="async">`;
}
