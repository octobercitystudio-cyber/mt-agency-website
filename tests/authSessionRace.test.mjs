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
const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('an older session restore cannot overwrite a newer login', () => {
  assert.match(dataContextSource, /const restoreRevision = authRevisionRef\.current/);
  assert.match(dataContextSource, /authRevisionRef\.current === restoreRevision/);
  assert.match(dataContextSource, /authRevisionRef\.current \+= 1/);
});

test('a broken legacy cache cannot blank the login application', () => {
  assert.match(dataContextSource, /const readCachedSiteData = \(\) => \{/);
  assert.match(dataContextSource, /localStorage\.removeItem\('mt_agency_data_v5'\)/);
  assert.match(dataContextSource, /useState\(readCachedSiteData\)/);
});

test('login waits for session restoration and routes users by role', () => {
  assert.match(loginSource, /disabled=\{loading \|\| !isAuthReady\}/);
  assert.match(loginSource, /user\.role === 'client' \? '\/dashboard' : '\/erp'/);
});

test('the owner shell and dashboard are bundled with the login application', () => {
  assert.match(appSource, /import ERPLayout from '\.\/erp\/ERPLayout'/);
  assert.match(appSource, /import ERPDashboard from '\.\/erp\/ERPDashboard'/);
  assert.doesNotMatch(appSource, /lazy\(\(\) => import\('\.\/erp\/ERPLayout'\)\)/);
});

test('route protection uses the server user role as its single source of truth', () => {
  assert.match(appSource, /ERP_ROLES\.includes\(currentUser\?\.role\)/);
  assert.match(appSource, /currentUser\?\.role !== 'client'/);
  assert.doesNotMatch(appSource, /const \{ isErpAuth \} = useData\(\)/);
});
