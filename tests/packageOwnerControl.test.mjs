import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('owner package center exposes four safe sections and no held or remaining setters', async () => {
  const [ui, css, fixes] = await Promise.all([load('src/erp/OwnerPackageControl.jsx'), load('src/erp/OwnerPackageControl.css'), load('src/erp/OwnerPackageControlFixes.css')]);
  for (const label of ['الرصيد والاستخدام', 'السعر والمدفوع', 'الصلاحية والبيانات', 'مواعيد الباقة']) assert.match(ui, new RegExp(label));
  assert.match(ui, /usage-adjustment/);
  assert.match(ui, /admin-reschedule/);
  assert.match(ui, /'DELETE'/);
  assert.match(ui, /حذف الموعد/);
  assert.doesNotMatch(ui, /سبب الإلغاء/);
  assert.match(ui, /immutable_reason/);
  assert.doesNotMatch(ui, /target_held|target_remaining/);
  assert.match(css, /min-height:44px/);
  assert.match(fixes, /\.owner-confirm-row\s*\{[^}]*min-height:\s*44px/s);
  assert.match(fixes, /@media \(max-width: 420px\)[\s\S]*?\.owner-tab-label\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media\(max-width:420px\)/);
});

test('nested package booking uses one topmost modal and exact focus return', async () => {
  const [owner, packages, booking, bookingCss] = await Promise.all([
    load('src/erp/OwnerPackageControl.jsx'), load('src/erp/ERPPackages.jsx'), load('src/erp/ERPAddBookingModal.jsx'), load('src/erp/ERPAddBookingModal.css'),
  ]);
  assert.match(owner, /useModalDialog\(true, onClose, \{ returnFocusRef \}\)/);
  assert.match(owner, /aria-modal=\{childOpen \? undefined : 'true'\}/);
  assert.match(owner, /aria-hidden=\{childOpen \? 'true' : undefined\}/);
  assert.match(owner, /inert=\{childOpen \? true : undefined\}/);
  assert.match(packages, /returnFocusRef=\{dialogTriggerRef\}/);
  assert.match(packages, /childOpen=\{bookingPackage\.open \|\| paymentPackage\.open\}/);
  assert.match(packages, /returnFocusRef=\{bookingTriggerRef\}/);
  assert.doesNotMatch(booking, /zIndex:\s*1050/);
  assert.match(booking, /erp-modal-overlay erp-booking-overlay/);
  assert.match(bookingCss, /\.erp-booking-overlay\s*\{\s*z-index:\s*2000;/);
  assert.match(owner, /تم تحديث بيانات الباقة وسجلاتها المالية والتشغيلية/);
});

test('production owner correction is locked, versioned, audited and minute authoritative', async () => {
  const api = await load('api/index.php');
  assert.ok(api.includes("client-packages/(\\d+)/usage-adjustment"));
  assert.match(api, /requireRole\(\$user,\['owner'\]\)/);
  assert.match(api, /owner-consumed:/);
  assert.match(api, /stale_package_version/);
  assert.match(api, /package_session_active/);
  assert.match(api, /mutateLockedPackageQuantities/);
  assert.match(api, /owner_adjust_consumed_usage/);
  assert.match(api, /correction_key/);
  assert.match(api, /consumed_minutes/);
  assert.match(api, /all_bookings/);
});

test('production reschedule enforces resource organization and package validity', async () => {
  const api = await load('api/index.php');
  assert.match(api, /booking_outside_package_validity/);
  assert.match(api, /validity_mode_snapshot/);
  assert.match(api, /SELECT id FROM resources WHERE id=\? AND organization_id=\? AND is_active=1 FOR UPDATE/);
  assert.match(api, /UPDATE bookings SET resource_id=\?,date=\?/);
  assert.match(api, /format\('N'\)==='5'/);
});

test('validity-only owner edits use the narrow versioned route and keep dates synchronized', async () => {
  const [owner, api, demo] = await Promise.all([
    load('src/erp/OwnerPackageControl.jsx'), load('api/index.php'), load('src/lib/demoDataClient.js'),
  ]);
  assert.match(owner, /const validityOnly = Boolean\(details\.expires\)/);
  assert.match(owner, /`\/client-packages\/\$\{pkg\.id\}\/extend`/);
  assert.match(owner, /packageExpiryFromDays/);
  assert.match(owner, /packageValidityDays/);
  assert.match(owner, /validity_days_snapshot: Number\(details\.validityDays\)/);
  assert.match(owner, /expected_version: info\.version/);
  assert.match(api, /invalid_package_expiry/);
  assert.match(api, /invalid_package_validity_days/);
  assert.match(api, /bookings_outside_package_validity/);
  assert.match(api, /\$nextStatus=\$before\['status'\]===\'expired\'/);
  assert.match(api, /\[Package validity WhatsApp\]/);
  assert.match(demo, /client-packages\\\/\(\\d\+\)\\\/extend/);
});

test('package expiry survives optional adjustment and notification failures', async () => {
  const api = await load('api/index.php');
  assert.match(api, /\[Package validity adjustment\]/);
  assert.match(api, /adjustment_recorded/);
  assert.match(api, /\[Audit client notification\]/);
  assert.match(api, /\[Audit owner notification\]/);
  assert.match(api, /UPDATE client_packages SET expires_at=\?,validity_days_snapshot=\?,status=\?,version=version\+1/);
  assert.match(api, /\$pdo->commit\(\);\$adjustmentRecorded=true/);
  assert.match(api, /\[Package validity audit\]/);
});

test('demo validity edit derives inclusive calendar days from the selected end date', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const before = await demoClient.request('/client-packages/201/details', { method: 'GET' });
  const starts = String(before.data.validity.starts_at).slice(0, 10);
  const expiry = new Date(`${starts}T00:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + 44);
  const expires = expiry.toISOString().slice(0, 10);
  const saved = await demoClient.request('/client-packages/201/extend', { method: 'POST', body: JSON.stringify({ expires_at: expires, validity_days_snapshot: 999, reason: 'تصحيح مدة الصلاحية للاختبار', expected_version: before.data.package.version }) });
  assert.equal(saved.error, null);
  assert.equal(saved.data.expires_at, expires);
  assert.equal(saved.data.validity_days_snapshot, 45);
  const after = await demoClient.request('/client-packages/201/details', { method: 'GET' });
  assert.equal(after.data.package.validity_days_snapshot, 45);
  deactivateDemoMode();
});

test('demo consumed correction keeps exact authoritative balance and is idempotent', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const before = await demoClient.request('/client-packages/201/details', { method: 'GET' });
  assert.equal(before.error, null);
  const maximum = before.data.quantities.purchased - before.data.quantities.upcoming_held;
  const target = Math.min(maximum, before.data.quantities.used + 0.5);
  const payload = { target_consumed_quantity: target, reason: 'تصحيح اختبار موثق للاستخدام', expected_version: before.data.package.version, correction_key: 'owner-test-correction-0001' };
  const adjusted = await demoClient.request('/client-packages/201/usage-adjustment', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(adjusted.error, null);
  assert.equal(adjusted.data.consumed_quantity, target);
  const duplicate = await demoClient.request('/client-packages/201/usage-adjustment', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(duplicate.error, null);
  assert.equal(duplicate.data.idempotent, true);
  const after = await demoClient.request('/client-packages/201/details', { method: 'GET' });
  assert.equal(after.data.quantities.used + after.data.quantities.upcoming_held <= after.data.quantities.purchased, true);
  assert.equal(after.data.quantities.used_minutes, Math.round(target * 60));
  deactivateDemoMode();
});

test('demo keeps package correction owner-only', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('admin');
  const denied = await demoClient.request('/client-packages/201/usage-adjustment', { method: 'POST', body: JSON.stringify({ target_consumed_quantity: 1, reason: 'محاولة مدير غير مصرح بها', correction_key: 'admin-denied-correction-01' }) });
  assert.equal(denied.error?.code, 'forbidden');
  deactivateDemoMode();
});
