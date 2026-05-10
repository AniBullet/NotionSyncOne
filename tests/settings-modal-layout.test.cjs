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
  assert.match(source, /gridTemplateRows:\s*'auto 1fr auto'/);
  assert.match(source, /gridTemplateColumns:\s*'210px minmax\(0, 1fr\)'/);
  assert.match(source, /minHeight:\s*0/);
  assert.match(source, /overflowY:\s*'auto'/);
  assert.match(source, /overscrollBehavior:\s*'contain'/);
});

test('settings modal tabs remain usable and screen-reader friendly', () => {
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{activeTab === tab\.id\}/);
  assert.match(source, /type="button"/);
  assert.match(source, /borderRight:\s*'1px solid var\(--border-light\)'/);
});

test('settings modal does not ask for relogin when bilibili uid is available', () => {
  assert.match(source, /verifiedByCookie/);
  assert.match(source, /上传前会继续使用当前登录状态/);
  assert.doesNotMatch(source, /上传前建议重新登录或检查网络代理/);
});
