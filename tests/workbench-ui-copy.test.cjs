const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mainLayout = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'components', 'MainLayout.tsx'), 'utf8');
const articleGrid = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'components', 'ArticleGrid.tsx'), 'utf8');

test('workbench status copy avoids emoji-prefixed messages', () => {
  assert.doesNotMatch(mainLayout, /[📥📤📹✅⚠️❌]/u);
  assert.doesNotMatch(articleGrid, /[📄🌐📱]/u);
});

test('workbench platform counters use readable labels', () => {
  assert.match(mainLayout, /微信 \{wechatSynced\}/);
  assert.match(mainLayout, /B站 \{biliSynced\}/);
  assert.doesNotMatch(mainLayout, /微 \{wechatSynced\}/);
  assert.doesNotMatch(mainLayout, /B \{biliSynced\}/);
});

test('article sync badges render status dots instead of text abbreviations', () => {
  assert.match(articleGrid, /aria-label=\{tooltip\}/);
  assert.match(articleGrid, /title=\{tooltip\}/);
  assert.match(articleGrid, /<span aria-hidden="true" style=\{\{/);
  assert.doesNotMatch(articleGrid, /getBadge\(wechatState,\s*'微'/);
  assert.doesNotMatch(articleGrid, /getBadge\(biliState,\s*'B'/);
});
