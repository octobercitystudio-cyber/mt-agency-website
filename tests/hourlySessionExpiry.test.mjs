import assert from 'node:assert/strict';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { clientPackageBlocksPurchase } from '../src/lib/clientPackageEligibility.js';
import { registrationValidityLabel } from '../src/lib/registrationPolicy.js';
import { formatPackageWhatsAppMessage } from '../src/erp/packageWhatsAppSummary.js';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
const database = () => JSON.parse([...storage.values()][0]);
const save = db => storage.set([...storage.keys()][0], JSON.stringify(db));
const post = (path, body = {}) => demoClient.request(path, { method: 'POST', body: JSON.stringify(body) });
const fixture = (category = 'تصوير بالساعة') => {
  const db = database(); const pkg = db.client_packages.find(row => row.id === 201);
  db.services.push({ ...db.services.find(row => row.id === pkg.service_id), id: 991, category });
  Object.assign(pkg, { service_id: 991, purchased_minutes: 120, purchased_quantity: 2, consumed_minutes: 0, consumed_quantity: 0, held_minutes: 60, held_quantity: 1, payment_due_minutes: 0, payment_due_quantity: 0, version: 1 });
  db.bookings = db.bookings.filter(row => row.client_package_id !== 201 || row.id === 301);
  const booking = db.bookings.find(row => row.id === 301);
  Object.assign(booking, { service_id: 991, duration_minutes: 60, requested_quantity: 1, start_time: '12:00', end_time: '13:00', status: 'confirmed' });
  db.package_usage_ledger = db.package_usage_ledger.filter(row => row.client_package_id !== 201);
  db.package_usage_ledger.push({ id: 900, client_package_id: 201, booking_id: 301, movement_type: 'hold', quantity: 1, quantity_minutes: 60, event_key: 'booking:301:hold' });
  save(db); return { pkg, booking };
};
const finish = async (id = 301, actual = 45) => {
  const started = await post(`/bookings/${id}/session/start`); assert.equal(started.error, null);
  const result = await post(`/bookings/${id}/session/complete`, { actual_minutes: actual, idempotency_key: `hourly-expiry-${id}` });
  assert.equal(result.error, null); return result;
};
test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('hourly package expires immediately after ending, retaining actual usage and finances', async () => {
  const { pkg } = fixture();
  assert.equal((await post('/bookings/301/session/start')).error, null);
  assert.equal(database().client_packages.find(row => row.id === 201).status, 'active', 'Starting is not expiry');
  const body = { actual_minutes: 45, idempotency_key: 'hourly-expiry-first' };
  const result = await post('/bookings/301/session/complete', body); assert.equal(result.error, null);
  const after = database().client_packages.find(row => row.id === 201);
  assert.equal(after.status, 'expired'); assert.equal(after.consumed_minutes, 45); assert.equal(after.purchased_minutes, 120); assert.equal(after.held_minutes, 0);
  for (const field of ['total_price', 'paid_amount', 'overage_amount']) assert.equal(after[field], pkg[field]);
  assert.equal(clientPackageBlocksPurchase(after), false, 'Expired hourly package cannot block a new purchase');
  assert.equal(result.data.whatsapp_summary.package_status, 'expired');
  assert.match(formatPackageWhatsAppMessage(result.data.whatsapp_summary), /رصيد غير مستخدم \(انتهت صلاحيته\)/);
  const snapshot = JSON.stringify(database());
  assert.equal((await post('/bookings/301/session/complete', body)).data.idempotent_replay, true);
  assert.equal(JSON.stringify(database()), snapshot, 'Retry does not repeat expiry or settlement');
  assert.equal((await post('/bookings/301/session/start')).error?.code, 'session_already_completed');
});

test('other daily allocations stay active when an hourly session ends', async () => {
  const { pkg, booking } = fixture(); const db = database();
  const future = { ...pkg, id: 299, starts_at: '2099-02-02', expires_at: '2099-02-02' }; db.client_packages.push(future);
  db.bookings.push({ ...booking, id: 399, client_package_id: 299, date: '2099-02-02' }); save(db);
  await finish();
  assert.equal(database().client_packages.find(row => row.id === 201).status, 'expired');
  assert.deepEqual(database().client_packages.find(row => row.id === 299), future);
});

test('legacy shared package closes after its last booked session and preserves future holds', async () => {
  const { booking } = fixture(); const db = database(); const pkg = db.client_packages.find(row => row.id === 201);
  Object.assign(pkg, { held_minutes: 120, held_quantity: 2 });
  db.bookings.push({ ...booking, id: 399, start_time: '14:00', end_time: '15:00' });
  db.package_usage_ledger.push({ id: 901, client_package_id: 201, booking_id: 399, movement_type: 'hold', quantity: 1, quantity_minutes: 60 }); save(db);
  await finish();
  const first = database().client_packages.find(row => row.id === 201); assert.equal(first.status, 'active'); assert.equal(first.held_minutes, 60);
  await finish(399);
  const last = database().client_packages.find(row => row.id === 201); assert.equal(last.status, 'expired'); assert.equal(last.consumed_minutes, 90);
});

test('monthly hour-billed packages keep their existing validity', async () => {
  for (const category of ['باقة شهرية']) {
    resetDemoDatabase(); const { pkg } = fixture(category); await finish();
    const after = database().client_packages.find(row => row.id === 201); assert.equal(after.status, 'active', category); assert.equal(after.expires_at, pkg.expires_at);
  }
});

test('daily packages expire after early or full completion without changing payment or actual usage', async () => {
  for (const minutes of [45, 120]) {
    resetDemoDatabase(); const { pkg, booking } = fixture('باقة يومية');
    const db = database(); Object.assign(db.client_packages.find(row => row.id === 201), { validity_mode_snapshot: 'shooting_day', starts_at: booking.date, expires_at: booking.date }); save(db);
    await finish(301, minutes);
    const after = database().client_packages.find(row => row.id === 201);
    assert.equal(after.status, 'expired'); assert.equal(after.consumed_minutes, minutes);
    assert.equal(after.purchased_minutes, 120); assert.equal(after.total_price, pkg.total_price); assert.equal(after.paid_amount, pkg.paid_amount);
    assert.equal(clientPackageBlocksPurchase(after), false);
  }
});

test('sold daily validity snapshot still expires after the service category changes', async () => {
  fixture('باقة شهرية'); const db = database(); db.client_packages.find(row => row.id === 201).validity_mode_snapshot = 'shooting_day'; save(db);
  await finish(); assert.equal(database().client_packages.find(row => row.id === 201).status, 'expired');
});

test('zero-minute daily cancellation keeps the package available', async () => {
  fixture('باقة يومية'); await finish(301, 0); assert.equal(database().client_packages.find(row => row.id === 201).status, 'active');
});

test('cancelled zero-minute session does not expire the hourly package', async () => {
  fixture(); await finish(301, 0); assert.equal(database().client_packages.find(row => row.id === 201).status, 'active');
});

test('hourly package created to settle extra session time also expires on completion', async () => {
  fixture('باقة شهرية'); const db = database(); db.services.push({ ...db.services.find(row => row.id === 991), id: 992, category: 'تصوير بالساعة' }); save(db);
  assert.equal((await post('/bookings/301/session/start')).error, null);
  const preview = await post('/bookings/301/session/settlement-preview', { actual_minutes: 150 }); assert.equal(preview.error, null);
  const result = await post('/bookings/301/session/complete', { actual_minutes: 150, expected_session_version: preview.data.session_version, preview_hash: preview.data.preview_hash, idempotency_key: 'hourly-target-package', settlement: { mode: 'new_package', service_id: 992, name: 'تصوير بالساعة', purchased_minutes: 60, validity_days: 30, total_price: '300.00', initial_paid: '150.00' } });
  assert.equal(result.error, null);
  const pkg = database().client_packages.find(row => row.id === result.data.target_package_id);
  assert.equal(pkg.status, 'expired'); assert.equal(pkg.consumed_minutes, 30); assert.equal(Number(pkg.paid_amount), 150);
  assert.equal(database().client_packages.find(row => row.id === 201).status, 'active', 'Original monthly package keeps its own validity');
});

test('hourly checkout explains session expiry and preserves independently scheduled dates', () => {
  assert.match(registrationValidityLabel({ kind: 'hourly' }), /بانتهاء جلسة التصوير/);
  assert.match(registrationValidityLabel({ kind: 'hourly' }), /المواعيد القادمة مستقلة/);
  assert.match(registrationValidityLabel({ kind: 'monthly', validity_days: 30 }), /30/);
  assert.match(registrationValidityLabel({ kind: 'daily' }), /تنتهي بانتهاء جلسة التصوير/);
});
