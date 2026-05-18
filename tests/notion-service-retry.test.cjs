const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalLoad = Module._load;

function createNetworkResetError() {
  const error = new Error('read ECONNRESET');
  error.code = 'ECONNRESET';
  return error;
}

async function withFastTimers(run) {
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (callback, _delay, ...args) => originalSetTimeout(callback, 0, ...args);
  try {
    await run();
  } finally {
    global.setTimeout = originalSetTimeout;
  }
}

async function withNotionClientMock(fakeClient, run) {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@notionhq/client') {
      return {
        Client: function Client() {
          return fakeClient;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  for (const modulePath of [
    '../src/main/services/NotionService.ts',
    '../src/main/utils/logger.ts',
  ]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // module was not loaded yet
    }
  }

  try {
    await run();
  } finally {
    Module._load = originalLoad;
  }
}

test('NotionService retries transient ECONNRESET while reading page properties', async () => {
  let attempts = 0;
  const fakeClient = {
    pages: {
      retrieve: async () => {
        attempts++;
        if (attempts === 1) {
          throw createNetworkResetError();
        }
        return {
          id: 'page-id',
          url: 'https://notion.so/page-id',
          last_edited_time: '2026-05-17T00:00:00.000Z',
          cover: null,
          properties: {
            Name: {
              type: 'title',
              title: [{ plain_text: '在你的动画中使用PHYSICS！ | UE5.7' }],
            },
          },
        };
      },
    },
    blocks: {
      children: {
        list: async () => ({ results: [], has_more: false, next_cursor: null }),
      },
    },
    databases: {},
  };

  await withNotionClientMock(fakeClient, async () => {
    await withFastTimers(async () => {
      const { NotionService } = require('../src/main/services/NotionService.ts');
      const service = new NotionService({ apiKey: 'secret_test', databaseId: 'db-id' });
      const page = await service.getPageProperties('page-id');

      assert.equal(attempts, 2);
      assert.equal(page.title, '在你的动画中使用PHYSICS！ | UE5.7');
    });
  });
});

test('NotionService retries transient ECONNRESET while reading page content blocks', async () => {
  let attempts = 0;
  const fakeClient = {
    pages: {
      retrieve: async () => {
        throw new Error('unused');
      },
    },
    blocks: {
      children: {
        list: async () => {
          attempts++;
          if (attempts === 1) {
            throw createNetworkResetError();
          }
          return { results: [], has_more: false, next_cursor: null };
        },
      },
    },
    databases: {},
  };

  await withNotionClientMock(fakeClient, async () => {
    await withFastTimers(async () => {
      const { NotionService } = require('../src/main/services/NotionService.ts');
      const service = new NotionService({ apiKey: 'secret_test', databaseId: 'db-id' });
      const blocks = await service.getPageContent('page-id');

      assert.equal(attempts, 2);
      assert.deepEqual(blocks, []);
    });
  });
});
