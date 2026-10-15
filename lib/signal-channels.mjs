// 特殊频段页面中有三处 Infobox type 误填为普通频道，页面标题明确标识真实类型。
export function signalSourceType(title, rawType) {
  if(/^Exclusive Rescreening(?:\/|$)/.test(title))return 'Exclusive Rescreening';
  if(/^W-Engine Reverberation(?:\/|$)/.test(title))return 'W-Engine Reverberation';
  return rawType;
}
export const SIGNAL_TYPES={'Exclusive Rescreening':'独家重映','W-Engine Reverberation':'音擎回响'};
export function pairSignalBanners(entries) {
  const special=entries.filter(e=>e.game==='zenless'&&e.category==='banners'&&Object.values(SIGNAL_TYPES).includes(e.type));
  for(const entry of special){const peer=special.find(e=>e.id!==entry.id&&e.type!==entry.type&&e.releaseVersion===entry.releaseVersion&&e.banner.start===entry.banner.start&&e.banner.end===entry.banner.end);if(peer)entry.banner.pairedBannerId=peer.id;}
  return special;
}
