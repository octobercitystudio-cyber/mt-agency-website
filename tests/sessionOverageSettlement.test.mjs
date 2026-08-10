import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
const eventTarget = new EventTarget();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
const database = () => JSON.parse([...storage.values()][0]);
const writeDatabase = value => storage.set([...storage.keys()][0], JSON.stringify(value));
const startAndPreview = async (minutes = 300) => {
  const start = await demoClient.request('/bookings/301/session/start', { method: 'POST' }); assert.equal(start.error, null);
  const preview = await demoClient.request('/bookings/301/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: minutes }) }); assert.equal(preview.error, null); return preview.data;
};
const complete = (preview, key, settlement, minutes = preview.actual_minutes) => demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: minutes, idempotency_key: key, expected_session_version: preview.session_version, preview_hash: preview.preview_hash, settlement }) });
const previewBooking = async (bookingId, minutes) => {
  const result = await demoClient.request(`/bookings/${bookingId}/session/settlement-preview`, { method: 'POST', body: JSON.stringify({ actual_minutes: minutes }) });
  assert.equal(result.error, null); return result.data;
};
const completeBooking = (bookingId, preview, key, settlement, extra = {}) => demoClient.request(`/bookings/${bookingId}/session/complete`, { method: 'POST', body: JSON.stringify({ actual_minutes: preview.actual_minutes, idempotency_key: key, expected_session_version: preview.session_version, preview_hash: preview.preview_hash, settlement, ...extra }) });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('preview uses current hold plus free original balance but never future holds', async () => {
  const preview = await startAndPreview(300);
  assert.equal(preview.held_for_booking_minutes, 120);
  assert.equal(preview.free_unheld_original_minutes, 150);
  assert.equal(preview.covered_minutes, 270);
  assert.equal(preview.excess_minutes, 30);
  const db = database(); const pkg = db.client_packages.find(row => row.id === 201);
  assert.equal(pkg.held_quantity, 2, 'preview must not mutate held time');
});

test('fresh eligibility and sale-confirm-reschedule-cancel-edit-preview keep exact booking minutes', async () => {
  const freshEligibility = await demoClient.request(`/studio-session-eligibility?date=${database().bookings.find(row => row.id === 301).date}`);
  assert.equal(freshEligibility.error, null);
  assert.equal(freshEligibility.data.items.find(row => row.booking_id === 301).eligible, true);

  const initial = database();
  initial.resources.push({ id: 2, name: 'استديو التسلسل', type: 'studio', is_active: 1 });
  writeDatabase(initial);
  const today = database().bookings.find(row => row.id === 301).date;
  const futureDate = new Date(`${today}T12:00:00`); futureDate.setDate(futureDate.getDate() + 1);
  const future = futureDate.toISOString().slice(0, 10);
  const sale = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ client_id: 6, service_id: 101, name: 'باقة تسلسل الدقائق', billing_unit: 'hour', quantity: 5, payment_due_quantity: 5, deposit_percent_snapshot: 30, overage_price_snapshot: 1400, total_price: 5000, paid_amount: 0, payment_method: 'cash', notes: '', starts_at: today, validity_days: 30, idempotency_key: 'session-overage-minute-sequence-package' }) });
  assert.equal(sale.error, null); const packageId = sale.data.id;
  assert.equal(database().client_packages.find(row => row.id === packageId).purchased_minutes, 300);

  const first = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 6, service_id: 101, resource_id: 2, date: today, start_time: '20:00', end_time: '21:00', status: 'confirmed' }) });
  assert.equal(first.error, null); assert.equal(database().client_packages.find(row => row.id === packageId).held_minutes, 60);
  const rescheduled = await demoClient.request(`/bookings/${first.data.id}/admin-reschedule`, { method: 'POST', body: JSON.stringify({ date: today, start_time: '20:00', end_time: '21:30' }) });
  assert.equal(rescheduled.error, null); assert.equal(database().client_packages.find(row => row.id === packageId).held_minutes, 90);
  const cancelled = await demoClient.request(`/bookings/${first.data.id}/admin-cancel`, { method: 'POST', body: JSON.stringify({ charge: false }) });
  assert.equal(cancelled.error, null); assert.equal(database().client_packages.find(row => row.id === packageId).held_minutes, 0);
  const edited = await demoClient.request(`/client-packages/${packageId}/adjust`, { method: 'POST', body: JSON.stringify({ target_quantity: 6, reason: 'زيادة معتمدة للاختبار' }) });
  assert.equal(edited.error, null); assert.equal(database().client_packages.find(row => row.id === packageId).purchased_minutes, 360);

  const current = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 6, service_id: 101, resource_id: 2, date: today, start_time: '20:00', end_time: '21:00', status: 'confirmed' }) });
  const futureBooking = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 6, service_id: 101, resource_id: 2, date: future, start_time: '20:00', end_time: '21:00', status: 'confirmed' }) });
  assert.equal(current.error, null); assert.equal(futureBooking.error, null);
  assert.equal(database().client_packages.find(row => row.id === packageId).held_minutes, 120);
  const start = await demoClient.request(`/bookings/${current.data.id}/session/start`, { method: 'POST' }); assert.equal(start.error, null);
  const preview = await demoClient.request(`/bookings/${current.data.id}/session/settlement-preview`, { method: 'POST', body: JSON.stringify({ actual_minutes: 301 }) });
  assert.equal(preview.error, null); assert.equal(preview.data.held_for_booking_minutes, 60); assert.equal(preview.data.free_unheld_original_minutes, 240); assert.equal(preview.data.excess_minutes, 1);
  assert.equal(database().client_packages.find(row => row.id === packageId).held_minutes, 120, 'preview must not steal the future booking hold');
});

test('hourly overage is exact to piastres, does not overdraw package, and is idempotent', async () => {
  const preview = await startAndPreview(271);
  const first = await complete(preview, 'overage-piastre-001', { mode: 'package_overage', hourly_rate: 100 });
  assert.equal(first.error, null); assert.equal(first.data.excess_minutes, 1); assert.equal(Number(first.data.amount_due), 1.67);
  const after = database(); const pkg = after.client_packages.find(row => row.id === 201);
  assert.equal(pkg.consumed_quantity, 10); assert.equal(Number(pkg.overage_amount), 1.67);
  assert.equal(after.finance.filter(row => row.correlation_id?.includes('overage-piastre')).length, 0, 'receivable is not collected income');
  const replay = await complete(preview, 'overage-piastre-001', { mode: 'package_overage', hourly_rate: 100 });
  assert.equal(replay.error, null); assert.equal(replay.data.idempotent_replay, true); assert.equal(database().session_settlements.length, 1);
  const mismatch = await complete(preview, 'overage-piastre-001', { mode: 'package_overage', hourly_rate: 101 });
  assert.equal(mismatch.error?.code, 'idempotency_payload_mismatch');
});

test('new package consumes only excess and records income only for initial paid amount', async () => {
  const preview = await startAndPreview();
  const result = await complete(preview, 'new-package-001', { mode: 'new_package', service_id: 101, name: 'استكمال جلسة أغسطس', purchased_minutes: 60, validity_days: 30, total_price: '1200.00', initial_paid: '200.10', notes: 'تجربة التسوية' });
  assert.equal(result.error, null); const db = database(); const target = db.client_packages.find(row => row.id === result.data.target_package_id);
  assert.equal(target.purchased_quantity, 1); assert.equal(target.consumed_quantity, 0.5); assert.equal(Number(target.paid_amount), 200.1);
  const invoice = db.invoices.find(row => row.id === result.data.invoice_id); assert.equal(Number(invoice.total), 1200); assert.equal(Number(invoice.paid_amount), 200.1);
  const incomes = db.finance.filter(row => row.source_type === 'payment' && row.source_id === result.data.payment_id); assert.equal(incomes.length, 1); assert.equal(Number(incomes[0].amount), 200.1);
});

test('existing package, custom invoice, custom project and waiver create one allocation each', async t => {
  await t.test('existing package', async () => {
    const db = database(); db.client_packages.push({ id: 299, client_id: 1, service_id: 101, name: 'باقة احتياطية', billing_unit: 'hour', purchased_quantity: 2, consumed_quantity: 0, held_quantity: 0, total_price: 0, paid_amount: 0, overage_amount: 0, starts_at: db.client_packages[0].starts_at, expires_at: db.client_packages[0].expires_at, status: 'active' }); writeDatabase(db);
    const preview = await startAndPreview(); assert.equal(preview.eligible_packages[0].id, 299);
    const result = await complete(preview, 'existing-package-001', { mode: 'existing_package', target_package_id: 299 }); assert.equal(result.error, null); assert.equal(database().client_packages.find(row => row.id === 299).consumed_quantity, 0.5);
  });
  await t.test('custom invoice', async () => { resetDemoDatabase(); const preview = await startAndPreview(); const result = await complete(preview, 'custom-invoice-001', { mode: 'custom_invoice', description: 'نصف ساعة إضافية', amount: '333.33' }); assert.equal(result.error, null); const db = database(); assert.equal(Number(db.invoices.find(row => row.id === result.data.invoice_id).total), 333.33); assert.equal(db.finance.filter(row => Number(row.source_id) === Number(result.data.invoice_id)).length, 0); });
  await t.test('custom project', async () => { resetDemoDatabase(); const preview = await startAndPreview(); const result = await complete(preview, 'custom-project-001', { mode: 'custom_project', name: 'خدمة إضافية', description: 'معالجة وقت الجلسة', amount: '450.00' }); assert.equal(result.error, null); const db = database(); assert.ok(db.projects.find(row => row.id === result.data.project_id)); assert.equal(db.invoices.filter(row => row.project_id === result.data.project_id).length, 1); });
  await t.test('waive', async () => { resetDemoDatabase(); const preview = await startAndPreview(); const result = await complete(preview, 'waive-001', { mode: 'waive', internal_reason: 'مجاملة معتمدة للعميل', client_note: 'تمت التسوية دون رسوم' }); assert.equal(result.error, null); assert.equal(result.data.waived_minutes, 30); const row = database().session_settlements[0]; assert.equal(row.billable_minutes, 270); assert.equal(row.internal_reason, 'مجاملة معتمدة للعميل'); });
});

test('roles and stale preview leave session and ledgers unchanged', async () => {
  const preview = await startAndPreview(); const before = database(); activateDemoMode('operations');
  const operations = await complete(preview, 'ops-001', { mode: 'waive', internal_reason: 'غير مسموح' }); assert.equal(operations.error?.code, 'settlement_owner_required');
  let after = database(); assert.equal(after.booking_sessions.find(row => row.booking_id === 301).status, 'active'); assert.equal(after.package_usage_ledger.length, before.package_usage_ledger.length);
  activateDemoMode('owner'); after.client_packages.find(row => row.id === 201).consumed_minutes += 15; writeDatabase(after);
  const stale = await complete(preview, 'stale-001', { mode: 'package_overage', hourly_rate: 1400 }); assert.equal(stale.error?.code, 'stale_settlement_preview'); assert.equal(database().booking_sessions.find(row => row.booking_id === 301).status, 'active');
  activateDemoMode('finance'); const denied = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 300 }) }); assert.equal(denied.error?.code, 'forbidden');
});

test('direct completion requests require both preview guards and reject stale values without mutation', async () => {
  const preview = await startAndPreview();
  const validBase = { actual_minutes: preview.actual_minutes, idempotency_key: 'direct-guard-001', settlement: { mode: 'package_overage', hourly_rate: 1400 } };
  const cases = [
    [{ ...validBase, expected_session_version: preview.session_version }, 'settlement_preview_required'],
    [{ ...validBase, preview_hash: preview.preview_hash }, 'settlement_preview_required'],
    [{ ...validBase, preview_hash: 'demo-stale-hash', expected_session_version: preview.session_version }, 'stale_settlement_preview'],
    [{ ...validBase, preview_hash: preview.preview_hash, expected_session_version: preview.session_version + 1 }, 'stale_settlement_preview'],
  ];
  for (const [body, code] of cases) {
    const before = JSON.stringify(database());
    const result = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(result.error?.code, code); assert.equal(JSON.stringify(database()), before);
  }
});

test('integer minutes remain authoritative at 1/59/60/61 minute and piastre boundaries', async () => {
  for (const excess of [1, 59, 60, 61]) {
    resetDemoDatabase();
    const preview = await startAndPreview(270 + excess);
    const result = await complete(preview, `boundary-${excess}`, { mode: 'package_overage', hourly_rate: 100 });
    assert.equal(result.error, null); assert.equal(result.data.excess_minutes, excess);
    assert.equal(Number(result.data.amount_due), Math.round((10000 * excess) / 60) / 100);
    const pkg = database().client_packages.find(row => row.id === 201);
    assert.equal(pkg.consumed_minutes, 600); assert.equal(pkg.consumed_quantity, 10);
  }
});

test('repeated one-minute allocations derive original and target hour snapshots from cumulative minutes', async () => {
  const db = database(); const source = db.client_packages.find(row => row.id === 201);
  Object.assign(source, { purchased_quantity: 1, purchased_minutes: 60, consumed_quantity: 0, consumed_minutes: 0, held_quantity: 0.1667, held_minutes: 10 });
  db.client_packages.push({ id: 299, client_id: 1, service_id: 101, name: 'باقة دقائق مستهدفة', billing_unit: 'hour', purchased_quantity: 2, purchased_minutes: 120, consumed_quantity: 0, consumed_minutes: 0, held_quantity: 0, held_minutes: 0, total_price: 0, paid_amount: 0, overage_amount: 0, starts_at: source.starts_at, expires_at: source.expires_at, status: 'active' });
  const template = db.bookings.find(row => row.id === 301);
  db.booking_sessions = [];
  for (let index = 0; index < 10; index += 1) {
    const bookingId = 800 + index;
    db.bookings.push({ ...template, id: bookingId, status: 'in_progress', requested_quantity: 1 / 60 });
    db.booking_sessions.push({ id: 900 + index, booking_id: bookingId, client_id: 1, status: 'active', settlement_version: 1, booking_held_quantity: 1 / 60, started_at: template.date + ' 13:00:00' });
  }
  writeDatabase(db);
  for (let index = 0; index < 10; index += 1) {
    const bookingId = 800 + index; const preview = await previewBooking(bookingId, index === 0 ? 52 : 2);
    assert.equal(preview.excess_minutes, 1);
    const result = await completeBooking(bookingId, preview, `repeat-minute-${index}`, { mode: 'existing_package', target_package_id: 299 });
    assert.equal(result.error, null);
  }
  const after = database(); const finalSource = after.client_packages.find(row => row.id === 201); const target = after.client_packages.find(row => row.id === 299);
  assert.equal(finalSource.consumed_minutes, 60); assert.equal(finalSource.consumed_quantity, 1); assert.equal(finalSource.held_minutes, 0);
  assert.equal(target.consumed_minutes, 10); assert.equal(target.consumed_quantity, 0.1667);
  assert.equal(after.package_usage_ledger.filter(row => Number(row.client_package_id) === 299).reduce((sum, row) => sum + Number(row.quantity_minutes || 0), 0), 10);
});

test('package, invoice and project faults rollback byte-for-byte and leave the session active', async () => {
  const scenarios = [
    ['package', { mode: 'new_package', service_id: 101, name: 'باقة اختبار رجوع', purchased_minutes: 60, validity_days: 30, total_price: 0, initial_paid: 0 }],
    ['invoice', { mode: 'custom_invoice', description: 'فاتورة اختبار رجوع', amount: 250 }],
    ['project', { mode: 'custom_project', name: 'مشروع اختبار رجوع', description: 'تفاصيل', amount: 300 }],
  ];
  for (const [point, settlement] of scenarios) {
    resetDemoDatabase(); const preview = await startAndPreview(); const before = JSON.stringify(database());
    const result = await completeBooking(301, preview, `rollback-${point}`, settlement, { __test_fail_at: point });
    assert.equal(result.error?.code, 'settlement_fault_injected'); assert.equal(JSON.stringify(database()), before);
    assert.equal(database().booking_sessions.find(row => row.booking_id === 301).status, 'active');
  }
});

test('admin template terms and changed target validity are revalidated without writes', async () => {
  const preview = await startAndPreview(); activateDemoMode('admin'); const beforeAdmin = JSON.stringify(database());
  const admin = await complete(preview, 'admin-custom-template', { mode: 'new_package', service_id: 101, name: 'شروط معدلة', purchased_minutes: 60, validity_days: 90, total_price: 12000, initial_paid: 0 });
  assert.equal(admin.error?.code, 'custom_package_terms_forbidden'); assert.equal(JSON.stringify(database()), beforeAdmin);
  activateDemoMode('owner'); resetDemoDatabase(); let db = database(); const source = db.client_packages.find(row => row.id === 201);
  db.client_packages.push({ id: 299, client_id: 1, service_id: 101, name: 'باقة ستنتهي', billing_unit: 'hour', purchased_quantity: 2, consumed_quantity: 0, held_quantity: 0, total_price: 0, paid_amount: 0, overage_amount: 0, starts_at: source.starts_at, expires_at: source.expires_at, status: 'active' }); writeDatabase(db);
  const targetPreview = await startAndPreview(); db = database(); db.client_packages.find(row => row.id === 299).status = 'archived'; writeDatabase(db); const changedBaseline = JSON.stringify(database());
  const changed = await complete(targetPreview, 'target-expired', { mode: 'existing_package', target_package_id: 299 });
  assert.equal(changed.error?.code, 'stale_settlement_preview'); assert.equal(JSON.stringify(database()), changedBaseline);
});

test('non-hour and no-hold bookings cannot start in demo and stay unchanged', async () => {
  const db = database(); const booking = db.bookings.find(row => row.id === 304); const pkg = db.client_packages.find(row => row.id === 205);
  booking.date = db.bookings.find(row => row.id === 301).date; booking.status = 'confirmed'; pkg.held_quantity = 1; writeDatabase(db);
  await demoClient.request('/studio-sessions/active');
  const before = JSON.stringify(database()); const unsupported = await demoClient.request('/bookings/304/session/start', { method: 'POST' });
  assert.equal(unsupported.error?.code, 'unsupported_session_package'); assert.equal(JSON.stringify(database()), before);
  const noHoldDb = database(); Object.assign(noHoldDb.client_packages.find(row => row.id === 205), { billing_unit: 'hour', purchased_minutes: 60, held_minutes: 0, consumed_minutes: 0, payment_due_minutes: 0, held_quantity: 0 }); writeDatabase(noHoldDb);
  const noHoldBefore = JSON.stringify(database()); const noHold = await demoClient.request('/bookings/304/session/start', { method: 'POST' });
  assert.equal(noHold.error?.code, 'missing_package_hold'); assert.equal(JSON.stringify(database()), noHoldBefore);
});

test('migration, UI and server expose safe auditable settlement contracts', async () => {
  const [migration, dialog, api, php, packages, client] = await Promise.all([load('database/mysql/019_session_overage_settlements.sql'), load('src/erp/ERPStopSessionDialog.jsx'), load('api/index.php'), load('api/session_settlement.php'), load('src/erp/ERPPackages.jsx'), load('src/pages/ClientDashboard.jsx')]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS session_settlements/); assert.match(migration, /UNIQUE KEY uq_session_settlement_idempotency/); assert.match(migration, /session_settlement_allocations/); assert.match(migration, /consumed_minutes/); assert.match(migration, /quantity_minutes/);
  assert.match(dialog, /فتح باقة جديدة/); assert.match(dialog, /احتساب بنظام آخر/); assert.match(dialog, /التغاضي عن الوقت الزائد/); assert.match(dialog, /session-coverage__bar/);
  assert.match(api, /session\/settlement-preview/); assert.match(php, /FOR UPDATE/); assert.match(php, /idempotency_payload_mismatch/); assert.match(php, /settlement_preview_required/); assert.match(php, /stale_settlement_preview/); assert.match(php, /settlement_owner_required/); assert.match(php, /package_overdraft_prevented/);
  assert.match(packages, /تسويات الوقت/); assert.match(client, /client-session-settlement/); assert.doesNotMatch(api.match(/'session_settlements' =>[^\n]+/)?.[0] || '', /internal_reason/);
});
