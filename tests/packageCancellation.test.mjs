import test from 'node:test';
import assert from 'node:assert/strict';
import { packageCancellationMessage } from '../src/lib/packageCancellationMessage.js';
import { packageFinancialSummary, effectivePackageStatus } from '../src/lib/businessFormat.js';
import { isPackagePaymentDue } from '../src/lib/clientFinanceSummary.js';

const receipt = { package_id: 201, client_name: 'عميل الاختبار', package_name: 'MULTI 10', purchased_minutes: 600, consumed_minutes: 240, billing_unit: 'hour', original_total_cents: 180000, paid_cents: 180000, usage_cost_cents: 120000, hourly_rate_cents: 30000, retained_cents: 120000, refund_cents: 60000, method: 'vodafone_cash', starts_at: '2030-01-01', expires_at: '2030-01-30', cancelled_at: '2030-01-15 14:00:00', bookings: [{ date: '2030-01-20', start_time: '12:00', end_time: '14:00' }], pending_dates: [] };
test('client receipt carries original agreement, usage, refund method and cancelled appointment', () => {
  const message = packageCancellationMessage(receipt);
  for (const text of ['عميل الاختبار', 'MULTI 10', '201', '2030-01-30', '2030-01-20', 'فودافون كاش', 'المبلغ الذي تم رده', 'لا توجد مبالغ إضافية']) assert.ok(message.includes(text));
});
test('zero refund and manual settlement language are accurate', () => {
  const message = packageCancellationMessage({ ...receipt, refund_cents: 0, retained_cents: 180000, override_reason: 'تسوية معتمدة بناءً على طلب العميل' });
  assert.match(message, /لا يوجد مبلغ مستحق للاسترداد/);
  assert.match(message, /تسوية معتمدة بناءً على طلب العميل/);
  assert.doesNotMatch(message, /المبلغ الذي تم رده إليكم/);
});
test('settled package is inactive, free of payment hold and additional debt', () => {
  const pkg = { billing_unit: 'hour', purchased_minutes: 600, consumed_minutes: 240, held_minutes: 0, total_price: 1200, paid_amount: 1200, overage_amount: 0, payment_due_minutes: 180, status: 'cancelled', expires_at: '2030-01-30' };
  assert.equal(effectivePackageStatus(pkg, '2030-01-15'), 'cancelled');
  assert.equal(packageFinancialSummary(pkg).outstandingCents, 0);
  assert.equal(isPackagePaymentDue(pkg), false);
});
