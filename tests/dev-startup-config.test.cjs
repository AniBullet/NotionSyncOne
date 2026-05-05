const assert = require('assert');
const fs = require('fs');
const test = require('node:test');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

test('dev server keeps the Vite port aligned with Electron loadURL', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main/index.ts'), 'utf8');
  const viteConfig = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');

  assert.match(mainSource, /loadURL\('http:\/\/localhost:5173'\)/);
  assert.match(viteConfig, /port:\s*5173/);
  assert.match(viteConfig, /strictPort:\s*true/);
});

test('run-dev uses shell command mode for cross-version Windows compatibility', () => {
  const script = fs.readFileSync(path.join(repoRoot, 'run-dev.js'), 'utf8');

  assert.match(script, /devCommand\s*=\s*isWindows\s*\?\s*'pnpm dev'\s*:\s*'pnpm dev'/);
  assert.match(script, /spawn\(devCommand,\s*\[\]/);
  assert.match(script, /shell:\s*true/);
});
