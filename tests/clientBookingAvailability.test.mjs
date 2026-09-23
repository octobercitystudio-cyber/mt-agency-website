import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { clientDurationMinutesFromDraft, clientDurationError, normalizeClientMinuteDraft, resolveClientBookingTime } from '../src/pages/clientBookingTime.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

const installBrowserStubs = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
};

test('client availability demo is private, role scoped, bounded, and keeps pending requests non-blocking', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const path = '/client/booking-availability?client_package_id=201&duration_minutes=60&days=21';
  const result = await demoClient.request(path, { method: 'GET' });
  assert.equal(result.error, null);
  assert.deepEqual(Object.keys(result.data).sort(), ['booking_policy', 'days', 'duration_minutes', 'package', 'server_time']);
  assert.deepEqual(Object.keys(result.data.package).sort(), ['available_quantity', 'billing_unit', 'booking_increment_minutes', 'expires_at', 'id', 'minimum_booking_minutes', 'name', 'starts_at']);
  assert.ok(result.data.days.length === 21);
  assert.ok(result.data.days.filter(day => new Date(`${day.date}T12:00:00`).getDay() === 5).every(day => !day.available && !day.slots.length), 'Friday is closed for clients');
  for (const day of result.data.days) {
    assert.deepEqual(Object.keys(day).sort(), ['available', 'busy_intervals', 'date', 'has_client_booking', 'slots', 'unavailable_reason']);
    for (const slot of day.slots) {
      assert.deepEqual(Object.keys(slot).sort(), ['end_time', 'resource_id', 'start_time']);
      assert.equal(slot.start_time.slice(3, 5), '00', 'client starts are offered on whole hours only');
      assert.ok(['00', '30'].includes(slot.end_time.slice(3, 5)), 'client ends are offered on the half-hour grid');
      for (const privateKey of ['client_id', 'client_name', 'booking_id', 'block_id', 'title', 'status', 'notes', 'resource_name', 'busy']) assert.equal(privateKey in slot, false);
    }
  }
  const chosenDay = result.data.days.find(day => day.slots.length);
  assert.ok(chosenDay, 'the demo must expose at least one safe slot');
  const chosen = chosenDay.slots[0];
  const pending = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 999, client_package_id: 201, service_id: 101, resource_id: chosen.resource_id, date: chosenDay.date, start_time: chosen.start_time, end_time: chosen.end_time, duration_minutes: 60, status: 'confirmed' }) });
  assert.equal(pending.error, null);
  assert.equal(pending.data.client_id, 1, 'the authenticated demo client, not a submitted id, owns the request');
  assert.equal(pending.data.status, 'pending');
  const afterPending = await demoClient.request(path, { method: 'GET' });
  const ownDay = afterPending.data.days.find(day => day.date === chosenDay.date);
  assert.equal(ownDay.has_client_booking, true); assert.equal(ownDay.unavailable_reason, 'already_booked'); assert.deepEqual(ownDay.slots, []);
  assert.deepEqual(ownDay.busy_intervals, chosenDay.busy_intervals, 'pending blocks this customer date but does not reserve shared capacity');

  const wrongPackage = await demoClient.request('/client/booking-availability?client_package_id=203&duration_minutes=60&days=7');
  assert.equal(wrongPackage.error?.code, 'invalid_package');
  const insufficient = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=180&days=7');
  assert.equal(insufficient.error?.code, 'insufficient_package_balance');
  const invalidIncrement = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=70&days=7');
  assert.equal(invalidIncrement.error?.code, 'invalid_booking_duration');
  const overWindow = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=32');
  assert.equal(overWindow.error?.code, 'availability_window_out_of_range');
  activateDemoMode('owner');
  const forbidden = await demoClient.request(path, { method: 'GET' });
  assert.equal(forbidden.error?.code, 'forbidden');
  deactivateDemoMode();
});

test('requested hours must fit one continuous same-day slot and are never split across gaps', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');

  const baseline = await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=120&days=21');
  assert.equal(baseline.error, null);

  activateDemoMode('owner');
  const bookings = (await demoClient.from('bookings').select('*')).data;
  const target = baseline.data.days.find(day => day.available && !bookings.some(booking => booking.date === day.date));
  assert.ok(target, 'the fixture must have an otherwise empty bookable day');

  const alternatingBlocks = [
    ['00:00', '01:00'], ['02:00', '03:00'], ['04:00', '05:00'],
    ['06:00', '07:00'], ['08:00', '09:00'], ['10:00', '11:00'],
    ['12:00', '13:00'], ['14:00', '15:00'], ['16:00', '17:00'],
    ['18:00', '19:00'], ['20:00', '21:00'], ['22:00', '23:00'],
  ];
  for (const [index, [start_time, end_time]] of alternatingBlocks.entries()) {
    const blocked = await demoClient.request('/booking-blocks', {
      method: 'POST',
      body: JSON.stringify({
        date: target.date,
        start_time,
        end_time,
        resource_id: 1,
        repeat_daily: false,
        idempotency_key: `continuous-client-booking-${target.date}-${index}`,
      }),
    });
    assert.equal(blocked.error, null);
  }

  activateDemoMode('client');
  const twoHours = await demoClient.request(`/client/booking-availability?client_package_id=201&duration_minutes=120&days=1&start_date=${target.date}`);
  assert.equal(twoHours.error, null);
  assert.equal(twoHours.data.days[0].available, false, 'separate one-hour gaps must not be combined into a two-hour appointment');
  assert.deepEqual(twoHours.data.days[0].slots, []);

  const oneHour = await demoClient.request(`/client/booking-availability?client_package_id=201&duration_minutes=60&days=1&start_date=${target.date}`);
  assert.equal(oneHour.error, null);
  assert.equal(oneHour.data.days[0].available, true, 'a genuinely continuous one-hour gap remains bookable');
  for (const slot of oneHour.data.days[0].slots) {
    const [startHour, startMinute] = slot.start_time.split(':').map(Number);
    const endMinutes = slot.end_time === '24:00' ? 1440 : slot.end_time.split(':').map(Number).reduce((hour, minute) => (hour * 60) + minute);
    assert.equal(endMinutes - ((startHour * 60) + startMinute), 60, 'every suggestion must be one exact continuous interval');
  }
  deactivateDemoMode();
});

test('legacy quarter-hour occupancy blocks overlapping whole-hour client candidates', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const baseline = (await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=21')).data;
  const target = baseline.days.find(day => day.slots.some(slot => slot.start_time === '12:00'));
  assert.ok(target, 'the fixture must include a noon candidate before the legacy overlap');
  const database = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12'));
  database.resources.filter(resource => Number(resource.is_active ?? 1) === 1).forEach((resource, index) => database.bookings.push({
    id: 9900 + index, organization_id: 1, client_id: 2, resource_id: resource.id, date: target.date,
    start_time: '12:15', end_time: '13:15', status: 'confirmed', client_name: 'محجوب عن العميل',
  }));
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(database));
  const updated = (await demoClient.request(`/client/booking-availability?client_package_id=201&duration_minutes=60&days=1&start_date=${target.date}`)).data.days[0];
  assert.equal(updated.slots.some(slot => slot.start_time === '12:00'), false);
  deactivateDemoMode();
});

test('final submit rechecks a stale availability snapshot and returns a conflict', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const path = '/client/booking-availability?client_package_id=201&duration_minutes=60&days=21';
  const availability = (await demoClient.request(path)).data;
  const day = availability.days.find(item => item.slots.length); const slot = day.slots[0];
  activateDemoMode('owner');
  const confirmed = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 2, client_package_id: 203, service_id: 101, resource_id: slot.resource_id, date: day.date, start_time: slot.start_time, end_time: slot.end_time, status: 'confirmed' }) });
  assert.equal(confirmed.error, null);
  activateDemoMode('client');
  const stale = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_package_id: 201, service_id: 101, resource_id: slot.resource_id, date: day.date, start_time: slot.start_time, end_time: slot.end_time, duration_minutes: 60 }) });
  assert.equal(stale.error?.code, 'booking_conflict');
  assert.equal(stale.error?.status, 409);
  deactivateDemoMode();
});

test('production calendar routes require a client and use the shared calendar in both booking flows', async () => {
  const [api, calendarApi, dialog, dashboard, wizard, calendar] = await Promise.all([
    load('api/index.php'), load('api/client_calendar.php'), load('src/pages/ClientBookingDialog.jsx'),
    load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientStudioBooking.jsx'), load('src/components/ClientAvailabilityCalendar.jsx'),
  ]);
  const route = api.slice(api.indexOf("if ($path === '/client/booking-availability'"), api.indexOf("if ($path === '/bookings/request'"));
  assert.match(route, /requireRole\(\$user,\['client'\]\)/);
  assert.match(route, /booking_id/); assert.doesNotMatch(route, /(?:INSERT|UPDATE|DELETE)\s+/i);
  assert.match(calendarApi, /busy_intervals/); assert.match(calendarApi, /requireClientSingleDate/);
  assert.match(dialog, /<ClientAvailabilityCalendar/); assert.match(wizard, /<ClientAvailabilityCalendar/);
  assert.match(dashboard, /<ClientBookingDialog/); assert.match(dialog, /\/reschedule-requests/);
  assert.match(dialog, /event\.key !== 'Tab'/); assert.match(dialog, /node\.setAttribute\('inert', ''\)/);
  assert.match(dialog, /document\.addEventListener\('focusin'/); assert.match(dialog, /trigger\?\.isConnected/);
  assert.match(calendar, /busy_intervals/); assert.doesNotMatch(calendar, /client_name|booking.title|booking.notes/);
});

test('manual client time resolves one exact connected slot and supports opening and closing boundaries', () => {
  const slots = [
    { start_time: '12:00', end_time: '13:00', resource_id: 1 },
    { start_time: '21:00', end_time: '22:00', resource_id: 2 },
    { start_time: '13:00', end_time: '13:30', resource_id: 1 },
    { start_time: '13:30', end_time: '14:00', resource_id: 1 },
  ];
  assert.equal(resolveClientBookingTime({ startTime: '12:00', durationMinutes: 60, slots }).slot?.resource_id, 1);
  assert.equal(resolveClientBookingTime({ startTime: '21:00', durationMinutes: 60, slots }).endTime, '22:00');
  assert.equal(resolveClientBookingTime({ startTime: '21:00', durationMinutes: 60, slots }).slot?.resource_id, 2);
  assert.equal(resolveClientBookingTime({ startTime: '13:00', durationMinutes: 60, slots }).errorCode, 'unavailable', 'separate half-hour suggestions are never composed');
  assert.equal(resolveClientBookingTime({ startTime: '12:30', durationMinutes: 60, slots }).errorCode, 'start_grid_invalid');
  assert.equal(resolveClientBookingTime({ startTime: '21:00', durationMinutes: 90, slots }).errorCode, 'outside_hours');
});

test('duration keeps real typing drafts and commits minutes to zero or thirty', () => {
  let minuteDraft = '';
  minuteDraft += '3';
  assert.equal(clientDurationMinutesFromDraft('0', minuteDraft), 3);
  assert.equal(clientDurationError(clientDurationMinutesFromDraft('0', minuteDraft)), 'duration_too_short');
  minuteDraft += '0';
  assert.equal(clientDurationMinutesFromDraft('0', minuteDraft), 30, 'sequential typing must form 30 rather than normalize the first digit away');
  assert.equal(clientDurationError(clientDurationMinutesFromDraft('0', minuteDraft)), 'duration_too_short');
  assert.equal(clientDurationError(clientDurationMinutesFromDraft('1', minuteDraft)), '');
  assert.equal(normalizeClientMinuteDraft('3'), '0');
  assert.equal(normalizeClientMinuteDraft('30'), '30');
});

test('calendar selections clear stale availability and retain a visible error and summary', async () => {
  const dialog = await load('src/pages/ClientBookingDialog.jsx');
  assert.match(dialog, /setStartTime\(''\)/); assert.match(dialog, /setAvailability\(emptyAvailability\)/);
  assert.match(dialog, /selectedSlot && <section className="client-booking-summary"/);
  assert.match(dialog, /disabled=\{busy \|\| !selectedSlot \|\| availability.loading/);
  assert.match(dialog, /client-booking-submit-error" role="alert"/);
  assert.match(dialog, /reloadAvailability\(\); setSubmitError\(dateError\)/);
});

test('demo client request independently enforces the whole-hour and half-hour duration contract', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const availability = (await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&days=21')).data;
  assert.equal(availability.package.minimum_booking_minutes, 60);
  assert.equal(availability.package.booking_increment_minutes, 30);
  const day = availability.days.find(item => item.slots.length); const resourceId = day.slots[0].resource_id;
  const base = { client_package_id: 201, service_id: 101, resource_id: resourceId, date: day.date };
  const reject = async (overrides, code) => {
    const result = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ ...base, start_time: '12:00', end_time: '13:00', duration_minutes: 60, ...overrides }) });
    assert.equal(result.error?.code, code);
    assert.equal(result.error?.status, 422);
  };
  await reject({ start_time: '12:15', end_time: '13:15' }, 'client_booking_start_grid_invalid');
  await reject({ start_time: '12:30', end_time: '13:30' }, 'client_booking_start_grid_invalid');
  await reject({ end_time: '12:15' }, 'client_booking_end_grid_invalid');
  await reject({ end_time: '12:45', duration_minutes: 60 }, 'client_booking_end_grid_invalid');
  await reject({ duration_minutes: 15 }, 'client_booking_duration_out_of_range');
  await reject({ duration_minutes: 75 }, 'client_booking_duration_increment_invalid');
  await reject({ duration_minutes: 90 }, 'client_booking_duration_mismatch');
  await reject({ start_time: '23:00', end_time: '01:00', duration_minutes: 120 }, 'client_booking_after_midnight');
  deactivateDemoMode();
});
