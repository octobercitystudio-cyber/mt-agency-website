import test from 'node:test';
import assert from 'node:assert/strict';
import { hostingerClient } from '../src/lib/hostingerClient.js';
import { authAudience, roleMatchesAudience, authCsrfCookieNames } from '../src/lib/authAudience.js';
import { staffPath } from '../src/lib/staffRoutes.js';

test('portal selection and role matching never infer staff access from customer routes', () => {
  for (const path of ['/login', '/register', '/dashboard', '/change-password', '/']) {
    assert.equal(authAudience(path), 'client');
    assert.equal(roleMatchesAudience('owner', authAudience(path)), false);
  }
  for (const path of [staffPath('/login'), staffPath('/requests'), '/erp/', '/adminmt/login']) assert.equal(authAudience(path), 'staff');
  assert.equal(roleMatchesAudience('client', 'staff'), false);
  assert.equal(roleMatchesAudience('owner', 'staff'), true);
  assert.equal(roleMatchesAudience('applicant', 'client'), true);
  assert.notDeepEqual(authCsrfCookieNames('staff'), authCsrfCookieNames('client'));
});

test('shared browser jar uses separate session selectors and CSRF; wrong-role session is rejected', async () => {
  const saved = Object.fromEntries(['location', 'document', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  let responseUser = { id: 1, role: 'owner' };
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: staffPath('/login') } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '__Host-mt_csrf_staff=staff-csrf; __Host-mt_csrf_client=client-csrf; mt_csrf=legacy-csrf' } });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (url, options) => {
      calls.push({ url, ...options });
      return { ok: true, json: async () => ({ data: { session: { active: true }, user: responseUser } }) };
    } });
    assert.equal((await hostingerClient.auth.getSession()).data.session.user.role, 'owner');
    await hostingerClient.request('/fixture', { method: 'POST', body: '{}' });
    assert.equal(calls.at(-1).headers['X-MTA-Audience'], 'staff');
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'staff-csrf');
    globalThis.location.pathname = '/login';
    assert.equal((await hostingerClient.auth.getUser()).data.user, null, 'cached owner cannot escape staff portal');
    assert.equal(calls.at(-1).headers['X-MTA-Audience'], 'client');
    responseUser = { id: 2, role: 'client' };
    assert.equal((await hostingerClient.auth.getSession()).data.session.user.id, 2);
    await hostingerClient.request('/fixture', { method: 'POST', body: '{}' });
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'client-csrf');
    await hostingerClient.auth.signOut();
    assert.equal(calls.at(-1).headers['X-MTA-Audience'], 'client');
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'client-csrf');
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
