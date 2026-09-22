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

test('phone and staff passwords hydrate only their own portal; Google methods are removed', async t => {
  const requests = [], events = [], responses = [];
  const oldFetch = globalThis.fetch, oldDocument = globalThis.document;
  globalThis.document = { cookie: 'mt_csrf=fixture' };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options }); const response = responses.shift(); assert.ok(response);
    return { ok: response.ok !== false, status: response.status || 200, headers: { get: () => null }, json: async () => response.payload };
  };
  const subscription = hostingerClient.auth.onAuthStateChange((event, session) => events.push({ event, session }));
  t.after(() => { globalThis.fetch = oldFetch; globalThis.document = oldDocument; subscription.data.subscription.unsubscribe(); });
  const auth = hostingerClient.auth;
  for (const method of ['getGoogleConfig', 'createGoogleChallenge', 'signInWithGoogle', 'linkGoogleAccount']) assert.equal(auth[method], undefined);
  assert.equal((await auth.signInWithPassword({ identifier: 'person@example.test', password: 'fixture' })).error.code, 'validation_error');
  assert.equal(requests.length, 0);
  const queue = (role, extra = {}) => responses.push({ payload: { data: { user: { id: 44, role, ...extra }, session: { active: true } } } });
  queue('client'); const client = await auth.signInWithPassword({ identifier: '٠٠٢٠١٠١٢٣٤٥٦٧٨', password: 'fixture' });
  assert.equal(client.data.user.role, 'client'); assert.equal(requests.at(-1).url, '/api/auth/login');
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), { identifier: '01012345678', password: 'fixture' });
  responses.push({ payload: { data: { user: { id: 45, role: 'client' } } } });
  assert.equal((await auth.signInWithPassword({ phone: '01012345678', password: 'fixture' })).error.code, 'api_error');
  for (const role of ['owner', 'admin', 'operations', 'finance', 'staff']) {
    queue(role); assert.equal((await auth.signInWithPassword({ phone: '01012345678', password: 'fixture' })).error.code, 'invalid_credentials');
  }
  for (const role of ['client', 'applicant']) {
    queue(role); assert.equal((await auth.signInStaffWithPassword({ identifier: 'client@example.test', password: 'fixture' })).error.code, 'invalid_credentials');
  }
  queue('owner', { client_id: 10 });
  assert.equal((await auth.signInStaffWithPassword({ identifier: 'client@example.test', password: 'fixture' })).error.code, 'invalid_credentials');
  assert.equal(events.length, 1, 'Wrong portal or malformed response never hydrates a session');
  for (const role of ['owner', 'admin', 'operations', 'finance', 'staff']) {
    queue(role); const staff = await auth.signInStaffWithPassword({ identifier: ' OWNER@EXAMPLE.TEST ', password: 'fixture' });
    assert.equal(staff.data.user.role, role); assert.equal(requests.at(-1).url, '/api/auth/staff/login');
    assert.deepEqual(JSON.parse(requests.at(-1).options.body), { identifier: 'owner@example.test', password: 'fixture' });
  }
  queue('staff'); assert.equal((await auth.signInStaffWithPassword({ identifier: '٠٠٢٠١٠١٢٣٤٥٦٧٨', password: 'fixture' })).data.user.role, 'staff');
  assert.equal(JSON.parse(requests.at(-1).options.body).identifier, '01012345678');
  assert.equal(events.length, 7);
  const count = requests.length;
  assert.equal((await auth.signInStaffWithPassword({ identifier: [], password: 'fixture' })).error.code, 'validation_error');
  assert.equal(requests.length, count);
});
