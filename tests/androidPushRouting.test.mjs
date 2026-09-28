import { STAFF_BASE, STAFF_LOGIN_PATH, staffPath } from '../src/lib/staffRoutes.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isolateCustomerAppLinks } from '../scripts/sync-android-client-links.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const customer = read('android-twa/app/src/main/AndroidManifest.xml');
const staff = read('android-twa/staff/src/main/AndroidManifest.xml');
// Android combines data elements within an intent filter. A broad HTTPS filter
// without paths would match every route, allowing Chrome to pick either app.
function handles(xml, path) {
  return [...xml.matchAll(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g)].some(([filter]) => {
    if (!filter.includes('android:scheme="https"') || !filter.includes('android.intent.action.VIEW')) return false;
    const paths = [...filter.matchAll(/android:(path|pathPrefix)="([^"]*)"/g)];
    return !paths.length || paths.some(([, kind, value]) => kind === 'path' ? path === value : path.startsWith(value));
  });
}
test('every notification worker scope resolves to exactly one installed MTA app', () => {
  for (const path of ['/', '/login', '/register', '/reset-password', '/dashboard', '/dashboard/']) {
    assert.equal(handles(customer, path), true, path);
    assert.equal(handles(staff, path), false, path);
  }
  for (const path of ['/erp', '/erp/', '/erp/requests', '/erp/bookings', STAFF_LOGIN_PATH, STAFF_BASE, staffPath('/requests')]) {
    assert.equal(handles(customer, path), false, path);
    assert.equal(handles(staff, path), true, path);
  }
});
test('regenerating the customer wrapper cannot silently restore the all-site delegate', () => {
  const broad = '<intent-filter><action android:name="android.intent.action.VIEW"/><data android:scheme="https" android:host="@string/hostName"/></intent-filter>';
  assert.equal(handles(broad, '/erp/'), true);
  const updated = isolateCustomerAppLinks(broad);
  for (const xml of [updated, isolateCustomerAppLinks(updated)]) {
    assert.equal(handles(xml, '/erp/'), false);
    assert.equal(handles(xml, '/'), true);
    assert.equal(handles(xml, '/dashboard'), true);
  }
  assert.throws(() => isolateCustomerAppLinks(''), /Expected one/);
  assert.match(read('package.json'), /sync-android-client-links/);
});
test('staff settings entry is specific and never modifies system sound or battery preferences', () => {
  assert.match(staff, /android:scheme="mta-team" android:host="notification-settings"/);
  const settings = read('android-twa/staff/src/main/java/com/multitaskagency/app/StaffNotificationSettingsActivity.java');
  assert.match(settings, /ACTION_CHANNEL_NOTIFICATION_SETTINGS/);
  assert.match(settings, /getNotificationChannels/);
  assert.match(settings, /getSound\(\)/);
  assert.match(settings, /isBackgroundRestricted/);
  assert.match(settings, /"received_at"/);
  assert.doesNotMatch(settings, /setInterruptionFilter|setStreamVolume|setRingerMode|setBypassDnd|REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/);
});
