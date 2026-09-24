import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithBookingConfirmation } from '../src/lib/bookingConfirmation.js';
const warning = token => ({ data: null, error: { code: 'temporary_booking_confirmation_required', message: 'حجز مؤقت', confirmationToken: token } });
test('cancelling temporary replacement never retries the mutation', async () => {
  let calls = 0;
  const result = await requestWithBookingConfirmation(async () => { calls++; return warning('a'); }, '/bookings/request', { method: 'POST', body: '{}' }, () => false);
  assert.equal(calls, 1); assert.equal(result.error.code, 'booking_confirmation_cancelled');
});
test('owner consents separately to changed or multiple temporary intervals', async () => {
  const bodies = []; let prompts = 0;
  const result = await requestWithBookingConfirmation(async (_path, options) => { bodies.push(JSON.parse(options.body)); return bodies.length === 1 ? warning('a') : bodies.length === 2 ? warning('b') : { data: { id: 10 }, error: null }; }, '/client-packages/sale', { method: 'POST', body: JSON.stringify({ idempotency_key: 'same', bookings: [1, 2] }) }, () => { prompts++; return true; });
  assert.equal(result.data.id, 10); assert.equal(prompts, 2);
  assert.deepEqual(bodies[2], { idempotency_key: 'same', bookings: [1, 2], temporary_booking_confirmations: ['a', 'b'] });
});
test('real booking conflicts never offer an override', async () => {
  let calls = 0;
  const result = await requestWithBookingConfirmation(async () => { calls++; return { error: { code: 'booking_conflict' } }; }, '/bookings/request', {}, () => { throw new Error('Must not prompt'); });
  assert.equal(calls, 1); assert.equal(result.error.code, 'booking_conflict');
});

test('demo owner confirmation preserves the unused temporary hours and pending appointments block overlaps', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
  globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  const { demoClient, resetDemoDatabase, activateDemoMode, deactivateDemoMode } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const block = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ resource_id: 1, date: '2035-02-10', start_time: '12:00', end_time: '18:00', title: 'Temporary fixture', idempotency_key: 'test-owner-block-consent-1' }) });
  assert.equal(block.error, null);
  const options = { method: 'POST', body: JSON.stringify({ client_id: 1, client_package_id: 201, service_id: 101, resource_id: 1, date: '2035-02-10', start_time: '14:00', end_time: '16:00', status: 'pending' }) };
  const warning = await demoClient.request('/bookings/request', options);
  assert.equal(warning.error?.code, 'temporary_booking_confirmation_required');
  let result = await requestWithBookingConfirmation(demoClient.request.bind(demoClient), '/bookings/request', options, () => true);
  assert.equal(result.error, null);
  const blocks = (await demoClient.from('booking_blocks').select('*')).data.filter(b => b.block_date === '2035-02-10' && b.status === 'active').sort((a,b) => a.start_time.localeCompare(b.start_time));
  assert.deepEqual(blocks.map(b => [b.start_time.slice(0,5), b.end_time.slice(0,5)]), [['12:00','14:00'],['16:00','18:00']]);
  assert.ok(blocks.every(b => Number.isInteger(b.id)));
  result = await demoClient.request('/bookings/request', options);
  assert.equal(result.error?.code, 'booking_conflict');
  deactivateDemoMode();
});
