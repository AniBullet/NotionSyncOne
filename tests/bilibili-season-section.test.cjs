const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'services', 'BilibiliService.ts'),
  'utf8'
);

test('bilibili fixed collection section uses Bilibili API after upload', () => {
  assert.match(serviceSource, /creative\/web\/season\/section\/episodes\/add/);
  assert.match(serviceSource, /addVideoToSeasonSection/);
  assert.match(serviceSource, /config\.defaultSeasonId/);
  assert.doesNotMatch(serviceSource, /--season|--section/);
});

test('biliup dependency points at current biliup repository', () => {
  assert.match(serviceSource, /api\.github\.com\/repos\/biliup\/biliup\/releases\/latest/);
  assert.doesNotMatch(serviceSource, /biliup-rs\/releases\/latest/);
});
