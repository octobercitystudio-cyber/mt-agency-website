import test from 'node:test';
import assert from 'node:assert/strict';
import { hostingerClient } from '../src/lib/hostingerClient.js';
import { loginServiceError } from '../src/lib/loginError.js';

const response = (status, body, reference = '') => ({
  ok: status < 400, status,
  headers: { get: () => reference },
  json: async () => { if (body === 'html') throw new SyntaxError('HTML'); return body; },
});

test('login renews rejected CSRF protection once for either portal', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document };
  try {
    for (const staff of [false, true]) {
      const calls = [];
      const cookie = staff ? 'mt_csrf_staff' : 'mt_csrf_client';
      const previousLocation = globalThis.location;
      globalThis.location = { pathname: staff ? '/p-e2f8474bcda6b5ea/login' : '/login' };
      globalThis.document = { cookie: `${cookie}=old` };
      globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) return response(403, { data: null, error: { code: 'csrf_failed' } });
        if (calls.length === 2) {
          globalThis.document.cookie = `${cookie}=renewed`;
          return response(200, { data: { session: null, user: null } });
        }
        return response(200, { data: { session: { active: true }, user: { id: 1, role: staff ? 'staff' : 'client' } } });
      };
      try {
        const result = await (staff
          ? hostingerClient.auth.signInStaffWithPassword({ identifier: 'test@example.test', password: 'test' })
          : hostingerClient.auth.signInWithPassword({ phone: '01000000000', password: 'test' }));
        assert.equal(result.error, null);
        assert.equal(calls.length, 3);
        assert.equal(calls[1].url, '/api/auth/session');
        assert.equal(calls[2].options.headers['X-CSRF-Token'], 'renewed');
        assert.equal(calls[0].options.body, calls[2].options.body);
      } finally { globalThis.location = previousLocation; }
    }
  } finally { Object.assign(globalThis, previous); }
});

test('login never repeats invalid credentials, server failures, or a second CSRF rejection', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document };
  globalThis.document = { cookie: '' };
  try {
    for (const [status, code, expectedPosts] of [[401, 'invalid_credentials', 1], [500, 'server_error', 1], [403, 'csrf_failed', 2]]) {
      let posts = 0;
      globalThis.fetch = async (_url, options) => {
        if (options.method === 'GET') return response(200, { data: { session: null, user: null } });
        posts++;
        return response(status, { data: null, error: { code } });
      };
      const result = await hostingerClient.auth.signInStaffWithPassword({ identifier: 'test@example.test', password: 'test' });
      assert.equal(result.error.code, code);
      assert.equal(posts, expectedPosts);
    }
  } finally { Object.assign(globalThis, previous); }
});

test('malformed API responses are errors, retain header references, and safe reads recover', async () => {
  const previous = { fetch: globalThis.fetch, document: globalThis.document };
  globalThis.document = { cookie: '' };
  try {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      return attempts === 1 ? response(200, 'html') : response(200, { data: { ready: true } });
    };
    const result = await hostingerClient.request('/dashboard/kpis');
    assert.deepEqual(result.data, { ready: true });
    assert.equal(attempts, 2);
    globalThis.fetch = async () => response(503, 'html', 'header-ref-123');
    const failed = await hostingerClient.request('/auth/staff/login', { method: 'POST', body: '{}' });
    assert.equal(failed.error.requestId, 'header-ref-123');
    assert.match(failed.error.message, /رقم المتابعة: header-ref-123/);
    assert.match(loginServiceError(failed.error), /رقم المتابعة: header-ref-123/);
    assert.doesNotMatch(loginServiceError({ status: 500, message: 'SQL password secret' }), /SQL|password|secret/);
  } finally { Object.assign(globalThis, previous); }
});
