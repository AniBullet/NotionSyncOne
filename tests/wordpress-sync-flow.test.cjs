const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

test('wordpress sync flow module exposes the article sync entrypoint', () => {
  const flow = require('../src/main/services/sync/wordpressSync.ts');

  assert.equal(typeof flow.syncArticleToWordPressFlow, 'function');
});
