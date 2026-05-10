const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

test('bilibili sync flow module exposes the video sync entrypoint', () => {
  const flow = require('../src/main/services/sync/bilibiliSync.ts');

  assert.equal(typeof flow.syncVideoToBilibiliFlow, 'function');
});
