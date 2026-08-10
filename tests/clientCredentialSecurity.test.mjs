import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, authenticateDemoClientCredential, deactivateDemoMode, demoClient, resetDemoDatabase, resumeDemoCredentialSession } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('temporary credential is returned once, persisted hash-free, and metadata never reveals it', async () => {
  const issued = await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' });
  assert.equal(issued.error, null);
  assert.match(issued.data.temporary_password, /\p{L}/u);
  assert.match(issued.data.temporary_password, /\d/);
  assert.ok(issued.data.temporary_password.length >= 12);
  const persisted = storage.get('mt_agency_erp_demo_v12');
  assert.equal(persisted.includes(issued.data.temporary_password), false, 'the one-time secret must not reach localStorage');
  assert.equal(/password_hash|token_hash/.test(persisted), false, 'demo fixtures must remain hash/secret free');
  const meta = await demoClient.request('/clients/1/credentials', { method: 'GET' });
  assert.equal(meta.data.credential_state, 'change_required');
  assert.equal(JSON.stringify(meta.data).includes(issued.data.temporary_password), false);
  assert.equal('temporary_password' in meta.data, false);
});

test('credential controls are owner-only and forced completion rejects reuse', async () => {
  const issued = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  const authenticated = await authenticateDemoClientCredential(issued.login_identifier, issued.temporary_password);
  assert.equal(authenticated.must_change_password, true);
  activateDemoMode('owner');
  for (const role of ['admin', 'operations', 'finance', 'staff', 'client']) {
    activateDemoMode(role);
    const denied = await demoClient.request('/clients/1/credentials', { method: 'GET' });
    assert.equal(denied.error?.code, 'forbidden', `${role} cannot read credential metadata`);
  }
  activateDemoMode('client');
  const reused = await demoClient.auth.updateUser({ password: issued.temporary_password });
  assert.equal(reused.error?.code, 'password_reuse');
  const weak = await demoClient.auth.updateUser({ password: 'shor1' });
  assert.equal(weak.error?.code, 'weak_password');
  const changed = await demoClient.auth.updateUser({ password: 'abcdef' });
  assert.equal(changed.error, null);
  assert.equal(changed.data.user.must_change_password, false);
  assert.equal(await authenticateDemoClientCredential(issued.login_identifier, issued.temporary_password), null, 'the consumed temporary password cannot authenticate again');
  activateDemoMode('owner');
  const meta = await demoClient.request('/clients/1/credentials', { method: 'GET' });
  assert.equal(meta.data.credential_state, 'active');
  assert.equal(meta.data.temporary_expires_at, null);
});

test('full demo lifecycle rejects pre-reset and temporary passwords but accepts the new permanent password', async () => {
  const first = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  assert.ok(await authenticateDemoClientCredential(first.login_identifier, first.temporary_password));
  const firstPermanent = 'FirstPermanent2026!';
  assert.equal((await demoClient.auth.updateUser({ password: firstPermanent })).error, null);
  deactivateDemoMode();
  const permanentSession = await authenticateDemoClientCredential(first.login_identifier, firstPermanent);
  assert.equal(permanentSession.must_change_password, false, 'the chosen permanent password supports a real later login');

  activateDemoMode('owner');
  const second = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  assert.equal(resumeDemoCredentialSession(permanentSession), false, 'issuing a new credential invalidates the prior versioned session');
  assert.ok(await authenticateDemoClientCredential(second.login_identifier, second.temporary_password));
  assert.equal((await demoClient.auth.updateUser({ password: firstPermanent })).error?.code, 'password_history_reuse');
  assert.equal((await demoClient.auth.updateUser({ password: second.temporary_password })).error?.code, 'password_reuse');
  const finalPermanent = 'FinalPermanent2027!';
  assert.equal((await demoClient.auth.updateUser({ password: finalPermanent })).error, null);
  deactivateDemoMode();
  assert.equal(await authenticateDemoClientCredential(second.login_identifier, firstPermanent), null);
  assert.equal(await authenticateDemoClientCredential(second.login_identifier, second.temporary_password), null);
  assert.equal((await authenticateDemoClientCredential(second.login_identifier, finalPermanent)).must_change_password, false);
  const persisted = storage.get('mt_agency_erp_demo_v12');
  for (const secret of [first.temporary_password, firstPermanent, second.temporary_password, finalPermanent]) assert.equal(persisted.includes(secret), false);
});

test('temporary issuance preserves an explicit disabled portal until a separate audited enable', async () => {
  const first = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: false }) });
  const second = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  const disabledMeta = await demoClient.request('/clients/1/credentials', { method: 'GET' });
  assert.equal(disabledMeta.data.portal_access, 'disabled');
  assert.equal(await authenticateDemoClientCredential(second.login_identifier, second.temporary_password), null);
  const databaseBeforeEnable = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const latestActions = databaseBeforeEnable.audit_logs.slice(-2).map(row => row.action);
  assert.deepEqual(latestActions, ['client_portal_disabled', 'temporary_credential_issued']);
  await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: true }) });
  assert.ok(await authenticateDemoClientCredential(second.login_identifier, second.temporary_password));
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(database.audit_logs.at(-1).action, 'client_portal_enabled');
  assert.equal(JSON.stringify(database).includes(first.temporary_password), false);
});

test('demo credential versions invalidate restored client sessions on revoke and disable', async () => {
  const issued = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  const forcedSession = await authenticateDemoClientCredential(issued.login_identifier, issued.temporary_password);
  activateDemoMode('owner'); await demoClient.request('/clients/1/credentials/sessions/revoke', { method: 'POST', body: '{}' });
  assert.equal(resumeDemoCredentialSession(forcedSession), false);
  activateDemoMode('owner'); const reissued = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  const nextSession = await authenticateDemoClientCredential(reissued.login_identifier, reissued.temporary_password);
  activateDemoMode('owner'); await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: false }) });
  assert.equal(resumeDemoCredentialSession(nextSession), false);
});

test('session revoke and disable increment safe state without audit secrets', async () => {
  const issued = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  const revoked = await demoClient.request('/clients/1/credentials/sessions/revoke', { method: 'POST', body: '{}' });
  assert.equal(revoked.error, null);
  const disabled = await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: false }) });
  assert.equal(disabled.data.enabled, false);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const audits = JSON.stringify(database.audit_logs.filter(row => ['temporary_credential_issued', 'client_sessions_revoked', 'client_portal_disabled'].includes(row.action)));
  assert.equal(audits.includes(issued.temporary_password), false);
  assert.equal(/password_hash|token_hash/.test(audits), false);
});

test('production contracts enforce versioned sessions, forced allowlist, token rotation, and retired weak routes', async () => {
  const [api, migration, modal, security, forced, app, login] = await Promise.all([
    readFile(new URL('api/index.php', root), 'utf8'), readFile(new URL('database/mysql/021_client_credential_security.sql', root), 'utf8'),
    readFile(new URL('src/erp/ERPClientModal.jsx', root), 'utf8'), readFile(new URL('src/erp/ClientCredentialSecurity.jsx', root), 'utf8'),
    readFile(new URL('src/pages/ForcedPasswordChange.jsx', root), 'utf8'), readFile(new URL('src/App.jsx', root), 'utf8'), readFile(new URL('src/pages/UnifiedLogin.jsx', root), 'utf8'),
  ]);
  for (const column of ['password_changed_at', 'password_status', 'must_change_password', 'credential_version', 'temporary_expires_at']) assert.ok(migration.includes(column));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS user_password_history'));
  assert.ok(migration.includes('password_hash VARCHAR(255) NOT NULL'));
  assert.ok(api.includes('passwordWasUsed'));
  assert.ok(api.includes("retainPasswordHash($pdo,$account,'temporary_issued')"));
  assert.ok(api.includes("password_history_reuse"));
  const temporaryBlock = api.slice(api.indexOf("credentials/temporary$#"), api.indexOf("credentials/sessions/revoke$#"));
  assert.doesNotMatch(temporaryBlock, /UPDATE users SET[^\n]*is_active=/, 'temporary issuance never mutates the existing access flag');
  assert.ok(temporaryBlock.includes("'client',0,'temporary'"), 'new temporary credential starts with access disabled');
  assert.ok(api.includes('s.credential_version = u.credential_version'));
  assert.ok(api.includes("password_needs_rehash"));
  assert.ok(api.includes("['/auth/session','/auth/password','/auth/logout','/health']"));
  assert.ok(api.includes("insecure_credential_route_retired"));
  assert.ok(api.includes("DELETE FROM api_sessions WHERE user_id=?"));
  assert.ok(api.includes("setSessionCookie($config,$rawToken,$days)"));
  assert.equal(modal.includes('portalPassword'), false);
  assert.equal(modal.includes('/access'), false);
  assert.ok(security.includes('لن تظهر هذه البيانات مرة أخرى'));
  assert.ok(security.includes('setHandoff(null)'));
  assert.ok(forced.includes('CLIENT_PASSWORD_HINT'));
  assert.ok(forced.includes('CLIENT_PASSWORD_MIN_LENGTH'));
  assert.equal(forced.includes('تحتوي حرفًا'), false);
  assert.equal(forced.includes('تحتوي رقمًا'), false);
  assert.ok(app.includes('/change-password'));
  assert.ok(login.includes("must_change_password ? '/change-password' : '/dashboard'"));
});
