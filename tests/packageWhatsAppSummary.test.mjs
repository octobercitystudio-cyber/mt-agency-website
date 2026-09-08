import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPackageWhatsAppUrl,
  formatPackageWhatsAppMessage,
  normalizeWhatsAppPhone,
  packageDurationLabel,
} from '../src/erp/packageWhatsAppSummary.js';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const storage = new Map();
const eventTarget = new EventTarget();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };

test.afterEach(() => deactivateDemoMode());

test('WhatsApp summary formats the exact post-session package, finance, due and loyalty details', () => {
  const summary = {
    client_name: 'باسم انور ابراهيم', client_phone: '0111 446 6646', client_points: 90,
    package_name: 'باقة 10 ساعات', billing_unit: 'hour', today_minutes: 120,
    purchased_minutes: 600, consumed_minutes: 240, remaining_minutes: 360,
    payment_due_minutes: 240, payment_due_reached: true,
    total_amount: '1800.00', paid_amount: '900.00', outstanding_amount: '900.00', expires_at: '2026-09-20',
  };
  const message = formatPackageWhatsAppMessage(summary);
  assert.match(message, /مرحباً بك أستاذ باسم انور ابراهيم/);
  assert.match(message, /إجمالي الساعات: 10 س/);
  assert.match(message, /تم تصويره اليوم: 2 س/);
  assert.match(message, /الإجمالي المستخدم: 4 س/);
  assert.match(message, /المتبقي في الباقة: 6 س/);
  assert.match(message, /الأحد 2026-09-20/);
  assert.match(message, /التكلفة: 1,800 ج\.م \| المدفوع: 900 ج\.م \| المتبقي للدفع: 900 ج\.م/);
  assert.match(message, /ساعات الاستحقاق المتفق عليها \(4 س\)/);
  assert.match(message, /لديك الآن \(90 نقطة\).*400 نقطة/);
  const url = buildPackageWhatsAppUrl(summary);
  assert.match(url, /^https:\/\/wa\.me\/201114466646\?text=/);
  assert.equal(decodeURIComponent(url.split('?text=')[1]), message);
});

test('duration and phone helpers preserve minutes and reject invalid recipients', () => {
  assert.equal(packageDurationLabel(90), '1 س و30 د');
  assert.equal(packageDurationLabel(30), '30 د');
  assert.equal(normalizeWhatsAppPhone('0020 111 446 6646'), '201114466646');
  assert.equal(normalizeWhatsAppPhone('+201094084424'), '201094084424');
  assert.equal(buildPackageWhatsAppUrl({ client_phone: 'غير مسجل' }), '');
});

test('completed demo session returns an authoritative WhatsApp snapshot after package consumption', async () => {
  storage.clear(); activateDemoMode('owner'); resetDemoDatabase();
  const started = await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  assert.equal(started.error, null);
  const completed = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 75 }) });
  assert.equal(completed.error, null);
  const summary = completed.data.whatsapp_summary;
  assert.equal(summary.today_minutes, 75);
  assert.equal(summary.consumed_minutes, 405);
  assert.equal(summary.remaining_minutes, 195);
  assert.equal(summary.package_name, 'باقة صناعة المحتوى');
  assert.ok(summary.client_name);
});
