import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPackageWhatsApp, whatsappPhone } from '../src/lib/packageWhatsApp.js';

const details = {
  package: { name: 'باقة 20 ساعة', billing_unit: 'hour', client: { name: 'احمد درويش' } },
  quantities: { purchased: 20, used: 14.25, remaining: 5.75, upcoming_held: 0, available: 5.75, purchased_minutes: 1200, used_minutes: 855 },
  financial: { total_price: 3400, paid_amount: 3400, outstanding: 0 },
  validity: { expires_at: '2026-09-08' },
};

test('package message preserves exact minutes, package finances, expiry and configured loyalty threshold', () => {
  const message = buildPackageWhatsApp(details, { name: 'احمد درويش', points: 340 }, { points_redeem_threshold: 400 });
  assert.match(message, /احمد درويش/);
  assert.match(message, /14 س و 15 د/);
  assert.match(message, /5 س و 45 د/);
  assert.match(message, /الثلاثاء 2026-09-08/);
  assert.match(message, /المتبقي للدفع: 0 ج.م/);
  assert.match(message, /340 نقطة/);
  assert.match(message, /400 نقطة/);
});

test('future holds, overage, credit and redeemable points are disclosed without double-counting usage', () => {
  const message = buildPackageWhatsApp({ ...details,
    quantities: { ...details.quantities, upcoming_held: 2, available: 3.75 },
    financial: { ...details.financial, overage_amount: 100, outstanding: 100, customer_credit: 20 },
  }, { points: 500 }, { points_redeem_threshold: 400 });
  assert.match(message, /المتبقي في الباقة: 5 س و 45 د/);
  assert.match(message, /محجوز قادمًا: 2 س/);
  assert.match(message, /المتاح لحجز جديد: 3 س و 45 د/);
  assert.match(message, /رسوم التجاوز: 100 ج.م/);
  assert.match(message, /رصيد دائن: 20 ج.م/);
  assert.match(message, /يمكنك الآن استبدال/);
});

test('pending validity and unavailable loyalty configuration do not invent dates or rewards', () => {
  const message = buildPackageWhatsApp({ ...details, validity: {} }, { points: 20 });
  assert.match(message, /لم تبدأ الصلاحية بعد/);
  assert.doesNotMatch(message, /400 نقطة|خصومات/);
  assert.doesNotMatch(buildPackageWhatsApp(details, {}), /نقاط الولاء/);
});

test('WhatsApp recipient normalizes Egyptian and international numbers and rejects invalid values', () => {
  assert.equal(whatsappPhone('01012345678'), '201012345678');
  assert.equal(whatsappPhone('+20 101 234 5678'), '201012345678');
  assert.equal(whatsappPhone('٠١٠١٢٣٤٥٦٧٨'), '201012345678');
  assert.equal(whatsappPhone('00971501234567'), '971501234567');
  assert.equal(whatsappPhone(''), '');
  assert.equal(whatsappPhone('01012345678?text=wrong'), '');
});
