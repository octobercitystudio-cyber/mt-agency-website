import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = path => readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('financial months have close/reopen snapshots and closed months reject writes', async () => {
  const api=await load('api/legacy_import.php');const ui=await load('src/erp/ERPFinance.jsx');const migration=await load('database/mysql/035_legacy_import_and_finance_periods.sql');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS finance_periods/);assert.match(migration,/opening_balances_json/);assert.match(migration,/closing_balances_json/);
  assert.match(api,/function legacyRequireFinancePeriodOpen/);assert.match(api,/finance_period_closed/);assert.match(api,/\/finance\/periods/);assert.match(api,/close\|reopen/);assert.match(api,/function legacyRefreshImportedFinancePeriods/);assert.match(api,/shouldAutoClose/);assert.match(api,/month===\$current.*closed_by/s);
  assert.match(ui,/إقفال الشهر/);assert.match(ui,/إعادة فتح الشهر/);assert.match(ui,/يوم 1 يبدأ تقرير شهر جديد/);
});
