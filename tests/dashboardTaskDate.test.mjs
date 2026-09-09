import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTaskDate } from '../src/erp/dashboardTaskDate.js';

const now = new Date('2026-09-09T21:30:00Z'); // Already September 10 in Cairo.
test('uses Cairo date across midnight and displays zoned timestamps consistently', () => {
  const due = dashboardTaskDate('2026-09-09T22:00:00Z', now);
  assert.equal(due.status, 'today');
  assert.match(due.label, /10/);
  assert.equal(due.time, '1:00 ص');
  assert.equal(dashboardTaskDate('2026-09-09T20:00:00Z', now).status, 'overdue');
});
test('calendar dates have no fabricated midnight time and expire after Cairo day ends', () => {
  assert.equal(dashboardTaskDate('2026-09-10', now).status, 'today');
  assert.equal(dashboardTaskDate('2026-09-10', now).time, '');
  assert.equal(dashboardTaskDate('2026-09-11', now).status, '');
  assert.equal(dashboardTaskDate('2026-09-09', now).status, 'overdue');
});
test('legacy unzoned times retain Cairo wall time independently of device timezone', () => {
  assert.equal(dashboardTaskDate('2026-09-10 12:30:00', now).time, '12:30 م');
  assert.equal(dashboardTaskDate('2026-09-10 12:30:00', now).status, 'today');
});
test('missing, malformed, and impossible dates are safely undated', () => {
  for (const value of [null, '', 'bad', '2026-02-30', '2026-09-10T29:00:00Z']) {
    assert.deepEqual(dashboardTaskDate(value, now), { label: 'دون موعد', time: '', status: '', dateTime: '' });
  }
});
