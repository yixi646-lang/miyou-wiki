const games = {genshin: '原神', starrail: '星穹铁道', zenless: '绝区零'};
const parseVersion = value => String(value ?? '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
const timestamp = value => {const result = Date.parse(value); return Number.isFinite(result) ? result : null;};

export function buildContentStatus(rows, fileDates = []) {
  const versions = Object.fromEntries(Object.keys(games).map(game => [game, null]));
  let updated = null;
  for (const row of rows) {
    if (!(row.game in versions)) continue;
    const version = parseVersion(row.version);
    if (version) {
      const candidate = version.slice(1).filter(v => v !== undefined).map(Number);
      const previous = versions[row.game]?.split('.').map(Number);
      const newer = !previous || candidate.some((n, i) => n > (previous[i] ?? 0) && candidate.slice(0, i).every((v, j) => v === previous[j]));
      if (newer) versions[row.game] = candidate.join('.');
    }
    const date = timestamp(row.updatedAt);
    if (date !== null) updated = Math.max(updated ?? date, date);
  }
  for (const value of fileDates) {
    const date = timestamp(value);
    if (date !== null) updated = Math.max(updated ?? date, date);
  }
  return {
    versions,
    updatedAt: updated === null ? null : new Date(updated).toISOString(),
    updatedDate: updated === null ? null : new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'}).format(updated)
  };
}

export function contentStatusText(status) {
  return `已收录版本：${Object.entries(games).map(([game, name]) => `${name} ${status.versions[game] ?? '未标注'}`).join(' · ')}${status.updatedDate ? ` ｜ 资料更新 ${status.updatedDate}` : ''}`;
}
