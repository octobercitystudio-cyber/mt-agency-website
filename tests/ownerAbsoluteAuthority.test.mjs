import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

const setupDemo = async role => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const module = await import('../src/lib/demoDataClient.js');
  module.resetDemoDatabase(); module.activateDemoMode(role);
  return module;
};

test('all staff business role gates include owner while client-only and safe generic guards stay isolated', async () => {
  const api = await load('api/index.php');
  const gates = [...api.matchAll(/requireRole\(\$(?:user|sessionUser),\[([^\]]*)\]\)/g)].map(match => match[1].match(/'([^']+)'/g)?.map(value => value.slice(1, -1)) || []);
  assert.ok(gates.length > 40);
  for (const roles of gates) {
    if (roles.length && !roles.includes('client')) assert.ok(roles.includes('owner'), `business gate must include owner: ${roles.join(',')}`);
  }
  assert.match(api, /'client_packages'\s*=>[^\n]+?'write'\s*=>\s*\[\]/);
  assert.match(api, /'finance'\s*=>[^\n]+?'write'\s*=>\s*\[\]/);
  assert.match(api, /'bookings'\s*=>[^\n]+?'write'\s*=>\s*\[\]/);
  assert.match(api, /requireRole\(\$user,\['client'\]\)/, 'client-only routes must remain client-only');
});

test('owner package contract correction exposes payment, validity and service controls with history guards', async () => {
  const [api, ui] = await Promise.all([load('api/index.php'), load('src/erp/OwnerPackageControl.jsx')]);
  for (const field of ['validity_mode_snapshot', 'validity_days_snapshot', 'payment_due_quantity', 'deposit_percent_snapshot', 'overage_price_snapshot', 'service_id']) {
    assert.match(api, new RegExp(field)); assert.match(ui, new RegExp(field === 'service_id' ? 'service_id' : field));
  }
  assert.match(api, /package_service_has_history/);
  assert.match(api, /owner_update_package_contract/);
  assert.match(api, /bookings_outside_package_validity/);

  const { demoClient, deactivateDemoMode } = await setupDemo('owner');
  const before = await demoClient.request('/client-packages/209/details');
  const changed = await demoClient.request('/client-packages/209', { method: 'PATCH', body: JSON.stringify({ expected_version: before.data.package.version, service_id: 102, name: 'باقة ريلز مصححة', starts_at: '', expires_at: '', status: 'active', validity_mode_snapshot: 'rolling', validity_days_snapshot: 21, payment_due_quantity: 1, deposit_percent_snapshot: 40, overage_price_snapshot: '999.50', reason: 'تصحيح كامل لعقد الباقة التجريبية' }) });
  assert.equal(changed.error, null);
  const after = await demoClient.request('/client-packages/209/details');
  assert.equal(after.data.package.service.id, 102);
  assert.equal(after.data.package.validity_days_snapshot, 21);
  assert.equal(after.data.package.deposit_percent_snapshot, 40);
  assert.equal(after.data.package.overage_price_snapshot, '999.50');
  deactivateDemoMode();
});

test('owner manual attendance creates and corrects explicit absence without counting it as presence', async () => {
  const [api, ui, client] = await Promise.all([load('api/index.php'), load('src/erp/ERPAttendance.jsx'), load('src/lib/attendanceApi.js')]);
  assert.match(api, /attendance\/records\/manual/);
  assert.match(api, /authorized_leave/);
  assert.match(api, /owner_create_attendance_day/);
  assert.match(api, /\$presentRecords/);
  assert.match(ui, /إضافة حضور أو غياب/);
  assert.match(client, /saveManualRecord/);

  const { demoClient, deactivateDemoMode } = await setupDemo('owner');
  const payload = { user_id: 3, work_date: '2026-08-18', status: 'absent', correction_reason: 'اعتماد غياب الموظف بواسطة المالك' };
  const created = await demoClient.request('/attendance/records/manual', { method: 'PUT', body: JSON.stringify(payload) });
  assert.equal(created.error, null); assert.equal(created.data.created, true); assert.equal(created.data.record.status, 'absent');
  const corrected = await demoClient.request('/attendance/records/manual', { method: 'PUT', body: JSON.stringify({ ...payload, status: 'authorized_leave', correction_reason: 'تحويل الغياب إلى إجازة معتمدة' }) });
  assert.equal(corrected.error, null); assert.equal(corrected.data.created, false); assert.equal(corrected.data.record.status, 'authorized_leave');
  deactivateDemoMode();
});

test('owner client balance movement is atomic, exact and idempotent in shared ledger', async () => {
  const [api, ui] = await Promise.all([load('api/index.php'), load('src/erp/ERPClients.jsx')]);
  assert.ok(api.includes('/owner/clients/(\\d+)/balance-adjustment'));
  assert.match(api, /FOR UPDATE/);
  assert.match(api, /owner-client-balance:/);
  assert.match(api, /owner_client_balance_adjustment/);
  assert.match(ui, /balance-adjustment/);
  assert.doesNotMatch(ui, /from\('clients'\)\.update\(\{ debt:/);

  const { demoClient, deactivateDemoMode } = await setupDemo('owner');
  const before = (await demoClient.from('clients').select('*').eq('id', 2).single()).data;
  const body = { action: 'pay_debt', amount: '100.25', method: 'instapay', idempotency_key: 'owner-client-balance-test-001' };
  const first = await demoClient.request('/owner/clients/2/balance-adjustment', { method: 'POST', body: JSON.stringify(body) });
  const replay = await demoClient.request('/owner/clients/2/balance-adjustment', { method: 'POST', body: JSON.stringify(body) });
  const after = (await demoClient.from('clients').select('*').eq('id', 2).single()).data;
  const ledger = (await demoClient.from('finance').select('*').eq('correlation_id', 'owner-client-balance:owner-client-balance-test-001')).data;
  assert.equal(first.error, null); assert.equal(replay.data.idempotent, true); assert.equal(Number(after.debt), Number(before.debt) - 100.25); assert.equal(ledger.length, 1); assert.equal(ledger[0].amount, '100.25');
  deactivateDemoMode();
});

test('owner can correct post-production backwards while normal staff flow stays forward-only', async () => {
  const [api, demo, ui] = await Promise.all([load('api/post_production.php'), load('src/lib/demoDataClient.js'), load('src/erp/ERPPostProduction.jsx')]);
  for (const source of [api, demo, ui]) assert.match(source, /status-correction/);
  assert.match(api, /requireRole\(\$user,\['owner'\]\)/);
  assert.match(api, /owner_post_production_status_correction/);
  assert.match(ui, /تصحيح أي حالة بصلاحية المالك/);

  const { demoClient, deactivateDemoMode } = await setupDemo('owner');
  const list = await demoClient.request('/post-production?status=all'); const job = list.data.items[0];
  const target = job.status === 'editing_in_progress' ? 'delivered' : 'editing_in_progress';
  const corrected = await demoClient.request(`/owner/post-production/${job.id}/status-correction`, { method: 'POST', body: JSON.stringify({ status: target, expected_version: job.version, reason: 'تصحيح مرحلة المونتاج بواسطة المالك' }) });
  assert.equal(corrected.error, null); assert.equal(corrected.data.status, target);
  deactivateDemoMode();
});

test('non-owner demo roles cannot use absolute correction endpoints', async () => {
  const { demoClient, deactivateDemoMode } = await setupDemo('admin');
  for (const [path, body] of [
    ['/owner/clients/2/balance-adjustment', { action: 'pay_debt', amount: 10, method: 'cash', idempotency_key: 'admin-denied-balance-001' }],
    ['/attendance/records/manual', { user_id: 3, work_date: '2026-08-18', status: 'absent', correction_reason: 'محاولة مدير غير مصرح بها' }],
    ['/owner/post-production/1901/status-correction', { status: 'editing_in_progress', expected_version: 1, reason: 'محاولة مدير غير مصرح بها' }],
  ]) {
    const response = await demoClient.request(path, { method: path.includes('/attendance/') ? 'PUT' : 'POST', body: JSON.stringify(body) }); assert.equal(response.error?.code, 'forbidden');
  }
  deactivateDemoMode();
});
