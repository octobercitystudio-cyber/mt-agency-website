import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPackageReminderWhatsApp } from '../src/lib/packageWhatsApp.js';

const details = {
  package: { name: 'باقة صناعة المحتوى', billing_unit: 'hour', status: 'active' },
  quantities: { purchased: 20, used: 14.25, remaining: 5.75, purchased_minutes: 1200, used_minutes: 855, upcoming_held: 2, held_minutes: 120, available: 3.75, available_minutes: 225 },
  validity: { today: '2026-10-12', expires_at: '2026-10-15' },
};

test('reminder places remaining calendar days after greeting, preserves exact minutes and has no links', () => {
  const message = buildPackageReminderWhatsApp(details, { name: 'أحمد' });
  assert.equal(message.split('\n').filter(Boolean)[1], '⏳ *متبقي 4 يوم على انتهاء صلاحية باقتك.*');
  assert.match(message, /^السلام عليكم أستاذ\/ة \*أحمد\*/);
  assert.match(message, /باقة صناعة المحتوى/);
  assert.match(message, /5 ساعات و45 دقيقة/);
  assert.match(message, /3 ساعات و45 دقيقة/);
  assert.match(message, /15 أكتوبر 2026/);
  assert.match(message, /افتح التطبيق/);
  assert.match(message, /الحجز بدري/);
  assert.match(message, /لا يمكن استخدام أي ساعات متبقية/);
  assert.ok(message.endsWith('*فريق Multi Task Agency*'));
  assert.equal(message.indexOf('Multi Task Agency'), message.lastIndexOf('Multi Task Agency'));
  assert.doesNotMatch(message, /https?:|www\.|wa\.me/);
});

test('expiry day remains usable and is explicitly described as today', () => {
  const message = buildPackageReminderWhatsApp({ ...details, validity: { today: '2026-10-15', expires_at: '2026-10-15' } });
  assert.match(message, /تنتهي صلاحية باقتك اليوم/);
});

test('expired, depleted, suspended and unactivated packages never generate misleading reminders', () => {
  for (const invalid of [
    { ...details, validity: { today: '2026-10-16', expires_at: '2026-10-15' } },
    { ...details, validity: { today: '2026-10-12', expires_at: null } },
    { ...details, quantities: { ...details.quantities, used_minutes: 1200, remaining: 0 } },
    { ...details, package: { ...details.package, status: 'suspended' } },
  ]) assert.throws(() => buildPackageReminderWhatsApp(invalid));
});

test('reel packages use their own unit instead of inventing hours', () => {
  const message = buildPackageReminderWhatsApp({ ...details, package: { ...details.package, billing_unit: 'reel' }, quantities: { purchased: 10, used: 3, remaining: 7 } });
  assert.match(message, /7 ريل/);
  assert.doesNotMatch(message, /ساعات|دقيقة/);
});
