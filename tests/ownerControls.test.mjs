import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('migration keeps history and adds immutable reversal links', async () => {
  const migration = await load('database/mysql/015_owner_adjustments_and_voids.sql');
  assert.match(migration, /CREATE TABLE owner_adjustments/i);
  assert.match(migration, /UNIQUE KEY uq_finance_reversal_once/i);
  assert.match(migration, /UNIQUE KEY uq_usage_reversal_once/i);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN)\b/i);
});

test('sensitive API mutations are owner-only and use locking', async () => {
  const api = await load('api/index.php');
  for (const route of [
    "#^/services/(\\d+)/archive$#",
    "#^/client-packages/(\\d+)/adjust$#",
    "#^/payments/(\\d+)/void$#",
    "#^/finance/(\\d+)/correct$#",
  ]) assert.ok(api.includes(route), `missing route ${route}`);
  assert.match(api, /requireRole\(\$user,\['owner'\]\)/);
  assert.match(api, /FOR UPDATE/i);
  assert.match(api, /allocation_total_mismatch/);
  assert.match(api, /INSERT INTO owner_adjustments/i);
});

test('owner controls are hidden from non-owner users in all three screens', async () => {
  const [packages, finance, settings] = await Promise.all([
    load('src/erp/ERPPackages.jsx'), load('src/erp/ERPFinance.jsx'), load('src/erp/ERPSettings.jsx'),
  ]);
  assert.match(packages, /role === 'owner'/);
  assert.match(finance, /currentUser\?\.role === 'owner'/);
  assert.match(settings, /currentUser\?\.role === 'owner'/);
  assert.match(settings, /المبيعات الجديدة فقط/);
  assert.match(packages, /تحكم المالك/);
  assert.match(finance, /قيد عكسي موثق/);
});

test('demo API rejects admin mutations and accepts the same owner workflow', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  activateDemoMode('admin');
  const denied = await demoClient.request('/client-packages/201/adjust', { method: 'POST', body: JSON.stringify({ target_quantity: 18, reason: 'اختبار صلاحيات المدير' }) });
  assert.equal(denied.error?.code, 'forbidden');
  activateDemoMode('owner');
  const allowed = await demoClient.request('/client-packages/201/adjust', { method: 'POST', body: JSON.stringify({ target_quantity: 18, reason: 'اختبار صلاحيات المالك' }) });
  assert.equal(allowed.error, null);
  assert.equal(allowed.data.purchased_quantity, 18);
  deactivateDemoMode();
});
