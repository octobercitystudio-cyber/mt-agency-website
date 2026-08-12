import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const extractCreateTable = (sql, tableName) => {
  const marker = new RegExp('CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+`?' + tableName + '`?\\s*\\(', 'i').exec(sql);
  assert.ok(marker, `CREATE TABLE ${tableName} must exist`);
  const open = marker.index + marker[0].lastIndexOf('(');
  let depth = 0; let quote = null; let escaped = false;
  for (let index = open; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '(') depth += 1;
    if (char === ')' && --depth === 0) return sql.slice(open + 1, index);
  }
  assert.fail(`CREATE TABLE ${tableName} has no balanced closing parenthesis`);
};

const splitSqlDefinitions = body => {
  const definitions = []; let start = 0; let depth = 0; let quote = null; let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) { definitions.push(body.slice(start, index).trim()); start = index + 1; }
  }
  definitions.push(body.slice(start).trim());
  return definitions.filter(Boolean);
};

const schemaShape = body => {
  const definitions = splitSqlDefinitions(body);
  const constraintPrefix = /^(?:PRIMARY|UNIQUE|FULLTEXT|SPATIAL|KEY|INDEX|CONSTRAINT|CHECK)\b/i;
  const columns = new Set(definitions.filter(definition => !constraintPrefix.test(definition)).map(definition => definition.match(/^`?([a-zA-Z0-9_]+)`?\s+/)?.[1]).filter(Boolean));
  const localReferences = [];
  for (const definition of definitions) {
    const match = /(?:KEY|INDEX|FOREIGN\s+KEY)\s*(?:`[^`]+`|[a-zA-Z0-9_]+)?\s*\(([^)]+)\)/i.exec(definition);
    if (!match) continue;
    for (const reference of match[1].split(',')) localReferences.push(reference.trim().replace(/^`|`$/g, '').replace(/\s+(?:ASC|DESC)$/i, '').replace(/\(\d+\)$/, ''));
  }
  return { columns, definitions, localReferences };
};
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
if (!globalThis.CustomEvent) Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } } });

test('migration 027 links employee users without guessing ambiguous names', async () => {
  const migration = await load('database/mysql/027_employee_finance_accounts.sql');
  assert.match(migration, /employee_user_id/);
  assert.match(migration, /fk_finance_employee_user/);
  assert.match(migration, /idx_finance_org_employee_date/);
  assert.match(migration, /HAVING COUNT\(\*\)=1/);
  assert.match(migration, /role<>'client'/);
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN)/i);
});

test('initial schema defines employee finance linkage on finance before its index and foreign key', async () => {
  const schema = await load('database/mysql/001_initial_schema.sql');
  const usersBody = extractCreateTable(schema, 'users');
  const financeBody = extractCreateTable(schema, 'finance');
  const users = schemaShape(usersBody);
  const finance = schemaShape(financeBody);

  assert.equal(users.columns.has('employee_user_id'), false, 'users must not own finance.employee_user_id');
  assert.doesNotMatch(usersBody, /\bemployee_user_id\b/i, 'users must not reference employee_user_id at all');
  assert.equal(finance.columns.has('employee_user_id'), true, 'finance must define employee_user_id');
  for (const reference of finance.localReferences) assert.ok(finance.columns.has(reference), `finance index/FK references missing local column: ${reference}`);

  const columnPosition = finance.definitions.findIndex(definition => /^`?employee_user_id`?\s/i.test(definition));
  const indexPosition = finance.definitions.findIndex(definition => /idx_finance_org_employee_date/i.test(definition));
  const foreignKeyPosition = finance.definitions.findIndex(definition => /fk_finance_employee_user/i.test(definition));
  assert.ok(columnPosition >= 0 && indexPosition > columnPosition, 'employee_user_id must be declared before its index');
  assert.ok(foreignKeyPosition > columnPosition, 'employee_user_id must be declared before its foreign key');
  assert.ok(schema.search(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+users/i) < schema.search(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+finance/i), 'users must exist before finance references it');
});

test('attendance owns employee accounts while finance keeps the linked ledger', async () => {
  const [attendance, component, finance, api, responsiveCss] = await Promise.all([load('src/erp/ERPAttendance.jsx'), load('src/erp/EmployeeFinanceAccounts.jsx'), load('src/erp/ERPFinance.jsx'), load('api/index.php'), load('src/erp/ERPAttendanceResponsive.css')]);
  assert.match(attendance, /title="الحضور والرواتب"/);
  assert.match(attendance, /<EmployeeFinanceAccounts/);
  for (const label of ['دفع من جيبه', 'منح سلفة', 'سداد سلفة', 'سداد مستحقات', 'عرض في الحسابات']) assert.match(component, new RegExp(label));
  assert.match(component, /canManage/);
  assert.match(component, /aria-live/);
  assert.match(component, /finance_entry_id/);
  assert.doesNotMatch(finance, /Partners Dues|settleDues|adjustPartner|handleAdjustDue|openAdvanceModal/);
  assert.match(finance, /employee_user_id/);
  assert.match(finance, /حساب الموظف:/);
  assert.match(api, /requireRole\(\$user,\['owner','admin'\]\).*?employee-accounts/s);
  assert.match(api, /organization_id=\?/);
  assert.match(responsiveCss, /\.attendance-table-wrap\s*\{[^}]*direction:\s*ltr[^}]*overflow-x:\s*auto/s);
  assert.match(responsiveCss, /\.attendance-table\s*\{[^}]*direction:\s*rtl/s);
  assert.match(responsiveCss, /\.attendance-workspace\s*\{[^}]*contain:\s*inline-size/s);
});

test('demo employee finance is exact, idempotent, role scoped, linked and month independent', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  storage.clear(); resetDemoDatabase(); activateDemoMode('owner');
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); const month = now.slice(0, 7);
  const initial = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data; const ashraf = initial.accounts.find(account => account.user.id === 1);
  assert.equal(ashraf.totals.out_of_pocket, '900.00');
  assert.equal(ashraf.net_due_to_employee, '900.00');

  const movement = { employee_user_id: 1, kind: 'advance_out', amount: '10.01', method: 'cash', detail: 'سلفة اختبار دقيقة', date: now, idempotency_key: 'employee-test-0001' };
  const first = await demoClient.request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify(movement) });
  const replay = await demoClient.request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify(movement) });
  assert.equal(first.error, null); assert.equal(replay.data.id, first.data.id); assert.equal(replay.data.idempotent, true);
  const current = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data.accounts.find(account => account.user.id === 1);
  assert.equal(current.totals.advance_out, '10.01'); assert.equal(current.net_due_to_employee, '889.99');
  assert.equal(current.selected_month.transactions.find(entry => entry.finance_id === first.data.id)?.amount, '10.01');
  const ledger = (await demoClient.request('/finance/entries', { method: 'GET' })).data.find(entry => entry.id === first.data.id);
  assert.equal(ledger.employee_user_id, 1); assert.equal(ledger.employee_name, 'أشرف محمد');
  const oldMonth = (await demoClient.request('/attendance/employee-accounts?month=2000-01')).data.accounts.find(account => account.user.id === 1);
  assert.equal(oldMonth.net_due_to_employee, '889.99'); assert.equal(oldMonth.selected_month.movement_count, 0);

  await demoClient.request(`/finance/${first.data.id}/void`, { method: 'POST', body: '{}' });
  const afterVoid = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data.accounts.find(account => account.user.id === 1);
  assert.equal(afterVoid.net_due_to_employee, '900.00');
  const expense = (await demoClient.request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify({ ...movement, kind: 'out_of_pocket', amount: '1.23', detail: 'مصروف قابل للتصحيح', idempotency_key: 'employee-test-correct' }) })).data;
  await demoClient.request(`/finance/${expense.id}/correct`, { method: 'POST', body: JSON.stringify({ amount: '2.34', entry_kind: 'expense', method: 'cash', detail: 'مصروف مصحح', date: now, reason: 'تصحيح قيمة المصروف' }) });
  const afterCorrection = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data.accounts.find(account => account.user.id === 1);
  assert.equal(afterCorrection.net_due_to_employee, '902.34');

  const beforeFailure = (await demoClient.request('/finance/entries')).data.length;
  const failed = await demoClient.request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify({ ...movement, idempotency_key: 'employee-test-fail', __test_fail_after_insert: true }) });
  assert.equal(failed.error.code, 'demo_fault_injected'); assert.equal((await demoClient.request('/finance/entries')).data.length, beforeFailure);

  for (const role of ['operations', 'finance', 'staff', 'client']) { activateDemoMode(role); const denied = await demoClient.request(`/attendance/employee-accounts?month=${month}`); assert.equal(denied.error.code, 'forbidden'); }
  activateDemoMode('admin'); const adminRead = await demoClient.request(`/attendance/employee-accounts?month=${month}`); assert.equal(adminRead.error, null);
  deactivateDemoMode();
});

test('attendance salary adjustments stay outside employee finance balances', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  storage.clear(); resetDemoDatabase(); activateDemoMode('owner'); const month = new Date().toISOString().slice(0, 7);
  const before = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data.accounts.find(account => account.user.id === 1).net_due_to_employee;
  await demoClient.request('/attendance/adjustments', { method: 'POST', body: JSON.stringify({ user_id: 1, month, amount: 100, reason: 'خصم راتب منفصل للاختبار' }) });
  const after = (await demoClient.request(`/attendance/employee-accounts?month=${month}`)).data.accounts.find(account => account.user.id === 1).net_due_to_employee;
  assert.equal(after, before); deactivateDemoMode();
});
