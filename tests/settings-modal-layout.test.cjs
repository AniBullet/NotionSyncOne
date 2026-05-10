const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '../src/renderer/components/SettingsModal.tsx'),
  'utf8'
);

test('settings modal keeps tabs and actions fixed while content scrolls', () => {
  assert.match(source, /height:\s*'min\(760px, calc\(100vh - 48px\)\)'/);
  assert.match(source, /display:\s*'grid'/);
  assert.match(source, /gridTemplateRows:\s*'auto auto 1fr auto'/);
  assert.match(source, /minHeight:\s*0/);
  assert.match(source, /overflowY:\s*'auto'/);
  assert.match(source, /overscrollBehavior:\s*'contain'/);
});

test('settings modal tabs remain usable and screen-reader friendly', () => {
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{activeTab === tab\.id\}/);
  assert.match(source, /type="button"/);
  assert.match(source, /overflowX:\s*'auto'/);
});
