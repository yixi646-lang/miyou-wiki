import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { metadataForPackage } from '../lib/update-metadata.mjs';

export function metadataFromArchive(archive, channel, { assetName = path.basename(archive) } = {}) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;$zip=[IO.Compression.ZipFile]::OpenRead($env:WIKI_METADATA_ARCHIVE);try{$entry=$zip.GetEntry($env:WIKI_METADATA_ENTRY);if(!$entry -or $entry.Length -gt 8388608){throw '更新包清单缺失或过大'};$reader=New-Object IO.StreamReader($entry.Open(),[Text.Encoding]::UTF8);try{[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);[Console]::Write($reader.ReadToEnd())}finally{$reader.Dispose()}}finally{$zip.Dispose()}"], { windowsHide: true, encoding: 'utf8', maxBuffer: 9 * 1024 ** 2, timeout: 30000, env: { ...process.env, WIKI_METADATA_ARCHIVE: path.resolve(archive), WIKI_METADATA_ENTRY: channel === 'content' ? 'content.json' : 'update.json' } });
  if (result.error || result.status !== 0) throw Error(result.error?.message ?? result.stderr ?? '读取更新包清单失败。');
  const manifest = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  if (manifest.format !== (channel === 'content' ? 'wiki-content-update' : 'wiki-local-update')) throw Error('更新包类型不匹配。');
  return metadataForPackage(manifest, assetName);
}
