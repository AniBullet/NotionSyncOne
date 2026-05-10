const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const {
  PLATFORM_COLORS,
  collectSyncFailures,
  getSyncBadgePresentation
} = require('../src/renderer/utils/syncPresentation.ts');

const { SyncStatus } = require('../src/shared/types/sync.ts');

test('successful sync badge uses each platform color', () => {
  assert.equal(
    getSyncBadgePresentation('wechat', { articleId: 'a1', status: SyncStatus.SUCCESS }).color,
    PLATFORM_COLORS.wechat
  );
  assert.equal(
    getSyncBadgePresentation('wordpress', { articleId: 'wp_a1', status: SyncStatus.SUCCESS }).color,
    PLATFORM_COLORS.wordpress
  );
  assert.equal(
    getSyncBadgePresentation('bilibili', { articleId: 'bili_a1', status: SyncStatus.SUCCESS }).color,
    PLATFORM_COLORS.bilibili
  );
});

test('failed sync badge is neutral with an error border and preserves reason', () => {
  const badge = getSyncBadgePresentation('wordpress', {
    articleId: 'wp_a1',
    status: SyncStatus.FAILED,
    error: 'HTTP 401'
  });

  assert.equal(badge.color, '#94A3B8');
  assert.equal(badge.borderColor, '#EF4444');
  assert.equal(badge.statusText, '失败');
  assert.equal(badge.reason, 'HTTP 401');
});

test('collectSyncFailures returns article title, platform, and fallback reason', () => {
  const failures = collectSyncFailures(
    [{ id: 'a1', title: 'Article One' }],
    { a1: { articleId: 'a1', status: SyncStatus.FAILED, error: '微信权限不足' } },
    { a1: { articleId: 'wp_a1', status: SyncStatus.SUCCESS } },
    { a1: { articleId: 'bili_a1', status: SyncStatus.FAILED } }
  );

  assert.deepEqual(failures, [
    { articleId: 'a1', title: 'Article One', platform: 'wechat', platformLabel: '微信', error: '微信权限不足' },
    { articleId: 'a1', title: 'Article One', platform: 'bilibili', platformLabel: 'B站', error: '未知错误' }
  ]);
});
