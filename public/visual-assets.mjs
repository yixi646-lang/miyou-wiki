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
 const cover={
  genshin:{file:'cover-2026-10-23.png',alt:'原神版本宣传图'},
  starrail:{file:'cover-4.6-hd.png',alt:'4.6版本宣传图'},
  zenless:{file:'cover-2026-10-23.png',alt:'绝区零版本宣传图'}
 }[game];
 return `<div class="game-card-media"><img class="game-card-cover" src="/assets/${game}/branding/${cover.file}" alt="${cover.alt}" decoding="async"></div>`;
}
export const gameLogoHTML=game=>`<img class="game-card-logo" src="/assets/${game}/branding/logo.webp" alt="" decoding="async">`;
