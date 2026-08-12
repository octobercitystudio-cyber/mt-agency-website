import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { anchorPackageDraftToBookings, packageDraftExpiry, templateToPackageDraft } from '../src/lib/clientPackageDraft.js';

const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
};

test('15-day validity includes the first booking day and every calendar day including Friday', () => {
  const draft = { starts_at: '2026-09-03', validity_days: 15, validity_mode_snapshot: 'rolling' };
  assert.equal(packageDraftExpiry(draft), '2026-09-17');
  const anchored = anchorPackageDraftToBookings({ ...draft, starts_at: '' }, [
    { date: '2026-09-10' },
    { date: '2026-09-03' },
  ]);
  assert.equal(anchored.starts_at, '2026-09-03');
  assert.equal(anchored.expires_at, '2026-09-17');
});

test('package saved without appointments activates on its first confirmed booking', async () => {
  browserGlobals();
  resetDemoDatabase(); activateDemoMode('owner');
  const service = (await demoClient.from('services').select('*')).data.find(row => Number(row.id) === 101);
  const draft = templateToPackageDraft(service, { clientId: 1, startsAt: '' });
  const sale = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({
    ...draft,
    validity_days: 15,
    starts_at: '',
    expires_at: '',
    bookings: [],
    idempotency_key: 'first-booking-validity-pending-001',
  }) });
  assert.equal(sale.error, null);
  let packages = (await demoClient.from('client_packages').select('*')).data;
  let created = packages.find(row => Number(row.id) === Number(sale.data.id));
  assert.equal(created.starts_at, null);
  assert.equal(created.expires_at, null);
  assert.equal(Number(created.validity_days_snapshot), 15);

  const booking = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({
    client_id: 1,
    client_package_id: created.id,
    service_id: 101,
    resource_id: 1,
    service: created.name,
    date: '2026-09-03',
    start_time: '12:00',
    end_time: '13:00',
    status: 'confirmed',
  }) });
  assert.equal(booking.error, null);
  packages = (await demoClient.from('client_packages').select('*')).data;
  created = packages.find(row => Number(row.id) === Number(sale.data.id));
  assert.equal(created.starts_at, '2026-09-03');
  assert.equal(created.expires_at, '2026-09-17');
  deactivateDemoMode();
});

test('sale with appointments anchors immediately to the earliest photography booking', async () => {
  browserGlobals();
  resetDemoDatabase(); activateDemoMode('owner');
  const service = (await demoClient.from('services').select('*')).data.find(row => Number(row.id) === 101);
  const draft = templateToPackageDraft(service, { clientId: 2, startsAt: '' });
  const bookings = [
    { resource_id: 1, date: '2026-10-10', start_time: '12:00', end_time: '13:00' },
    { resource_id: 1, date: '2026-10-03', start_time: '12:00', end_time: '13:00' },
  ];
  const anchored = anchorPackageDraftToBookings({ ...draft, validity_days: 15 }, bookings);
  const sale = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({
    ...anchored,
    bookings,
    idempotency_key: 'first-booking-validity-anchored-001',
  }) });
  assert.equal(sale.error, null);
  const created = (await demoClient.from('client_packages').select('*')).data.find(row => Number(row.id) === Number(sale.data.id));
  assert.equal(created.starts_at, '2026-10-03');
  assert.equal(created.expires_at, '2026-10-17');
  deactivateDemoMode();
});

test('demo includes a pending-activation package for the sold row and details views', async () => {
  browserGlobals(); resetDemoDatabase(); activateDemoMode('owner');
  const pkg = (await demoClient.from('client_packages').select('*')).data.find(row => Number(row.id) === 209);
  assert.ok(pkg); assert.equal(pkg.starts_at, null); assert.equal(pkg.expires_at, null); assert.equal(Number(pkg.validity_days_snapshot), 14);
  const details = await demoClient.request('/client-packages/209/details', { method: 'GET' });
  assert.equal(details.error, null); assert.equal(details.data.validity.state, 'pending_activation'); assert.equal(details.data.validity.starts_at, null); assert.equal(details.data.validity.friday_included, true);
  deactivateDemoMode();
});

test('production schema and API require the first-booking validity contract', () => {
  const api = fs.readFileSync(new URL('../api/index.php', import.meta.url), 'utf8');
  const migration = fs.readFileSync(new URL('../database/mysql/026_package_first_booking_validity.sql', import.meta.url), 'utf8');
  assert.match(migration, /MODIFY starts_at DATE NULL/);
  assert.match(migration, /MODIFY expires_at DATE NULL/);
  assert.match(migration, /validity_days_snapshot/);
  assert.match(api, /function packageValidityEnd/);
  assert.match(api, /max\(1,\$validityDays\)-1/);
  assert.match(api, /function activatePackageOnFirstBooking/);
  assert.match(api, /026_package_first_booking_validity\.sql/);
});
