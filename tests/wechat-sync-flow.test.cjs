const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

test('wechat sync flow module exposes the article sync entrypoint', () => {
  const flow = require('../src/main/services/sync/wechatSync.ts');

  assert.equal(typeof flow.syncArticleToWeChat, 'function');
});
