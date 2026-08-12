import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isSellablePackageTemplate, packageDraftIsDirty, resetPackageDraftToTemplate, templateToPackageDraft, validatePackageDraft } from '../src/lib/clientPackageDraft.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};
const template = (overrides = {}) => ({ id: 10, name: 'قالب احترافي', category: 'studio', billing_unit: 'hour', total_hours: 7.5, total_reels: 0, validity_days: 45, payment_due_hours: 3.25, deposit_percent: 35, overage_price: '1250.75', price: '9000.10', is_active: 1, ...overrides });

test('pure template mapper normalizes hour/day/month and reel templates with every snapshot', () => {
  for (const billing_unit of ['hour', 'day', 'month']) {
    const draft = templateToPackageDraft(template({ billing_unit }), { clientId: 44, startsAt: '2026-08-10' });
    assert.equal(draft.billing_unit, 'hour'); assert.equal(draft.quantity, 7.5); assert.equal(draft.payment_due_quantity, 3.25);
    assert.equal(draft.deposit_percent_snapshot, 35); assert.equal(Number(draft.overage_price_snapshot), 1250.75); assert.equal(Number(draft.total_price), 9000.1);
    assert.equal(draft.expires_at, '2026-09-23'); assert.equal(draft.client_id, '44');
  }
  const reel = templateToPackageDraft(template({ billing_unit: 'reel', total_hours: 0, total_reels: 8, payment_due_reels: 4 }), { clientId: 2, startsAt: '2026-08-10' });
  assert.equal(reel.billing_unit, 'reel'); assert.equal(reel.quantity, 8); assert.equal(reel.payment_due_quantity, 4);
});

test('project-like templates are excluded and reset preserves client while restoring template terms', () => {
  assert.equal(isSellablePackageTemplate(template({ billing_unit: 'project', total_hours: 0 })), false);
  assert.equal(isSellablePackageTemplate(template({ category: 'graphics' })), false);
  const source = template(); const draft = templateToPackageDraft(source, { clientId: 91, startsAt: '2026-08-10' });
  const edited = { ...draft, name: 'اسم معدل', quantity: 12, paid_amount: 250, notes: 'خاص' };
  assert.equal(packageDraftIsDirty(edited, source), true);
  const reset = resetPackageDraftToTemplate(edited, source, { startsAt: '2026-08-11' });
  assert.equal(reset.client_id, '91'); assert.equal(reset.name, source.name); assert.equal(reset.quantity, 7.5); assert.equal(reset.paid_amount, 0); assert.equal(reset.notes, ''); assert.equal(reset.starts_at, '2026-08-11');
});

test('draft validation rejects missing client, invalid balances, expiry and overpayment', () => {
  const draft = templateToPackageDraft(template(), { startsAt: '2026-08-10' });
  const errors = validatePackageDraft({ ...draft, client_id: '', quantity: 0, validity_days: 0, paid_amount: 9000.11 });
  assert.ok(errors.client_id); assert.ok(errors.quantity); assert.ok(errors.validity_days); assert.ok(errors.paid_amount);
});

test('demo sale creates exact hour package, opening ledger, payment allocation, finance, audit and notification once', async () => {
  const storage = browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const draft = templateToPackageDraft((await demoClient.from('services').select('*')).data.find(row => row.id === 101), { clientId: 1, startsAt: '2026-08-10' });
  const body = { ...draft, name: 'بيع دقيق', quantity: 7.25, payment_due_quantity: 2.75, deposit_percent_snapshot: 42, overage_price_snapshot: '1300.15', total_price: '10000.30', paid_amount: '3333.37', payment_method: 'instapay', notes: 'شروط معدلة', idempotency_key: 'package-sale-hour-001' };
  const first = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(body) }); assert.equal(first.error, null); assert.equal(first.data.idempotent, false);
  const retry = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(body) }); assert.equal(retry.error, null); assert.equal(retry.data.id, first.data.id); assert.equal(retry.data.idempotent, true);
  const mismatch = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...body, name: 'بيانات أخرى' }) }); assert.equal(mismatch.error?.code, 'idempotency_payload_mismatch');
  const db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = db.client_packages.find(row => row.id === first.data.id); const payment = db.payments.find(row => row.id === first.data.payment_id);
  assert.equal(pkg.billing_unit, 'hour'); assert.equal(pkg.purchased_minutes, 435); assert.equal(pkg.purchased_quantity, 7.25); assert.equal(pkg.payment_due_minutes, 165); assert.equal(pkg.deposit_percent_snapshot, 42); assert.equal(Number(pkg.overage_price_snapshot), 1300.15); assert.equal(Number(pkg.total_price), 10000.3); assert.equal(Number(pkg.paid_amount), 3333.37); assert.equal(pkg.notes, 'شروط معدلة');
  assert.equal(db.package_usage_ledger.filter(row => row.client_package_id === pkg.id && row.event_key === `package:${pkg.id}:opening`).length, 1);
  assert.equal(db.payment_allocations.filter(row => row.client_package_id === pkg.id).length, 1); assert.equal(Number(payment.amount), 3333.37);
  assert.equal(db.finance.filter(row => row.source_type === 'payment' && row.source_id === payment.id && Number(row.amount) === 3333.37).length, 1);
  assert.equal(db.audit_logs.filter(row => row.entity_type === 'client_packages' && row.entity_id === pkg.id && row.action === 'create').length, 1);
  assert.equal(db.app_notifications.filter(row => row.entity_type === 'client_packages' && row.entity_id === pkg.id && row.type === 'package_created').length, 1);
  deactivateDemoMode();
});

test('demo sale supports reel, enforces roles and rolls back injected failure', async () => {
  const storage = browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('operations'); const service = (await demoClient.from('services').select('*')).data.find(row => row.id === 102); const draft = templateToPackageDraft(service, { clientId: 1, startsAt: '2026-08-10' });
  const reel = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, paid_amount: '100.20', payment_method: 'cash', idempotency_key: 'package-sale-reel-001' }) }); assert.equal(reel.error, null); let db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(db.client_packages.find(row => row.id === reel.data.id).billing_unit, 'reel'); assert.equal(db.client_packages.find(row => row.id === reel.data.id).purchased_quantity, 8);
  const before = storage.get('mt_agency_erp_demo_v12'); const failed = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, idempotency_key: 'package-sale-fail-001', __test_fail_at: 'finance' }) }); assert.equal(failed.error?.code, 'demo_fault_injected'); assert.equal(storage.get('mt_agency_erp_demo_v12'), before);
  for (const role of ['owner', 'admin']) { resetDemoDatabase(); activateDemoMode(role); const allowed = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, idempotency_key: `package-sale-${role}-001` }) }); assert.equal(allowed.error, null); }
  for (const role of ['finance', 'staff', 'client']) { activateDemoMode(role); const forbidden = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, idempotency_key: `package-sale-forbidden-${role}-001` }) }); assert.equal(forbidden.error?.code, 'forbidden'); }
  deactivateDemoMode();
});

test('production and UI contracts include normalized reel support, snapshots, idempotency and responsive reset', async () => {
  const [api, migration, view, css] = await Promise.all([load('api/index.php'), load('database/mysql/023_client_package_sale_idempotency.sql'), load('src/erp/ERPPackages.jsx'), load('src/erp/ERPPackages.css')]);
  assert.match(api, /normalizedStudioPackageUnit/); assert.match(api, /client_package_sale_requests/); assert.match(api, /payment_due_minutes/); assert.match(api, /payment_allocations/); assert.match(api, /packageMoneyCents/); assert.match(api, /appNotification/);
  assert.match(migration, /UNIQUE KEY uq_client_package_sale_request/); assert.match(view, /templateToPackageDraft/); assert.match(view, /استعادة شروط القالب/); assert.match(view, /idempotency_key/); assert.match(view, /payment_due_quantity/); assert.match(view, /deposit_percent_snapshot/); assert.match(css, /packages-template-snapshot/); assert.match(css, /max-width:700px/);
  assert.ok(view.indexOf('packages-template-snapshot') < view.indexOf('packages-sale-groups'), 'template comparison must appear before editable groups');
  assert.match(view, /الرصيد والصلاحية/); assert.match(view, /السعر والدفع/); assert.match(view, /رصيد الباقة \(\{balanceUnitPlural\}\)/); assert.match(view, /سعر \{reelBalance \? 'الريل' : 'الساعة'\} الإضافي/);
  assert.match(css, /\.erp-main \.packages-dialog\.packages-sale-dialog[^}]+background:[^}]+!important/); assert.match(css, /packages-sale-section/); assert.match(css, /min-height:44px/);
});
