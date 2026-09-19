import assert from 'node:assert/strict';
import test from 'node:test';
import { clientPackageWorkspaceSummary, packageWorkspaceUpcomingBookings, resolvePackageWorkspaceSelection } from '../src/erp/packageWorkspace.js';

const todayKey = '2026-09-19';
const current = { id: 41, client_id: 7, billing_unit: 'hour', status: 'active', starts_at: '2026-09-01', expires_at: '2026-10-08', purchased_minutes: 1200, consumed_minutes: 855, held_minutes: 240, purchased_quantity: 99, consumed_quantity: 0, total_price: '3400.00', paid_amount: '3400.00' };
const next = { ...current, id: 42, starts_at: null, expires_at: null, consumed_minutes: 0, held_minutes: 0, paid_amount: '1000.00' };
const anotherClient = { ...current, id: 50, client_id: 8 };
const groups = [
  { clientId: '7', packages: [current, next], priorityPackageId: 41 },
  { clientId: '8', packages: [anotherClient], priorityPackageId: 50 },
];

test('workspace switching never retains another client package and respects visible priority', () => {
  assert.equal(resolvePackageWorkspaceSelection(groups, '7', '42').pkg, next);
  const switched = resolvePackageWorkspaceSelection(groups, '8', '42');
  assert.equal(switched.group.clientId, '8');
  assert.equal(switched.pkg, anotherClient);
  assert.equal(resolvePackageWorkspaceSelection(groups, '7', '').pkg, current);
  const filtered = [{ ...groups[0], packages: [next] }];
  assert.equal(resolvePackageWorkspaceSelection(filtered, '7', '41').pkg, next);
});

test('refresh, deletion and empty search results always derive a safe selection', () => {
  assert.equal(resolvePackageWorkspaceSelection(groups.slice(1), '7', '41').pkg, anotherClient);
  assert.equal(resolvePackageWorkspaceSelection([{ clientId: '7', packages: [] }, groups[1]], '7', '41').pkg, anotherClient);
  assert.deepEqual(resolvePackageWorkspaceSelection([], '7', '42'), { group: null, pkg: null });
  assert.deepEqual(resolvePackageWorkspaceSelection([{ clientId: '7', packages: [] }]), { group: null, pkg: null });
});

test('client summaries include pending renewal dues and authoritative minutes without summing reels as hours', () => {
  const reel = { id: 43, client_id: 7, billing_unit: 'reel', status: 'active', purchased_quantity: 8, consumed_quantity: 2, held_quantity: 1, starts_at: null, expires_at: null, total_price: '100.10', overage_amount: '0.20', paid_amount: '0.05' };
  const expired = { ...next, id: 44, starts_at: '2026-08-01', expires_at: '2026-09-18' };
  const suspended = { ...next, id: 45, status: 'suspended' };
  const credit = { ...current, id: 46, consumed_minutes: 1200, held_minutes: 0, paid_amount: '5000.00' };
  const summary = clientPackageWorkspaceSummary([current, next, anotherClient, reel, expired, suspended, credit], '7', todayKey);
  assert.equal(summary.totalCount, 6);
  assert.equal(summary.activeCount, 4);
  assert.equal(summary.activeOutstandingCents, 250025);
  assert.equal(summary.availableHours, 21.75);
  assert.equal(summary.availableReels, 5);
  assert.deepEqual(clientPackageWorkspaceSummary([], '7', todayKey), { totalCount: 0, activeCount: 0, activeOutstandingCents: 0, availableHours: 0, availableReels: 0 });
});

test('credit remains on its package and does not mask renewal debt', () => {
  const overpaid = { ...current, paid_amount: '5000.00' };
  assert.equal(clientPackageWorkspaceSummary([overpaid, next], 7, todayKey).activeOutstandingCents, 240000);
});

test('schedule shows only exact client/package active bookings and keeps a running session', () => {
  const booking = { client_id: 7, client_package_id: 41, date: todayKey, start_time: '19:00', end_time: '21:00', status: 'confirmed' };
  const bookings = [
    { ...booking, id: 4, date: '2026-09-20', start_time: '18:00' },
    { ...booking, id: 3, date: '2026-09-20', start_time: '14:00' },
    { ...booking, id: 2 },
    { ...booking, id: 1, start_time: '12:00', end_time: '13:00', status: 'in_progress' },
    { ...booking, id: 5, client_package_id: 42 },
    { ...booking, id: 6, client_id: 8 },
    { ...booking, id: 7, status: 'cancelled' },
    { ...booking, id: 8, status: 'completed' },
    { ...booking, id: 9, date: '2026-09-18' },
    { ...booking, id: 10, start_time: '12:00', end_time: '13:00' },
    { ...booking, id: 11, start_time: '16:00', end_time: '18:00' },
    { ...booking, id: 12, status: 'pending' },
  ];
  assert.deepEqual(packageWorkspaceUpcomingBookings(bookings, current, `${todayKey} 18:00`).map(item => item.id), [1, 2, 3, 4]);
  assert.deepEqual(packageWorkspaceUpcomingBookings(bookings, next, `${todayKey} 18:00`).map(item => item.id), [5]);
  assert.deepEqual(packageWorkspaceUpcomingBookings(bookings, null), []);
  assert.equal(bookings[0].id, 4, 'input order is preserved');
});
