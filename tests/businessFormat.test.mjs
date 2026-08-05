import assert from 'node:assert/strict';
import test from 'node:test';
import {
  effectivePackageStatus,
  formatPaymentMethod,
  moneyToCents,
  packageFinancialSummary,
  packageQuantitySummary,
  remainingBusinessDays,
} from '../src/lib/businessFormat.js';

test('payment methods normalize across API and Arabic legacy values', () => {
  assert.equal(formatPaymentMethod('cash'), 'نقدي');
  assert.equal(formatPaymentMethod('bank_transfer'), 'تحويل بنكي');
  assert.equal(formatPaymentMethod('vodafone_cash'), 'فودافون كاش');
  assert.equal(formatPaymentMethod('instapay'), 'إنستاباي');
  assert.equal(formatPaymentMethod('إنستاباي (InstaPay)'), 'إنستاباي');
  assert.equal(formatPaymentMethod('طريقة خاصة'), 'طريقة خاصة');
  assert.equal(formatPaymentMethod(''), 'غير محدد');
});

test('money remains exact to the cent', () => {
  assert.equal(moneyToCents('0.10') + moneyToCents('0.20'), 30);
  assert.deepEqual(packageFinancialSummary({ total_price: '12000.10', overage_amount: '325.20', paid_amount: '10000.05' }), {
    totalCents: 1200010,
    overageCents: 32520,
    paidCents: 1000005,
    outstandingCents: 232525,
    creditCents: 0,
  });
  assert.deepEqual(packageFinancialSummary({ total_price: '100.10', overage_amount: '0', paid_amount: '120.15' }), {
    totalCents: 10010,
    overageCents: 0,
    paidCents: 12015,
    outstandingCents: 0,
    creditCents: 2005,
  });
});

test('package quantity meanings remain distinct', () => {
  assert.deepEqual(packageQuantitySummary({ purchased_quantity: '10', consumed_quantity: '5.2500', held_quantity: '1.5000' }), {
    purchased: 10,
    consumed: 5.25,
    held: 1.5,
    remaining: 4.75,
    available: 3.25,
  });
});

test('remaining business days are strictly after today and exclude Friday', () => {
  assert.equal(remainingBusinessDays('2026-08-05', '2026-08-05'), 0);
  assert.equal(remainingBusinessDays('2026-08-06', '2026-08-05'), 1);
  assert.equal(remainingBusinessDays('2026-08-07', '2026-08-06'), 0);
  assert.equal(remainingBusinessDays('2026-08-16', '2026-08-05'), 9);
  assert.equal(remainingBusinessDays('2026-08-04', '2026-08-05'), 0);
});

test('expired package status uses date-only comparison', () => {
  assert.equal(effectivePackageStatus({ status: 'active', expires_at: '2026-08-04' }, '2026-08-05'), 'expired');
  assert.equal(effectivePackageStatus({ status: 'active', expires_at: '2026-08-05' }, '2026-08-05'), 'active');
});
