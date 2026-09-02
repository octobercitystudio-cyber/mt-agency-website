import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../api/index.php', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/hostingerClient.js', import.meta.url), 'utf8');
const about = await readFile(new URL('../src/components/About.jsx', import.meta.url), 'utf8');
const migration = await readFile(new URL('../database/mysql/016_security_hardening.sql', import.meta.url), 'utf8');
const htaccess = await readFile(new URL('../.htaccess', import.meta.url), 'utf8');

test('authenticated mutations require a same-site CSRF token', () => {
  assert.match(api, /function requireCsrf/);
  assert.match(api, /HTTP_X_CSRF_TOKEN/);
  assert.match(api, /hash_equals\(\$cookie, \$header\)/);
  assert.match(client, /X-CSRF-Token/);
  assert.match(client, /__Host-mt_csrf/);
});

test('sessions use hardened cookies, an idle timeout and a device binding', () => {
  assert.match(api, /__Host-mt_session/);
  assert.match(api, /'httponly' => true/);
  assert.match(api, /'samesite' => 'Strict'/);
  assert.match(api, /session_idle_minutes/);
  assert.match(api, /user_agent_hash = \?/);
  assert.match(api, /max_sessions_per_user/);
});

test('login guessing is throttled without storing raw identifiers or IPs', () => {
  assert.match(api, /enforceLoginRateLimit/);
  assert.match(api, /recordLoginFailure/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_rate_limits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_security_events/);
  assert.doesNotMatch(migration, /\bemail\b|\bphone\b|ip_address/i);
});

test('generic updates and deletes require a bounded record identifier', () => {
  assert.match(api, /record_identifier_required/);
  assert.match(api, /count\(\$value\) <= 100/);
  assert.match(api, /\$column === 'id'/);
});

test('public rendering cannot execute editable About HTML', () => {
  assert.doesNotMatch(about, /dangerouslySetInnerHTML/);
});

test('the web server enforces HTTPS and browser security headers', () => {
  assert.match(htaccess, /Strict-Transport-Security/);
  assert.match(htaccess, /Content-Security-Policy/);
  assert.match(htaccess, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(htaccess, /script-src[^;]*'unsafe-eval'/);
  assert.match(htaccess, /frame-ancestors 'none'/);
  assert.match(htaccess, /X-Robots-Tag "noindex, nofollow, noarchive"/);
});
