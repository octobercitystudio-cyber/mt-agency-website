import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, authenticateDemoClientCredential, deactivateDemoMode, demoClient, resetDemoDatabase, resumeDemoCredentialSession } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

const setPassword = (clientId, password, requireChange = false, confirmation = password) => demoClient.request(`/clients/${clientId}/credentials/password`, { method: 'POST', body: JSON.stringify({ new_password: password, confirm_password: confirmation, require_change: requireChange }) });
const toggleAccess = (clientId, enabled) => demoClient.request(`/clients/${clientId}/credentials/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
const credentialMeta = clientId => demoClient.request(`/clients/${clientId}/credentials`, { method: 'GET' });
const patchUser = (userId, values) => demoClient.request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(values) });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('owner-set password works immediately while enabled and repeated login never changes access', async () => {
  const firstPassword = 'OwnerChosen2026A';
  const saved = await setPassword(1, firstPassword);
  assert.equal(saved.error, null);
  assert.equal(saved.data.access_enabled, true);
  assert.equal(saved.data.must_change_password, false, 'force-change defaults off');
  assert.equal(JSON.stringify(saved.data).includes(firstPassword), false, 'saved password is never echoed');
  assert.equal(await authenticateDemoClientCredential('01012345678', 'WrongPassword2026'), null);
  assert.equal((await credentialMeta(1)).data.access_enabled, true, 'failed login does not toggle access');

  const firstSession = await authenticateDemoClientCredential('01012345678', firstPassword);
  assert.equal(firstSession.must_change_password, false);
  await demoClient.auth.signOut();
  assert.ok(await authenticateDemoClientCredential('sara@example.com', firstPassword));
  await demoClient.auth.signOut();
  activateDemoMode('owner');
  assert.equal((await credentialMeta(1)).data.access_enabled, true, 'login/logout does not toggle access');

  const secondPassword = 'OwnerChanged2027B';
  assert.equal((await setPassword(1, secondPassword)).data.access_enabled, true);
  assert.equal(resumeDemoCredentialSession(firstSession), false, 'password change revokes the old versioned session');
  assert.equal(await authenticateDemoClientCredential('01012345678', firstPassword), null);
  assert.ok(await authenticateDemoClientCredential('01012345678', secondPassword));
  activateDemoMode('owner');
  assert.equal((await credentialMeta(1)).data.access_enabled, true);
});

test('explicit disable blocks the right password and password changes preserve disabled until explicit enable', async () => {
  const firstPassword = 'DisabledFlow2026A';
  const latestPassword = 'DisabledFlow2027B';
  await setPassword(1, firstPassword);
  const activeSession = await authenticateDemoClientCredential('01012345678', firstPassword);
  activateDemoMode('owner');
  assert.equal((await toggleAccess(1, false)).data.enabled, false);
  assert.equal(resumeDemoCredentialSession(activeSession), false);
  assert.equal(await authenticateDemoClientCredential('01012345678', firstPassword), null);

  activateDemoMode('owner');
  const changed = await setPassword(1, latestPassword);
  assert.equal(changed.data.access_enabled, false);
  assert.equal((await credentialMeta(1)).data.portal_access, 'disabled');
  assert.equal(await authenticateDemoClientCredential('01012345678', latestPassword), null);

  activateDemoMode('owner');
  await toggleAccess(1, true);
  assert.ok(await authenticateDemoClientCredential('01012345678', latestPassword));
  activateDemoMode('owner');
  assert.equal((await credentialMeta(1)).data.portal_access, 'enabled');
});

test('new credential starts disabled and enable without a credential fails safely', async () => {
  const password = 'NewPortalKey2026A';
  const created = await setPassword(2, password);
  assert.equal(created.error, null);
  assert.equal(created.data.access_enabled, false);
  const meta = await credentialMeta(2);
  assert.equal(meta.data.has_password, true);
  assert.equal(meta.data.portal_access, 'disabled');
  assert.equal(await authenticateDemoClientCredential('01023456789', password), null);

  const missing = await toggleAccess(3, true);
  assert.equal(missing.error?.code, 'client_credential_required');
  assert.equal((await credentialMeta(3)).data.has_password, false);

  const temporary = (await demoClient.request('/clients/3/credentials/temporary', { method: 'POST', body: '{}' })).data;
  assert.equal(temporary.portal_access, 'disabled', 'a generated credential also never enables a new portal');
  assert.equal(await authenticateDemoClientCredential(temporary.login_identifier, temporary.temporary_password), null);

  activateDemoMode('owner');
  await toggleAccess(2, true);
  assert.ok(await authenticateDemoClientCredential('01023456789', password));
});

test('owner custom password enforces confirmation, canonical policy, current and history reuse checks', async () => {
  const firstPassword = 'HistorySafe2026A';
  const secondPassword = 'HistorySafe2027B';
  assert.equal((await setPassword(1, '12345')).error?.code, 'weak_password', 'five characters remain invalid');
  assert.equal((await setPassword(1, '123456')).error, null, 'six digits are accepted without letters or symbols');
  assert.equal((await setPassword(1, 'abcdef')).error, null, 'six letters are accepted without digits or symbols');
  assert.equal((await setPassword(1, 'a1b2c3')).error, null, 'a six-character mix is accepted');
  assert.equal((await setPassword(1, firstPassword, false, `${firstPassword}x`)).error?.code, 'password_confirmation_mismatch');
  assert.equal((await setPassword(1, firstPassword)).error, null);
  assert.equal((await setPassword(1, firstPassword)).error?.code, 'password_reuse');
  assert.equal((await setPassword(1, secondPassword)).error, null);
  assert.equal((await setPassword(1, firstPassword)).error?.code, 'password_history_reuse');
  assert.equal((await credentialMeta(1)).data.access_enabled, true);
});

test('forced client password change accepts the same simple six-character policy', async () => {
  const issued = (await demoClient.request('/clients/1/credentials/temporary', { method: 'POST', body: '{}' })).data;
  assert.ok(await authenticateDemoClientCredential(issued.login_identifier, issued.temporary_password));
  assert.equal((await demoClient.auth.updateUser({ password: '98765' })).error?.code, 'weak_password');
  assert.equal((await demoClient.auth.updateUser({ password: '987654' })).error, null);
  await demoClient.auth.signOut();
  assert.ok(await authenticateDemoClientCredential(issued.login_identifier, '987654'));
});

test('optional owner force-change uses the same password and remains independent from enabled access', async () => {
  const initial = 'OwnerForced2026A';
  assert.equal((await setPassword(1, initial, true)).data.access_enabled, true);
  const forcedSession = await authenticateDemoClientCredential('01012345678', initial);
  assert.equal(forcedSession.must_change_password, true);
  const replacement = 'ClientSelected2027B';
  assert.equal((await demoClient.auth.updateUser({ password: replacement })).error, null);
  await demoClient.auth.signOut();
  assert.equal(await authenticateDemoClientCredential('01012345678', initial), null);
  assert.ok(await authenticateDemoClientCredential('01012345678', replacement));
  activateDemoMode('owner');
  const meta = await credentialMeta(1);
  assert.equal(meta.data.access_enabled, true);
  assert.equal(meta.data.must_change_password, false);
});

test('legacy disabled password status follows explicit access through enable, rotation, and disable', async () => {
  const legacyPassword = 'LegacyEnabled2026A';
  const rotatedPassword = 'LegacyRotated2027B';
  await setPassword(1, legacyPassword);

  const legacyDatabase = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const legacyClient = legacyDatabase.clients.find(client => Number(client.id) === 1);
  Object.assign(legacyClient, { portal_enabled: false, password_status: 'disabled' });
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(legacyDatabase));

  assert.equal((await credentialMeta(1)).data.portal_access, 'disabled');
  assert.equal((await toggleAccess(1, true)).data.enabled, true);
  const enabledDatabase = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(enabledDatabase.clients.find(client => Number(client.id) === 1).password_status, 'disabled', 'access toggle does not rewrite credential semantics');
  const enabledMeta = await credentialMeta(1);
  assert.equal(enabledMeta.data.access_enabled, true);
  assert.equal(enabledMeta.data.credential_state, 'active', 'legacy disabled status is not an access or credential-state gate');

  const firstSession = await authenticateDemoClientCredential('01012345678', legacyPassword);
  assert.ok(firstSession, 'explicitly enabled legacy account can log in');
  assert.equal(resumeDemoCredentialSession(firstSession), true, 'enabled legacy session survives restore');

  activateDemoMode('owner');
  assert.equal((await setPassword(1, rotatedPassword)).data.access_enabled, true, 'password rotation preserves enabled access');
  assert.equal(resumeDemoCredentialSession(firstSession), false, 'rotation revokes the previous credential version');
  assert.equal(await authenticateDemoClientCredential('01012345678', legacyPassword), null);
  const rotatedSession = await authenticateDemoClientCredential('01012345678', rotatedPassword);
  assert.ok(rotatedSession);

  activateDemoMode('owner');
  assert.equal((await credentialMeta(1)).data.access_enabled, true);
  assert.equal((await toggleAccess(1, false)).data.enabled, false);
  assert.equal(resumeDemoCredentialSession(rotatedSession), false, 'explicit disable revokes the current session');
  assert.equal(await authenticateDemoClientCredential('01012345678', rotatedPassword), null, 'explicit disable blocks login');
});

test('generic user management cannot bypass client credential, linkage, role, or access controls', async () => {
  const previousPassword = 'GenericGuard2026A';
  const password = 'GenericGuard2027B';
  await setPassword(1, previousPassword);
  await setPassword(1, password);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  database.users.push({ id: 91, client_id: 1, full_name: 'Client portal user', email: 'sara@example.com', phone: '01012345678', role: 'client', permissions: ['client_portal'], is_active: 1 });
  database.users.push({ id: 92, client_id: 2, full_name: 'Passwordless client', email: 'adel@example.com', phone: '01023456789', role: 'client', permissions: ['client_portal'], is_active: 0 });
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(database));

  const originalSession = await authenticateDemoClientCredential('01012345678', password);
  assert.ok(originalSession);
  activateDemoMode('owner');
  for (const mutation of [
    { is_active: 0 },
    { status: 'disabled' },
    { role: 'staff' },
    { client_id: null },
    { password: previousPassword },
    { email: 'attacker@example.com' },
    { phone: '01099999999' },
    { permissions: ['owner'] },
  ]) assert.equal((await patchUser(91, mutation)).error?.code, 'use_client_credential_flow', JSON.stringify(mutation));

  assert.equal((await patchUser(91, { full_name: 'Updated client label' })).error, null, 'safe display metadata remains editable');
  let after = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const protectedUser = after.users.find(user => Number(user.id) === 91);
  assert.equal(protectedUser.full_name, 'Updated client label');
  assert.deepEqual({ client_id: protectedUser.client_id, role: protectedUser.role, is_active: protectedUser.is_active, permissions: protectedUser.permissions }, { client_id: 1, role: 'client', is_active: 1, permissions: ['client_portal'] });
  assert.equal(resumeDemoCredentialSession(originalSession), true, 'rejected generic mutations do not disturb or replace the valid client session');

  activateDemoMode('owner');
  assert.equal((await patchUser(92, { is_active: 1 })).error?.code, 'use_client_credential_flow', 'passwordless linked account cannot be enabled generically');
  assert.equal((await toggleAccess(2, true)).error?.code, 'client_credential_required');

  for (const step of [{ role: 'staff' }, { password: 'RoleFlipBypass2027B' }, { role: 'client' }]) {
    assert.equal((await patchUser(91, step)).error?.code, 'use_client_credential_flow', 'each role-flip bypass step is blocked');
  }

  assert.equal((await toggleAccess(1, false)).data.enabled, false, 'dedicated disable still works');
  assert.equal(resumeDemoCredentialSession(originalSession), false, 'dedicated disable revokes the old session version');
  activateDemoMode('owner');
  assert.equal((await patchUser(91, { is_active: 1 })).error?.code, 'use_client_credential_flow');
  assert.equal(resumeDemoCredentialSession(originalSession), false, 'rejected generic re-enable cannot revive the old session');
  activateDemoMode('owner');
  assert.equal((await toggleAccess(1, true)).data.enabled, true, 'dedicated enable still works');
  assert.equal(resumeDemoCredentialSession(originalSession), false, 'explicit re-enable never revives the old credential version');
  assert.ok(await authenticateDemoClientCredential('01012345678', password));

  activateDemoMode('owner');
  assert.equal((await patchUser(4, { full_name: 'Updated staff', role: 'operations', is_active: 0, permissions: ['bookings'], password: 'StaffManaged2027A' })).error, null, 'generic non-client management remains functional');
  after = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const staff = after.users.find(user => Number(user.id) === 4);
  assert.deepEqual({ full_name: staff.full_name, role: staff.role, is_active: staff.is_active, permissions: staff.permissions }, { full_name: 'Updated staff', role: 'operations', is_active: 0, permissions: ['bookings'] });
  assert.equal(JSON.stringify(staff).includes('StaffManaged2027A'), false, 'generic staff password is never persisted in demo data');

  for (const role of ['admin', 'operations', 'finance', 'staff', 'client']) {
    activateDemoMode(role);
    assert.equal((await patchUser(4, { full_name: `Denied ${role}` })).error?.code, 'forbidden', role);
  }
});

test('all non-owner roles are denied password and access controls and no secret reaches persistence or audit', async () => {
  const secret = 'NeverPersist2026A';
  await setPassword(1, secret);
  for (const role of ['admin', 'operations', 'finance', 'staff', 'client']) {
    activateDemoMode(role);
    assert.equal((await setPassword(1, `Denied${role}2026A`)).error?.code, 'forbidden', role);
    assert.equal((await toggleAccess(1, false)).error?.code, 'forbidden', role);
  }
  const persisted = storage.get('mt_agency_erp_demo_v12');
  assert.equal(persisted.includes(secret), false);
  assert.equal(/new_password|confirm_password|password_hash|token_hash/.test(persisted), false);
  const database = JSON.parse(persisted);
  const passwordAudit = database.audit_logs.find(row => row.action === 'client_password_set');
  const auditText = JSON.stringify(passwordAudit);
  assert.equal(auditText.includes(secret), false);
  assert.equal(/password_hash|new_password|confirm_password|secret/i.test(JSON.stringify(passwordAudit.after_data)), false);
  assert.deepEqual(Object.keys(passwordAudit.after_data).sort(), ['access_enabled', 'client_id', 'require_change', 'sessions_revoked']);
});

test('production and owner UI contracts keep password save independent, scoped, hash-only and ephemeral', async () => {
  const [api, accessMigration, component, clientModal, styles] = await Promise.all([
    readFile(new URL('api/index.php', root), 'utf8'),
    readFile(new URL('database/mysql/022_client_access_authority.sql', root), 'utf8'),
    readFile(new URL('src/erp/ClientCredentialSecurity.jsx', root), 'utf8'),
    readFile(new URL('src/erp/ERPClientModal.jsx', root), 'utf8'),
    readFile(new URL('src/erp/ClientCredentialSecurity.css', root), 'utf8'),
  ]);
  const passwordBlock = api.slice(api.indexOf("credentials/password$#"), api.indexOf("credentials/temporary$#"));
  const toggleBlock = api.slice(api.indexOf("credentials/toggle$#"), api.indexOf("^/clients/(\\d+)/access$#"));
  const loginBlock = api.slice(api.indexOf("$path === '/auth/login'"), api.indexOf("$path === '/auth/session'"));
  const sessionBlock = api.slice(api.indexOf('function sessionUser'), api.indexOf('function requireUser'));
  const forcedPasswordBlock = api.slice(api.indexOf("$path === '/auth/password'"), api.indexOf("$path === '/sync'"));
  const genericUserBlock = api.slice(api.indexOf("preg_match('#^/users/(\\d+)$#'"), api.indexOf("$path === '/clients' && $method === 'POST'"));
  assert.ok(passwordBlock.includes("requireRole($user,['owner'])"));
  assert.ok(passwordBlock.includes('validClientPassword($next)'));
  assert.ok(passwordBlock.includes("organization_id=? AND role='client' FOR UPDATE"));
  assert.ok(passwordBlock.includes('password_hash($next,PASSWORD_DEFAULT)'));
  assert.ok(passwordBlock.includes('passwordWasUsed'));
  assert.ok(passwordBlock.includes('retainPasswordHash'));
  assert.ok(passwordBlock.includes('DELETE FROM api_sessions WHERE user_id=? AND user_id<>?'));
  assert.ok(passwordBlock.includes("[$accountId,$user['id']]"), 'the acting owner session is excluded from client-session revocation');
  assert.ok(passwordBlock.includes('password_reset_tokens'));
  assert.ok(passwordBlock.includes("'client',0,'active'"), 'new credential is explicitly disabled');
  assert.doesNotMatch(passwordBlock, /UPDATE users SET[^\n]*is_active=/, 'password update preserves access');
  assert.match(toggleBlock, /UPDATE users SET is_active=\?,credential_version=credential_version\+1/);
  assert.doesNotMatch(toggleBlock, /password_status=|password_hash=/);
  assert.doesNotMatch(loginBlock, /WHERE is_active = 1/, 'login may identify a disabled account but must not create a session for it');
  assert.ok(loginBlock.indexOf('password_verify') < loginBlock.indexOf('account_disabled'));
  assert.doesNotMatch(loginBlock, /password_status[^\n]*disabled|disabled[^\n]*password_status/, 'legacy status cannot override active access');
  assert.doesNotMatch(loginBlock, /UPDATE users SET is_active/);
  assert.ok(sessionBlock.includes('AND u.is_active = 1 LIMIT 1'));
  assert.doesNotMatch(sessionBlock, /password_status\s*(?:=|<>|!=)[^\n]*disabled/, 'sessions use the same access authority as login');
  assert.doesNotMatch(forcedPasswordBlock, /UPDATE users SET[^\n]*is_active=/, 'client password completion preserves enabled access');
  assert.ok(genericUserBlock.includes('SELECT id, client_id'));
  assert.ok(genericUserBlock.includes('clientCredentialMutationRequested($payload)'));
  assert.ok(genericUserBlock.indexOf('clientCredentialMutationRequested($payload)') < genericUserBlock.indexOf("foreach(['full_name','email','phone','role','is_active']"), 'client guard runs before generic fields are assembled');
  for (const field of ['email','phone','is_active','status','role','client_id','password','password_hash','password_status','must_change_password','credential_version','temporary_expires_at','permissions']) assert.ok(api.slice(api.indexOf('function clientCredentialMutationRequested'), api.indexOf('function loginIdentity')).includes(`'${field}'`));
  assert.ok(api.includes("if (!empty($payload['client_id'])) fail"), 'generic create cannot create a client-linked staff account');
  assert.match(accessMigration, /UPDATE users[\s\S]*SET password_status = CASE[\s\S]*must_change_password = 1 AND temporary_expires_at IS NOT NULL[\s\S]*THEN 'temporary'[\s\S]*ELSE 'active'[\s\S]*WHERE role = 'client' AND password_status = 'disabled'/);
  assert.equal(/SET\s+is_active/i.test(accessMigration), false, 'compatibility migration never enables a portal implicitly');
  assert.match(accessMigration, /COLUMN_NAME IN \('password_status','must_change_password','temporary_expires_at'\)/, 'migration guards its 021 dependency order');

  assert.ok(component.includes('/credentials/password'));
  assert.ok(component.includes('CLIENT_PASSWORD_HINT'));
  assert.ok(component.includes('CLIENT_PASSWORD_MIN_LENGTH'));
  assert.ok(component.includes('type={passwordVisible ? \'text\' : \'password\'}'));
  assert.ok(component.includes('إظهار كلمة المرور الجديدة'));
  assert.equal(component.includes('current_password'), false);
  assert.equal(component.includes('إظهار كلمة المرور الحالية'), false);
  assert.ok(component.includes('setPasswordForm(emptyPasswordForm())'));
  assert.ok(component.includes('event.stopPropagation()'), 'credential submit cannot bubble into the client details form');
  assert.equal(/localStorage|sessionStorage/.test(component), false);
  assert.ok(clientModal.lastIndexOf('</form>') < clientModal.indexOf('<ClientCredentialSecurity'), 'credential controls are not nested inside the client details form');
  assert.match(styles, /credential-security__control-grid\{[^}]*grid-template-columns:minmax\(0,1\.35fr\) minmax\(280px,\.65fr\)/);
  assert.match(styles, /@media\(max-width:980px\)\{\.credential-security__control-grid\{grid-template-columns:1fr\}/);
  assert.match(styles, /credential-password-dialog\{[^}]*width:min\(100%,560px\);[^}]*max-height:calc\(100dvh - 32px\);[^}]*overflow:auto/);
  assert.match(styles, /credential-password-input button\{width:44px;height:44px/);
  assert.match(styles, /credential-password-(?:cancel|submit)\{min-height:44px/);
  assert.match(styles, /@media\(max-width:560px\)/);
});
