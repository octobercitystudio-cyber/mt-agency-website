import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { elapsedSessionSeconds } from '../src/erp/studioSessionDuration.js';
import {
  clientSessionMap,
  earliestClientSession,
  formatElapsedHoursMinutes,
  normalizeClientStudioSessions,
  promoteActiveBookings,
  sessionServerOffset,
} from '../src/pages/clientStudioSessions.js';
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
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('active sessions attach only to their exact valid numeric booking ids', () => {
  const sessions = [
    { id: 1, booking_id: 301, status: 'active', started_at_iso: '2026-08-09T12:00:00+02:00' },
    { id: 2, booking_id: 302, status: 'active', started_at_iso: '2026-08-09T12:01:00+02:00' },
    { id: 3, booking_id: 'bad', status: 'active' },
    { id: 4, booking_id: 303, status: 'completed' },
  ];
  assert.deepEqual(normalizeClientStudioSessions({ items: sessions }).map(row => row.id), [1, 2]);
  const map = clientSessionMap(sessions);
  assert.equal(map.get(301)?.id, 1);
  assert.equal(map.get(302)?.id, 2);
  assert.equal(map.has(303), false);
  assert.equal(map.has(Number.NaN), false);
});

test('earliest active session is deterministic and promotes a past booking as current', () => {
  const sessions = [
    { booking_id: 302, status: 'active', started_at_iso: '2026-08-09T12:05:00+02:00', service: 'الثانية' },
    { booking_id: 301, status: 'active', started_at_iso: '2026-08-09T12:00:00+02:00', service: 'الحالية', date: '2026-08-09', start_time: '12:00', end_time: '13:00' },
  ];
  assert.equal(earliestClientSession(sessions).booking_id, 301);
  const promoted = promoteActiveBookings([{ id: 400, service: 'موعد قادم', status: 'confirmed' }], sessions);
  assert.equal(promoted[0].id, 301);
  assert.equal(promoted[0].status, 'in_progress');
  assert.equal(promoted[1].id, 400);
});

test('server offset and ISO start self-correct elapsed hours and minutes without negatives', () => {
  const receivedAt = Date.parse('2026-08-09T10:00:30Z');
  const offset = sessionServerOffset('2026-08-09T10:02:30Z', receivedAt);
  assert.equal(offset, 120000);
  const session = { started_at_iso: '2026-08-09T12:00:00+02:00' };
  assert.equal(elapsedSessionSeconds(session, receivedAt, offset), 150);
  assert.equal(formatElapsedHoursMinutes(150), '00:02');
  assert.equal(formatElapsedHoursMinutes(elapsedSessionSeconds(session, Date.parse('2026-08-09T09:00:00Z'), 0)), '00:00');
  assert.equal(formatElapsedHoursMinutes(3661), '01:01');
});

test('demo client sees only their active session and no internal or financial fields', async () => {
  const started = await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  assert.equal(started.error, null);
  activateDemoMode('client');
  const response = await demoClient.request('/studio-sessions/active', { method: 'GET' });
  assert.equal(response.error, null);
  assert.equal(response.data.items.length, 1);
  assert.equal(response.data.items[0].booking_id, 301);
  for (const forbidden of ['client_id', 'started_by', 'ended_by', 'adjustment_reason', 'settlement_version', 'paid_amount', 'held_quantity']) {
    assert.equal(Object.hasOwn(response.data.items[0], forbidden), false, `${forbidden} must stay private`);
  }
  const denied = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 5 }) });
  assert.equal(denied.error?.code, 'forbidden');
});

test('client hook keeps last active state on failure and API uses authenticated client scope', async () => {
  const [hook, api, dashboard, component] = await Promise.all([
    load('src/hooks/useClientStudioSessions.js'),
    load('api/index.php'),
    load('src/pages/ClientDashboard.jsx'),
    load('src/pages/ClientAppointmentLiveStatus.jsx'),
  ]);
  assert.match(hook, /sequence !== requestSequence\.current/);
  assert.match(hook, /temporary failure must not make a real, running session disappear/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /useChangeSync/);
  assert.match(api, /if\(\$user\['role'\]===\s*'client'\).*bs\.client_id=\?/s);
  assert.match(api, /clientSafeBookingSessionRows/);
  assert.doesNotMatch(api.slice(api.indexOf('function clientSafeBookingSessionRows'), api.indexOf("if ($path === '/studio-session-eligibility'")), /paid_amount|started_by|settlement|waiver|ledger/);
  assert.doesNotMatch(dashboard, /function ClientActiveSession/);
  assert.match(dashboard, /sessionByBookingId\.get\(Number\(booking\.id\)\)/);
  assert.match(component, /elapsedSessionSeconds/);
  assert.doesNotMatch(component, /button|input|onClick|onChange/);
});

test('client home promotes the appointment card before packages and transforms that card in place', async () => {
  const overview = await load('src/pages/ClientDashboardOverview.jsx');
  assert.ok(overview.indexOf('className={`client-next-home') < overview.indexOf('className="client-packages-home"'));
  assert.match(overview, /activeSession \? 'تم بدء جلسة التصوير' : 'الموعد القادم'/);
  assert.match(overview, /activeSession \? <span className="client-status client-status--live">جاري التصوير<\/span>/);
  assert.equal((overview.match(/<ClientAppointmentLiveStatus/g) || []).length, 1);
  assert.equal((overview.match(/\{!activeSession && <button/g) || []).length, 2);
});
