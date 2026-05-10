const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main', 'index.ts'), 'utf8');
const preloadSource = fs.readFileSync(path.join(repoRoot, 'src', 'preload', 'index.ts'), 'utf8');
const mainLayout = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'components', 'MainLayout.tsx'), 'utf8');

test('main window uses custom chrome instead of native title bar', () => {
  assert.match(mainSource, /frame:\s*false/);
  assert.match(mainSource, /ipcMain\.handle\('window-minimize'/);
  assert.match(mainSource, /ipcMain\.handle\('window-toggle-maximize'/);
  assert.match(mainSource, /ipcMain\.handle\('window-close'/);
});

test('preload exposes safe window control actions', () => {
  assert.match(preloadSource, /minimizeWindow/);
  assert.match(preloadSource, /toggleMaximizeWindow/);
  assert.match(preloadSource, /closeWindow/);
});

test('workbench renders draggable custom window controls', () => {
  assert.match(mainLayout, /WebkitAppRegion.*drag/s);
  assert.match(mainLayout, /WebkitAppRegion.*no-drag/s);
  assert.match(mainLayout, /minimizeWindow/);
  assert.match(mainLayout, /toggleMaximizeWindow/);
  assert.match(mainLayout, /closeWindow/);
  assert.match(mainLayout, /aria-label="最小化窗口"/);
});

test('custom window controls have clear hit targets and visible borders', () => {
  assert.match(mainLayout, /width:\s*'42px'/);
  assert.match(mainLayout, /height:\s*'38px'/);
  assert.match(mainLayout, /border:\s*'1px solid var\(--border-medium\)'/);
  assert.match(mainLayout, /gap:\s*'6px'/);
  assert.match(mainLayout, /fontSize:\s*'16px'/);
});
