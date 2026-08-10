import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  durationInputToMinutes,
  elapsedSessionSeconds,
  formatElapsedTime,
  roundedElapsedMinutes,
  sessionMaximumMinutes,
} from '../src/erp/studioSessionDuration.js';
import { canRoleCompleteStudioSession } from '../src/erp/studioSessionPermissions.js';
import { dispatchStudioSessionUpdates } from '../src/erp/studioSessionEvents.js';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
const eventTarget = new EventTarget();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
}

const storedDatabase = () => JSON.parse([...storage.values()][0]);

test.beforeEach(() => {
  storage.clear();
  activateDemoMode('owner');
  resetDemoDatabase();
});

test.afterEach(() => deactivateDemoMode());

test('elapsed duration rounds to the nearest minute and positive time never becomes zero', () => {
  assert.equal(roundedElapsedMinutes(0), 0);
  assert.equal(roundedElapsedMinutes(1), 1);
  assert.equal(roundedElapsedMinutes(29), 1);
  assert.equal(roundedElapsedMinutes(89), 1);
  assert.equal(roundedElapsedMinutes(90), 2);
  assert.equal(roundedElapsedMinutes(3690), 62);
});

test('manual hours and minutes convert exactly and reject invalid values', () => {
  assert.equal(durationInputToMinutes('1', '15'), 75);
  assert.equal(durationInputToMinutes('0', '1'), 1);
  for (const values of [['0', '0'], ['-1', '0'], ['1', '-1'], ['1', '60'], ['', '5'], ['x', '5'], ['1.5', '0']]) {
    assert.throws(() => durationInputToMinutes(...values));
  }
});

test('maximum editable duration uses the booking hold before package totals', () => {
  assert.equal(sessionMaximumMinutes({ billing_unit: 'hour', booking_held_quantity: 1.25, held_quantity: 4, requested_quantity: 2 }), 75);
  assert.equal(sessionMaximumMinutes({ billing_unit: 'hour', held_quantity: 3, requested_quantity: 1.5 }), 90);
  assert.equal(sessionMaximumMinutes({ billing_unit: 'reel', duration_minutes: 120 }), 120);
});

test('stop permission matrix allows only owner, admin, and operations', async () => {
  assert.deepEqual(['owner', 'admin', 'operations', 'finance', 'staff', 'client'].map(role => [role, canRoleCompleteStudioSession(role)]), [
    ['owner', true], ['admin', true], ['operations', true], ['finance', false], ['staff', false], ['client', false],
  ]);
  const [timer, layout] = await Promise.all([load('src/erp/ERPSessionTimer.jsx'), load('src/erp/ERPLayout.jsx')]);
  assert.match(timer, /canComplete && <button/);
  assert.match(timer, /canComplete && <ERPStopSessionDialog/);
  assert.match(layout, /<ERPSessionTimer role=\{role\}/);
});

test('shared completion event dispatcher notifies every dependent ERP surface', () => {
  const received = [];
  const handlers = ['erpSessionChanged', 'erpRequestsUpdated', 'erpPackagesUpdated', 'erpClientDashboardUpdated'].map(type => {
    const handler = event => received.push([type, event.detail]);
    eventTarget.addEventListener(type, handler, { once: true });
    return [type, handler];
  });
  dispatchStudioSessionUpdates({ bookingId: 301, packageId: 201, completed: true }, eventTarget);
  assert.deepEqual(received.map(([type]) => type), ['erpSessionChanged', 'erpRequestsUpdated', 'erpPackagesUpdated', 'erpClientDashboardUpdated']);
  assert.equal(received[0][1].bookingId, 301);
  assert.deepEqual(received[1][1].topics, ['bookings', 'client_packages', 'package_usage_ledger', 'finance', 'projects', 'invoices', 'notifications']);
  handlers.forEach(([type, handler]) => eventTarget.removeEventListener(type, handler));
});

test('demo start returns Cairo-safe ISO timing and complete appointment context', async () => {
  const started = await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  assert.equal(started.error, null);
  const active = await demoClient.request('/studio-sessions/active', { method: 'GET' });
  assert.equal(active.error, null);
  assert.ok(Array.isArray(active.data.items));
  assert.equal(active.data.items.length, 1);
  const session = active.data.items[0];
  assert.equal(session.date, storedDatabase().bookings.find(item => item.id === 301).date);
  assert.equal(session.start_time, '13:00:00');
  assert.equal(session.end_time, '15:00:00');
  assert.equal(session.duration_minutes, 120);
  assert.equal(session.booking_held_quantity, 2);
  const elapsedMilliseconds = Date.parse(active.data.server_now) - Date.parse(session.started_at_iso);
  assert.ok(elapsedMilliseconds >= 0 && elapsedMilliseconds < 3000, `unexpected fresh-session age: ${elapsedMilliseconds}ms`);
  assert.equal(roundedElapsedMinutes(Math.max(1, elapsedMilliseconds) / 1000), 1);
  const visibleSeconds = elapsedSessionSeconds(session, Date.parse(active.data.server_now));
  assert.ok(visibleSeconds >= 0 && visibleSeconds <= 2);
  assert.match(formatElapsedTime(visibleSeconds), /^00:00:0[0-2]$/);
  assert.notEqual(formatElapsedTime(visibleSeconds), '03:00:00');
});

test('visible timer prefers explicit ISO while keeping a timezone-less production fallback', () => {
  const now = Date.parse('2026-08-09T13:00:01+03:00');
  const session = { started_at: '2026-08-09 07:00:00', started_at_iso: '2026-08-09T13:00:00+03:00' };
  assert.equal(elapsedSessionSeconds(session, now), 1);
  assert.equal(formatElapsedTime(elapsedSessionSeconds(session, now)), '00:00:01');
  const localFallback = new Date('2026-08-09 13:00:00').getTime();
  assert.equal(elapsedSessionSeconds({ started_at: '2026-08-09 13:00:00' }, localFallback + 2000), 2);
});

test('demo rejects invalid stop without mutation, then deducts exactly once and stays idempotent', async () => {
  await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  const before = storedDatabase();
  const beforePackage = before.client_packages.find(item => item.id === 201);
  const beforeLedgerCount = before.package_usage_ledger.length;

  const invalid = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 0 }) });
  assert.equal(invalid.error?.code, 'invalid_actual_duration');
  const afterInvalid = storedDatabase();
  assert.equal(afterInvalid.bookings.find(item => item.id === 301).status, 'in_progress');
  assert.equal(afterInvalid.client_packages.find(item => item.id === 201).consumed_quantity, beforePackage.consumed_quantity);
  assert.equal(afterInvalid.client_packages.find(item => item.id === 201).held_quantity, beforePackage.held_quantity);
  assert.equal(afterInvalid.package_usage_ledger.length, beforeLedgerCount);

  const completed = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 75, reason: 'اعتماد المدة الفعلية' }) });
  assert.equal(completed.error, null);
  assert.equal(completed.data.actual_minutes, 75);
  const afterComplete = storedDatabase();
  const completedPackage = afterComplete.client_packages.find(item => item.id === 201);
  assert.equal(completedPackage.consumed_quantity, beforePackage.consumed_quantity + 1.25);
  assert.equal(completedPackage.held_quantity, beforePackage.held_quantity - 2);
  const completionRows = afterComplete.package_usage_ledger.filter(item => item.booking_id === 301 && String(item.event_key || '').startsWith('settlement:'));
  assert.deepEqual(completionRows.map(item => [item.movement_type, item.quantity]), [['consume', 1.25], ['release', 0.75]]);

  const repeated = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 30 }) });
  assert.equal(repeated.error?.code, 'session_already_settled');
  const afterRepeat = storedDatabase();
  assert.equal(afterRepeat.client_packages.find(item => item.id === 201).consumed_quantity, completedPackage.consumed_quantity);
  assert.equal(afterRepeat.client_packages.find(item => item.id === 201).held_quantity, completedPackage.held_quantity);
  assert.equal(afterRepeat.package_usage_ledger.filter(item => item.booking_id === 301 && String(item.event_key || '').startsWith('settlement:')).length, 2);
});

test('dismissing the editor path leaves the demo session and package untouched', async () => {
  await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  const before = storedDatabase();
  const active = await demoClient.request('/studio-sessions/active', { method: 'GET' });
  assert.equal(active.data.items[0].status, 'active');
  const after = storedDatabase();
  assert.equal(after.booking_sessions.find(item => item.booking_id === 301).status, 'active');
  assert.equal(after.bookings.find(item => item.id === 301).status, 'in_progress');
  assert.equal(after.client_packages.find(item => item.id === 201).consumed_quantity, before.client_packages.find(item => item.id === 201).consumed_quantity);
});

test('stop dialog keeps cancellation separate from completion and preserves edits on errors', async () => {
  const [dialog, timer, helper] = await Promise.all([
    load('src/erp/ERPStopSessionDialog.jsx'),
    load('src/erp/ERPSessionTimer.jsx'),
    load('src/erp/studioSessionComplete.js'),
  ]);
  assert.match(timer, /<ERPStopSessionDialog/);
  assert.match(dialog, /onMouseDown=\{event => event\.target === event\.currentTarget && close\(\)\}/);
  assert.match(dialog, /useModalDialog\(true, close, \{ returnFocusRef \}\)/);
  assert.match(dialog, /if \(busy\) return/);
  assert.match(dialog, /setError\(requestError\?\.message/);
  assert.match(dialog, /حفظ وإيقاف التصوير/);
  assert.match(helper, /dispatchStudioSessionUpdates/);
});

test('production and demo settlement validate before mutation and remain idempotent', async () => {
  const [api, settlement, demo] = await Promise.all([load('api/index.php'), load('api/session_settlement.php'), load('src/lib/demoDataClient.js')]);
  assert.match(api, /settleAndCompleteBookingSession/);
  assert.match(settlement, /FOR UPDATE/);
  assert.match(settlement, /invalid_actual_duration/);
  assert.match(settlement, /idempotency_payload_mismatch/);
  assert.match(settlement, /stale_settlement_preview/);
  assert.ok(settlement.indexOf('invalid_new_package') < settlement.indexOf("UPDATE booking_sessions SET ended_at"));
  assert.match(demo, /const working = clone\(database\)/);
  assert.match(demo, /idempotency_payload_mismatch/);
  assert.match(demo, /session_already_settled/);
});
