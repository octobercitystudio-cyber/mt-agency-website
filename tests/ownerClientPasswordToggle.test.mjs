import assert from 'node:assert/strict';
import test from 'node:test';
import { activateDemoMode, authenticateDemoClientCredential, deactivateDemoMode, demoClient, resetDemoDatabase, resumeDemoCredentialSession } from '../src/lib/demoDataClient.js';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
const setPassword = (clientId, password, confirmation = password) => demoClient.request(`/clients/${clientId}/credentials/password`, { method: 'POST', body: JSON.stringify({ password, confirm_password: confirmation }) });
const toggleAccess = (clientId, enabled) => demoClient.request(`/clients/${clientId}/credentials/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
const credentialMeta = clientId => demoClient.request(`/clients/${clientId}/credentials`, { method: 'GET' });
const patchUser = (userId, values) => demoClient.request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(values) });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('owner-set password works while enabled and repeated login never changes access', async () => {
  const first = 'OwnerChosen2026A'; const second = 'OwnerChanged2027B';
  assert.equal((await setPassword(1, first)).data.access_enabled, true);
  const session = await authenticateDemoClientCredential('01012345678', first); assert.ok(session);
  await demoClient.auth.signOut(); assert.ok(await authenticateDemoClientCredential('sara@example.com', first));
  activateDemoMode('owner'); assert.equal((await credentialMeta(1)).data.access_enabled, true);
  assert.equal((await setPassword(1, second)).data.access_enabled, true); assert.equal(resumeDemoCredentialSession(session), false); assert.equal(await authenticateDemoClientCredential('01012345678', first), null);
});

test('explicit disable blocks login and direct password changes preserve disabled access', async () => {
  const first = 'DisabledFlow2026A'; const second = 'DisabledFlow2027B'; await setPassword(1, first);
  const session = await authenticateDemoClientCredential('01012345678', first); activateDemoMode('owner'); await toggleAccess(1, false);
  assert.equal(resumeDemoCredentialSession(session), false); assert.equal(await authenticateDemoClientCredential('01012345678', first), null);
  activateDemoMode('owner'); assert.equal((await setPassword(1, second)).data.access_enabled, false); assert.equal(await authenticateDemoClientCredential('01012345678', second), null);
  activateDemoMode('owner'); await toggleAccess(1, true); assert.ok(await authenticateDemoClientCredential('01012345678', second));
});

test('new credential starts disabled and enable without a credential fails safely', async () => {
  const password = 'NewPortalKey2026A'; const created = await setPassword(2, password); assert.equal(created.data.access_enabled, false); assert.equal(await authenticateDemoClientCredential('01023456789', password), null);
  assert.equal((await toggleAccess(3, true)).error?.code, 'client_credential_required');
  assert.equal((await setPassword(3, 'ThirdClient2026A')).data.access_enabled, false); assert.equal(await authenticateDemoClientCredential('01034567890', 'ThirdClient2026A'), null);
});

test('owner custom password enforces confirmation, shared policy, current and history reuse', async () => {
  const first = 'HistorySafe2026A'; const second = 'HistorySafe2027B';
  assert.equal((await setPassword(1, '12345')).error?.code, 'weak_password'); assert.equal((await setPassword(1, '123456')).error, null); assert.equal((await setPassword(1, 'abcdef')).error, null); assert.equal((await setPassword(1, first, `${first}x`)).error?.code, 'password_confirmation_mismatch');
  assert.equal((await setPassword(1, first)).error, null); assert.equal((await setPassword(1, first)).error?.code, 'password_reuse'); assert.equal((await setPassword(1, second)).error, null); assert.equal((await setPassword(1, first)).error?.code, 'password_history_reuse');
});

test('generic user management cannot bypass client credential, linkage, role or access controls', async () => {
  const password = 'GenericGuard2027B'; await setPassword(1, password); const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  database.users.push({ id: 91, client_id: 1, full_name: 'Client portal user', email: 'sara@example.com', phone: '01012345678', role: 'client', permissions: ['client_portal'], is_active: 1 }); storage.set('mt_agency_erp_demo_v12', JSON.stringify(database));
  for (const mutation of [{ is_active: 0 }, { role: 'staff' }, { client_id: null }, { password: 'Bypass2028A' }, { email: 'attacker@example.com' }, { phone: '01099999999' }, { permissions: ['owner'] }]) assert.equal((await patchUser(91, mutation)).error?.code, 'use_client_credential_flow');
  assert.equal((await patchUser(91, { full_name: 'Updated client label' })).error, null);
});

test('all non-owner roles are denied password, reset and access controls and audit remains secret-free', async () => {
  const secret = 'NeverPersist2026A'; await setPassword(1, secret);
  for (const role of ['admin', 'operations', 'finance', 'staff', 'client']) { activateDemoMode(role); assert.equal((await setPassword(1, `Denied${role}2026A`)).error?.code, 'forbidden'); assert.equal((await toggleAccess(1, false)).error?.code, 'forbidden'); assert.equal((await demoClient.request('/clients/1/credentials/reset', { method: 'POST', body: '{}' })).error?.code, 'forbidden'); }
  const persisted = storage.get('mt_agency_erp_demo_v12'); assert.equal(persisted.includes(secret), false); const audit = JSON.parse(persisted).audit_logs.find(row => row.action === 'client_password_set'); assert.deepEqual(Object.keys(audit.after_data).sort(), ['access_enabled', 'client_id', 'reset_tokens_revoked', 'sessions_revoked']);
});
