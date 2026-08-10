import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CLIENT_PASSWORD_MAX_LENGTH, CLIENT_PASSWORD_MIN_LENGTH, isValidClientPassword } from '../src/lib/clientPasswordPolicy.js';
import { activateDemoMode, authenticateDemoClientCredential, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('client-only password policy accepts six digits, letters, or a mix and rejects five', () => {
  assert.equal(CLIENT_PASSWORD_MIN_LENGTH, 6);
  assert.equal(CLIENT_PASSWORD_MAX_LENGTH, 128);
  assert.equal(isValidClientPassword('12345'), false);
  assert.equal(isValidClientPassword('123456'), true);
  assert.equal(isValidClientPassword('abcdef'), true);
  assert.equal(isValidClientPassword('a1b2c3'), true);
  assert.equal(isValidClientPassword(`abc\ndef`), false);
});

test('demo client login accepts an enabled account and rejects wrong or disabled credentials', async () => {
  const saved = await demoClient.request('/clients/1/credentials/password', { method: 'POST', body: JSON.stringify({ new_password: 'a1b2c3', confirm_password: 'a1b2c3', require_change: false }) });
  assert.equal(saved.error, null);
  assert.equal(saved.data.access_enabled, true);
  assert.ok(await authenticateDemoClientCredential('01012345678', 'a1b2c3'));
  await demoClient.auth.signOut();
  assert.equal(await authenticateDemoClientCredential('01012345678', 'wrong1'), null);
  activateDemoMode('owner');
  assert.equal((await demoClient.request('/clients/1/credentials/toggle', { method: 'POST', body: JSON.stringify({ enabled: false }) })).error, null);
  assert.equal(await authenticateDemoClientCredential('01012345678', 'a1b2c3'), null);
});

test('the simpler client policy never weakens owner or staff passwords', async () => {
  const weakStaff = await demoClient.request('/users', { method: 'POST', body: JSON.stringify({ full_name: 'موظف اختبار', email: 'staff-policy@test.local', role: 'staff', password: 'abcdef' }) });
  assert.equal(weakStaff.error?.code, 'weak_password');
  const strongStaff = await demoClient.request('/users', { method: 'POST', body: JSON.stringify({ full_name: 'موظف اختبار', email: 'staff-policy@test.local', role: 'staff', password: 'StaffSecure2026' }) });
  assert.equal(strongStaff.error, null);
});

test('production login uses Hostinger /api by default and preserves explicit access authority', async () => {
  const [provider, hostinger, env, api] = await Promise.all([
    load('src/supabaseClient.js'),
    load('src/lib/hostingerClient.js'),
    load('.env.example'),
    load('api/index.php'),
  ]);
  const loginBlock = api.slice(api.indexOf("$path === '/auth/login'"), api.indexOf("$path === '/auth/session'"));
  assert.match(provider, /VITE_DATA_PROVIDER \|\| 'hostinger'/);
  assert.match(provider, /configuredProvider !== 'supabase'/);
  assert.match(hostinger, /VITE_API_URL \|\| '\/api'/);
  assert.match(env, /VITE_DATA_PROVIDER=hostinger/);
  assert.match(api, /function validClientPassword[\s\S]*?\$length >= 6[\s\S]*?\$length <= 128/);
  assert.match(api, /function validPassword[\s\S]*?\$length >= 12[\s\S]*?preg_match\('\/\[\\p\{L\}\]\//);
  assert.match(loginBlock, /loginPhoneCandidates\(\$identifier\)/);
  assert.match(loginBlock, /account_disabled/);
  assert.ok(loginBlock.indexOf('password_verify') < loginBlock.indexOf('account_disabled'), 'disabled status is disclosed only after the supplied password is verified');
  assert.doesNotMatch(loginBlock, /WHERE is_active = 1/);
  assert.doesNotMatch(loginBlock, /UPDATE users SET is_active/);
});

test('login surface exposes stable premium loading, distinct Arabic errors, and accessible states', async () => {
  const [login, css] = await Promise.all([load('src/pages/UnifiedLogin.jsx'), load('src/pages/UnifiedLogin.css')]);
  for (const code of ['validation_error', 'invalid_credentials', 'account_disabled', 'login_temporarily_blocked', 'api_error']) assert.match(login, new RegExp(code));
  assert.match(login, /جارٍ تسجيل الدخول…/);
  assert.match(login, /aria-busy=\{loading\}/);
  assert.match(login, /LoaderCircle/);
  assert.match(login, /ArrowLeft/);
  assert.match(login, /aria-live="polite"/);
  assert.match(css, /\.unified-login-submit\{[^}]*min-height:54px/);
  assert.match(css, /\.unified-login-submit:focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media\(max-width:340px\)/);
});
