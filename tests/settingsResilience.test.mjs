import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('settings safely formats numeric strings returned by Hostinger', async () => {
  const settings = await load('src/erp/ERPSettings.jsx');

  assert.match(settings, /const formatServicePrice = value =>/);
  assert.match(settings, /Number\.isFinite\(price\)/);
  assert.doesNotMatch(settings, /s\.price\.toFixed/);
  assert.equal((settings.match(/formatServicePrice\(s\.price\)/g) || []).length, 5);
});

test('stale lazy-route assets trigger one guarded application refresh', async () => {
  const main = await load('src/main.jsx');

  assert.match(main, /vite:preloadError/);
  assert.match(main, /event\.preventDefault\(\)/);
  assert.match(main, /mta:stale-build-reload/);
  assert.match(main, /window\.location\.reload\(\)/);
});
