import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLIENT_APP_DOWNLOAD_URL, CLIENT_APP_PACKAGE_ID, CLIENT_APP_VERSION } from '../src/data/clientApp.js';
import { clientAppEntry, clientAppVersionStatus, installedClientVersion, updateSnoozed, CLIENT_APP_UPDATE_SNOOZE_MS } from '../src/lib/clientAppUpdate.js';

test('compares installed releases numerically and never calls a newer release outdated', () => {
  assert.equal(clientAppVersionStatus('1.0.6'), 'outdated');
  assert.equal(clientAppVersionStatus(CLIENT_APP_VERSION), 'current');
  assert.equal(clientAppVersionStatus('1.0.10'), 'current');
  assert.equal(clientAppVersionStatus('2.0.0'), 'current');
  for (const value of [undefined, null, '', 'invalid', '1.0']) assert.equal(clientAppVersionStatus(value), 'unknown');
});

test('client launcher and shortcuts are recognized, staff signals override remembered client state', () => {
  assert.equal(clientAppEntry({ search: '?source=android-app', userAgent: 'Android' }), true);
  assert.equal(clientAppEntry({ search: '?source=android-shortcut', userAgent: 'Android' }), true);
  assert.equal(clientAppEntry({ referrer: 'android-app://com.multitaskagency.app/' }), true);
  assert.equal(clientAppEntry({ remembered: true }), true);
  assert.equal(clientAppEntry({ search: '?source=android-staff-app', remembered: true }), false);
  assert.equal(clientAppEntry({ referrer: 'android-app://com.multitaskagency.staff/', remembered: true }), false);
  assert.equal(clientAppEntry({ userAgent: 'Android' }), false);
  assert.equal(clientAppEntry({ search: '?source=android-app', userAgent: 'Windows' }), false);
  assert.equal(clientAppEntry({ referrer: 'android-app://com.multitaskagency.app.fake/' }), false);
});

test('installed app lookup uses only the client package and handles missing, failed and stalled APIs', async () => {
  assert.equal(await installedClientVersion({ getInstalledRelatedApps: async () => [
    { platform: 'play', id: 'com.multitaskagency.staff', version: '1.0.4' },
    { platform: 'play', id: CLIENT_APP_PACKAGE_ID, version: '1.0.6' },
  ] }), '1.0.6');
  assert.equal(await installedClientVersion({ getInstalledRelatedApps: async () => [{ platform: 'play', id: 'other.app', version: '1.0.6' }] }), null);
  assert.equal(await installedClientVersion({}), null);
  assert.equal(await installedClientVersion({ getInstalledRelatedApps: async () => { throw new Error('unsupported'); } }), null);
  assert.equal(await installedClientVersion({ getInstalledRelatedApps: () => new Promise(() => {}) }, 5), null);
});

test('remind later expires and invalid stored timestamps cannot hide updates indefinitely', () => {
  const now = 100000000;
  assert.equal(updateSnoozed(now + CLIENT_APP_UPDATE_SNOOZE_MS, now), true);
  assert.equal(updateSnoozed(now, now), false);
  assert.equal(updateSnoozed(now - 1, now), false);
  assert.equal(updateSnoozed('NaN', now), false);
  assert.equal(updateSnoozed(now + CLIENT_APP_UPDATE_SNOOZE_MS + 1, now), false);
});

test('release metadata, downloadable APK and manifest agree on the client application', async () => {
  const twa = JSON.parse(await readFile(new URL('../android-twa/twa-manifest.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(CLIENT_APP_VERSION, twa.appVersion);
  assert.equal(CLIENT_APP_PACKAGE_ID, twa.packageId);
  assert.equal(CLIENT_APP_DOWNLOAD_URL, `/downloads/MTA-${twa.appVersion}.apk`);
  assert.ok(manifest.related_applications.some(app => app.platform === 'play' && app.id === twa.packageId));
  const apk = await readFile(new URL(`../public${CLIENT_APP_DOWNLOAD_URL}`, import.meta.url));
  assert.equal(apk.subarray(0, 2).toString(), 'PK');
});
