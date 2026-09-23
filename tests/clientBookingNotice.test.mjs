import assert from 'node:assert/strict';
import test from 'node:test';
import { clientNoticeIsLate, clientNoticeRemainingSeconds } from '../src/lib/clientBookingNotice.js';

test('48 actual hours exclude every Friday hour and include the exact boundary', () => {
  const booking = { date: '2026-09-26', start_time: '12:00' };
  assert.equal(clientNoticeRemainingSeconds(booking, new Date('2026-09-23T09:00:00Z')), 48 * 3600);
  assert.equal(clientNoticeIsLate(booking, new Date('2026-09-23T09:00:00Z')), false);
  assert.equal(clientNoticeIsLate(booking, new Date('2026-09-23T09:00:01Z')), true);
  assert.equal(clientNoticeRemainingSeconds(booking, new Date('2026-09-24T09:00:00Z')), 24 * 3600);
  assert.equal(clientNoticeRemainingSeconds(booking, new Date('2026-09-25T09:00:00Z')), 12 * 3600);
});

test('ordinary days count overnight hours, not only company opening hours', () => {
  const booking = { date: '2026-09-24', start_time: '12:00' };
  assert.equal(clientNoticeIsLate(booking, new Date('2026-09-22T09:00:00Z')), false);
  assert.equal(clientNoticeIsLate(booking, new Date('2026-09-22T09:01:00Z')), true);
  assert.equal(clientNoticeIsLate(booking, new Date('2026-09-24T09:00:00Z')), true);
  assert.equal(clientNoticeIsLate({ date: 'invalid', start_time: 'invalid' }), true);
});

test('Egypt daylight-saving Friday transitions do not change counted notice hours', () => {
  assert.equal(clientNoticeIsLate({ date: '2026-04-25', start_time: '12:00' }, new Date('2026-04-22T10:00:00Z')), false);
  assert.equal(clientNoticeIsLate({ date: '2026-10-31', start_time: '12:00' }, new Date('2026-10-28T09:00:00Z')), false);
});
