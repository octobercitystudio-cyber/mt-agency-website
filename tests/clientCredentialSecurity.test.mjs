import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, authenticateDemoClientCredential, deactivateDemoMode, demoClient, resetDemoDatabase, resumeDemoCredentialSession } from '../src/lib/demoDataClient.js';
import { acquireResetFragment, completeResetAttempt, resetResetPasswordFlowForTests, scheduleResetFragmentRelease } from '../src/lib/resetPasswordFlow.js';

const root = new URL('../', import.meta.url);
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

const setPassword = (clientId, password, confirmation = password) => demoClient.request(`/clients/${clientId}/credentials/password`, { method: 'POST', body: JSON.stringify({ password, confirm_password: confirmation }) });
const issueReset = clientId => demoClient.request(`/clients/${clientId}/credentials/reset`, { method: 'POST', body: '{}' });
const tokenFrom = response => response.data.reset_url.split('#')[1];

test.beforeEach(async () => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); await demoClient.auth.getSession(); });
test.afterEach(() => deactivateDemoMode());

test('StrictMode probe reclaims the stripped fragment and genuine unmount releases it', async () => {
  resetResetPasswordFlowForTests();
  const token = 'a'.repeat(64); const replaced = [];
  const location = { hash: `#${token}`, pathname: '/reset-password', search: '?demo=1' };
  const history = { replaceState: (...args) => { replaced.push(args.at(-1)); location.hash = ''; } };
  const firstSetup = acquireResetFragment(location, history);
  scheduleResetFragmentRelease(firstSetup);
  const secondSetup = acquireResetFragment(location, history);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(firstSetup, token); assert.equal(secondSetup, token); assert.deepEqual(replaced, ['/reset-password?demo=1']);
  scheduleResetFragmentRelease(secondSetup); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(acquireResetFragment(location, history), '');
});

test('reset UI retry keeps the same in-memory token after a correctable server error', async () => {
  const token = 'b'.repeat(64); const calls = []; let attempt = 0;
  const client = { request: async (_path, options) => { calls.push(JSON.parse(options.body)); attempt += 1; return attempt === 1 ? { data: null, error: Object.assign(new Error('لا يمكن إعادة استخدام كلمة مرور سابقة.'), { code: 'password_history_reuse' }) } : { data: { updated: true }, error: null }; } };
  const rejected = await completeResetAttempt(client, token, { password: 'OldPassword2026', confirm_password: 'OldPassword2026' });
  const accepted = await completeResetAttempt(client, token, { password: 'NewPassword2027', confirm_password: 'NewPassword2027' });
  assert.equal(rejected.kind, 'correctable'); assert.equal(accepted.kind, 'success');
  assert.deepEqual(calls.map(call => call.token), [token, token]);
});

test('owner direct change preserves access, revokes sessions and never persists a secret', async () => {
  const first = 'OwnerSafe2026A'; const second = 'OwnerSafe2027B';
  assert.equal((await setPassword(1, first)).error, null);
  const session = await authenticateDemoClientCredential('01012345678', first);
  activateDemoMode('owner');
  assert.equal((await setPassword(1, second, `${second}x`)).error?.code, 'password_confirmation_mismatch');
  assert.equal((await setPassword(1, second)).data.access_enabled, true);
  assert.equal(resumeDemoCredentialSession(session), false);
  assert.equal(await authenticateDemoClientCredential('01012345678', first), null);
  assert.ok(await authenticateDemoClientCredential('01012345678', second));
  const persisted = storage.get('mt_agency_erp_demo_v12');
  assert.equal(persisted.includes(first) || persisted.includes(second), false);
  assert.equal(/password_hash|token_hash|reset_url/.test(persisted), false);
});

test('normal client change requires current password and enforces confirmation, policy and history', async () => {
  const first = 'ClientStart2026A'; const second = 'ClientNext2027B'; const third = 'ClientFinal2028C';
  await setPassword(1, first); await authenticateDemoClientCredential('01012345678', first);
  assert.equal((await demoClient.auth.updateUser({ password: second, currentPassword: 'wrong', confirmPassword: second })).error?.code, 'invalid_password');
  assert.equal((await demoClient.auth.updateUser({ password: '12345', currentPassword: first, confirmPassword: '12345' })).error?.code, 'weak_password');
  assert.equal((await demoClient.auth.updateUser({ password: second, currentPassword: first, confirmPassword: `${second}x` })).error?.code, 'password_confirmation_mismatch');
  assert.equal((await demoClient.auth.updateUser({ password: first, currentPassword: first, confirmPassword: first })).error?.code, 'password_reuse');
  const changed = await demoClient.auth.updateUser({ password: second, currentPassword: first, confirmPassword: second });
  assert.equal(changed.error, null); assert.equal(changed.data.user.must_change_password, false);
  assert.equal((await demoClient.auth.updateUser({ password: first, currentPassword: second, confirmPassword: first })).error?.code, 'password_history_reuse');
  assert.equal((await demoClient.auth.updateUser({ password: third, currentPassword: second, confirmPassword: third })).error, null);
});

test('reset issue is hash-only, revokes the previous link, is single-use and preserves disabled access', async () => {
  const first = 'ResetStart2026A'; const final = 'ResetDone2027B'; await setPassword(1, first);
  await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: false }) });
  const old = await issueReset(1); const latest = await issueReset(1); const oldToken = tokenFrom(old); const token = tokenFrom(latest);
  assert.equal((await demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token: oldToken }) })).error?.code, 'invalid_reset_link');
  assert.equal((await demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal(storage.get('mt_agency_erp_demo_v12').includes(token), false);
  const weak = await demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: '12345', confirm_password: '12345' }) });
  assert.equal(weak.error?.code, 'weak_password', 'policy failure does not consume the token');
  assert.equal((await demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal((await demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: final, confirm_password: final }) })).error, null);
  assert.equal((await demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: 'Another2028C', confirm_password: 'Another2028C' }) })).error?.code, 'invalid_reset_link');
  activateDemoMode('owner'); const meta = await demoClient.request('/clients/1/credentials', { method: 'GET' });
  assert.equal(meta.data.portal_access, 'disabled'); assert.equal(meta.data.reset_pending, false); assert.equal(await authenticateDemoClientCredential('01012345678', final), null);
});

test('fresh demo contexts preserve password reuse history and accept the new password for login', async () => {
  const historical = 'FreshHistory2026A'; const current = 'FreshCurrent2027B'; const final = 'FreshDone2028C';
  await setPassword(1, historical); await setPassword(1, current); const issued = await issueReset(1); const token = tokenFrom(issued);
  assert.match(issued.data.reset_url, /\/reset-password\?demo=1#[a-f0-9]{64}$/);
  const persistedBefore = storage.get('mt_agency_erp_demo_v12'); const snapshot = JSON.parse(persistedBefore);
  assert.equal(persistedBefore.includes(token), false); assert.equal(snapshot.credential_reset_links.length, 1);
  assert.match(snapshot.credential_reset_links[0].digest, /^[a-f0-9]{64}$/); assert.equal('reset_url' in snapshot.credential_reset_links[0], false);
  const freshUrl = new URL('../src/lib/demoDataClient.js', import.meta.url); freshUrl.searchParams.set('fresh_context', String(Date.now()));
  const fresh = await import(freshUrl.href); fresh.activateDemoMode('public_reset');
  assert.equal((await fresh.demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).error?.code, 'csrf_failed');
  await fresh.demoClient.auth.getSession();
  assert.equal((await fresh.demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal((await fresh.demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: current, confirm_password: current }) })).error?.code, 'password_reuse');
  assert.equal((await fresh.demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal((await fresh.demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: historical, confirm_password: historical }) })).error?.code, 'password_history_reuse');
  assert.equal((await fresh.demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal((await fresh.demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: final, confirm_password: final }) })).error, null);
  assert.equal((await fresh.demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: 'FreshAgain2028C', confirm_password: 'FreshAgain2028C' }) })).error?.code, 'invalid_reset_link');
  fresh.deactivateDemoMode();

  const loginUrl = new URL('../src/lib/demoDataClient.js', import.meta.url); loginUrl.searchParams.set('fresh_login_context', `${Date.now()}-${Math.random()}`);
  const loginFresh = await import(loginUrl.href);
  assert.ok(await loginFresh.authenticateDemoClientCredential('01012345678', final));
  assert.equal(await loginFresh.authenticateDemoClientCredential('01012345678', current), null);
  loginFresh.deactivateDemoMode();

  const persistedAfter = storage.get('mt_agency_erp_demo_v12'); const storedClient = JSON.parse(persistedAfter).clients.find(client => Number(client.id) === 1);
  assert.equal([token, historical, current, final].some(secret => persistedAfter.includes(secret)), false);
  assert.match(storedClient.credential_verifier_digest, /^[a-f0-9]{64}$/);
  assert.ok(storedClient.credential_history_digests.length <= 5);
  storedClient.credential_history_digests.forEach(verifier => assert.match(verifier, /^[a-f0-9]{64}$/));
});

test('reset validate and complete require an initialized CSRF context', async () => {
  await setPassword(1, 'CsrfStart2026A'); const token = tokenFrom(await issueReset(1));
  deactivateDemoMode(); activateDemoMode('public_reset');
  const validateWithout = await demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) });
  const completeWithout = await demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: 'CsrfDone2027B', confirm_password: 'CsrfDone2027B' }) });
  assert.equal(validateWithout.error?.code, 'csrf_failed'); assert.equal(completeWithout.error?.code, 'csrf_failed');
  await demoClient.auth.getSession();
  assert.equal((await demoClient.request('/auth/password-reset/validate', { method: 'POST', body: JSON.stringify({ token }) })).data.valid, true);
  assert.equal((await demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password: 'CsrfDone2027B', confirm_password: 'CsrfDone2027B' }) })).error, null);
});

test('production client sends the CSRF cookie header to validate and complete', async () => {
  const previousDocument = globalThis.document; const previousFetch = globalThis.fetch; const requests = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } });
  globalThis.fetch = async (url, options) => {
    const header = options.headers['X-CSRF-Token'] || '';
    requests.push({ path: String(url), header });
    if (header !== 'csrf-demo-token') return new Response(JSON.stringify({ error: { message: 'CSRF', code: 'csrf_failed' } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ data: String(url).endsWith('/complete') ? { updated: true } : { valid: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const hostingerUrl = new URL('../src/lib/hostingerClient.js', import.meta.url); hostingerUrl.searchParams.set('csrf_context', String(Date.now()));
    const { hostingerClient } = await import(hostingerUrl.href); const payload = JSON.stringify({ token: 'c'.repeat(64) });
    assert.equal((await hostingerClient.request('/auth/password-reset/validate', { method: 'POST', body: payload })).error?.code, 'csrf_failed');
    assert.equal((await hostingerClient.request('/auth/password-reset/complete', { method: 'POST', body: payload })).error?.code, 'csrf_failed');
    globalThis.document.cookie = 'mt_csrf=csrf-demo-token';
    assert.equal((await hostingerClient.request('/auth/password-reset/validate', { method: 'POST', body: payload })).data.valid, true);
    assert.equal((await hostingerClient.request('/auth/password-reset/complete', { method: 'POST', body: payload })).data.updated, true);
    assert.deepEqual(requests.map(request => request.header), ['', '', 'csrf-demo-token', 'csrf-demo-token']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousDocument === undefined) delete globalThis.document; else Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
  }
});

test('two concurrent reset completions have exactly one winner', async () => {
  await setPassword(1, 'ConcurrentStart2026A'); const token = tokenFrom(await issueReset(1));
  const attempt = password => demoClient.request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password, confirm_password: password }) });
  const results = await Promise.all([attempt('ConcurrentDone2027B'), attempt('ConcurrentOther2028C')]);
  assert.equal(results.filter(result => !result.error).length, 1); assert.equal(results.filter(result => result.error?.code === 'invalid_reset_link').length, 1);
});

test('demo credential operations deny an owner from another organization', async () => {
  await setPassword(1, 'ScopedStart2026A'); activateDemoMode('owner', 1, 2);
  assert.equal((await issueReset(1)).error?.code, 'client_not_found');
  assert.equal((await setPassword(1, 'ScopedDone2027B')).error?.code, 'client_not_found');
  assert.equal((await demoClient.request('/clients/1/credentials', { method: 'GET' })).error?.code, 'client_not_found');
});

test('reset issuer is owner-only, org-scoped in production contract and rate limited at five per 15 minutes', async () => {
  await setPassword(1, 'RateStart2026A');
  for (const role of ['admin', 'operations', 'finance', 'staff', 'client']) { activateDemoMode(role); assert.equal((await issueReset(1)).error?.code, 'forbidden'); }
  activateDemoMode('owner'); for (let index = 0; index < 5; index += 1) assert.equal((await issueReset(1)).error, null);
  assert.equal((await issueReset(1)).error?.code, 'password_reset_rate_limited');
});

test('reset rate limits retain each owner principal while other owners issue links', async () => {
  await setPassword(1, 'PrincipalRate2026A');
  activateDemoMode('owner', 11, 1);
  for (let index = 0; index < 4; index += 1) assert.equal((await issueReset(1)).error, null);
  activateDemoMode('owner', 22, 1);
  assert.equal((await issueReset(1)).error, null);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const otherOrgClient = database.clients.find(client => Number(client.id) === 2);
  Object.assign(otherOrgClient, { organization_id: 2, portal_account_exists: true, portal_enabled: true }); storage.set('mt_agency_erp_demo_v12', JSON.stringify(database));
  activateDemoMode('owner', 33, 2);
  assert.equal((await issueReset(2)).error, null);
  activateDemoMode('owner', 11, 1);
  assert.equal((await issueReset(1)).error, null);
  assert.equal((await issueReset(1)).error?.code, 'password_reset_rate_limited');
  const rows = JSON.parse(storage.get('mt_agency_erp_demo_v12')).credential_reset_issue_times;
  assert.equal(rows.filter(row => Number(row.organization_id) === 1 && Number(row.user_id) === 11).length, 5);
  assert.equal(rows.filter(row => Number(row.organization_id) === 1 && Number(row.user_id) === 22).length, 1);
  assert.equal(rows.filter(row => Number(row.organization_id) === 2 && Number(row.user_id) === 33).length, 1);
});

test('retired credential issuer returns 410 and new metadata exposes reset state without a token', async () => {
  const retired = await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' });
  assert.equal(retired.error?.status, 410); assert.equal(retired.error?.code, 'credential_issue_retired');
  await setPassword(1, 'Metadata2026A'); const reset = await issueReset(1); const meta = await demoClient.request('/clients/1/credentials', { method: 'GET' });
  assert.equal(meta.data.reset_pending, true); assert.ok(meta.data.reset_expires_at); assert.equal(JSON.stringify(meta.data).includes(tokenFrom(reset)), false); assert.equal('temporary_expires_at' in meta.data, false);
});

test('production API, migration and UI implement the secure reset and accessible client-settings contracts', async () => {
  const [api, migration, ownerUi, clientUi, resetUi, resetFlow, forcedUi, app, dashboard, styles, dashboardStyles] = await Promise.all([
    readFile(new URL('api/index.php', root), 'utf8'),
    readFile(new URL('database/mysql/032_client_password_reset_links.sql', root), 'utf8'),
    readFile(new URL('src/erp/ClientCredentialSecurity.jsx', root), 'utf8'),
    readFile(new URL('src/pages/ClientSecuritySettings.jsx', root), 'utf8'),
    readFile(new URL('src/pages/ResetPassword.jsx', root), 'utf8'),
    readFile(new URL('src/lib/resetPasswordFlow.js', root), 'utf8'),
    readFile(new URL('src/pages/ForcedPasswordChange.jsx', root), 'utf8'),
    readFile(new URL('src/App.jsx', root), 'utf8'),
    readFile(new URL('src/pages/ClientDashboard.jsx', root), 'utf8'),
    readFile(new URL('src/erp/ClientCredentialSecurity.css', root), 'utf8'),
    readFile(new URL('src/pages/ClientDashboard.css', root), 'utf8'),
  ]);
  const direct = api.slice(api.indexOf("credentials/password$#"), api.indexOf("credentials/reset$#"));
  const issue = api.slice(api.indexOf("credentials/reset$#"), api.indexOf("$path==='/auth/password-reset/validate'"));
  const complete = api.slice(api.indexOf("$path==='/auth/password-reset/complete'"), api.indexOf("credentials/temporary$#"));
  assert.match(direct, /requireRole\(\$user,\['owner'\]\)/); assert.match(direct, /DELETE FROM api_sessions WHERE user_id=\?/); assert.doesNotMatch(direct, /require_change|UPDATE users SET[^\n]*is_active=/);
  assert.match(issue, /random_bytes\(32\)/); assert.match(issue, /hash\('sha256',\$raw\)/); assert.match(issue, /INTERVAL 15 MINUTE/); assert.match(issue, /organization_id=\?/); assert.doesNotMatch(issue, /audit\([^\n]*\$raw/);
  assert.match(complete, /FOR UPDATE/); assert.match(complete, /used_at=NOW\(\)/); assert.match(complete, /passwordWasUsed/); assert.match(complete, /DELETE FROM api_sessions WHERE user_id=\?/); assert.doesNotMatch(complete, /UPDATE users SET[^\n]*is_active=/);
  assert.match(api, /credential_issue_retired/); assert.match(api, /if\s*\(\$path==='\/auth\/password-reset\/validate'/); assert.match(api, /if\s*\(\$path==='\/auth\/password-reset\/complete'/);
  assert.match(migration, /password_status='active'/); assert.match(migration, /temporary_expires_at=NULL/); assert.doesNotMatch(migration, /password_hash|is_active|must_change_password\s*=/);
  for (const source of [ownerUi, clientUi, resetUi, forcedUi]) assert.doesNotMatch(source, /كلمة مرور مؤقتة|المؤقتة/);
  assert.match(ownerUi, /إنشاء رابط إعادة تعيين/); assert.match(ownerUi, /setPasswordForm\(emptyPasswordForm\(\)\)/); assert.doesNotMatch(ownerUi, /localStorage|sessionStorage|require_change/);
  assert.match(clientUi, /autocomplete="current-password"/i); assert.match(clientUi, /autocomplete="new-password"/i); assert.match(clientUi, /role="status"/); assert.match(clientUi, /إظهار كلمات المرور/); assert.doesNotMatch(clientUi, /localStorage|sessionStorage/);
  assert.match(resetUi, /acquireResetFragment/); assert.match(resetFlow, /replaceState/); assert.match(resetFlow, /scheduleResetFragmentRelease/); assert.doesNotMatch(resetUi, /localStorage|sessionStorage/); assert.match(app, /path="\/reset-password"/); assert.match(dashboard, /ClientSecuritySettings/);
  assert.match(styles, /min-height:44px/); assert.match(styles, /background:#fffefa/); assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(dashboardStyles, /\.client-sidebar nav button,.client-logout \{ min-height:44px/); assert.match(dashboardStyles, /@media\(max-width:800px\)\{\s*\.client-sidebar nav\{display:grid!important;grid-template-columns:repeat\(5/);
});
