const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'index.ts'), 'utf8');

test('main window defaults leave room for dense toolbar controls', () => {
  assert.match(source, /width:\s*1360,/);
  assert.match(source, /height:\s*860,/);
  assert.match(source, /minWidth:\s*1100,/);
  assert.match(source, /minHeight:\s*700,/);
});
