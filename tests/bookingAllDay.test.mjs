import assert from 'node:assert/strict';
import test from 'node:test';
import { createBusinessTimeOptions, isValidBusinessBooking, time12To24, time24To12Parts } from '../src/lib/businessFormat.js';
import { validatePackageAppointment } from '../src/lib/packageSaleAppointments.js';
import { clientDurationError, resolveClientBookingTime } from '../src/pages/clientBookingTime.js';

test('booking times cover the entire day while blank input defaults to evening', () => {
  for (const [start, end] of [['00:00', '01:00'], ['08:00', '09:15'], ['12:00', '13:00'], ['23:00', '24:00'], ['00:00', '24:00']]) {
    assert.equal(isValidBusinessBooking(start, end), true);
    assert.deepEqual(validatePackageAppointment({ date: '2027-01-08', resource_id: 1, start_time: start, end_time: end }, { nowKey: '2027-01-01 00:00' }), {});
  }
  assert.equal(isValidBusinessBooking('23:00', '01:00'), false);
  assert.equal(isValidBusinessBooking('00:00', '00:15'), false);
  assert.equal(isValidBusinessBooking('24:00', '24:00'), false);
  const options = createBusinessTimeOptions();
  assert.equal(options[0].value, '00:00');
  assert.equal(options.at(-1).value, '24:00');
  assert.equal(options.length, 97);
  assert.equal(time24To12Parts('').period, 'pm');
  assert.equal(time12To24('2:00'), '14:00');
  assert.equal(time12To24('2:00', 'am'), '02:00');
});

test('client time entry supports morning and a full day without spilling into another date', () => {
  const slots = [{ start_time: '00:00', end_time: '24:00', resource_id: 1 }, { start_time: '08:00', end_time: '09:30', resource_id: 1 }];
  assert.equal(clientDurationError(1440), '');
  assert.equal(clientDurationError(1470), 'duration_too_long');
  assert.equal(resolveClientBookingTime({ startTime: '00:00', durationMinutes: 1440, slots }).slot?.resource_id, 1);
  assert.equal(resolveClientBookingTime({ startTime: '08:00', durationMinutes: 90, slots }).slot?.resource_id, 1);
  assert.equal(resolveClientBookingTime({ startTime: '01:00', durationMinutes: 1440, slots }).errorCode, 'after_midnight');
});

test('Friday availability includes midnight and morning; saved requests still respect blocks and package validity', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  const { demoClient, resetDemoDatabase, activateDemoMode, deactivateDemoMode } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const key = 'mt_agency_erp_demo_v12';
  const db = JSON.parse(storage.get(key));
  const pkg = db.client_packages.find(p => p.id === 201);
  Object.assign(pkg, { starts_at: '2027-01-01', expires_at: '2027-01-31', purchased_quantity: 40, purchased_minutes: 2400, held_quantity: 0, held_minutes: 0, consumed_quantity: 0, consumed_minutes: 0 });
  db.bookings = []; db.booking_blocks = []; db.booking_slots = []; db.package_usage_ledger = [];
  storage.set(key, JSON.stringify(db));
  const request = (route, body) => demoClient.request(route, { method: 'POST', body: JSON.stringify(body) });
  const availability = minutes => demoClient.request(`/client/booking-availability?client_package_id=201&duration_minutes=${minutes}&days=1&start_date=2027-01-08`);
  const full = await availability(1440);
  assert.equal(full.error, null); assert.deepEqual(full.data.days[0].slots.map(s => [s.start_time, s.end_time]), [['00:00', '24:00']]);
  const morning = await availability(60);
  assert.equal(morning.data.days[0].slots.length, 24);
  const slot = morning.data.days[0].slots.find(s => s.start_time === '08:00');
  const body = { ...slot, date: '2027-01-08', client_package_id: 201, service_id: 101, duration_minutes: 60 };
  const saved = await request('/bookings/request', body); assert.equal(saved.error, null);
  activateDemoMode('owner');
  const block = await request('/booking-blocks', { date: body.date, resource_id: slot.resource_id, start_time: '08:00', end_time: '09:00', idempotency_key: 'friday-morning-block-0001' });
  assert.equal(block.error, null);
  activateDemoMode('client');
  assert.equal((await availability(60)).data.days[0].slots.some(s => s.start_time === '08:00'), false);
  assert.equal((await request('/bookings/request', body)).error?.code, 'booking_conflict');
  const expired = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=1&start_date=2027-02-05');
  assert.equal(expired.data.days[0].available, false);
  deactivateDemoMode();
});
