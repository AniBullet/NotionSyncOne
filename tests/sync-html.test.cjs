const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const {
  convertRichTextToHtml,
  cutWeChatTitle,
  escapeHtml,
  filterWeChatUnsupportedChars,
} = require('../src/main/services/sync/html.ts');

test('sync html helpers escape text and preserve current rich text markup', () => {
  assert.equal(escapeHtml('<a&"\'>'), '&lt;a&amp;&quot;&#39;&gt;');

  const html = convertRichTextToHtml([
    {
      plain_text: '<unsafe>',
      annotations: { bold: true },
    },
    {
      plain_text: 'link',
      href: 'https://example.com?a=1&b=2',
      annotations: { italic: true },
    },
  ]);

  assert.match(html, /<strong>&lt;unsafe&gt;<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\?a=1&b=2"/);
  assert.match(html, /<em>link<\/em>/);
});

test('sync html helpers normalize WeChat titles without exceeding the limit', () => {
  const normalized = filterWeChatUnsupportedChars('  Hello\u0000 \u0008World\u{1F3AC}  ');
  assert.equal(normalized, 'Hello World');

  const title = cutWeChatTitle('  1234567890abcdef  ', 10);
  assert.equal(title, '1234567890');
});
