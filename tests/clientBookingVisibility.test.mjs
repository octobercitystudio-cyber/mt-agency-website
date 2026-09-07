import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isClientBookingVisible } from '../src/lib/clientBookingVisibility.js';

test('client dashboard hides cancelled and rejected appointments only', () => {
  for (const status of ['cancelled', 'canceled', 'rejected', ' CANCELLED ', 'REJECTED']) {
    assert.equal(isClientBookingVisible({ status }), false, status);
  }

  for (const status of ['pending', 'confirmed', 'alternative_proposed', 'cancel_requested', 'late_cancel_requested', 'in_progress', 'completed']) {
    assert.equal(isClientBookingVisible({ status }), true, status);
  }
});

test('home and booking history are both derived from visible appointments', async () => {
  const dashboard = await readFile(new URL('../src/pages/ClientDashboard.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /const visibleBookings = useMemo\(\(\) => bookings\.filter\(isClientBookingVisible\)/);
  assert.match(dashboard, /return visibleBookings\.map\(/);
  assert.match(dashboard, /const futureBookings = useMemo\(\(\) => visibleBookings/);
  assert.match(dashboard, /promoteActiveBookings\(futureBookings, visibleActiveSessions\)/);
  assert.match(dashboard, /orderedBookings\.map\(booking/);
});

test('owner dashboard also excludes cancelled and rejected appointments', async () => {
  const dashboard = await readFile(new URL('../src/erp/ERPDashboard.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /isClientBookingVisible as isDashboardBookingVisible/);
  assert.match(dashboard, /bookings: \(bookingsResult\.data \|\| \[\]\)\.filter\(\(booking\) => isDashboardBookingVisible/);
  assert.match(dashboard, /'مرفوض': 'rejected'/);
});
