import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateAttendanceLateCharge } from '../src/lib/attendancePayrollPolicy.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('lateness keeps 15 minutes free then charges each started half hour at EGP 10', () => {
  const cases = [
    [0, 0, 0, 0],
    [15, 0, 0, 0],
    [16, 1, 30, 10],
    [30, 1, 30, 10],
    [31, 2, 60, 20],
    [60, 2, 60, 20],
    [61, 3, 90, 30],
  ];
  for (const [minutes, units, billableMinutes, amount] of cases) {
    assert.deepEqual(calculateAttendanceLateCharge(minutes), {
      rawLateMinutes: minutes,
      units,
      billableMinutes,
      amount,
    });
  }
});

test('server applies attendance on login to employees only and keeps the fixed rule authoritative', async () => {
  const api = await load('api/index.php');
  assert.match(api, /attendanceCheckIn\(\$pdo, \['id'=>\(int\)\$found\['id'\]/);
  assert.match(api, /in_array\(\$user\['role'\], \['client','owner'\], true\)/);
  assert.match(api, /\$scheduledStart = '12:00';\s*\$graceMinutes = 15;/);
  assert.match(api, /if \(\$rawLateMinutes <= \$graceMinutes\).*?ceil\(\$rawLateMinutes \/ 30\).*?'amount_cents'=>\$units \* 1000/s);
  assert.match(api, /u\.role NOT IN \('client','owner'\)/);
  assert.match(api, /'late_billable_half_hours'=>\$lateUnits/);
});

test('migration enables every active employee and disables owners without changing historical entries', async () => {
  const migration = await load('database/mysql/034_employee_attendance_payroll_rules.sql');
  assert.match(migration, /u\.role IN \('admin', 'operations', 'finance', 'staff'\)/);
  assert.match(migration, /scheduled_start = '12:00:00'/);
  assert.match(migration, /grace_minutes = 15/);
  assert.match(migration, /WHERE u\.role IN \('owner', 'client'\)/);
  assert.doesNotMatch(migration, /UPDATE\s+(attendance_records|attendance_adjustments|finance)\b/i);
});

test('demo manual attendance applies the same boundary and rejects the owner', async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      data: new Map(),
      getItem(key) { return this.data.get(key) ?? null; },
      setItem(key, value) { this.data.set(key, String(value)); },
      removeItem(key) { this.data.delete(key); },
      clear() { this.data.clear(); },
    },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  if (!globalThis.CustomEvent) Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } } });
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const base = { user_id: 3, work_date: '2026-08-24', check_out_at: '2026-08-24 21:00', status: 'late', correction_reason: 'اختبار حدود التأخير الثابتة' };
  const minute16 = await demoClient.request('/attendance/records/manual', { method: 'PUT', body: JSON.stringify({ ...base, check_in_at: '2026-08-24 12:16' }) });
  assert.equal(minute16.data.record.late_minutes, 16);
  const owner = await demoClient.request('/attendance/records/manual', { method: 'PUT', body: JSON.stringify({ ...base, user_id: 1 }) });
  assert.equal(owner.error.code, 'invalid_manual_attendance');
  deactivateDemoMode();
});
