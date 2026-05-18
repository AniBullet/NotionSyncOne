const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const {
  convertBlockToHtml,
  convertBlocksToHtml,
} = require('../src/main/services/sync/notionToHtml.ts');

test('notion html renderer renders paragraphs and headings from rich text', () => {
  const paragraphHtml = convertBlockToHtml({
    id: 'p1',
    type: 'paragraph',
    content: {
      rich_text: [{ plain_text: '<hello>', annotations: { bold: true } }],
    },
  });

  const headingHtml = convertBlockToHtml({
    id: 'h1',
    type: 'heading_2',
    content: {
      rich_text: [{ plain_text: 'Section' }],
    },
  });

  assert.match(paragraphHtml, /<strong>&lt;hello&gt;<\/strong>/);
  assert.match(headingHtml, /<h2/);
  assert.match(headingHtml, /Section/);
});

test('notion html renderer groups adjacent list items by list type', () => {
  const html = convertBlocksToHtml([
    {
      id: 'b1',
      type: 'bulleted_list_item',
      content: { rich_text: [{ plain_text: 'first' }] },
    },
    {
      id: 'b2',
      type: 'bulleted_list_item',
      content: { rich_text: [{ plain_text: 'second' }] },
    },
    {
      id: 'b3',
      type: 'numbered_list_item',
      content: { rich_text: [{ plain_text: 'third' }] },
    },
  ]);

  assert.match(html, /<ul/);
  assert.match(html, /first/);
  assert.match(html, /second/);
  assert.match(html, /<ol/);
  assert.match(html, /third/);
});

test('notion html renderer maps image URLs and escapes captions', () => {
  const html = convertBlockToHtml(
    {
      id: 'image-1',
      type: 'image',
      content: {
        url: 'https://notion.so/source.png',
        caption: [{ plain_text: '<caption>' }],
      },
    },
    new Map([['https://notion.so/source.png', 'https://mmbiz.qpic.cn/uploaded.png']])
  );

  assert.match(html, /https:\/\/mmbiz\.qpic\.cn\/uploaded\.png/);
  assert.match(html, /&lt;caption&gt;/);
  assert.doesNotMatch(html, /https:\/\/notion\.so\/source\.png/);
});

test('notion html renderer renders code blocks with line numbers and language label', () => {
  const html = convertBlockToHtml({
    id: 'code-1',
    type: 'code',
    content: {
      language: 'typescript',
      rich_text: [{ plain_text: 'const x = 1;\nconsole.log(x);' }],
    },
  });

  assert.match(html, /typescript/);
  assert.match(html, /const x = 1;/);
  assert.match(html, /console\.log\(x\);/);
  assert.match(html, />1<\/li>/);
  assert.match(html, />2<\/li>/);
});
