import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  initialPackageBookingMonth,
  packageBookingMonthWindow,
  packageBookingValidRange,
  shiftBookingMonth,
} from '../src/lib/packageBookingCalendar.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

const pkg = {
  starts_at: '2026-09-08',
  expires_at: '2026-12-17',
  billing_unit: 'hour',
};

test('booking months continue past the current month and stop at package expiry', () => {
  assert.equal(initialPackageBookingMonth(pkg, '2026-09-13'), '2026-09-01');
  assert.equal(shiftBookingMonth('2026-09-01', 1), '2026-10-01');

  const current = packageBookingMonthWindow(pkg, '2026-09-01', '2026-09-13');
  assert.deepEqual(
    { startDate: current.startDate, endDate: current.endDate, days: current.days, canPrevious: current.canPrevious, canNext: current.canNext },
    { startDate: '2026-09-13', endDate: '2026-09-30', days: 18, canPrevious: false, canNext: true },
  );

  const following = packageBookingMonthWindow(pkg, '2026-10-01', '2026-09-13');
  assert.deepEqual(
    { startDate: following.startDate, endDate: following.endDate, days: following.days, canPrevious: following.canPrevious, canNext: following.canNext },
    { startDate: '2026-10-01', endDate: '2026-10-31', days: 31, canPrevious: true, canNext: true },
  );

  const expiry = packageBookingMonthWindow(pkg, '2026-12-01', '2026-09-13');
  assert.deepEqual(
    { startDate: expiry.startDate, endDate: expiry.endDate, days: expiry.days, canPrevious: expiry.canPrevious, canNext: expiry.canNext },
    { startDate: '2026-12-01', endDate: '2026-12-17', days: 17, canPrevious: true, canNext: false },
  );
  assert.deepEqual(packageBookingValidRange(pkg, '2026-09-13'), { start: '2026-09-13', end: '2026-12-18' });
});

test('a package awaiting its first booking can navigate to later months without a synthetic month cap', () => {
  const pending = { starts_at: null, expires_at: null, billing_unit: 'hour' };
  const future = packageBookingMonthWindow(pending, '2027-04-01', '2026-09-13');
  assert.equal(future.startDate, '2027-04-01');
  assert.equal(future.endDate, '2027-04-30');
  assert.equal(future.days, 30);
  assert.equal(future.canPrevious, true);
  assert.equal(future.canNext, true);
});

test('client and admin booking interfaces expose package-aware future navigation', async () => {
  const [dialog, modal, api, css] = await Promise.all([
    load('src/pages/ClientBookingDialog.jsx'),
    load('src/erp/ERPAddBookingModal.jsx'),
    load('api/index.php'),
    load('src/pages/ClientDashboard.css'),
  ]);
  const availabilityFunction = api.slice(api.indexOf('function clientBookingAvailability'), api.indexOf('function bookingBlockDate'));
  assert.match(dialog, /className="client-booking-month-nav"/);
  assert.match(dialog, /start_date: monthWindow\.startDate/);
  assert.match(dialog, /days: String\(monthWindow\.days\)/);
  assert.match(dialog, /الرصيد المتاح لهذه الباقة/);
  assert.match(modal, /validRange=\{calendarValidRange\}/);
  assert.match(modal, /يمكنك الانتقال لأي شهر/);
  assert.match(css, /client-booking-month-nav button\{min-width:82px;min-height:44px/);
  assert.doesNotMatch(availabilityFunction, /\+90 days|خلال 90 يومًا فقط/);
  assert.match(availabilityFunction, /\$maximumWindow=31/);
});
