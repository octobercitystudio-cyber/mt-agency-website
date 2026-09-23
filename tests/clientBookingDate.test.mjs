import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { earliestClientBookingDate, clientBookingDateError, CLIENT_BOOKING_DATE_MESSAGE } from '../src/lib/clientBookingDate.js';
import { packageBookingMonthWindow } from '../src/lib/packageBookingCalendar.js';
const cases = JSON.parse(readFileSync(new URL('./fixtures/clientBookingDates.json', import.meta.url), 'utf8'));
for (const item of cases) test(item.name, () => {
  const now = new Date(item.now);
  assert.equal(earliestClientBookingDate(now), item.tomorrow);
  assert.equal(clientBookingDateError(item.today, now), CLIENT_BOOKING_DATE_MESSAGE);
  assert.equal(clientBookingDateError('2020-01-01', now), CLIENT_BOOKING_DATE_MESSAGE);
  assert.equal(clientBookingDateError(item.tomorrow, now), '');
});
test('invalid dates cannot pass lexicographic comparison or JS rollover', () => {
  for (const date of ['', null, undefined, '2030-02-29', '2030-02-30', '2030-04-31', '2030-13-01', '2030-00-01', '2030-01-00', '2030-1-01', '2030-01-01T12:00:00Z', ' 2030-01-01']) {
    assert.ok(clientBookingDateError(date, new Date('2026-01-01T00:00:00Z')), String(date));
  }
});
test('a saved selection becomes invalid at Cairo midnight', () => {
  assert.equal(clientBookingDateError('2026-09-24', new Date('2026-09-23T20:59:59.999Z')), '');
  assert.equal(clientBookingDateError('2026-09-24', new Date('2026-09-23T21:00:00Z')), CLIENT_BOOKING_DATE_MESSAGE);
});
test('tomorrow is a calendar boundary, not a 24-hour notice requirement', () => {
  assert.equal(clientBookingDateError('2026-09-24', new Date('2026-09-23T20:59:59Z')), '');
});
test('package validity can extend into next month; expired-today package has no days', () => {
  const earliest = earliestClientBookingDate(new Date('2026-09-30T10:00:00Z'));
  const valid = packageBookingMonthWindow({ starts_at: '2026-09-20', expires_at: '2026-10-10' }, '', earliest);
  assert.equal(valid.startDate, '2026-10-01');
  assert.equal(valid.endDate, '2026-10-10');
  assert.equal(valid.days, 10);
  assert.equal(packageBookingMonthWindow({ starts_at: '2026-09-20', expires_at: '2026-09-30' }, '', earliest).days, 0);
});
