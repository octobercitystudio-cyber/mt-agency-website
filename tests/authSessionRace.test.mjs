import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataContextSource = await readFile(
  new URL('../src/store/DataContext.jsx', import.meta.url),
  'utf8',
);
const loginSource = await readFile(
  new URL('../src/pages/UnifiedLogin.jsx', import.meta.url),
  'utf8',
);

test('an older session restore cannot overwrite a newer login', () => {
  assert.match(dataContextSource, /const restoreRevision = authRevisionRef\.current/);
  assert.match(dataContextSource, /authRevisionRef\.current === restoreRevision/);
  assert.match(dataContextSource, /authRevisionRef\.current \+= 1/);
});

test('login waits for session restoration and routes users by role', () => {
  assert.match(loginSource, /disabled=\{loading \|\| !isAuthReady\}/);
  assert.match(loginSource, /user\.role === 'client' \? '\/dashboard' : '\/erp'/);
});
