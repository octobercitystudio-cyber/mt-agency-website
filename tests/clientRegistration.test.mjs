import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRegistrationDigits } from '../src/lib/registrationPolicy.js';
import { webcrypto } from 'node:crypto';
const storage = new Map(); globalThis.crypto ||= webcrypto;
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
const { demoClient, resetDemoDatabase, activateDemoMode, authenticateDemoRegistration, resumeDemoRegistrationSession } = await import('../src/lib/demoDataClient.js');
const key = 'mt_agency_erp_demo_v12'; const db = () => JSON.parse(storage.get(key));
const post = (path, body) => demoClient.request(path, { method: 'POST', body: JSON.stringify(body) });
let sequence = 0;
async function register() {
  const n = ++sequence; const email = 'new' + n + '@example.test'; const phone = '01512345' + String(n).padStart(3, '0'); activateDemoMode('guest');
  const sent = await post('/registration/email-code', { email }); assert.equal(sent.error, null);
  assert.equal((await post('/registration/verify-email', { challenge_id: sent.data.challenge_id, code: '000000' })).error?.code, 'invalid_verification_code');
  const verified = await post('/registration/verify-email', { challenge_id: sent.data.challenge_id, code: '123456' }); assert.equal(verified.error, null);
  const payload = { registration_token: verified.data.registration_token, name: 'عميل جديد ' + n, phone, job: 'صانع محتوى', password: 'demoSafe123', password_confirmation: 'demoSafe123' };
  const complete = await post('/registration/complete', payload); assert.equal(complete.error, null); assert.equal(await authenticateDemoRegistration(email, payload.password), null); const user = await authenticateDemoRegistration(payload.phone, payload.password); assert.ok(user); return { id: complete.data.id, user, email, payload, complete: complete.data };
}
test('verified standalone signup immediately creates a website client and active account without package, intake or money movement', async () => {
  resetDemoDatabase(); const before = db(); const registered = await register(); const after = db();
  assert.equal(after.clients.length, before.clients.length + 1); for (const table of ['client_packages', 'bookings', 'payments', 'finance']) assert.equal(after[table].length, before[table].length, table);
  assert.equal(registered.user.role, 'client'); assert.equal(registered.user.client_id, registered.id); assert.equal(registered.complete.registered, true); assert.equal(after.clients.at(-1).registration_source, 'website');
  assert.equal(after.intake_requests?.length || 0, 0); assert.equal(storage.get(key).includes('demoSafe123'), false); assert.equal(storage.get(key).includes(registered.payload.registration_token), false);
  assert.equal((await demoClient.request('/client/intake-requests')).data.pending_count, 0); assert.equal((await demoClient.request('/client/offers')).data.items.length, 0);
  assert.equal(resumeDemoRegistrationSession(registered.user).client_id, registered.id); assert.equal((await demoClient.auth.getSession()).data.session.user.client_id, registered.id);
  const repeat = await post('/registration/complete', registered.payload); assert.equal(repeat.data.client_id, registered.id); assert.equal(db().clients.length, after.clients.length);
});
test('independent signups use distinct real identities and require verified email', async () => {
  resetDemoDatabase(); const first = await register(); const second = await register(); assert.notEqual(first.id, second.id); assert.notEqual(second.id, 1);
  assert.equal((await demoClient.request('/client/studio-booking-requests')).data.items.length, 0);
  activateDemoMode('guest'); assert.ok((await post('/registration/complete', { ...second.payload, registration_token: '' })).error);
  assert.equal((await post('/registration/email-code', { email: first.email })).error?.code, 'email_exists');
});
test('confirmed appointments inside 48 hours cannot be cancelled by client while pending requests can', async () => {
  resetDemoDatabase(); activateDemoMode('client');
  const state = db(); const appointment = state.bookings.find(item => item.id === 301); appointment.date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); appointment.status = 'confirmed'; storage.set(key, JSON.stringify(state));
  assert.equal((await post('/bookings/301/cancel-request', {})).error?.code, 'late_cancellation'); assert.equal(db().bookings.find(item => item.id === 301).status, 'confirmed');
  const pending = db(); pending.bookings.find(item => item.id === 301).status = 'pending'; storage.set(key, JSON.stringify(pending)); assert.equal((await post('/bookings/301/cancel-request', {})).error, null);
});

test('Arabic and Persian numerals remain usable in WhatsApp and verification code fields', () => {
  assert.equal(normalizeRegistrationDigits('+٢٠ ١٠١٢٣٤٥٦٧٨'), '+20 1012345678');
  assert.equal(normalizeRegistrationDigits('۱۲۳٤٥٦'), '123456');
});
