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

test('client booking hours are noon to ten while admin remains all-day', () => {
  const slots = [{ start_time: '12:00', end_time: '22:00', resource_id: 1 }];
  assert.equal(clientDurationError(600), '');
  assert.equal(clientDurationError(630), 'duration_too_long');
  assert.equal(resolveClientBookingTime({ startTime: '12:00', durationMinutes: 600, slots }).slot?.resource_id, 1);
  assert.equal(resolveClientBookingTime({ startTime: '08:00', durationMinutes: 90, slots }).errorCode, 'start_grid_invalid');
  assert.equal(resolveClientBookingTime({ startTime: '21:00', durationMinutes: 90, slots }).errorCode, 'outside_hours');
});

test('clients cannot request Friday or off-hours even with sufficient package balance', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  const { demoClient, resetDemoDatabase, activateDemoMode, deactivateDemoMode } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const key = 'mt_agency_erp_demo_v12'; const db = JSON.parse(storage.get(key));
  Object.assign(db.client_packages.find(p => p.id === 201), { starts_at: '2027-01-01', expires_at: '2027-01-31', purchased_quantity: 40, purchased_minutes: 2400, held_quantity: 0, held_minutes: 0, consumed_quantity: 0, consumed_minutes: 0 });
  db.bookings = []; db.booking_blocks = []; db.booking_slots = []; db.package_usage_ledger = []; storage.set(key, JSON.stringify(db));
  const request = body => demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify(body) });
  const friday = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=1&start_date=2027-01-08');
  assert.equal(friday.error, null); assert.equal(friday.data.days[0].available, false);
  const saturday = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=1&start_date=2027-01-09');
  assert.equal(saturday.data.days[0].slots.length, 10); assert.equal(saturday.data.days[0].slots[0].start_time, '12:00'); assert.equal(saturday.data.days[0].slots.at(-1).end_time, '22:00');
  const base = { client_package_id: 201, service_id: 101, resource_id: 1, duration_minutes: 60, start_time: '12:00', end_time: '13:00' };
  assert.equal((await request({ ...base, date: '2027-01-08' })).error?.code, 'client_booking_outside_hours');
  assert.equal((await request({ ...base, date: '2027-01-09', start_time: '08:00', end_time: '09:00' })).error?.code, 'client_booking_outside_hours');
  assert.equal((await request({ ...base, date: '2027-01-09' })).error, null);
  deactivateDemoMode();
});
