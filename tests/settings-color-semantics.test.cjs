const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const { getSettingsSections } = require('../src/renderer/utils/settingsStatus.ts');

test('notion source color is neutral and distinct from wechat sync color', () => {
  const sections = getSettingsSections({
    notion: { apiKey: 'notion-key', databaseId: 'database-id' },
    wechat: { appId: 'wechat-app-id', appSecret: 'wechat-secret' }
  });

  assert.equal(sections.notion.accentColor, '#64748B');
  assert.equal(sections.wechat.accentColor, '#07C160');
  assert.notEqual(sections.notion.accentColor, sections.wechat.accentColor);
});
