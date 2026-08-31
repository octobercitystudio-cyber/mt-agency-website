import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractLegacyPackageRows } from '../src/lib/legacySqlitePackages.js';
import { legacyImportPayload, matchLegacyPackages } from '../src/lib/legacyPackageMatching.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('old SQLite rows reconstruct only package balance, validity and historical paid amount', () => {
  const extracted = extractLegacyPackageRows({
    clients: [{ id: 7, name: 'اسم العميل القديم', phone1: '+20 101 234 5678', phone2: null }],
    services: [{ id: 3, name: 'باقة تصوير 10 ساعات', price: 1800, validity_days: 15, total_hours: 10, payment_due_hours: 5, total_reels: 0 }],
    bookings: [
      { id: 1, client_name: 'اسم العميل القديم', service: 'باقة تصوير 10 ساعات', date: '2026-08-01', status: 'منتهي', actual_hours: 3.25, actual_reels: 0, payment: 0, custom_price: 0, custom_expiry: null },
      { id: 2, client_name: 'اسم العميل القديم', service: 'باقة تصوير 10 ساعات', date: '2026-08-02', status: 'دفعة', actual_hours: 0, actual_reels: 0, payment: 900, custom_price: 0, custom_expiry: null },
    ],
    sourceFingerprint: 'a'.repeat(64),
    asOfDate: '2026-08-10',
  });
  assert.equal(extracted.packages.length, 1); const pkg = extracted.packages[0];
  assert.equal(pkg.source_phone, '01012345678'); assert.equal(pkg.purchased_quantity, 10); assert.equal(pkg.consumed_quantity, 3.25); assert.equal(pkg.remaining_quantity, 6.75);
  assert.equal(pkg.total_price, 1800); assert.equal(pkg.paid_amount, 900); assert.equal(pkg.outstanding_amount, 900); assert.equal(pkg.starts_at, '2026-08-01'); assert.equal(pkg.expires_at, '2026-08-15');
});

test('phone matching preserves the new-program client name and never falls back to the old name', () => {
  const sourcePackage = { legacy_reference: 'sqlite-1234567890abcdef', source_client_name: 'اسم قديم مختلف', source_phone: '01012345678', source_service_name: 'باقة تصوير 10 ساعات', service_match_name: 'باقة تصوير 10 ساعات', billing_unit: 'hour', purchased_quantity: 10, consumed_quantity: 3, remaining_quantity: 7, payment_due_quantity: 5, total_price: 1800, paid_amount: 900, starts_at: '2026-08-01', expires_at: '2026-08-15', validity_days_snapshot: 15, status: 'active', issues: [] };
  const services = [{ id: 101, name: 'باقة تصوير 10 ساعات', billing_unit: 'hour', total_hours: 10, total_reels: 0 }];
  const matched = matchLegacyPackages({ packages: [sourcePackage], clients: [{ id: 44, name: 'الاسم الحالي المعتمد', phone1: '+201012345678', phone2: null }], services });
  assert.equal(matched.blocked, 0); assert.equal(matched.rows[0].target_client_id, 44); assert.equal(matched.rows[0].target_client_name, 'الاسم الحالي المعتمد');
  assert.equal(legacyImportPayload(matched.rows[0], { sha256: 'b'.repeat(64) }).source_client_name, 'اسم قديم مختلف');
  const noPhone = matchLegacyPackages({ packages: [{ ...sourcePackage, source_phone: '01111111111', source_client_name: 'الاسم الحالي المعتمد' }], clients: [{ id: 44, name: 'الاسم الحالي المعتمد', phone1: '01012345678' }], services });
  assert.equal(noPhone.importable, 0); assert.match(noPhone.rows[0].match_problems.join(' '), /رقم الموبايل/);
  const duplicate = matchLegacyPackages({ packages: [sourcePackage], clients: [{ id: 44, name: 'أ', phone1: '01012345678' }, { id: 45, name: 'ب', phone1: '01012345678' }], services });
  assert.equal(duplicate.importable, 0); assert.match(duplicate.rows[0].match_problems.join(' '), /مكرر/);
  const renamedService = [{ ...services[0], id: 202, name: 'قالب حديث بالاسم الجديد' }];
  const overridden = matchLegacyPackages({ packages: [sourcePackage], clients: [{ id: 44, name: 'الاسم الحالي المعتمد', phone1: '01012345678' }], services: renamedService, serviceOverrides: { [sourcePackage.legacy_reference]: 202 } });
  assert.equal(overridden.importable, 1); assert.equal(overridden.rows[0].target_service_id, 202);
});

test('over-consumption is capped and disclosed instead of producing a negative balance', () => {
  const extracted = extractLegacyPackageRows({ clients: [{ id: 1, name: 'عميل', phone1: '01000000000' }], services: [{ id: 1, name: 'باقة ساعتين', price: 500, validity_days: 5, total_hours: 2, payment_due_hours: 1, total_reels: 0 }], bookings: [{ id: 1, client_name: 'عميل', service: 'باقة ساعتين', date: '2026-08-01', status: 'منتهي', actual_hours: 3, actual_reels: 0, payment: 0, custom_price: 0, custom_expiry: null }], sourceFingerprint: 'c'.repeat(64), asOfDate: '2026-08-02' });
  const pkg = extracted.packages[0]; assert.equal(pkg.raw_used_quantity, 3); assert.equal(pkg.consumed_quantity, 2); assert.equal(pkg.remaining_quantity, 0); assert.equal(pkg.overage_quantity, 1); assert.match(pkg.issues.join(' '), /يتجاوز الرصيد/);
});

test('browser reader allow-lists all business tables while excluding users and passwords', async () => {
  const source = await load('src/lib/legacySqliteDatabase.js');
  for (const table of ['clients','services','bookings','finance','reminders','app_config']) assert.match(source, new RegExp(`SELECT[^;]+FROM ${table}`, 'i'));
  assert.doesNotMatch(source, /users:\s*['"`]SELECT/i); assert.doesNotMatch(source, /password_hash/i);
  assert.match(source, /dismissed_alerts/); assert.match(source, /backup settings/);
});

test('the packages-only production route is retired in favor of the comprehensive importer', async () => {
  const api = await load('api/index.php'); const start = api.indexOf("if ($path === '/client-packages/legacy-db-import'"); const end = api.indexOf("if ($path === '/client-packages'", start + 1); const route = api.slice(start, end);
  assert.ok(start > 0 && end > start); assert.match(route, /requireRole\(\$user,\['owner'\]\)/); assert.match(route, /legacy_packages_import_retired/); assert.match(route, /أداة النقل الشامل/);
});

test('demo import is atomic, idempotent and does not change unrelated ledgers', async () => {
  const storage = new Map(); globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }; globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js'); resetDemoDatabase(); activateDemoMode('owner'); const before = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const sha = 'd'.repeat(64);
  const body = { confirmation: 'IMPORT_PACKAGES_ONLY', idempotency_key: `legacydb.${sha}`, source: { sha256: sha }, packages: [{ legacy_reference: 'sqlite-abcdef0123456789', source_sha256: sha, source_client_name: 'اسم قديم', source_phone: before.clients[0].phone1, source_service_name: 'باقة قديمة 10 ساعات', client_id: before.clients[0].id, service_id: 101, billing_unit: 'hour', purchased_quantity: 10, consumed_quantity: 3.5, payment_due_quantity: 5, total_price: '1800.00', paid_amount: '900.00', starts_at: '2026-08-01', expires_at: '2026-08-15', validity_days_snapshot: 15, status: 'expired', overage_quantity: 0, archived_source: false }] };
  const first = await demoClient.request('/client-packages/legacy-db-import', { method: 'POST', body: JSON.stringify(body) }); assert.equal(first.error, null); assert.equal(first.data.imported_count, 1);
  const retry = await demoClient.request('/client-packages/legacy-db-import', { method: 'POST', body: JSON.stringify(body) }); assert.equal(retry.error, null); assert.equal(retry.data.idempotent, true);
  const after = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(after.client_packages.length, before.client_packages.length + 1); assert.equal(after.clients.length, before.clients.length); assert.equal(after.bookings.length, before.bookings.length); assert.equal(after.finance.length, before.finance.length); assert.equal(after.payments.length, before.payments.length); assert.equal(after.payment_allocations.length, before.payment_allocations.length);
  const pkg = after.client_packages.find(item => item.name === 'باقة قديمة 10 ساعات'); assert.equal(pkg.client_id, before.clients[0].id); assert.equal(pkg.consumed_minutes, 210); assert.equal(Number(pkg.paid_amount), 900); assert.equal(after.package_usage_ledger.filter(item => item.client_package_id === pkg.id).length, 2); deactivateDemoMode();
});
