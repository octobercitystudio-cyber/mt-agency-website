import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { validateStudioBookings, studioReviewDeadline } from '../src/lib/studioBookingPolicy.js';
const storage = new Map(); globalThis.crypto ||= webcrypto;
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }; globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class {};
const { demoClient, resetDemoDatabase, activateDemoMode } = await import('../src/lib/demoDataClient.js');
const key = 'mt_agency_erp_demo_v12'; const db = () => JSON.parse(storage.get(key)); const post = (path, body) => demoClient.request(path, { method: 'POST', body: JSON.stringify(body) });
const first = { date: '2027-02-06', start_time: '12:00', end_time: '13:00', duration_minutes: 60, resource_id: 1 }; const second = { ...first, date: '2027-02-07' };
const image = () => new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+iBu8AAAAASUVORK5CYII=', 'base64')], 'receipt.png', { type: 'image/png' });
async function setup() { resetDemoDatabase(); activateDemoMode('client'); return (await demoClient.request('/registration/catalog')).data.services.find(s => s.id === 101); }
function submit(service, changes = {}, file = image()) { const body = new FormData(); body.append('payload', JSON.stringify({ service_id: service.id, service_terms_fingerprint: service.terms_fingerprint, bookings: [first, second], terms_accepted: true, terms_version: '2026-09-22', idempotency_key: crypto.randomUUID(), ...changes })); if (file) body.append('proof', file); return demoClient.request('/client/studio-booking-requests', { method: 'POST', body }); }
const decide = (id, stage, extra = {}) => post(`/studio-booking-requests/${id}/decision`, { stage, action: 'approve', ...extra });
test('multi-date request snapshots 50%, stays financially pending; owner receipt approval and chronological dates are exactly once', async () => {
  const service = await setup(); const baseline = db(); assert.equal(service.deposit_percent, 50); assert.equal(service.deposit_amount, service.price / 2);
  const idem = crypto.randomUUID(); const [a, b] = await Promise.all([submit(service, { idempotency_key: idem }), submit(service, { idempotency_key: idem })]); assert.equal(a.error, null); assert.equal(b.error, null); assert.equal(a.data.id, b.data.id); const id = a.data.id;
  assert.equal(db().studio_booking_requests.length, 1); for (const table of ['client_packages', 'payments', 'finance', 'payment_proofs']) assert.equal(db()[table].length, baseline[table].length);
  assert.equal((await demoClient.request('/client/studio-booking-requests')).data.pending_count, 3);
  activateDemoMode('admin'); assert.equal((await decide(id, 'package', { payment_received_confirmed: true })).error?.code, 'forbidden');
  activateDemoMode('owner'); assert.equal((await decide(id, 'package')).error?.code, 'payment_confirmation_required'); assert.equal((await decide(id, 'booking', { booking_request_id: 1 })).error?.status, 409);
  const state = db(); state.services.find(s => s.id === 101).price = 77777; storage.set(key, JSON.stringify(state));
  const approved = await decide(id, 'package', { payment_received_confirmed: true }); assert.equal(approved.error, null); const created = db().client_packages.find(p => p.id === approved.data.client_package_id); assert.equal(created.total_price, service.price); assert.equal(created.paid_amount, service.price / 2);
  assert.equal((await decide(id, 'package', { payment_received_confirmed: true })).error, null); for (const table of ['client_packages', 'payments', 'finance', 'payment_proofs', 'payment_allocations']) assert.equal(db()[table].length, baseline[table].length + 1, table);
  assert.equal((await decide(id, 'booking', { booking_request_id: 2 })).error?.status, 409);
  assert.equal((await decide(id, 'booking', { booking_request_id: 1 })).error, null); assert.equal((await decide(id, 'booking', { booking_request_id: 2 })).error, null); assert.equal((await decide(id, 'booking', { booking_request_id: 2 })).error, null);
  assert.equal(db().bookings.length, baseline.bookings.length + 2); assert.equal(db().client_packages.find(p => p.id === created.id).held_minutes, 120); assert.equal((await demoClient.request('/studio-booking-requests')).data.pending_count, 0);
});
test('image, consent, stale service, overlap, cumulative hours and schedule policies are enforced before insertion', async () => {
  const service = await setup(); for (const file of [null, new File(['wrong'], 'proof.svg', { type: 'image/svg+xml' }), new File(['fake'], 'proof.png', { type: 'image/png' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })]) assert.equal((await submit(service, {}, file)).error?.code, 'invalid_proof');
  assert.equal((await submit(service, { service_terms_fingerprint: 'stale' })).error?.code, 'service_terms_changed'); assert.ok((await submit(service, { terms_accepted: false })).error); assert.ok((await submit(service, { bookings: [] })).error);
  for (const bookings of [[first, first], [{ ...first, date: '2027-02-05' }], [{ ...first, start_time: '11:00', end_time: '12:00' }], [{ ...first, start_time: '21:00', end_time: '23:00', duration_minutes: 120 }], Array.from({ length: 11 }, (_, i) => ({ ...first, date: `2027-02-${String(6 + i).padStart(2, '0')}`, start_time: '12:00', end_time: '14:00', duration_minutes: 120 }))]) assert.ok((await submit(service, { bookings })).error);
  assert.equal(db().studio_booking_requests?.length || 0, 0);
  assert.match(validateStudioBookings({ ...service, kind: 'daily', validity_days: 1 }, [first, second]), /يوم واحد/); assert.match(validateStudioBookings({ ...service, validity_days: 1 }, [first, second]), /صلاحية/); assert.ok(validateStudioBookings(service, [{ ...first, date: 'bad' }]));
});
test('conflict at approval keeps appointment pending and does not hold hours; role boundaries and rejection cascade hold', async () => {
  const service = await setup(); const submitted = await submit(service); const id = submitted.data.id; activateDemoMode('owner'); await decide(id, 'package', { payment_received_confirmed: true }); const state = db(); state.bookings.push({ ...first, id: 999991, status: 'confirmed', client_id: 2 }); storage.set(key, JSON.stringify(state));
  assert.equal((await decide(id, 'booking', { booking_request_id: 1 })).error?.code, 'booking_conflict'); const after = db(); assert.equal(after.studio_booking_requests[0].bookings[0].status, 'pending'); assert.equal(after.client_packages.at(-1).held_minutes, 0);
  activateDemoMode('finance'); assert.equal((await demoClient.request('/studio-booking-requests')).error, null); assert.equal((await decide(id, 'booking', { booking_request_id: 1 })).error?.code, 'forbidden');
  activateDemoMode('operations'); assert.equal((await demoClient.request('/studio-booking-requests')).data.items[0].proof_url, null); assert.equal((await decide(id, 'package')).error?.code, 'forbidden');
  const s = await setup(); const req = await submit(s); activateDemoMode('owner'); assert.equal((await decide(req.data.id, 'package', { action: 'reject', note: 'لم يصل التحويل' })).error, null); assert.ok(db().studio_booking_requests[0].bookings.every(row => row.status === 'rejected')); assert.equal((await demoClient.request('/studio-booking-requests')).data.pending_count, 0);
});
test('review promise consumes one Cairo business hour and skips Friday', () => {
  assert.equal(studioReviewDeadline(new Date('2026-09-24T18:30:00Z')), '2026-09-26T09:30:00.000Z');
  assert.equal(studioReviewDeadline(new Date('2026-09-25T12:00:00Z')), '2026-09-26T10:00:00.000Z');
  assert.equal(studioReviewDeadline(new Date('2026-09-22T08:00:00Z')), '2026-09-22T10:00:00.000Z');
});

test('public catalog excludes packages without a positive price', async () => {
  await setup(); const state = db(); state.services.push({ ...state.services.find(s => s.id === 101), id: 99998, price: 0 }, { ...state.services.find(s => s.id === 101), id: 99999, price: -1 }); storage.set(key, JSON.stringify(state)); const result = await demoClient.request('/registration/catalog'); assert.equal(result.error, null); assert.ok(result.data.services.every(s => s.price > 0)); assert.equal(result.data.services.some(s => s.id === 99998 || s.id === 99999), false);
});
