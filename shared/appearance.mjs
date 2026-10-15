const icons={
 genshin:{火:'pyro.png',水:'hydro.png',风:'anemo.png',冰:'cryo.png',岩:'geo.png',雷:'electro.png',草:'dendro.png'},
 starrail:{物理:'Physical.png',火:'Fire.png',冰:'Ice.png',雷:'Thunder.png',风:'Wind.png',量子:'Quantum.png',虚数:'Imaginary.png'},
 zenless:{物理:'Physical.webp',火属性:'Fire.webp',冰属性:'Ice.webp',电属性:'Electric.webp',风属性:'Wind.webp',以太:'Ether.webp',烈霜:'Frost.webp',玄墨:'AuricInk.webp',凛刃:'HonedEdge.webp',流明:'Lumina.svg'},
};
export const rarityClass=entry=>Number.isInteger(entry?.rarity)&&entry.rarity>=1&&entry.rarity<=5?`rarity-${entry.rarity}`:'';
export function elementIcon(entry){const file=entry?.category==='characters'?icons[entry.game]?.[entry.element]:null;return file?`/assets/${entry.game}/elements/${file}`:null;}
