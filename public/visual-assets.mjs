import {isLocalImage} from '/shared/asset-image.mjs';

export function artworkFigure(entry,escape){
 const image=entry.details?.artwork?.image;
 if(entry.category!=='characters'||!isLocalImage(image))return '';
 return `<figure class="character-artwork"><img src="${escape(image)}" alt="${escape(entry.name)}完整立绘" loading="lazy" decoding="async"></figure>`;
}

const partTypes={HEAD:'头部',HAND:'手部',BODY:'躯干',FOOT:'脚部',NECK:'位面球',OBJECT:'连结绳'};
export function setPartsHTML(parts,escape){
 return `<div class="set-part-grid">${parts.map(part=>`<figure class="set-part-card">${isLocalImage(part.image)?`<img src="${escape(part.image)}" alt="${escape(part.name)}" loading="lazy" decoding="async">`:''}<figcaption><strong>${escape(part.name)}</strong>${part.type?`<span>${escape(partTypes[part.type]??part.type)}</span>`:''}</figcaption></figure>`).join('')}</div>`;
}

export function gameMediaHTML(game){
 const version={genshin:'7.0',starrail:'4.0',zenless:'3.0'}[game];
 const format=game==='zenless'?'png':'jpg';
 return `<div class="game-card-media"><img class="game-card-cover" src="/assets/${game}/branding/cover-${version}-hd.${format}" alt="${version}版本宣传图" decoding="async"></div>`;
}
export const gameLogoHTML=game=>`<img class="game-card-logo" src="/assets/${game}/branding/logo.webp" alt="" decoding="async">`;
