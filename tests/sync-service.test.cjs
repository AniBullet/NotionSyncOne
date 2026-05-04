const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalLoad = Module._load;

function createSyncService() {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-sync-'));

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath(name) {
            assert.equal(name, 'userData');
            return userDataPath;
          },
        },
        BrowserWindow: {
          getAllWindows: () => [],
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  for (const modulePath of [
    '../src/main/services/SyncService.ts',
    '../src/main/services/WeChatService.ts',
    '../src/main/services/BilibiliService.ts',
    '../src/main/services/WordPressService.ts',
  ]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // module was not loaded in this test yet
    }
  }

  const { SyncService } = require('../src/main/services/SyncService.ts');
  Module._load = originalLoad;

  return new SyncService(
    {},
    {},
    {
      getWeChatConfig: () => ({}),
      getBilibiliConfig: () => ({ enabled: false }),
      getWordPressConfig: () => undefined,
    },
    null,
    null
  );
}

test.afterEach(() => {
  Module._load = originalLoad;
});

test('SyncService uses Notion page cover before custom cover properties', () => {
  const service = createSyncService();

  const url = service.getCoverImageUrl({
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

test('SyncService reads cover URL from direct URL and rich text properties', () => {
  const service = createSyncService();

  const directUrl = service.getCoverImageUrl({
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

  const richTextUrl = service.getCoverImageUrl({
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

  assert.equal(directUrl, 'https://example.com/direct.jpg');
  assert.equal(richTextUrl, 'https://example.com/rich-text.jpg');
});

test('SyncService converts rich text to escaped formatted HTML', () => {
  const service = createSyncService();

  const html = service.convertRichTextToHtml([
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

  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /<strong>&lt;unsafe&gt;<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\?a=1&b=2"/);
  assert.match(html, /<em>link<\/em>/);
});

test('SyncService groups adjacent list items by list type', () => {
  const service = createSyncService();

  const html = service.convertBlocksToHtml([
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

test('SyncService maps uploaded image URLs and escapes captions', () => {
  const service = createSyncService();

  const html = service.convertBlockToHtml(
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

test('SyncService renders code blocks with line numbers and language label', () => {
  const service = createSyncService();

  const html = service.convertBlockToHtml({
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
