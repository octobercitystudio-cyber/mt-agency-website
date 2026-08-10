import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { blockingBookings, getBookingAvailability } from '../src/erp/bookingAvailability.js';

const slot = (status, overrides = {}) => ({ id: 1, date: '2026-08-12', start_time: '14:00', end_time: '16:00', resource_id: 1, client_name: 'سارة', status, ...overrides });

test('confirmed, active, and cancellation-pending bookings block an overlapping interval', () => {
  for (const status of ['confirmed', 'in_progress', 'cancel_requested', 'late_cancel_requested', 'مؤكد']) {
    const result = getBookingAvailability(slot('pending', { id: 90, start_time: '15:00', end_time: '17:00' }), [slot(status)]);
    assert.equal(result.status, 'conflict');
    assert.equal(result.conflicts[0].client_name, 'سارة');
  }
});

test('touching endpoints are free and non-blocking statuses never occupy the calendar', () => {
  const candidate = slot('pending', { id: 90, start_time: '16:00', end_time: '17:00' });
  assert.equal(getBookingAvailability(candidate, [slot('confirmed')]).status, 'available');
  for (const status of ['pending', 'completed', 'cancelled', 'rejected', 'alternative_proposed']) {
    assert.equal(getBookingAvailability({ ...candidate, start_time: '15:00' }, [slot(status)]).status, 'available');
  }
  assert.deepEqual(blockingBookings([slot('pending'), slot('confirmed'), slot('completed')]).map(row => row.status), ['confirmed']);
});

test('different dates/resources are free and rescheduling excludes the original booking only', () => {
  const existing = slot('confirmed', { id: 4 });
  assert.equal(getBookingAvailability(slot('pending', { date: '2026-08-13' }), [existing]).status, 'available');
  assert.equal(getBookingAvailability(slot('pending', { resource_id: 2 }), [existing]).status, 'available');
  assert.equal(getBookingAvailability(slot('pending'), [existing], { excludeBookingId: 4 }).status, 'available');
  const other = slot('confirmed', { id: 5, client_name: 'محمد', start_time: '15:30', end_time: '17:00' });
  const conflict = getBookingAvailability(slot('pending'), [existing, other], { excludeBookingId: 4 });
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.conflicts[0].client_name, 'محمد');
});

test('invalid or missing candidate intervals cannot be approved', () => {
  assert.equal(getBookingAvailability({ date: '2026-08-12', start_time: '16:00', end_time: '15:00' }, []).status, 'invalid');
  assert.equal(getBookingAvailability({ date: '', start_time: '14:00', end_time: '15:00' }, []).available, false);
});

test('requests page exposes the Arabic calendar, saved colors, preview, strips and approval guards', async () => {
  const root = new URL('../', import.meta.url);
  const [source, css] = await Promise.all([
    readFile(new URL('src/erp/ERPRequests.jsx', root), 'utf8'),
    readFile(new URL('src/erp/ERPRequests.css', root), 'utf8'),
  ]);
  assert.match(source, /مرجع الحجوزات/);
  assert.match(source, /locales=\{\[arCalendarLocale\]\}/);
  assert.match(source, /buttonText=\{\{ today: 'اليوم', month: 'شهر', week: 'أسبوع'/);
  assert.match(source, /slotMinTime="12:00:00"/);
  assert.match(source, /slotMaxTime="24:00:00"/);
  assert.match(source, /blockingBookings\(data\.bookings\)/);
  assert.match(source, /safeBookingColor\(client\?\.color\)/);
  assert.match(source, /requests-calendar-preview/);
  assert.match(source, /عرض على التقويم/);
  assert.match(source, /disabled=\{blocked \|\| checkingId/);
  assert.match(source, /requestError\.code === 'booking_conflict'/);
  assert.match(css, /\.request-availability\.available/);
  assert.match(css, /\.request-availability\.conflict/);
  assert.match(css, /min-height:44px/);
});

test('demo conflict guards reject before mutating bookings, requests, or package balance', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const bookings = (await demoClient.from('bookings').select('*')).data;
  const occupied = bookings.find(row => row.status === 'confirmed' && row.client_package_id);
  const pkgBefore = (await demoClient.from('client_packages').select('*')).data.find(row => Number(row.id) === Number(occupied.client_package_id));

  const pending = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: occupied.client_id, service_id: occupied.service_id, date: occupied.date, start_time: occupied.start_time, end_time: occupied.end_time, status: 'pending' }) });
  assert.equal(pending.error, null);
  const confirm = await demoClient.request(`/bookings/${pending.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'confirm' }) });
  assert.equal(confirm.error?.code, 'booking_conflict');
  const afterConfirm = (await demoClient.from('bookings').select('*')).data.find(row => row.id === pending.data.id);
  const pkgAfter = (await demoClient.from('client_packages').select('*')).data.find(row => Number(row.id) === Number(occupied.client_package_id));
  assert.equal(afterConfirm.status, 'pending');
  assert.equal(pkgAfter.held_quantity, pkgBefore.held_quantity);

  const request = await demoClient.request('/reschedule-requests', { method: 'POST', body: JSON.stringify({ booking_id: pending.data.id, client_id: pending.data.client_id, proposed_date: occupied.date, proposed_start_time: occupied.start_time, proposed_end_time: occupied.end_time }) });
  const decision = await demoClient.request(`/reschedule-requests/${request.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
  assert.equal(decision.error?.code, 'booking_conflict');
  const requestAfter = (await demoClient.from('reschedule_requests').select('*')).data.find(row => row.id === request.data.id);
  assert.equal(requestAfter.status, 'pending');

  await demoClient.request(`/bookings/${pending.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'alternative', date: occupied.date, start_time: occupied.start_time, end_time: occupied.end_time }) });
  const accept = await demoClient.request(`/bookings/${pending.data.id}/alternative-decision`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) });
  assert.equal(accept.error?.code, 'booking_conflict');
  const afterAlternative = (await demoClient.from('bookings').select('*')).data.find(row => row.id === pending.data.id);
  assert.equal(afterAlternative.status, 'alternative_proposed');
  deactivateDemoMode();
});
