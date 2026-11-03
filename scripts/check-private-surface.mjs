import assert from 'node:assert/strict';

// Read-only checks plus rejected empty login requests. Never send real credentials
// or run brute-force/load tests against production.
const base = new URL(process.env.MTA_SECURITY_TARGET || 'https://multitaskagency.com');
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS required');
const checks = [];
async function check(path, { status = 200, robots = false, privateCache = false, method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(new URL(path, base), { method, headers: { 'User-Agent': 'MTA-ReadOnly-Security-Check/1.0', ...headers }, body, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, status, `${path} status`);
  if (robots) assert.match(response.headers.get('x-robots-tag') || '', /noindex/, `${path} noindex`);
  if (privateCache) assert.match(response.headers.get('cache-control') || '', /no-store/, `${path} must not cache private data`);
  const text = method === 'HEAD' ? '' : await response.text();
  if (status === 401) { const data = JSON.parse(text); assert.equal(data.data, null); assert.equal(data.error.code, 'unauthorized'); }
  checks.push({ path, method, status: response.status });
  return { response, text };
}
for (const path of ['/login','/register','/change-password','/reset-password','/dashboard','/erp/finance','/adminmt/login','/app.html','/dist/app.html']) {
  const { response, text } = await check(path, { robots: true, privateCache: true });
  assert.match(response.headers.get('referrer-policy') || '', /no-referrer/);
  assert.match(text, /name="robots" content="noindex/);
  assert.doesNotMatch(text, /property="og:|name="twitter:|application\/ld\+json|<h1/);
}
for (const path of ['/api/data/clients','/api/data/bookings','/api/data/invoices','/api/data/payments','/api/finance/entries','/api/system-backups/export','/api/payment-proofs/1/file','/api/audit-logs']) await check(path, { status: 401, robots: true, privateCache: true });
for (const path of ['/api/config.php','/api/auth_identity.php','/api/owner_mfa.php','/api/vendor/firebase-php-jwt/composer.json','/dist/.vite/manifest.json','/src/App.jsx']) await check(path, { status: 403 });
for (const [path,audience] of [['/api/auth/login','client'],['/api/auth/staff/login','staff']]) {
  const { text } = await check(path, { status: 403, method: 'POST', headers: { 'Content-Type':'application/json', 'X-MTA-Audience':audience }, body:'{}', robots:true });
  assert.equal(JSON.parse(text).error.code, 'csrf_failed', `${audience} rejected before authentication`);
}
const { text: deniedOrigin } = await check('/api/auth/session', {status:403,headers:{Origin:'https://example.invalid'}});
assert.equal(JSON.parse(deniedOrigin).error.code, 'origin_not_allowed');
for (const path of ['/manifest.webmanifest','/downloads/MTA-1.0.7.apk','/downloads/MTA-Team-1.0.4.apk']) await check(path, {method:'HEAD',robots:true});
const { text: home, response: homeResponse } = await check('/ar/');
assert.match(home, /name="robots" content="index, follow"/);
assert.doesNotMatch(homeResponse.headers.get('x-robots-tag') || '', /noindex/);
const { text: sitemap } = await check('/sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]));
assert.equal(urls.length,32);
assert.ok(urls.every(url=>/^\/(ar|en)\//.test(url.pathname)));
const { text: robots } = await check('/robots.txt');
assert.doesNotMatch(robots, /^Disallow:/m, 'noindex login pages must be crawlable; data remains authenticated');
console.log(JSON.stringify({passed:checks.length,checks},null,2));
