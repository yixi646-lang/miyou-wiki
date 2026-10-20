const marker = /<!--\s*wiki-update-metadata\s+([\s\S]*?)\s*-->/g;
const releaseId = value => /^R\d{6}$/.test(value ?? '');
const version = value => /^\d+\.\d+\.\d+$/.test(value ?? '');
export function publishedMetadata(body, channel, assetName, declared) {
  const text = String(body ?? ''), matches = [...text.matchAll(marker)];
  const notes = text.replace(marker, '').trim();
  if (!declared && (matches.length !== 1 || matches[0][1].length > 64000)) return { notes, compatibility: null };
  try {
    const value = declared ?? JSON.parse(matches[0][1]);
    if (value.format !== 'wiki-update-metadata' || value.schemaVersion !== 1 || value.channel !== channel || value.asset !== assetName || !Array.isArray(value.softwareBases) || !value.softwareBases.length || value.softwareBases.length > 256) throw Error();
    if (value.softwareBases.some(base => !version(base?.version) || !releaseId(base?.releaseId))) throw Error();
    if (channel === 'software' ? !version(value.target?.version) || !releaseId(value.target?.releaseId) : !/^D\d{14}$/.test(value.target?.revision ?? '') || !Number.isSafeInteger(value.contentSchemaVersion)) throw Error();
    return { notes, compatibility: value };
  } catch { return { notes, compatibility: null }; }
}
export function compatibilityFor(latest, current, channel) {
  if (!latest?.asset) return { supported: false, reason: channel === 'content' ? '尚未发布资料包。' : '该版本未提供自动更新包，请下载完整包。' };
  const value = latest.compatibility;
  if (!value) return { supported: false, reason: '此发布缺少下载前的兼容信息，请使用包内手动安装器或完整包。' };
  const targetMatches = channel === 'content' ? value.target.revision === latest.revision : value.target.version === latest.version && value.target.releaseId === latest.releaseId;
  if (!targetMatches) return { supported: false, reason: '发布兼容信息与目标版本不一致，请前往 GitHub 查看。' };
  if (channel === 'content' && ![1, 2].includes(value.contentSchemaVersion)) return { supported: false, reason: '此资料包使用更新的格式，请先更新 Wiki 软件。' };
  if (!value.softwareBases.some(base => base.version === current.version && base.releaseId === current.releaseId)) return { supported: false, reason: channel === 'content' ? '当前软件批次不适用此资料包，请先更新 Wiki 软件。' : '当前软件批次不能直接更新，请下载最新完整包。' };
  return { supported: true, reason: '可直接更新。' };
}
export function metadataForPackage(manifest, asset) {
  const content = manifest.format === 'wiki-content-update';
  const sources = content ? manifest.softwareBases.map(base => base.release) : (manifest.routes?.map(route => route.from) ?? [manifest.from]);
  return { format: 'wiki-update-metadata', schemaVersion: 1, channel: content ? 'content' : 'software', asset, target: content ? { revision: manifest.revision } : { version: manifest.to.version, releaseId: manifest.to.releaseId }, softwareBases: sources.map(({ version, releaseId }) => ({ version, releaseId })), ...(content ? { contentSchemaVersion: manifest.schemaVersion } : {}) };
}
export function withPublishedMetadata(notes, metadata) {
  return String(notes ?? '').replace(marker, '').trim() + '\n\n<!-- wiki-update-metadata\n' + JSON.stringify(metadata) + '\n-->';
}
