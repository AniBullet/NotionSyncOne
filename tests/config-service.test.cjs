const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalLoad = Module._load;
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

test.before(() => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
});

test.after(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

function withElectronMock(userDataPath, run) {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath(name) {
            assert.equal(name, 'userData');
            return userDataPath;
          },
        },
        safeStorage: {
          isEncryptionAvailable: () => true,
          encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
          decryptString: (buffer) => buffer.toString('utf8').replace(/^enc:/, ''),
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  for (const modulePath of [
    '../src/main/services/ConfigService.ts',
    '../src/main/utils/logger.ts',
  ]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // module was not loaded in this test yet
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      Module._load = originalLoad;
    });
}

function getSavedConfigPath(userDataPath) {
  return path.join(userDataPath, 'config', 'config.json');
}

test('ConfigService saves valid Notion config without requiring WeChat credentials', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-config-'));
  await withElectronMock(userDataPath, async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await service.saveConfig({
      notion: {
        apiKey: 'secret_'.padEnd(50, 'x'),
        databaseId: '0123456789abcdef0123456789abcdef',
      },
      wechat: {
        appId: '',
        appSecret: '',
      },
      bilibili: {
        enabled: false,
      },
    });

    const savedPath = path.join(userDataPath, 'config', 'config.json');
    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    assert.equal(saved.notion.databaseId, '01234567-89ab-cdef-0123-456789abcdef');
    assert.match(saved.notion.apiKey, /^\[encrypted\]/);
    assert.equal(saved.wechat.appId, '');
    assert.equal(saved.wechat.appSecret, '');
  });
});

test('ConfigService initializes a missing config file with defaults', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-config-'));
  await withElectronMock(userDataPath, async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    new ConfigService();

    const savedPath = path.join(userDataPath, 'config', 'config.json');
    await assert.doesNotReject(async () => {
      for (let i = 0; i < 20; i++) {
        if (fs.existsSync(savedPath)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('config file was not created');
    });

    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    assert.deepEqual(saved.notion, { apiKey: '', databaseId: '' });
    assert.deepEqual(saved.wechat, { appId: '', appSecret: '' });
  });
});

test('ConfigService rejects missing Notion credentials', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-config-'));
  await withElectronMock(userDataPath, async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await assert.rejects(
      () => service.saveConfig({
        notion: {
          apiKey: '',
          databaseId: '',
        },
        wechat: {
          appId: '',
          appSecret: '',
        },
        bilibili: {
          enabled: false,
        },
      }),
      /Notion API Key|数据库|鏁版嵁/
    );
  });
});

test('ConfigService reloads encrypted secrets as plaintext config values', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-config-'));
  await withElectronMock(userDataPath, async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await service.saveConfig({
      notion: {
        apiKey: 'secret_'.padEnd(50, 'x'),
        databaseId: '0123456789abcdef0123456789abcdef',
      },
      wechat: {
        appId: 'wx-id',
        appSecret: 'wx-secret',
      },
      bilibili: {
        enabled: false,
      },
    });

    const saved = JSON.parse(fs.readFileSync(getSavedConfigPath(userDataPath), 'utf8'));
    assert.match(saved.notion.apiKey, /^\[encrypted\]/);
    assert.match(saved.wechat.appId, /^\[encrypted\]/);
    assert.match(saved.wechat.appSecret, /^\[encrypted\]/);

    delete require.cache[require.resolve('../src/main/services/ConfigService.ts')];
    const { ConfigService: FreshConfigService } = require('../src/main/services/ConfigService.ts');
    const freshService = new FreshConfigService();
    await freshService.init();

    const loaded = await freshService.getConfig();
    assert.equal(loaded.notion.apiKey, 'secret_'.padEnd(50, 'x'));
    assert.equal(loaded.wechat.appId, 'wx-id');
    assert.equal(loaded.wechat.appSecret, 'wx-secret');
  });
});

test('ConfigService deep merges partial nested platform config', async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'nso-config-'));
  await withElectronMock(userDataPath, async () => {
    const { ConfigService } = require('../src/main/services/ConfigService.ts');
    const service = new ConfigService();

    await service.saveConfig({
      notion: {
        apiKey: 'secret_'.padEnd(50, 'x'),
        databaseId: '0123456789abcdef0123456789abcdef',
      },
      wechat: {
        appId: 'wx-id',
        appSecret: 'wx-secret',
      },
      bilibili: {
        enabled: true,
        titleTemplate: 'old {title}',
        defaultTags: ['notion', 'sync'],
      },
    });

    await service.saveConfig({
      bilibili: {
        titleTemplate: 'new {title}',
      },
    });

    const loaded = await service.getConfig();
    assert.equal(loaded.bilibili.enabled, true);
    assert.equal(loaded.bilibili.titleTemplate, 'new {title}');
    assert.deepEqual(loaded.bilibili.defaultTags, ['notion', 'sync']);
    assert.equal(loaded.wechat.appId, 'wx-id');
  });
});
