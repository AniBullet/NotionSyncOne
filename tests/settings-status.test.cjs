const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const {
  getSettingsSections,
  getSectionStatusText
} = require('../src/renderer/utils/settingsStatus.ts');

const baseConfig = {
  notion: { apiKey: 'notion-key', databaseId: 'database-id' },
  wechat: { appId: 'wx-app', appSecret: 'wx-secret' },
  wordpress: { enabled: true, siteUrl: 'https://example.com', username: 'admin', appPassword: 'app-pass' },
  bilibili: { enabled: true }
};

test('settings sections include notion readiness and missing fields', () => {
  const sections = getSettingsSections({
    ...baseConfig,
    notion: { apiKey: '', databaseId: 'database-id' }
  });

  assert.equal(sections.notion.ready, false);
  assert.deepEqual(sections.notion.missingFields, ['API Key']);
  assert.equal(sections.notion.summary, '缺 API Key');
});

test('settings status text distinguishes optional disabled platforms', () => {
  const sections = getSettingsSections({
    ...baseConfig,
    bilibili: { enabled: false }
  });

  assert.equal(sections.bilibili.ready, false);
  assert.equal(sections.bilibili.optional, true);
  assert.equal(getSectionStatusText(sections.bilibili), '未启用');
});

test('wordpress section treats disabled platform as not enabled', () => {
  const sections = getSettingsSections({
    ...baseConfig,
    wordpress: { enabled: false, siteUrl: 'https://example.com', username: 'admin', appPassword: 'app-pass' }
  });

  assert.equal(sections.wordpress.ready, false);
  assert.equal(sections.wordpress.optional, true);
  assert.deepEqual(sections.wordpress.missingFields, ['未启用']);
  assert.equal(sections.wordpress.summary, '未启用');
});

test('enabled wordpress section reports all required missing fields', () => {
  const sections = getSettingsSections({
    ...baseConfig,
    wordpress: { enabled: true, siteUrl: '', username: '', appPassword: '' }
  });

  assert.equal(sections.wordpress.ready, false);
  assert.deepEqual(sections.wordpress.missingFields, ['站点 URL', '用户名', '应用密码']);
  assert.equal(sections.wordpress.summary, '缺 站点 URL、用户名、应用密码');
});

test('ready sections show usable status text', () => {
  const sections = getSettingsSections(baseConfig);

  assert.equal(getSectionStatusText(sections.notion), '已配置');
  assert.equal(getSectionStatusText(sections.wechat), '可同步');
  assert.equal(getSectionStatusText(sections.bilibili), '可同步');
  assert.equal(getSectionStatusText(sections.wordpress), '可同步');
});
