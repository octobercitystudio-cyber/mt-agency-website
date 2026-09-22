import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginPhone, requireLoginPhone } from '../src/lib/phoneLogin.js';
import { hostingerClient } from '../src/lib/hostingerClient.js';

test('registered primary mobile accepts Egyptian prefixes and Arabic/Persian numerals without converting email or letters', () => {
  for (const phone of ['01012345678', '1012345678', '+20 1012345678', '00201012345678', '٠١٠١٢٣٤٥٦٧٨', '+۲۰ ۱۰۱۲۳۴۵۶۷۸', '(010) 123-45678']) assert.equal(normalizeLoginPhone(phone), '01012345678', phone);
  for (const value of ['', 'name@example.com', '01012345678@example.com', 'abc01012345678', '12345', '01012345678/22', '++201012345678', '010+12345678']) {
    assert.equal(normalizeLoginPhone(value), '', value);
    assert.throws(() => requireLoginPhone(value), { code: 'validation_error' });
  }
});

test('password and Google authentication share verified session hydration; linking and incomplete responses never authenticate', async t => {
  const requests = [];
  const events = [];
  const responses = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: 'mt_csrf=csrf-fixture' };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const response = responses.shift();
    assert.ok(response, 'Every request has an explicit fixture');
    return { ok: response.ok !== false, status: response.status || 200, headers: { get: () => null }, json: async () => response.payload };
  };
  const { data: subscription } = hostingerClient.auth.onAuthStateChange((event, session) => events.push({ event, session }));
  t.after(() => { globalThis.fetch = originalFetch; globalThis.document = originalDocument; subscription.subscription.unsubscribe(); });
  const auth = hostingerClient.auth;
  assert.equal((await auth.signInWithPassword({ identifier: 'person@example.com', password: 'fixture' })).error.code, 'validation_error');
  assert.equal(requests.length, 0);
  responses.push({ payload: { data: { user: { id: 44, role: 'client' }, session: { expires_at: '2030-01-01' } } } });
  const password = await auth.signInWithPassword({ identifier: '٠٠٢٠١٠١٢٣٤٥٦٧٨', password: 'fixture' });
  assert.equal(password.data.session.user.id, 44);
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), { identifier: '01012345678', password: 'fixture' });
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'SIGNED_IN');
  responses.push({ payload: { data: { enabled: false, client_id: null } } });
  assert.equal((await auth.getGoogleConfig()).data.enabled, false);
  responses.push({ payload: { data: { challenge_id: 'a'.repeat(64), nonce: 'b'.repeat(64), expires_in: 300 } } });
  await auth.createGoogleChallenge();
  assert.equal(requests.at(-1).options.headers['X-CSRF-Token'], 'csrf-fixture');
  const link = { link_required: true, link_token: 'c'.repeat(64), expires_in: 300 };
  responses.push({ payload: { data: link } });
  assert.deepEqual((await auth.signInWithGoogle({ credential: 'explicit-unit-fixture', challenge_id: 'a'.repeat(64) })).data, link);
  assert.equal(events.length, 1, 'Unlinked Google identity cannot establish a session');
  responses.push({ payload: { data: { user: { id: 99, role: 'owner' } } } });
  assert.equal((await auth.signInWithGoogle({ credential: 'explicit-unit-fixture', challenge_id: 'a'.repeat(64) })).error.code, 'api_error');
  assert.equal(events.length, 1, 'Missing server session cannot hydrate an account');
  responses.push({ payload: { data: { link_required: true, link_token: '', expires_in: 300 } } });
  assert.equal((await auth.signInWithGoogle({ credential: 'explicit-unit-fixture', challenge_id: 'a'.repeat(64) })).error.code, 'api_error');
  responses.push({ ok: false, status: 401, payload: { error: { code: 'invalid_credentials', message: 'رفض الدخول' } } });
  assert.equal((await auth.linkGoogleAccount({ link_token: link.link_token, phone: '01012345678', password: 'wrong' })).error.code, 'invalid_credentials');
  assert.equal(events.length, 1);
  responses.push({ payload: { data: { user: { id: 44, role: 'client', must_change_password: true }, session: { expires_at: '2030-01-01' } } } });
  const linked = await auth.linkGoogleAccount({ link_token: link.link_token, phone: '+20 1012345678', password: 'fixture' });
  assert.equal(linked.data.session.user.must_change_password, true);
  assert.equal(events.length, 2);
  assert.equal(JSON.parse(requests.at(-1).options.body).phone, '01012345678');
  assert.equal((await auth.getUser()).data.user.id, 44);
  responses.push({ payload: { data: { user: { id: 45, role: 'staff' }, session: { expires_at: '2030-01-01' } } } });
  const returning = await auth.signInWithGoogle({ credential: 'explicit-unit-fixture', challenge_id: 'a'.repeat(64) });
  assert.equal(returning.data.session.user.role, 'staff');
  assert.equal(events.length, 3);
});
