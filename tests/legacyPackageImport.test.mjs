import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseLegacyPackageImportText, validateLegacyPackageImportRows } from '../src/lib/legacyPackageImport.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};

test('Arabic CSV and Excel paste preserve partial payment, usage and derived balances', () => {
  const csv = '\uFEFFالمرجع القديم,اسم العميل,هاتف العميل,اسم الخدمة,اسم الباقة,الوحدة,إجمالي الرصيد,المستخدم,إجمالي السعر,المدفوع,بداية الصلاحية,نهاية الصلاحية,حد السداد,الحالة,ملاحظات\nOLD-001,محمد رياض,01114466646,باقة تصوير,الباقة القديمة,ساعة,10,3.5,12000,5000,01/08/2026,2026-09-15,5,نشطة,دفعة جزئية';
  const rows = parseLegacyPackageImportText(csv);
  assert.equal(rows.length, 1);
  const result = validateLegacyPackageImportRows(rows, [{ id: 8, name: 'محمد رياض', phone1: '+201114466646' }], [{ id: 3, name: 'باقة تصوير', billing_unit: 'hour' }], '2026-08-31');
  assert.equal(result.summary.ready, 1); assert.equal(result.summary.invalid, 0);
  assert.equal(result.readyRows[0].client_id, 8); assert.equal(result.readyRows[0].service_id, 3);
  assert.equal(result.readyRows[0].purchased_quantity, 10); assert.equal(result.readyRows[0].consumed_quantity, 3.5); assert.equal(result.readyRows[0].remaining_quantity, 6.5);
  assert.equal(result.readyRows[0].total_price, 12000); assert.equal(result.readyRows[0].paid_amount, 5000); assert.equal(result.readyRows[0].outstanding_amount, 7000);
  assert.equal(result.readyRows[0].starts_at, '2026-08-01'); assert.equal(result.readyRows[0].expires_at, '2026-09-15');

  const pasted = parseLegacyPackageImportText('المرجع القديم\tاسم العميل\tالوحدة\tإجمالي الرصيد\tالمستخدم\nOLD-002\tعميل\tريل\t8\t2');
  assert.equal(pasted[0].legacy_reference, 'OLD-002'); assert.equal(pasted[0].billing_unit, 'ريل');
});

test('preflight blocks duplicate references, overuse, overpayment and fractional reels', () => {
  const client = { id: 1, name: 'عميل', phone1: '01000000000' }; const service = { id: 2, name: 'ريلز', billing_unit: 'reel' };
  const base = { client_name: 'عميل', service_name: 'ريلز', package_name: 'باقة', billing_unit: 'ريل', purchased_quantity: '8', consumed_quantity: '2', total_price: '1000', paid_amount: '500', starts_at: '2026-08-01', expires_at: '2026-09-01', payment_due_quantity: '4', status: 'نشطة' };
  const result = validateLegacyPackageImportRows([
    { ...base, source_row: 2, legacy_reference: 'OLD-1', consumed_quantity: '9' },
    { ...base, source_row: 3, legacy_reference: 'OLD-1', paid_amount: '1001' },
    { ...base, source_row: 4, legacy_reference: 'OLD-3', purchased_quantity: '8.5' },
  ], [client], [service], '2026-08-31');
  assert.equal(result.summary.invalid, 3); assert.match(result.rows[0].errors.join(' '), /المستخد/); assert.match(result.rows[1].errors.join(' '), /مكرر/); assert.match(result.rows[1].errors.join(' '), /المدفوع/); assert.match(result.rows[2].errors.join(' '), /الريلز/);
});

test('demo import creates an opening package without duplicating historic revenue', async () => {
  const storage = browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const before = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const service = before.services.find(row => row.id === 101);
  const payload = { legacy_reference: 'OLD-PKG-001', client_id: 1, service_id: service.id, package_name: 'باقة مرحّلة', billing_unit: 'hour', purchased_quantity: '10', consumed_quantity: '3.5', payment_due_quantity: '5', total_price: '12000.00', paid_amount: '5000.00', starts_at: '2026-08-01', expires_at: '2026-09-15', status: 'active', notes: 'رصيد افتتاحي' };
  const first = await demoClient.request('/client-packages/legacy-import', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(first.error, null); assert.equal(first.data.idempotent, false); assert.equal(first.data.finance_entry_created, false); assert.equal(first.data.remaining_quantity, 6.5); assert.equal(Number(first.data.outstanding_amount), 7000);
  let db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = db.client_packages.find(row => row.id === first.data.id);
  assert.equal(pkg.purchased_minutes, 600); assert.equal(pkg.consumed_minutes, 210); assert.equal(pkg.paid_amount, '5000.00'); assert.equal(pkg.status, 'active');
  assert.equal(db.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id)).length, 2);
  assert.equal(db.payments.length, before.payments.length); assert.equal(db.payment_allocations.length, before.payment_allocations.length); assert.equal(db.finance.length, before.finance.length);
  assert.equal(db.audit_logs.filter(row => row.entity_type === 'client_packages' && Number(row.entity_id) === Number(pkg.id) && row.action === 'legacy_import').length, 1);
  const details = await demoClient.request(`/client-packages/${pkg.id}/details`, { method: 'GET' });
  assert.equal(details.error, null); assert.equal(Number(details.data.financial.paid_amount), 5000); assert.equal(Number(details.data.financial.outstanding), 7000); assert.equal(details.data.financial.has_legacy_reconciliation, true); assert.equal(details.data.usage_reconciliation.reconciled, true);
  const retry = await demoClient.request('/client-packages/legacy-import', { method: 'POST', body: JSON.stringify(payload) }); assert.equal(retry.error, null); assert.equal(retry.data.id, pkg.id); assert.equal(retry.data.idempotent, true);
  db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(db.client_packages.filter(row => row.name === 'باقة مرحّلة').length, 1);
  const mismatch = await demoClient.request('/client-packages/legacy-import', { method: 'POST', body: JSON.stringify({ ...payload, paid_amount: '6000.00' }) }); assert.equal(mismatch.error?.code, 'legacy_reference_mismatch');
  for (const role of ['admin', 'finance', 'operations', 'staff', 'client']) { activateDemoMode(role); const denied = await demoClient.request('/client-packages/legacy-import', { method: 'POST', body: JSON.stringify({ ...payload, legacy_reference: `DENIED-${role}` }) }); assert.equal(denied.error?.code, 'forbidden'); }
  deactivateDemoMode();
});

test('production endpoint and owner UI enforce safe opening-balance migration', async () => {
  const [api, packagesView, dialog, csv, xlsx] = await Promise.all([
    load('api/index.php'), load('src/erp/ERPPackages.jsx'), load('src/erp/LegacyPackageImportDialog.jsx'), load('public/templates/legacy-package-import.csv'), readFile(new URL('public/templates/legacy-package-import.xlsx', root)),
  ]);
  const start = api.indexOf("if ($path === '/client-packages/legacy-import'"); const end = api.indexOf("if ($path === '/client-packages' && $method === 'POST')", start); const segment = api.slice(start, end);
  assert.ok(start > -1 && end > start); assert.match(segment, /requireRole\(\$user,\['owner'\]\)/); assert.match(segment, /client_package_sale_requests/); assert.match(segment, /legacy_reference_mismatch/); assert.match(segment, /'posted_to_current_finance'=>false/); assert.match(segment, /'finance_entry_created'=>false/);
  assert.doesNotMatch(segment, /INSERT INTO (?:payments|payment_allocations|finance)\b/i);
  assert.match(packagesView, /نقل من البرنامج القديم/); assert.match(packagesView, /LegacyPackageImportDialog/); assert.match(dialog, /legacy-package-import\.xlsx/); assert.match(dialog, /لن يدخل خزنة الشهر الحالي/); assert.match(csv, /المرجع القديم/); assert.ok(xlsx.byteLength > 10000);
});
