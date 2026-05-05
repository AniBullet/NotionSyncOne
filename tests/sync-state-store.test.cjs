const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

require('ts-node/register/transpile-only');

const { SyncStatus } = require('../src/shared/types/sync.ts');

function createStateFilePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nso-sync-state-')), 'sync-states.json');
}

function loadStore() {
  delete require.cache[require.resolve('../src/main/services/sync/stateStore.ts')];
  return require('../src/main/services/sync/stateStore.ts').SyncStateStore;
}

test('SyncStateStore initializes empty state when file is missing', () => {
  const SyncStateStore = loadStore();
  const stateFile = createStateFilePath();

  const store = new SyncStateStore(stateFile);

  assert.deepEqual(store.getAll(), {});
  assert.equal(store.get('missing'), undefined);
});

test('SyncStateStore resets syncing states to failed when loading existing state', () => {
  const SyncStateStore = loadStore();
  const stateFile = createStateFilePath();
  fs.writeFileSync(stateFile, JSON.stringify({
    article1: {
      articleId: 'article1',
      status: SyncStatus.SYNCING,
      lastSyncTime: 100,
    },
    article2: {
      articleId: 'article2',
      status: SyncStatus.SUCCESS,
      lastSyncTime: 200,
    },
  }));

  const store = new SyncStateStore(stateFile);

  assert.equal(store.get('article1').status, SyncStatus.FAILED);
  assert.equal(store.get('article2').status, SyncStatus.SUCCESS);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).article1.status, SyncStatus.FAILED);
});

test('SyncStateStore update merges new results with existing results', () => {
  const SyncStateStore = loadStore();
  const stateFile = createStateFilePath();
  const store = new SyncStateStore(stateFile);

  store.update('article1', SyncStatus.SUCCESS, undefined, {
    wechat: { mediaId: 'media-1' },
  });
  const updated = store.update('article1', SyncStatus.SUCCESS, undefined, {
    wordpress: { postId: 123 },
  });

  assert.deepEqual(updated.results, {
    wechat: { mediaId: 'media-1' },
    wordpress: { postId: 123 },
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).article1.results, updated.results);
});

test('SyncStateStore reset deletes one article state', () => {
  const SyncStateStore = loadStore();
  const stateFile = createStateFilePath();
  const store = new SyncStateStore(stateFile);

  store.update('article1', SyncStatus.SUCCESS);
  store.update('article2', SyncStatus.FAILED, 'failed');
  store.reset('article1');

  assert.equal(store.get('article1'), undefined);
  assert.equal(store.get('article2').status, SyncStatus.FAILED);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).article1, undefined);
});
