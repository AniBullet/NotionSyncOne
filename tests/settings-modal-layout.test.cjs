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
  assert.match(source, /gridTemplateColumns:\s*'168px minmax\(0, 1fr\)'/);
  assert.match(source, /minHeight:\s*0/);
  assert.match(source, /overflowY:\s*'auto'/);
  assert.match(source, /overscrollBehavior:\s*'contain'/);
});

test('notion field mapping uses individual inputs instead of raw json textarea', () => {
  assert.match(source, /notionFieldMapFields\.map/);
  assert.match(source, /handleNotionFieldMapChange/);
  assert.doesNotMatch(source, /notionFieldMapText/);
  assert.doesNotMatch(source, /JSON\.parse\(notionFieldMapText/);
});

test('notion metadata fields are clearly optional and use user-facing labels', () => {
  assert.match(source, /来源平台/);
  assert.match(source, /原作者/);
  assert.match(source, /个人期待值/);
  assert.match(source, /可选元数据字段/);
  assert.doesNotMatch(source, /label:\s*'来源'/);
  assert.doesNotMatch(source, /label:\s*'作者'/);
  assert.doesNotMatch(source, /label:\s*'评分'/);
});

test('connection test actions live in the section header', () => {
  assert.match(source, /renderSectionHeaderAction/);
  assert.match(source, /justifyContent:\s*'space-between'/);
  assert.match(source, /activeTab === 'wechat'/);
  assert.match(source, /activeTab === 'wordpress'/);
  assert.match(source, /activeTab === 'bilibili'/);
});

test('bilibili description template lists supported variables', () => {
  for (const token of ['{title}', '{url}', '{date}', '{from}', '{author}', '{engine}', '{rate}', '{tags}']) {
    assert.match(source, new RegExp(token.replace(/[{}]/g, '\\$&')));
  }
});

test('settings modal orders Bilibili before WordPress and keeps long template last', () => {
  assert.match(
    source,
    /id:\s*'wechat'[\s\S]*id:\s*'bilibili'[\s\S]*id:\s*'wordpress'/
  );
  assert.doesNotMatch(source, /<details/);
  assert.ok(source.indexOf("field === 'defaultSeasonId'") > source.indexOf("field === 'defaultTid'"));
  assert.ok(source.lastIndexOf('descTemplate') > source.lastIndexOf('upCloseDanmu'));
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
