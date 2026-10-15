import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export function readReleaseInfo(root) {
  try {
    const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
    if (/^\d+\.\d+\.\d+$/.test(release.version) && /^R\d{6}$/.test(release.releaseId)) return release;
  } catch {}
  return { version: '1.0.0', releaseId: null };
}
