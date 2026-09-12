import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
const database = () => JSON.parse([...storage.values()][0]);
const writeDatabase = value => storage.set([...storage.keys()][0], JSON.stringify(value));
test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

const futureDate = offset => { const date = new Date(); date.setDate(date.getDate() + offset); while (date.getDay() === 5) date.setDate(date.getDate() + 1); return date.toLocaleDateString('en-CA'); };
const createBlock = async (date = futureDate(140), duration = 90) => {
  const db = database(); const resourceId = Number(db.resources.find(row => Number(row.is_active ?? 1) === 1).id); const endMinutes = 12 * 60 + duration; const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  const result = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date, resource_id: resourceId, start_time: '12:00', end_time: end, title: 'حجز بيع باقة', idempotency_key: `new-block-${date.replaceAll('-', '')}-${duration}` }) });
  assert.equal(result.error, null); return result.data.items[0];
};
const newPackagePayload = (block, overrides = {}) => ({ client_id: 1, package_mode: 'new_package', idempotency_key: `convert-new-${block.id}-stable`, new_package: { service_id: 101, name: 'باقة جديدة من التقويم', billing_unit: 'hour', quantity: 4, validity_days: 30, payment_due_quantity: 2, deposit_percent_snapshot: 30, overage_price_snapshot: '1400.00', total_price: '5000.00', paid_amount: '1000.00', payment_method: 'cash', notes: 'اتفاق البيع من الحجز المؤقت', ...overrides } });

test('client without eligible packages sells one rolling package and atomically transfers the block', async () => {
  const block = await createBlock(); const before = database(); const counts = Object.fromEntries(['client_packages','bookings','package_usage_ledger','payments','payment_allocations','finance'].map(table => [table, before[table].length])); const oldSlots = before.booking_slots.filter(slot => Number(slot.booking_block_id) === Number(block.id)).length;
  const result = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block)) }); assert.equal(result.error, null); const db = database(); const pkg = db.client_packages.find(row => Number(row.id) === Number(result.data.package_id));
  assert.equal(db.client_packages.length, counts.client_packages + 1); assert.equal(db.bookings.length, counts.bookings + 1); assert.equal(db.package_usage_ledger.length, counts.package_usage_ledger + 2); assert.equal(db.payments.length, counts.payments + 1); assert.equal(db.payment_allocations.length, counts.payment_allocations + 1); assert.equal(db.finance.length, counts.finance + 1);
  assert.equal(oldSlots, block.duration_minutes / 15); assert.equal(db.booking_slots.filter(slot => Number(slot.booking_id) === Number(result.data.booking.id)).length, oldSlots); assert.equal(db.booking_slots.some(slot => Number(slot.booking_block_id) === Number(block.id)), false);
  assert.equal(pkg.held_minutes, block.duration_minutes); assert.equal(pkg.purchased_minutes - pkg.held_minutes, result.data.remaining_minutes); assert.equal(pkg.starts_at, block.block_date); const expected = new Date(`${block.block_date}T12:00:00`); expected.setDate(expected.getDate() + 29); assert.equal(pkg.expires_at, expected.toLocaleDateString('en-CA'));
  const replay = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block)) }); assert.equal(replay.error, null); assert.equal(replay.data.idempotent, true); assert.equal(replay.data.package_id, result.data.package_id); assert.deepEqual(Object.fromEntries(Object.keys(counts).map(table => [table, database()[table].length])), Object.fromEntries(Object.keys(counts).map(table => [table, db[table].length])));
});

test('shooting-day validity is anchored to the block date', async () => {
  const block = await createBlock(futureDate(170), 60); const result = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block, { service_id: 103, name: 'يوم تصوير جديد', quantity: 6, validity_days: 99 })) }); assert.equal(result.error, null); const pkg = database().client_packages.find(row => Number(row.id) === Number(result.data.package_id)); assert.equal(pkg.validity_mode_snapshot, 'shooting_day'); assert.equal(pkg.validity_days_snapshot, 1); assert.equal(pkg.starts_at, block.block_date); assert.equal(pkg.expires_at, block.block_date);
});

test('replay conflicts on changed payload and a new key after conversion has no side effects', async () => {
  const block = await createBlock(futureDate(190), 60); const first = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block, { paid_amount: '0.00' })) }); assert.equal(first.error, null); const snapshot = JSON.stringify(database());
  const changed = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block, { name: 'اسم مختلف', paid_amount: '0.00' })) }); assert.equal(changed.error?.code, 'booking_block_already_converted'); assert.equal(JSON.stringify(database()), snapshot);
  const another = newPackagePayload(block, { paid_amount: '0.00' }); another.idempotency_key = `convert-new-${block.id}-another`; const second = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(another) }); assert.equal(second.error?.code, 'booking_block_already_converted'); assert.equal(JSON.stringify(database()), snapshot);
});

test('new-package conversion rejects invalid templates, balance, schedule, money and payment data without writes', async () => {
  const cases = [
    { service_id: 102, label: 'reel template' }, { service_id: 106, label: 'project template' }, { service_id: 107, label: 'inactive template' },
    { quantity: .5, label: 'too-small balance' }, { total_price: '1e3', label: 'invalid money' }, { paid_amount: '6000.00', label: 'paid above total' }, { payment_method: 'cheque', label: 'invalid method' },
  ];
  for (const [index, invalid] of cases.entries()) { const block = await createBlock(futureDate(220 + index * 2), 60); const before = JSON.stringify(database()); const { label, ...overrides } = invalid; const payload = newPackagePayload(block, { paid_amount: '0.00', ...overrides }); payload.idempotency_key = `reject-new-package-${block.id}-${index}`; const result = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(payload) }); assert.ok(result.error, label); assert.equal(JSON.stringify(database()), before, label); }
  const block = await createBlock(futureDate(250), 60); const db = database(); const service = db.services.find(row => row.id === 101); service.minimum_booking_minutes = 90; writeDatabase(db); const before = JSON.stringify(database()); const badSchedule = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(newPackagePayload(block, { paid_amount: '0.00' })) }); assert.equal(badSchedule.error?.code, 'invalid_booking_time'); assert.equal(JSON.stringify(database()), before);
});

test('fault after staged package creation rolls back every table', async () => {
  const block = await createBlock(futureDate(270), 60); const before = JSON.stringify(database()); const payload = { ...newPackagePayload(block), __test_fail_at: 'finance' }; const result = await demoClient.request(`/booking-blocks/${block.id}/convert`, { method: 'POST', body: JSON.stringify(payload) }); assert.equal(result.error?.code, 'demo_fault_injected'); assert.equal(JSON.stringify(database()), before);
});

test('production conversion contract keeps package sale and slot transfer in one idempotent transaction', async () => {
  const api = await readFile(new URL('../api/index.php', import.meta.url), 'utf8');
  const routeStart = api.indexOf("if (preg_match('#^/booking-blocks/(\\d+)/convert$#'");
  const routeEnd = api.indexOf("if (preg_match('#^/booking-blocks/(\\d+)$#'", routeStart);
  assert.ok(routeStart > 0 && routeEnd > routeStart);
  const route = api.slice(routeStart, routeEnd);

  assert.match(route, /\$payload\['package_mode'\]\?\?'existing_package'/);
  assert.match(route, /\$pdo->beginTransaction\(\)/);
  assert.match(route, /INSERT INTO client_packages/);
  assert.match(route, /insertPackageUsage\([^;]*'opening'/);
  assert.match(route, /insertPackageUsage\([^;]*'hold'/);
  assert.match(route, /UPDATE booking_slots SET booking_id=\?,booking_block_id=NULL/);
  assert.match(route, /\$expectedSlots=intdiv\(\$duration,15\)/);
  assert.match(route, /\$transfer->rowCount\(\)!==\$expectedSlots/);
  assert.match(route, /conversion_idempotency_key/);
  assert.match(route, /conversion_request_hash/);
  assert.match(route, /\(\$error->errorInfo\[1\]\?\?0\)===1062/);
  assert.match(route, /queueClientWhatsAppSummary/);
  assert.match(route, /\$pdo->commit\(\)/);
  assert.doesNotMatch(route, /request\(['"]\/client-packages/);
});
