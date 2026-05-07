const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const {
  getPlatformReadiness,
  getSyncActionState,
  getSyncTargetDisplay
} = require('../src/renderer/utils/workbenchStatus.ts');

const baseConfig = {
  notion: { apiKey: 'notion-key', databaseId: 'database-id' },
  wechat: { appId: 'wx-app', appSecret: 'wx-secret' }
};

test('wechat readiness reports missing AppSecret', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    wechat: { appId: 'wx-app', appSecret: '' }
  });

  assert.equal(readiness.wechat.configured, false);
  assert.deepEqual(readiness.wechat.missingFields, ['AppSecret']);
  assert.equal(readiness.wechat.summary, '缺 AppSecret');
});

test('wordpress readiness reports each required missing field', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    wordpress: { siteUrl: '', username: 'admin', appPassword: '' }
  });

  assert.equal(readiness.wordpress.configured, false);
  assert.deepEqual(readiness.wordpress.missingFields, ['站点 URL', '应用密码']);
  assert.equal(readiness.wordpress.summary, '缺 站点 URL、应用密码');
});

test('bilibili readiness treats disabled platform as not enabled', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    bilibili: { enabled: false }
  });

  assert.equal(readiness.bilibili.configured, false);
  assert.deepEqual(readiness.bilibili.missingFields, ['未启用']);
  assert.equal(readiness.bilibili.summary, '未启用');
});

test('action state asks for selection before platform configuration', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    wordpress: { siteUrl: '', username: '', appPassword: '' }
  });

  assert.deepEqual(getSyncActionState('wordpress', readiness, 0), {
    disabled: true,
    reason: '请先选择文章'
  });
});

test('action state explains missing platform fields after selection', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    wordpress: { siteUrl: '', username: 'admin', appPassword: '' }
  });

  assert.deepEqual(getSyncActionState('wordpress', readiness, 2), {
    disabled: true,
    reason: 'WordPress 缺 站点 URL、应用密码'
  });
});

test('all-platform sync requires wechat and wordpress only', () => {
  const readiness = getPlatformReadiness({
    ...baseConfig,
    wordpress: { siteUrl: 'https://example.com', username: 'admin', appPassword: 'app-pass' },
    bilibili: { enabled: false }
  });

  assert.equal(readiness.both.configured, true);
  assert.deepEqual(getSyncActionState('both', readiness, 1), {
    disabled: false,
    reason: ''
  });
});

test('sync target display metadata uses readable short brand labels', () => {
  assert.deepEqual(getSyncTargetDisplay('wechat'), {
    compactLabel: '微信',
    ariaLabel: '同步到微信'
  });
  assert.deepEqual(getSyncTargetDisplay('bilibili'), {
    compactLabel: 'B站',
    ariaLabel: '同步到 B站'
  });
  assert.deepEqual(getSyncTargetDisplay('both'), {
    compactLabel: '全部',
    ariaLabel: '同步到微信和 WordPress'
  });
});
