import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  durationHoursToMinutes, durationMinutesToHours, formatDurationMinutes,
  packageQuantitySummary, splitDurationMinutes,
} from '../src/lib/businessFormat.js';
import { postProductionDuration } from '../src/lib/postProduction.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('all hour arithmetic normalizes through whole minutes', () => {
  assert.equal(durationHoursToMinutes(1), 60);
  assert.equal(durationHoursToMinutes(1.5), 90);
  assert.equal(durationHoursToMinutes(1.0167), 61);
  assert.equal(durationMinutesToHours(90), 1.5);
  assert.deepEqual(splitDurationMinutes(125), { hours: 2, minutes: 5, totalMinutes: 125 });
  assert.equal(formatDurationMinutes(60), 'ساعة واحدة');
  assert.equal(formatDurationMinutes(125), 'ساعتان و5 دقيقة');
  assert.equal(postProductionDuration(3600), 'ساعة واحدة');
});

test('package totals prefer authoritative minute columns over rounded decimal snapshots', () => {
  const summary = packageQuantitySummary({
    billing_unit: 'hour',
    purchased_quantity: 1, purchased_minutes: 125,
    consumed_quantity: 0, consumed_minutes: 61,
    held_quantity: 0, held_minutes: 4,
  });
  assert.equal(summary.purchasedMinutes, 125);
  assert.equal(summary.consumedMinutes, 61);
  assert.equal(summary.heldMinutes, 4);
  assert.equal(summary.remainingMinutes, 64);
  assert.equal(summary.availableMinutes, 60);
  assert.equal(summary.available, 1);
});

test('hour editors and remaining raw displays use the shared hours/minutes system', async () => {
  const [input, packages, owner, settings, upgrade, stop, bookings, requests, offers, clientOffers, notifications, api] = await Promise.all([
    load('src/components/DurationHoursMinutesInput.jsx'), load('src/erp/ERPPackages.jsx'), load('src/erp/OwnerPackageControl.jsx'),
    load('src/erp/ERPSettings.jsx'), load('src/erp/PackageUpgradeDialog.jsx'), load('src/erp/ERPStopSessionDialog.jsx'),
    load('src/erp/ERPBookings.jsx'), load('src/erp/ERPRequests.jsx'), load('src/erp/ERPOfferGenerator.jsx'),
    load('src/pages/ClientOfferTickets.jsx'), load('src/erp/ERPNotifications.jsx'), load('api/index.php'),
  ]);
  assert.match(input, /كل 60 دقيقة = ساعة واحدة/);
  for (const source of [packages, owner, settings, upgrade, stop, offers]) assert.match(source, /DurationHoursMinutesInput/);
  for (const source of [bookings, requests, offers, clientOffers, notifications]) assert.match(source, /format(?:DurationMinutes|PackageQuantity)/);
  assert.match(api, /packageReminderUnitText/);
  assert.match(api, /arabicDurationMinutes/);
  assert.doesNotMatch(requests, /requested_quantity \|\| 0\)\} ساعة/);
});
