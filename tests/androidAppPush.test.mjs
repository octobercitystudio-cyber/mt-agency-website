import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('PWA manifest launches the live Arabic app and provides adaptive icons', async () => {
  const manifest = JSON.parse(await load('public/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/login?source=android-app');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.dir, 'rtl');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'monochrome'));
});

test('service worker handles push and clicks without caching site releases', async () => {
  const worker = await load('public/sw.js');
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /clients\.openWindow/);
  assert.doesNotMatch(worker, /addEventListener\('fetch'/);
  assert.doesNotMatch(worker, /caches\.open|cache\.put/);
});

test('Android package, notification delegation and Digital Asset Links share one signing identity', async () => {
  const [twaSource, gradle, androidManifest, assetLinksSource] = await Promise.all([
    load('android-twa/twa-manifest.json'),
    load('android-twa/app/build.gradle'),
    load('android-twa/app/src/main/AndroidManifest.xml'),
    load('public/.well-known/assetlinks.json'),
  ]);
  const twa = JSON.parse(twaSource);
  const assetLinks = JSON.parse(assetLinksSource);
  assert.equal(twa.packageId, 'com.multitaskagency.app');
  assert.equal(twa.host, 'multitaskagency.com');
  assert.equal(twa.enableNotifications, true);
  assert.match(gradle, /enableNotifications: true/);
  assert.match(androidManifest, /@bool\/enableNotification/);
  assert.equal(assetLinks[0].target.package_name, twa.packageId);
  assert.equal(assetLinks[0].target.sha256_cert_fingerprints[0], '28:0C:7B:AE:3E:EF:12:72:34:59:91:CC:C0:E8:80:A0:05:A9:F5:82:31:E1:97:04:83:D1:5E:25:E7:C8:A5:DA');
});

test('push schema is forward-only and scopes each token to exactly one account', async () => {
  const migration = await load('database/mysql/029_android_push_notifications.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS app_push_subscriptions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS app_push_jobs/);
  assert.match(migration, /UNIQUE KEY uq_app_push_token_hash/);
  assert.match(migration, /CHECK \(\(user_id IS NOT NULL AND client_id IS NULL\) OR \(user_id IS NULL AND client_id IS NOT NULL\)\)/);
  assert.match(migration, /UNIQUE KEY uq_app_push_notification/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE)\b/im);
});

test('production push routes require authentication or a worker key and preserve account scoping', async () => {
  const api = await load('api/index.php');
  assert.match(api, /\$path === '\/push\/config'.*requireUser\(\$user\)/s);
  assert.match(api, /\$path === '\/push\/subscriptions'.*\$method === 'POST'.*requireUser\(\$user\)/s);
  assert.match(api, /token_hash.*hash\('sha256',\$token\)/s);
  assert.match(api, /\$user\['role'\]==='client'.*client_id.*else.*user_id/s);
  assert.match(api, /\$path === '\/cron\/push-queue'.*HTTP_X_WORKER_KEY.*hash_equals/s);
  assert.match(api, /firebase\.messaging/);
});

test('permission is requested only by the explicit enable action and logout unregisters the device', async () => {
  const [push, bridge, store] = await Promise.all([
    load('src/lib/pushNotifications.js'),
    load('src/components/PushNotificationsBridge.jsx'),
    load('src/store/DataContext.jsx'),
  ]);
  assert.match(push, /if \(permission === 'default' && requestPermission\) permission = await Notification\.requestPermission\(\)/);
  assert.match(bridge, /registerPushNotifications\(dataClient, configuration, true\)/);
  assert.match(bridge, /onEnable=\{enable\}/);
  assert.ok((store.match(/unregisterPushNotifications\(dataClient\)/g) || []).length >= 2);
});
