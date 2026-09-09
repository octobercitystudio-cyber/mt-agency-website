import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAttendancePage } from '../src/lib/attendancePageLoad.js';

test('owner payroll reads do not create attendance and preserve independent datasets', async () => {
  const api = {
    checkIn: () => assert.fail('owner must not check in'),
    summary: async month => ({ month, items: [{ user_id: 4 }] }),
    policies: async () => [{ user_id: 4 }],
    today: async () => ({ team: [] }),
  };
  assert.deepEqual(await loadAttendancePage(api, '2026-09', { isOwner: true }), [
    { month: '2026-09', items: [{ user_id: 4 }] }, [{ user_id: 4 }], { team: [] },
  ]);
});

test('employee view still checks in and identifies a failed module with its tracking ID', async () => {
  let checkedIn = false;
  const api = {
    checkIn: async () => { checkedIn = true; },
    summary: async () => { assert.equal(checkedIn, true); throw new Error('رقم المتابعة: test-request'); },
    policies: async () => [], today: async () => ({}),
  };
  await assert.rejects(loadAttendancePage(api, '2026-09'), /ملخص الحضور والرواتب: رقم المتابعة: test-request/);
});

test('payroll supports pre-void schema and policy joins preserve users without a policy', async () => {
  const api = await readFile(new URL('../api/index.php', import.meta.url), 'utf8');
  const summary = api.slice(api.indexOf('function attendanceSummary('), api.indexOf('function sendWhatsAppTemplate('));
  assert.match(summary, /schemaTableColumns\(\$pdo,'attendance_adjustments'\)/);
  assert.match(summary, /in_array\('voided_at',\$adjustmentColumns,true\)\?' AND voided_at IS NULL':''/);
  assert.match(summary, /adjustment_month=\?'\.\$activeAdjustmentFilter/);
  assert.doesNotMatch(api, /SELECT u\.id user_id,u\.full_name,u\.role,u\.is_active,p\.\* FROM users u LEFT JOIN attendance_policies/);
  assert.match(api, /SELECT p\.\*,u\.id user_id,u\.full_name,u\.role,u\.is_active FROM users u LEFT JOIN attendance_policies/);
  assert.match(api, /function attendanceWorkingWeekdays\(mixed \$value\): array/);
  assert.match(api, /catch\(Throwable \$ignored\).*?Keep the saved value for malformed legacy timestamps/s);
  assert.match(api, /attendance_schema_ready/);
});
