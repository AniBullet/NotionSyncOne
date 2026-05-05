const test = require('node:test');
const assert = require('node:assert/strict');

require('ts-node/register/transpile-only');

const {
  extractImageUrls,
  getCoverImageUrl,
  resolveImageUrl,
} = require('../src/main/services/sync/images.ts');

test('sync image helpers prefer page cover before custom cover properties', () => {
  const url = getCoverImageUrl({
    id: 'page-id',
    url: 'https://notion.so/page-id',
    title: 'Article',
    lastEditedTime: '2026-05-04T00:00:00.000Z',
    properties: {
      Cover: {
        type: 'url',
        url: 'https://example.com/property-cover.jpg',
      },
    },
    cover: {
      type: 'external',
      external: {
        url: 'https://example.com/page-cover.jpg',
      },
    },
  });

  assert.equal(url, 'https://example.com/page-cover.jpg');
});

test('sync image helpers read cover from URL rich text and files properties', () => {
  const directUrl = getCoverImageUrl({
    id: 'page-id',
    url: 'https://notion.so/page-id',
    title: 'Article',
    lastEditedTime: '2026-05-04T00:00:00.000Z',
    properties: {
      Cover: {
        type: 'url',
        url: 'https://example.com/direct.jpg',
      },
    },
  });

  const richTextUrl = getCoverImageUrl({
    id: 'page-id',
    url: 'https://notion.so/page-id',
    title: 'Article',
    lastEditedTime: '2026-05-04T00:00:00.000Z',
    properties: {
      Cover: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'https://example.com/rich-text.jpg' }],
      },
    },
  });

  const filesUrl = getCoverImageUrl({
    id: 'page-id',
    url: 'https://notion.so/page-id',
    title: 'Article',
    lastEditedTime: '2026-05-04T00:00:00.000Z',
    properties: {
      Cover: {
        type: 'files',
        files: [
          {
            type: 'external',
            external: { url: 'https://example.com/file-cover.jpg' },
          },
        ],
      },
    },
  });

  assert.equal(directUrl, 'https://example.com/direct.jpg');
  assert.equal(richTextUrl, 'https://example.com/rich-text.jpg');
  assert.equal(filesUrl, 'https://example.com/file-cover.jpg');
});

test('sync image helpers extract unique block image URLs without cover URL', () => {
  const urls = extractImageUrls(
    [
      {
        id: 'image-1',
        type: 'image',
        content: { url: 'https://example.com/one.png' },
      },
      {
        id: 'image-2',
        type: 'image',
        content: { url: 'https://example.com/one.png' },
      },
      {
        id: 'paragraph-1',
        type: 'paragraph',
        content: { rich_text: [{ plain_text: 'not image' }] },
      },
    ],
    'https://example.com/cover.png'
  );

  assert.deepEqual(urls, ['https://example.com/one.png']);
});

test('sync image helpers resolve uploaded image URL mappings', () => {
  const imageUrlMap = new Map([
    ['https://notion.so/source.png', 'https://mmbiz.qpic.cn/uploaded.png'],
  ]);

  assert.equal(
    resolveImageUrl('https://notion.so/source.png', imageUrlMap),
    'https://mmbiz.qpic.cn/uploaded.png'
  );
  assert.equal(
    resolveImageUrl('https://notion.so/other.png', imageUrlMap),
    'https://notion.so/other.png'
  );
});
