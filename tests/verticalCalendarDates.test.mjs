import assert from 'node:assert/strict';
import test from 'node:test';
import { verticalCalendarRange, shiftVerticalCalendar, groupVerticalCalendarEvents, transposeCalendarDays } from '../src/lib/verticalCalendarDates.js';

test('vertical month includes every day, including leap day and empty booking days', () => {
  const leap = verticalCalendarRange('2028-02-17', 'month');
  assert.equal(leap.start, '2028-02-01');
  assert.equal(leap.endExclusive, '2028-03-01');
  assert.equal(leap.days.length, 29);
  assert.equal(leap.days.at(-1), '2028-02-29');
  assert.equal(verticalCalendarRange('2027-02-17', 'month').days.length, 28);
  assert.equal(verticalCalendarRange('2026-09-27', 'month').days.length, 30);
  assert.equal(verticalCalendarRange('2026-12-31', 'month').endExclusive, '2027-01-01');
});

test('vertical week starts Saturday and crosses month and year boundaries', () => {
  const week = verticalCalendarRange('2027-01-01', 'week');
  assert.equal(week.start, '2026-12-26');
  assert.equal(week.endExclusive, '2027-01-02');
  assert.equal(week.days.length, 7);
  assert.deepEqual(week.days, ['2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
  assert.equal(verticalCalendarRange('2027-01-02', 'week').start, '2027-01-02');
});

test('period navigation stays in the intended month even from its last day', () => {
  assert.ok(shiftVerticalCalendar('2026-01-31', 'month', 1).startsWith('2026-02-'));
  assert.ok(shiftVerticalCalendar('2026-03-31', 'month', -1).startsWith('2026-02-'));
  assert.ok(shiftVerticalCalendar('2026-12-31', 'month', 1).startsWith('2027-01-'));
  assert.equal(shiftVerticalCalendar('2026-12-28', 'week', 1), '2027-01-04');
  assert.equal(shiftVerticalCalendar('2027-01-04', 'week', -1), '2026-12-28');
});

test('midnight-end bookings appear once on their start day, sorted without changing source records', () => {
  const days = ['2026-09-27', '2026-09-28', '2026-09-29'];
  const events = [
    { id: 'late', start: '2026-09-27T22:00:00', end: '2026-09-28T00:00:00' },
    { id: 'early', start: '2026-09-27T12:00:00', end: '2026-09-27T13:00:00' },
    { id: 'next', start: '2026-09-28T14:00:00', end: '2026-09-28T15:00:00' },
    { id: 'outside', start: '2026-10-01T12:00:00', end: '2026-10-01T13:00:00' },
  ];
  const snapshot = structuredClone(events);
  const grouped = groupVerticalCalendarEvents(events, days);
  assert.deepEqual(grouped.get(days[0]).map(event => event.id), ['early', 'late']);
  assert.deepEqual(grouped.get(days[1]).map(event => event.id), ['next']);
  assert.deepEqual(grouped.get(days[2]), []);
  assert.equal(grouped.size, 3);
  assert.deepEqual(events, snapshot);
});

test('month matrix places weekdays vertically and weeks horizontally without losing or repeating dates', () => {
  const days = verticalCalendarRange('2026-09-27').days;
  const matrix = transposeCalendarDays(days);
  assert.equal(matrix.weekCount, 5);
  assert.deepEqual(matrix.rows.map(row => row.weekday), [6, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(matrix.rows[0].cells, [null, '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']);
  assert.deepEqual(matrix.rows[3].cells, ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
  assert.deepEqual(matrix.rows.flatMap(row => row.cells).filter(Boolean).sort(), days);
  for (const row of matrix.rows) for (const date of row.cells.filter(Boolean)) {
    assert.equal(new Date(`${date}T12:00:00Z`).getUTCDay(), row.weekday);
  }
});

test('month matrix supports four and six weeks, leap day and single-week view', () => {
  assert.equal(transposeCalendarDays(verticalCalendarRange('2025-02-12').days).weekCount, 4);
  const six = transposeCalendarDays(verticalCalendarRange('2026-05-15').days);
  assert.equal(six.weekCount, 6);
  assert.equal(six.rows[6].cells[0], '2026-05-01');
  assert.equal(six.rows[1].cells[5], '2026-05-31');
  const leap = transposeCalendarDays(verticalCalendarRange('2028-02-02').days);
  assert.ok(leap.rows[3].cells.includes('2028-02-29'));
  const week = transposeCalendarDays(verticalCalendarRange('2027-01-01', 'week').days);
  assert.equal(week.weekCount, 1);
  assert.equal(week.rows[0].cells[0], '2026-12-26');
  assert.equal(week.rows[6].cells[0], '2027-01-01');
  assert.equal(transposeCalendarDays([]).weekCount, 0);
});
