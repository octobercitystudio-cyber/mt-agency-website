import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { calculateDashboardCashMovement, calculateDashboardReceivableDetails, calculateDashboardReceivables } from '../src/lib/dashboardKpis.js';
import { buildDemoClientServiceHistory } from '../src/lib/clientServiceHistory.js';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('receivables include all package dues without adding invoice or client debt', () => {
  const result = calculateDashboardReceivables({
    invoices: [{ id: 10, client_id: 1, total: '100.00', paid_amount: '40.00', status: 'issued' }, { id: 20, client_id: 2, total: '90.00', paid_amount: 0, status: 'void' }],
    packages: [
      { client_id: 1, source_invoice_id: 10, total_price: '100.00', paid_amount: '40.00', overage_amount: '5.00', status: 'active' },
      { client_id: 2, source_invoice_id: 20, total_price: '90.00', paid_amount: '10.00', overage_amount: 0, status: 'active' },
      { client_id: 3, source_invoice_id: 999, total_price: '50.00', paid_amount: 0, overage_amount: 0, status: 'active' },
    ],
    clients: [{ id: 1, debt: '60.00', status: 'active' }, { id: 2, debt: '100.00', status: 'active' }, { id: 4, debt: '7.00', status: 'active' }],
  });
  assert.deepEqual(result, { definition: 'unpaid_sold_packages', amount: '195.00', package_amount: '195.00' });
});

test('dashboard receivables include only packages active on the current date', () => {
  const packages = [
    { id: 1, client_id: 1, name: 'نشطة', total_price: '1000.00', paid_amount: '250.00', overage_amount: '50.00', status: 'active', expires_at: '2026-09-30' },
    { id: 2, client_id: 1, name: 'انتهى تاريخها', total_price: '9000.00', paid_amount: 0, status: 'active', expires_at: '2026-09-12' },
    { id: 3, client_id: 2, name: 'مكتملة', total_price: '8000.00', paid_amount: 0, status: 'completed', expires_at: '2026-10-01' },
    { id: 4, client_id: 2, name: 'موقوفة', total_price: '7000.00', paid_amount: 0, status: 'suspended', expires_at: null },
    { id: 5, client_id: 3, name: 'بانتظار أول حجز', total_price: '500.00', paid_amount: '100.00', status: 'active', expires_at: null },
  ];
  assert.deepEqual(calculateDashboardReceivables({ packages, todayKey: '2026-09-13' }), { definition: 'unpaid_sold_packages', amount: '1200.00', package_amount: '1200.00' });
  const details = calculateDashboardReceivableDetails({ packages, clients: [{ id: 1, name: 'أحمد' }, { id: 3, name: 'سارة' }], todayKey: '2026-09-13' });
  assert.equal(details.amount, '1200.00');
  assert.deepEqual(details.items.map(item => item.package_id), [1, 5]);
});

test('owner permanently deletes a sold package and its dedicated financial records', async () => {
  const sale = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ client_id: 6, service_id: 101, name: 'باقة للحذف', billing_unit: 'hour', quantity: 5, payment_due_quantity: 2, deposit_percent_snapshot: 30, overage_price_snapshot: '1200.00', total_price: '5000.00', paid_amount: '1000.00', payment_method: 'cash', notes: '', starts_at: '', expires_at: '', validity_days: 30, bookings: [], idempotency_key: 'delete-sold-package-0001' }) });
  assert.equal(sale.error, null);
  let database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = database.client_packages.find(row => Number(row.id) === Number(sale.data.id));
  const paymentIds = database.payment_allocations.filter(row => Number(row.client_package_id) === Number(pkg.id)).map(row => Number(row.payment_id));
  assert.ok(paymentIds.length > 0); assert.ok(database.finance.some(row => paymentIds.includes(Number(row.source_id))));
  const denied = await demoClient.request(`/client-packages/${pkg.id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'تنظيف باقة مدخلة بالخطأ', confirmation: 'خطأ', expected_version: pkg.version }) });
  assert.equal(denied.error?.code, 'hard_delete_confirmation_required');
  const removed = await demoClient.request(`/client-packages/${pkg.id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'تنظيف باقة مدخلة بالخطأ', confirmation: 'حذف', expected_version: pkg.version }) });
  assert.equal(removed.error, null); assert.equal(removed.data.deleted, true);
  database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(database.client_packages.some(row => Number(row.id) === Number(pkg.id)), false);
  assert.equal(database.package_usage_ledger.some(row => Number(row.client_package_id) === Number(pkg.id)), false);
  assert.equal(database.payment_allocations.some(row => Number(row.client_package_id) === Number(pkg.id)), false);
  assert.equal(database.payments.some(row => paymentIds.includes(Number(row.id))), false);
  assert.equal(database.finance.some(row => paymentIds.includes(Number(row.source_id))), false);
});

test('dashboard and sold-package owner control expose the active-only and delete contracts', async () => {
  const [api, dashboard, ownerControl] = await Promise.all([load('api/index.php'), load('src/erp/ERPDashboard.jsx'), load('src/erp/OwnerPackageControl.jsx')]);
  assert.match(api, /cp\.status='active' AND \(cp\.expires_at IS NULL OR cp\.expires_at>=\?\)/);
  assert.match(api, /ownerDeletePackageCascade/);
  assert.match(api, /client_package_payment_requests/);
  assert.match(dashboard, /المتبقي للدفع من الباقات النشطة حاليًا فقط/);
  assert.match(ownerControl, /حذف الباقة نهائيًا/);
  assert.match(ownerControl, /confirmation: archive\.deleteConfirmation\.trim\(\)/);
  assert.match(ownerControl, /method: 'DELETE'/);
});

test('cash movement uses one signed active ledger and reversals cancel their source exactly', () => {
  assert.deepEqual(calculateDashboardCashMovement([
    { date: '2026-08-01', entry_kind: 'income', amount: '100.00' },
    { date: '2026-08-02', entry_kind: 'expense', amount: '40.00' },
  ], '2026-08'), { definition: 'operational', transfers_included: false, cash_in: '100.00', cash_out: '40.00' });

  assert.deepEqual(calculateDashboardCashMovement([
    { date: '2026-08-01', entry_kind: 'income', amount: '100.01' },
    { date: '2026-08-02', entry_kind: 'reversal', category: 'reversal_income', amount: '100.01' },
    { date: '2026-08-03', entry_kind: 'expense', amount: '40.25' },
    { date: '2026-08-04', entry_kind: 'reversal', category: 'reversal_expense', amount: '40.25' },
    { date: '2026-07-31', entry_kind: 'income', amount: '999.00' },
  ], '2026-08'), { definition: 'operational', transfers_included: false, cash_in: '0.00', cash_out: '0.00' });
});

test('demo offers store line totals, discount and final total in exact piastres', async () => {
  const created = await demoClient.request('/offers', { method: 'POST', body: JSON.stringify({ client_id: 1, title: 'عرض دقيق', discount: '0.01', items: [{ description: 'بند أول', quantity: 3, unit: 'project', unit_price: '0.10' }, { description: 'بند ثانٍ', quantity: 2.5, unit: 'hour', unit_price: '1.01' }] }) });
  assert.equal(created.error, null); assert.equal(created.data.subtotal, '2.83'); assert.equal(created.data.total, '2.82');
  const invalid = await demoClient.request('/offers', { method: 'POST', body: JSON.stringify({ client_id: 1, items: [{ description: 'سعر غير دقيق', quantity: 1, unit_price: '1.001' }] }) });
  assert.equal(invalid.error?.code, 'invalid_offer_item');
});

test('generic booking writes are blocked and dedicated deletion leaves an immutable archive snapshot', async () => {
  await assert.rejects(Promise.resolve(demoClient.from('bookings').insert([{ client_id: 1, date: '2026-08-11', start_time: '12:00', end_time: '13:00' }])), error => error?.code === 'booking_dedicated_route_required');
  const deleted = await demoClient.request('/bookings/302', { method: 'DELETE' }); assert.equal(deleted.error, null);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const archive = database.booking_archives.find(row => Number(row.booking_id) === 302);
  assert.equal(archive.snapshot_json.booking.id, 302); assert.ok(Array.isArray(archive.snapshot_json.status_history)); assert.equal(database.bookings.some(row => Number(row.id) === 302), false);
});

test('client reel history reports consumed reels, never covered minutes converted to hours', () => {
  const history = buildDemoClientServiceHistory({
    client_packages: [{ id: 1, client_id: 9, name: 'باقة ريلز', billing_unit: 'reel' }],
    bookings: [{ id: 2, client_id: 9, client_package_id: 1, status: 'completed', service: 'تصوير ريلز', date: '2026-08-11', end_time: '15:00', billable_quantity: 3, actual_reels: 3 }],
    session_settlements: [{ booking_id: 2, client_id: 9, actual_minutes: 120, covered_minutes: 120, excess_minutes: 0, settlement_mode: 'none' }],
    projects: [],
  }, {}, 9);
  assert.equal(history.items[0].details.billing_unit, 'reel'); assert.equal(history.items[0].details.deducted_quantity, 3);
});

test('production contracts centralize booking validation, attendance intent, sync cursors and settlement concurrency', async () => {
  const [api, settlement, sync, migration] = await Promise.all([load('api/index.php'), load('api/session_settlement.php'), load('src/hooks/useChangeSync.js'), load('database/mysql/028_comprehensive_integrity.sql')]);
  assert.match(api, /function validateBookingSchedule/); assert.ok((api.match(/validateBookingSchedule\(/g) || []).length >= 5); assert.match(api, /booking_dedicated_route_required/);
  const sessionBlock = api.slice(api.indexOf("$path === '/auth/session'"), api.indexOf("$path === '/auth/logout'")); assert.doesNotMatch(sessionBlock, /attendanceCheckIn/); assert.match(api, /\/attendance\/check-in/);
  assert.match(api, /'high_watermark'/); assert.match(api, /'has_more'/); assert.match(sync, /const subscribers = new Map/); assert.match(sync, /if \(!data\.has_more/);
  assert.match(settlement, /target_package_version/); assert.match(settlement, /stale_package_version/); assert.match(settlement, /payment_method/); assert.match(settlement, /version=version\+1/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS booking_archives/); assert.match(migration, /snapshot_json JSON NOT NULL/); assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|TRUNCATE/i);
});
