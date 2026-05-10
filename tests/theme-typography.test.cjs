const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const themeCss = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'styles', 'theme.css'), 'utf8');
const entryCss = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'index.css'), 'utf8');

test('theme uses a mac-like high quality system font stack with Windows fallback', () => {
  assert.match(themeCss, /--font-sans:[^;]*SF Pro Text/);
  assert.match(themeCss, /--font-sans:[^;]*Segoe UI Variable/);
  assert.match(themeCss, /--font-sans:[^;]*PingFang SC/);
  assert.match(themeCss, /--font-sans:[^;]*Microsoft YaHei UI/);
});

test('global font rendering is applied after Tailwind base styles', () => {
  assert.match(entryCss, /@tailwind utilities;[\s\S]*font-family:\s*var\(--font-sans\)/);
  assert.match(entryCss, /-webkit-font-smoothing:\s*antialiased/);
  assert.match(entryCss, /text-rendering:\s*optimizeLegibility/);
  assert.match(entryCss, /font-synthesis:\s*none/);
});
