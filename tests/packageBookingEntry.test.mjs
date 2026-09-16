import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { packageBookingAvailability, packageChainValidRange, packagesForBookingClient, planPackageBookingRows, validatePackageBookingDraft } from '../src/erp/packageBookingSelection.js';

const activePackage = {
  id: 201,
  client_id: 7,
  service_id: 4,
  status: 'active',
  billing_unit: 'hour',
  purchased_quantity: 10,
  consumed_quantity: 2,
  held_quantity: 1,
  starts_at: '2026-08-01',
  expires_at: '2026-09-01',
};

test('package booking picker keeps packages scoped to the selected client and puts eligible balance first', () => {
  const exhausted = { ...activePackage, id: 202, purchased_quantity: 3, consumed_quantity: 2, held_quantity: 1 };
  const otherClient = { ...activePackage, id: 203, client_id: 9 };
  const pendingActivation = { ...activePackage, id: 204, starts_at: null, expires_at: null };
  const result = packagesForBookingClient([pendingActivation, exhausted, otherClient, activePackage], 7, '2026-08-10');
  assert.deepEqual(result.map(item => item.id), [201, 204, 202]);
  assert.equal(result[0].availability.bookable, true);
  assert.equal(result[0].availability.priority, 1);
  assert.equal(result[1].availability.priority, 2);
  assert.equal(result[2].availability.bookable, false);
  assert.equal(result[2].availability.priority, null);
  assert.match(result[2].availability.reason, /رصيد/);
});

test('expired and zero-balance packages cannot be booked', () => {
  assert.equal(packageBookingAvailability({ ...activePackage, expires_at: '2026-08-09' }, '2026-08-10').bookable, false);
  assert.equal(packageBookingAvailability({ ...activePackage, held_quantity: 8 }, '2026-08-10').bookable, false);
});

test('daily package accepts only its shooting day and matching service', () => {
  const daily = { ...activePackage, validity_mode_snapshot: 'shooting_day', starts_at: '2026-08-20', expires_at: '2026-08-20' };
  const service = { id: 4 };
  assert.equal(validatePackageBookingDraft({ pkg: daily, service, dates: [{ date: '2026-08-20' }], todayKey: '2026-08-10' }), '');
  assert.match(validatePackageBookingDraft({ pkg: daily, service, dates: [{ date: '2026-08-21' }], todayKey: '2026-08-10' }), /صلاحية|يوم التصوير/);
  assert.match(validatePackageBookingDraft({ pkg: daily, service: { id: 99 }, dates: [{ date: '2026-08-20' }], todayKey: '2026-08-10' }), /خدمة الباقة/);
});

test('booking plan consumes the oldest valid package first then moves future appointments to the new package', () => {
  const old = { ...activePackage, id: 210, purchased_quantity: 3, consumed_quantity: 1, held_quantity: 1, starts_at: '2026-09-01', expires_at: '2026-09-20' };
  const next = { ...activePackage, id: 211, purchased_quantity: 5, consumed_quantity: 0, held_quantity: 0, starts_at: null, expires_at: null, validity_days_snapshot: 30 };
  const plan = planPackageBookingRows({
    packages: [next, old], clientId: 7, todayKey: '2026-09-10', preferredPackageId: old.id,
    rows: [
      { date: '2026-09-15', start_time: '12:00', end_time: '13:00' },
      { date: '2026-09-22', start_time: '12:00', end_time: '14:00' },
    ],
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.allocations.map(item => item.package.id), [210, 211]);
  assert.equal(plan.allocations[0].remainingAfter, 0);
  assert.equal(plan.allocations[1].remainingAfter, 3);
});

test('one appointment stays on one package when the old remainder cannot cover its full duration', () => {
  const old = { ...activePackage, id: 220, purchased_quantity: 3, consumed_quantity: 1, held_quantity: 1, starts_at: '2026-09-01', expires_at: '2026-09-30' };
  const next = { ...activePackage, id: 221, purchased_quantity: 5, consumed_quantity: 0, held_quantity: 0, starts_at: null, expires_at: null, validity_days_snapshot: 30 };
  const plan = planPackageBookingRows({ packages: [next, old], clientId: 7, todayKey: '2026-09-10', preferredPackageId: old.id, rows: [{ date: '2026-09-15', start_time: '12:00', end_time: '14:00' }] });
  assert.equal(plan.ok, true);
  assert.equal(plan.allocations[0].package.id, 221);
  assert.equal(plan.allocations[0].quantity, 2);
});

test('pending package validity starts on its first chronological booking and bounds later bookings', () => {
  const next = { ...activePackage, id: 231, purchased_quantity: 8, consumed_quantity: 0, held_quantity: 0, starts_at: null, expires_at: null, validity_days_snapshot: 5 };
  const plan = planPackageBookingRows({ packages: [next], clientId: 7, todayKey: '2026-09-10', rows: [
    { date: '2026-09-20', start_time: '12:00', end_time: '13:00' },
    { date: '2026-09-26', start_time: '12:00', end_time: '13:00' },
  ] });
  assert.equal(plan.ok, false);
  assert.equal(plan.failedIndex, 1);
  assert.deepEqual(packageChainValidRange([next], '2026-09-10'), { start: '2026-09-10', end: '' });
});

test('sold packages and dashboard booking modal share package-aware IDs and request contract', () => {
  const modal = fs.readFileSync(new URL('../src/erp/ERPAddBookingModal.jsx', import.meta.url), 'utf8');
  const packages = fs.readFileSync(new URL('../src/erp/ERPPackages.jsx', import.meta.url), 'utf8');
  assert.match(modal, /initialClientId/);
  assert.match(modal, /initialPackageId/);
  assert.match(modal, /client_package_id:allocatedPackage\?\.id/);
  assert.match(modal, /requested_reels:allocatedPackage\?\.billing_unit/);
  assert.match(modal, /planPackageBookingRows/);
  assert.match(modal, /أقدم باقة صالحة/);
  assert.match(packages, /className="package-booking-button"/);
  assert.match(packages, /باقة جديدة لنفس العميل/);
  assert.match(packages, /initialClientId=\{bookingPackage\.pkg\?\.client_id\}/);
  assert.match(packages, /initialPackageId=\{bookingPackage\.pkg\?\.id\}/);
});

test('reviewed package and booking controls keep 44px touch targets', () => {
  const bookingCss = fs.readFileSync(new URL('../src/erp/ERPAddBookingModal.css', import.meta.url), 'utf8');
  const packagesCss = fs.readFileSync(new URL('../src/erp/ERPPackages.css', import.meta.url), 'utf8');
  const layoutCss = fs.readFileSync(new URL('../src/erp/ERPLayout.css', import.meta.url), 'utf8');
  assert.match(bookingCss, /\.erp-booking-dialog \.fc \.fc-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(bookingCss, /\.erp-booking-primary-grid select,[\s\S]*?\.erp-booking-form button\s*\{\s*min-height:\s*44px;/);
  assert.match(packagesCss, /\.packages-filters input,\.packages-filters select\{[^}]*min-height:44px/);
  assert.match(packagesCss, /\.package-details-button\{min-height:44px/);
  assert.match(layoutCss, /\.erp-demo-banner__reset\s*\{[\s\S]*?min-height:\s*44px;/);
});

test('320px calendar publishes separated Arabic headings and a readable full-name agenda', () => {
  const modal = fs.readFileSync(new URL('../src/erp/ERPAddBookingModal.jsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/erp/ERPAddBookingModal.css', import.meta.url), 'utf8');
  assert.match(modal, /buttonText=\{\{ today: 'اليوم' \}\}/);
  assert.match(modal, /className="erp-booking-mobile-agenda"/);
  assert.match(modal, /eventDidMount=.*aria-label/s);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?nth-child\(1\)[\s\S]*?content: 'سبت'/);
  assert.match(css, /nth-child\(7\)[^{]*\{ content: 'جمع'; \}/);
  assert.match(css, /\.erp-main \.erp-booking-dialog \.fc \.fc-col-header-cell-cushion\s*\{[^}]*font-size:\s*0\s*!important;[^}]*line-height:\s*0\s*!important;/s);
  assert.match(css, /\.erp-main \.erp-booking-dialog \.fc \.fc-col-header-cell-cushion::after\s*\{[^}]*font-size:\s*\.65rem\s*!important;/s);
  assert.match(css, /\.fc-daygrid-event \.fc-event-title::after\s*\{[^}]*content: 'حجز'/s);
  assert.match(css, /\.erp-main \.erp-booking-dialog \.fc \.fc-daygrid-event \.fc-event-title\s*\{[^}]*font-size:\s*0\s*!important;/s);
  assert.match(css, /\.erp-booking-mobile-agenda li\s*\{[^}]*min-height: 44px/s);
});
