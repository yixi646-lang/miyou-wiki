import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContentStatus, contentStatusText} from '../shared/content-status.mjs';

test('资料版本按数字比较并规范版本后缀，更新时间遵循香港日期', () => {
  const status = buildContentStatus([
    {game: 'genshin', version: '7.9', updatedAt: '2026-10-03T15:59:00Z'},
    {game: 'genshin', version: '7.10', updatedAt: '2026-10-03T16:01:00Z'},
    {game: 'genshin', version: '6.99', updatedAt: 'invalid'},
    {game: 'starrail', version: '4.6', updatedAt: '2026-10-02T00:00:00Z'},
    {game: 'zenless', version: '3.2版本', updatedAt: '2026-10-02T00:00:00Z'}
  ]);
  assert.deepEqual(status.versions, {genshin: '7.10', starrail: '4.6', zenless: '3.2'});
  assert.equal(status.updatedDate, '2026-10-04');
  assert(contentStatusText(status).includes('原神 7.10'));
  assert(!contentStatusText(status).includes('软件版本'));
});

test('同版本补充资料也更新日期，空资料不使用系统今天冒充更新时间', () => {
  const rows = [{game: 'genshin', version: '7.1', updatedAt: '2026-10-01T00:00:00Z'}];
  const updated = buildContentStatus(rows, ['2026-10-05T00:00:00Z', null]);
  assert.equal(updated.versions.genshin, '7.1');
  assert.equal(updated.updatedDate, '2026-10-05');
  assert.equal(buildContentStatus([]).updatedDate, null);
});
