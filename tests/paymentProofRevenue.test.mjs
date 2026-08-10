import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('approved payment proof becomes one linked client revenue with client and service labels', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  activateDemoMode('owner');

  const before = (await demoClient.request('/finance/entries', { method: 'GET' })).data;
  const approval = await demoClient.request('/payment-proofs/501/decision', {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', note: 'تمت المطابقة' }),
  });
  assert.equal(approval.error, null);

  const after = (await demoClient.request('/finance/entries', { method: 'GET' })).data;
  assert.equal(after.length, before.length + 1);
  const revenue = after.find(entry => entry.correlation_id === `payment:${approval.data.payment_id}`);
  assert.equal(revenue?.entry_kind, 'income');
  assert.equal(revenue?.category, 'client_revenue');
  assert.equal(revenue?.client_name, 'د. محمد عادل');
  assert.ok(revenue?.service_names?.length > 0);
  assert.equal(revenue?.source_label, revenue.service_names[0]);
  assert.match(revenue?.detail || '', /د\. محمد عادل/);

  const duplicate = await demoClient.request('/payment-proofs/501/decision', {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(duplicate.error?.code, 'payment_proof_already_decided');
  const finalEntries = (await demoClient.request('/finance/entries', { method: 'GET' })).data;
  assert.equal(finalEntries.length, after.length);
  deactivateDemoMode();
});

test('production approval links finance to the approved payment and prioritizes service labels', async () => {
  const api = await readFile(new URL('../api/index.php', import.meta.url), 'utf8');
  const requests = await readFile(new URL('../src/erp/ERPRequests.jsx', import.meta.url), 'utf8');
  assert.match(api, /'income','client_revenue'/);
  assert.match(api, /'payment',\?,\?,1,\?/);
  assert.match(api, /'payment:'\.\$paymentId/);
  assert.match(api, /array_merge\(\$serviceNames,\$packageNames,\$projectNames,\$invoiceNumbers\)/);
  assert.match(requests, /تسجيله إيرادًا باسم العميل والخدمة/);
});
