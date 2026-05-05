const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalLoad = Module._load;

function loadPreloadWithElectronMock() {
  const listeners = new Map();
  let exposedApi;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) {
            exposedApi = api;
          },
        },
        ipcRenderer: {
          invoke: async (_channel, ...args) => args,
          on(channel, listener) {
            listeners.set(channel, listener);
          },
          removeListener(channel, listener) {
            if (listeners.get(channel) === listener) {
              listeners.delete(channel);
            }
          },
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('../src/preload/index.ts')];
  require('../src/preload/index.ts');

  Module._load = originalLoad;

  return {
    exposedApi,
    emit(channel, ...args) {
      listeners.get(channel)?.({}, ...args);
    },
    hasListener(channel) {
      return listeners.has(channel);
    },
  };
}

test('preload ipcRenderer.on forwards payload args without Electron event', () => {
  const preload = loadPreloadWithElectronMock();
  const received = [];

  preload.exposedApi.ipcRenderer.on('progress', (...args) => {
    received.push(args);
  });

  preload.emit('progress', { phase: 'uploading' }, 80);

  assert.deepEqual(received, [[{ phase: 'uploading' }, 80]]);
});

test('preload ipcRenderer.removeListener removes the wrapper registered by on', () => {
  const preload = loadPreloadWithElectronMock();
  const callback = () => {};

  preload.exposedApi.ipcRenderer.on('progress', callback);
  assert.equal(preload.hasListener('progress'), true);

  preload.exposedApi.ipcRenderer.removeListener('progress', callback);

  assert.equal(preload.hasListener('progress'), false);
});
