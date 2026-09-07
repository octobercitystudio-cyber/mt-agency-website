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
  assert.deepEqual(Object.keys(result.data).sort(), ['days', 'duration_minutes', 'package', 'server_time']);
  assert.deepEqual(Object.keys(result.data.package).sort(), ['available_quantity', 'billing_unit', 'booking_increment_minutes', 'expires_at', 'id', 'minimum_booking_minutes', 'name', 'starts_at']);
  assert.ok(result.data.days.length === 21);
  assert.ok(result.data.days.some(day => !day.available && new Date(`${day.date}T12:00:00`).getDay() === 5), 'Friday must be closed without a reason field');
  for (const day of result.data.days) {
    assert.deepEqual(Object.keys(day).sort(), ['available', 'date', 'slots']);
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
  assert.ok(afterPending.data.days.find(day => day.date === chosenDay.date).slots.some(slot => slot.start_time === chosen.start_time && slot.end_time === chosen.end_time), 'pending does not reserve capacity');

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
  const baseline = (await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=30&days=21')).data;
  const target = baseline.days.find(day => day.slots.some(slot => slot.start_time === '12:00'));
  assert.ok(target, 'the fixture must include a noon candidate before the legacy overlap');
  const database = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12'));
  database.resources.filter(resource => Number(resource.is_active ?? 1) === 1).forEach((resource, index) => database.bookings.push({
    id: 9900 + index, organization_id: 1, client_id: 2, resource_id: resource.id, date: target.date,
    start_time: '12:15', end_time: '12:45', status: 'confirmed', client_name: 'محجوب عن العميل',
  }));
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(database));
  const updated = (await demoClient.request(`/client/booking-availability?client_package_id=201&duration_minutes=30&days=1&start_date=${target.date}`)).data.days[0];
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

test('production availability route and guided UI enforce the privacy contract without schema changes', async () => {
  const [api, dialog, dashboard, css, demo, requests] = await Promise.all([
    load('api/index.php'), load('src/pages/ClientBookingDialog.jsx'), load('src/pages/ClientDashboard.jsx'),
    load('src/pages/ClientDashboard.css'), load('src/lib/demoDataClient.js'), load('src/erp/ERPRequests.jsx'),
  ]);
  const route = api.slice(api.indexOf("if ($path === '/client/booking-availability'"), api.indexOf("if ($path === '/bookings/request'"));
  assert.match(route, /requireRole\(\$user,\['client'\]\)/);
  assert.match(api, /function clientBookingAvailability/);
  assert.match(api, /FROM booking_slots bs JOIN bookings b/);
  assert.match(api, /cp\.id=\? AND cp\.client_id=\? AND cp\.organization_id=\?/);
  assert.match(api, /status IN \('confirmed','in_progress','cancel_requested','late_cancel_requested'\)/);
  assert.match(api, /booking_blocks[\s\S]*status='active'/);
  assert.match(api, /windowDays=max\(\$minimumWindow,min\(\$maximumWindow,\$windowDays\)\)/);
  assert.match(api, /'slots'=>\$slots/);
  assert.doesNotMatch(api.slice(api.indexOf('function clientBookingAvailability'), route.length + api.indexOf('function clientBookingAvailability')), /client_name|booking_id|block_id|resource_name/);
  assert.match(demo, /route === '\/client\/booking-availability'/);
  assert.match(dialog, /احجز موعد تصوير/);
  assert.match(dialog, /الطلب يحتاج موافقة الإدارة/);
  assert.match(dialog, /تتسع لمدة الجلسة كاملة ومتّصلة في اليوم نفسه، ولا يتم تقسيم الساعات/);
  assert.match(dialog, /type="number"[^>]+inputMode="numeric"/);
  assert.match(dialog, /هذا الموعد لم يعد متاحًا، اختر موعدًا آخر/);
  assert.match(dialog, /aria-live="polite"/);
  assert.match(dashboard, /<ClientBookingDialog/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /client-booking-concierge[\s\S]*margin-bottom:76px/);
  assert.match(requests, /bookingPackageName\(item\)/);
  assert.match(requests, /المدة المطلوبة: \$\{formatDurationMinutes/);
  assert.match(dialog, /className="client-booking-submit-error" role="alert" aria-live="assertive"/);
  assert.ok(dialog.indexOf('client-booking-submit-error') < dialog.indexOf('<form onSubmit={submit}'), 'the persistent error region stays above changing availability content');
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(dialog, /node\.setAttribute\('inert', ''\)/);
  assert.match(dialog, /document\.addEventListener\('focusin'/);
  assert.match(dialog, /trigger\?\.isConnected/);
  assert.doesNotMatch(dashboard, /navigateClient\('schedule'\); setBookingOpen\(true\)/);
  assert.match(css, /client-booking-submit\{background:#2676c9!important/);
  assert.match(css, /client-booking-submit-error\{position:sticky;top:0;z-index:4/);
  assert.match(css, /client-booking-package-list small[\s\S]*font-size:12px!important/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.client-spin\{animation:none!important/);
  assert.match(requests, /requestedDurationMinutes = item/);
  assert.match(requests, /calculateDurationMinutes\(start, end\)/);
  assert.match(demo, /demoRole === 'client' \|\| status === 'confirmed'/);
  assert.match(api, /\$user\['role'\]==='client'\|\|\$status==='confirmed'/);
  assert.match(api, /validateClientBookingTimeGrid/);
  assert.match(api, /client_booking_start_grid_invalid/);
  assert.match(api, /client_booking_duration_mismatch/);
  assert.match(dialog, /<BusinessTimeSelect[^>]+step=\{60\}/);
  assert.match(dialog, /ينتهي الموعد|النهاية/);
  assert.match(dialog, /الدقائق ثابتة/);
  assert.doesNotMatch(dialog, /client-available-slots[^\n]+\.map/);
  assert.doesNotMatch(route, /(?:INSERT|UPDATE|DELETE)\s+/i);
});

test('manual client time resolves one exact connected slot and supports opening and closing boundaries', () => {
  const slots = [
    { start_time: '12:00', end_time: '12:30', resource_id: 1 },
    { start_time: '23:00', end_time: '24:00', resource_id: 2 },
    { start_time: '13:00', end_time: '13:30', resource_id: 1 },
    { start_time: '13:30', end_time: '14:00', resource_id: 1 },
  ];
  assert.equal(resolveClientBookingTime({ startTime: '12:00', durationMinutes: 30, slots }).slot?.resource_id, 1);
  assert.equal(resolveClientBookingTime({ startTime: '23:00', durationMinutes: 60, slots }).endTime, '24:00');
  assert.equal(resolveClientBookingTime({ startTime: '23:00', durationMinutes: 60, slots }).slot?.resource_id, 2);
  assert.equal(resolveClientBookingTime({ startTime: '13:00', durationMinutes: 60, slots }).errorCode, 'unavailable', 'separate half-hour suggestions are never composed');
  assert.equal(resolveClientBookingTime({ startTime: '12:30', durationMinutes: 30, slots }).errorCode, 'start_grid_invalid');
  assert.equal(resolveClientBookingTime({ startTime: '23:00', durationMinutes: 90, slots }).errorCode, 'after_midnight');
});

test('duration keeps real typing drafts and commits minutes to zero or thirty', () => {
  let minuteDraft = '';
  minuteDraft += '3';
  assert.equal(clientDurationMinutesFromDraft('0', minuteDraft), 3);
  assert.equal(clientDurationError(clientDurationMinutesFromDraft('0', minuteDraft)), 'duration_too_short');
  minuteDraft += '0';
  assert.equal(clientDurationMinutesFromDraft('0', minuteDraft), 30, 'sequential typing must form 30 rather than normalize the first digit away');
  assert.equal(clientDurationError(clientDurationMinutesFromDraft('0', minuteDraft)), '');
  assert.equal(normalizeClientMinuteDraft('3'), '0');
  assert.equal(normalizeClientMinuteDraft('30'), '30');
});

test('client manual input clears stale availability and uses truthful whole-hour help with large period controls', async () => {
  const [dialog, control, css] = await Promise.all([
    load('src/pages/ClientBookingDialog.jsx'), load('src/components/BusinessTimeSelect.jsx'), load('src/components/BusinessTimeSelect.css'),
  ]);
  assert.match(dialog, /example="2:00"/);
  assert.doesNotMatch(dialog, /example="2:30"|مثال صحيح: 1:30/);
  assert.match(dialog, /value=\{minutes\} onChange=\{event => updateDurationDraft\(hours, event\.target\.value\)\}/);
  assert.match(control, /setErrorMessage\(message\);\s*emit\(event, ''\)/);
  assert.match(dialog, /startTime && bookingTime\.endTime/);
  assert.match(dialog, /selectedSlot && <section className="client-booking-summary"/);
  assert.match(dialog, /disabled=\{busy \|\| !selectedSlot\}/);
  assert.match(css, /business-time-period button\{min-width:44px;min-height:44px/);
  assert.doesNotMatch(css, /business-time-period button\{min-width:(?:3[0-9]|4[0-3])px/);
});

test('demo client request independently enforces the whole-hour and half-hour duration contract', async () => {
  installBrowserStubs();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const availability = (await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=30&days=21')).data;
  assert.equal(availability.package.minimum_booking_minutes, 30);
  assert.equal(availability.package.booking_increment_minutes, 30);
  const day = availability.days.find(item => item.slots.length); const resourceId = day.slots[0].resource_id;
  const base = { client_package_id: 201, service_id: 101, resource_id: resourceId, date: day.date };
  const reject = async (overrides, code) => {
    const result = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ ...base, start_time: '12:00', end_time: '12:30', duration_minutes: 30, ...overrides }) });
    assert.equal(result.error?.code, code);
    assert.equal(result.error?.status, 422);
  };
  await reject({ start_time: '12:15', end_time: '12:45' }, 'client_booking_start_grid_invalid');
  await reject({ start_time: '12:30', end_time: '13:00' }, 'client_booking_start_grid_invalid');
  await reject({ end_time: '12:15' }, 'client_booking_end_grid_invalid');
  await reject({ end_time: '12:45', duration_minutes: 60 }, 'client_booking_end_grid_invalid');
  await reject({ duration_minutes: 15 }, 'client_booking_duration_out_of_range');
  await reject({ duration_minutes: 45 }, 'client_booking_duration_increment_invalid');
  await reject({ duration_minutes: 60 }, 'client_booking_duration_mismatch');
  await reject({ start_time: '23:00', end_time: '01:00', duration_minutes: 120 }, 'client_booking_after_midnight');
  deactivateDemoMode();
});
