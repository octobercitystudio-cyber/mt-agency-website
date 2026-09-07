import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { MAX_SESSION_COMPENSATION_SECONDS, validateSessionCompensation } from '../src/erp/sessionCompensationValidation.js';
import { elapsedSessionSeconds, grossSessionSeconds } from '../src/erp/studioSessionDuration.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
const eventTarget = new EventTarget();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
const database = () => JSON.parse([...storage.values()][0]);
const writeDatabase = value => storage.set([...storage.keys()][0], JSON.stringify(value));

const startSession = async (grossSeconds = 600) => {
  const started = await demoClient.request('/bookings/301/session/start', { method: 'POST' });
  assert.equal(started.error, null);
  const db = database(); const session = db.booking_sessions.find(row => Number(row.id) === Number(started.data.id));
  const instant = new Date(Date.now() - grossSeconds * 1000); session.started_at_iso = instant.toISOString(); session.started_at = instant.toISOString().slice(0, 19).replace('T', ' '); writeDatabase(db);
  return session.id;
};
const compensate = (sessionId, total, version = 1, reason = 'تأخر تجهيز إضاءة الشركة') => demoClient.request(`/studio-sessions/${sessionId}/compensation`, { method: 'POST', body: JSON.stringify({ complimentary_seconds: total, expected_session_version: version, reason }) });

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('timer math keeps gross time separate and subtracts compensation after server offset', () => {
  const session = { started_at_iso: '2026-09-06T12:00:00+03:00', complimentary_seconds: 75 };
  const localNow = Date.parse('2026-09-06T09:04:00Z');
  assert.equal(grossSessionSeconds(session, localNow, 30000), 270);
  assert.equal(elapsedSessionSeconds(session, localNow, 30000), 195);
  assert.equal(elapsedSessionSeconds({ ...session, complimentary_seconds: 999 }, localNow, 0), 0);
});

test('inline compensation validation explains every disabled-submit state before submission', () => {
  const zero = validateSessionCompensation({ additionalMinutes: 0, currentSeconds: 300, grossSeconds: 5400, reason: '' });
  assert.equal(zero.durationErrorCode, 'duration_required');
  assert.equal(zero.reasonErrorCode, 'reason_too_short');
  assert.equal(zero.maximumAdditionalSeconds, 5100);
  assert.equal(zero.valid, false);

  const shortReason = validateSessionCompensation({ additionalMinutes: 15, currentSeconds: 300, grossSeconds: 5400, reason: 'سبب' });
  assert.equal(shortReason.durationErrorCode, '');
  assert.equal(shortReason.reasonErrorCode, 'reason_too_short');
  assert.equal(shortReason.remainingReasonCharacters, 2);

  const aboveGross = validateSessionCompensation({ additionalMinutes: 86, currentSeconds: 300, grossSeconds: 5400, reason: 'تأخير واضح' });
  assert.equal(aboveGross.durationErrorCode, 'gross_elapsed_limit');
  assert.equal(aboveGross.maximumAdditionalSeconds, 5100);

  const aboveSevenDays = validateSessionCompensation({ additionalMinutes: (7 * 24 * 60) + 1, currentSeconds: 0, grossSeconds: MAX_SESSION_COMPENSATION_SECONDS + 3600, reason: 'تأخير واضح' });
  assert.equal(aboveSevenDays.durationErrorCode, 'seven_day_limit');
  assert.equal(aboveSevenDays.maximumAdditionalSeconds, MAX_SESSION_COMPENSATION_SECONDS);

  const valid = validateSessionCompensation({ additionalMinutes: 85, currentSeconds: 300, grossSeconds: 5400, reason: 'تأخير واضح' });
  assert.equal(valid.valid, true);
  assert.equal(valid.requestedTotal, 5400);
});

test('owner set-total is retry-safe, stale-safe, bounded, audited and synchronized', async () => {
  const id = await startSession(600);
  const first = await compensate(id, 120);
  assert.equal(first.error, null); assert.equal(first.data.complimentary_seconds, 120); assert.equal(first.data.settlement_version, 2); assert.ok(first.data.net_elapsed_seconds >= 475 && first.data.net_elapsed_seconds <= 485);
  const afterFirst = database(); const notificationCount = afterFirst.app_notifications.filter(row => row.type === 'session_compensation_added').length; const auditCount = afterFirst.audit_logs.filter(row => row.action === 'session_compensation_set').length;
  const replay = await compensate(id, 120, 1);
  assert.equal(replay.error, null); assert.equal(replay.data.idempotent_replay, true); assert.equal(database().app_notifications.filter(row => row.type === 'session_compensation_added').length, notificationCount); assert.equal(database().audit_logs.filter(row => row.action === 'session_compensation_set').length, auditCount);
  const stale = await compensate(id, 180, 1); assert.equal(stale.error?.code, 'stale_session_version'); assert.equal(database().booking_sessions.find(row => row.id === id).complimentary_seconds, 120);
  const tooLarge = await compensate(id, 700, 2); assert.equal(tooLarge.error?.code, 'compensation_exceeds_elapsed');
  const backwards = await compensate(id, 60, 2); assert.equal(backwards.error?.code, 'compensation_cannot_decrease');
  const db = database(); assert.ok(db.change_events.some(row => row.topic === 'bookings' && row.action === 'session_compensation'));
  const notice = db.app_notifications.find(row => row.type === 'session_compensation_added'); assert.ok(notice); assert.doesNotMatch(JSON.stringify(notice), /إضاءة الشركة|complimentary_reason|updated_by/);
});

test('non-owners are denied, other tenants cannot find the session, and client active DTO stays safe', async () => {
  const id = await startSession(600); const first = await compensate(id, 60); assert.equal(first.error, null);
  for (const role of ['admin', 'operations', 'staff', 'client']) {
    activateDemoMode(role); const denied = await compensate(id, 120, 2); assert.equal(denied.error?.code, 'forbidden', role);
  }
  activateDemoMode('owner', 1, 2); const isolated = await compensate(id, 120, 2); assert.equal(isolated.error?.code, 'session_not_found');
  activateDemoMode('client'); const active = await demoClient.request('/studio-sessions/active', { method: 'GET' }); const session = active.data.items[0];
  assert.equal(session.complimentary_seconds, 60);
  for (const field of ['complimentary_reason', 'complimentary_updated_by', 'complimentary_updated_at', 'settlement_version', 'client_id']) assert.equal(Object.hasOwn(session, field), false, field);
});

test('compensation invalidates an old settlement preview and final package consumption uses submitted net time once', async () => {
  const id = await startSession(300);
  const oldPreview = await demoClient.request('/bookings/301/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: 5 }) }); assert.equal(oldPreview.error, null);
  const changed = await compensate(id, 120); assert.equal(changed.error, null);
  const stale = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 5, expected_session_version: oldPreview.data.session_version }) }); assert.equal(stale.error?.code, 'stale_settlement_preview');
  const preview = await demoClient.request('/bookings/301/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: 3 }) }); assert.equal(preview.error, null); assert.equal(preview.data.complimentary_seconds, 120); assert.equal(preview.data.session_version, 2);
  const completed = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 3, expected_session_version: 2 }) }); assert.equal(completed.error, null); assert.equal(completed.data.actual_minutes, 3); assert.equal(completed.data.complimentary_seconds, 120);
  const consumed = database().package_usage_ledger.find(row => row.movement_type === 'consume' && Number(row.booking_id) === 301); assert.equal(consumed.quantity_minutes, 3);
});

test('production contract is owner-only, tenant-scoped, transactional and client-safe', async () => {
  const [api, settlement, migration] = await Promise.all([load('api/index.php'), load('api/session_settlement.php'), load('database/mysql/037_session_compensation.sql')]);
  const route = api.slice(api.indexOf("if (preg_match('#^/studio-sessions/"), api.indexOf('function clientSafeBookingSessionRows'));
  assert.match(route, /requireRole\(\$user,\['owner'\]\)/); assert.match(route, /FOR UPDATE/); assert.match(route, /bs\.organization_id=\?/); assert.match(route, /settlement_version=settlement_version\+1/); assert.match(route, /audit\(/); assert.match(route, /recordChangeEvent/); assert.match(route, /appNotification/);
  assert.doesNotMatch(route.slice(route.indexOf("appNotification"), route.indexOf('$response=')), /\$reason|complimentary_reason|updated_by/);
  const clientDto = api.slice(api.indexOf('function clientSafeBookingSessionRows'), api.indexOf("if ($path === '/studio-session-eligibility'")); assert.match(clientDto, /complimentary_seconds/); assert.doesNotMatch(clientDto, /complimentary_reason|complimentary_updated_by|complimentary_updated_at/);
  assert.match(settlement, /'complimentary_seconds'=>\$complimentary/); assert.match(settlement, /stale_settlement_preview/); assert.match(migration, /DEFAULT 0/); assert.match(migration, /information_schema\.COLUMNS/); assert.match(api, /session_compensation_ready/);
});

test('modal exposes inline validation and traps focus even while every control is disabled', async () => {
  const [dialog, timer, css, modalHook, durationInput] = await Promise.all([load('src/erp/ERPSessionCompensationDialog.jsx'), load('src/erp/ERPSessionTimer.jsx'), load('src/erp/ERPSessionCompensationDialog.css'), load('src/hooks/useModalDialog.js'), load('src/components/DurationHoursMinutesInput.jsx')]);
  assert.match(dialog, /DurationHoursMinutesInput/); assert.match(dialog, /role="dialog"/); assert.match(dialog, /aria-modal="true"/); assert.match(dialog, /aria-busy=\{busy\}/); assert.match(dialog, /tabIndex="-1"/); assert.match(dialog, /isolateBackground: true/); assert.match(dialog, /aria-live="polite"/); assert.match(dialog, /اعتماد وخصم الوقت/); assert.match(dialog, /يظهر للإدارة فقط/);
  assert.match(dialog, /أدخل دقيقة واحدة على الأقل/); assert.match(dialog, /الحد الأقصى الذي يمكنك إضافته الآن/); assert.match(dialog, /لا يمكن أن يتجاوز 7 أيام/); assert.match(dialog, /السبب مطلوب بحد أدنى 5 أحرف/); assert.match(dialog, /aria-invalid=\{Boolean\(reasonError\)\}/); assert.match(dialog, /error=\{durationError\}/);
  assert.match(durationInput, /aria-invalid=\{Boolean\(error\)\}/); assert.match(durationInput, /aria-describedby=\{describedBy\}/); assert.match(durationInput, /role="alert"/);
  assert.match(modalHook, /if \(!items\.length\)/); assert.match(modalHook, /event\.preventDefault\(\);\s*dialog\?\.focus/); assert.match(modalHook, /document\.addEventListener\('focusin', handleFocusIn, true\)/); assert.match(modalHook, /while \(activeBranch\.parentElement\)/); assert.match(modalHook, /element\.inert = true/);
  assert.match(timer, /role === 'owner'/); assert.doesNotMatch(timer, /PackageUpgradeDialog|ترقية الباقة/); assert.match(css, /@media\(max-width:600px\)/); assert.match(css, /min-height:46px/); assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
