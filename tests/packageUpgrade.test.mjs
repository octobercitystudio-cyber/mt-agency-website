import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { parseStrictMoney, strictMoneyToCents } from '../src/lib/strictMoney.js';
import { PackageUpgradeProductionHarness, packageUpgradeFaultStages } from './helpers/packageUpgradeProductionHarness.mjs';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent() {} } });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
const database = () => JSON.parse([...storage.values()][0]);
const writeDatabase = value => storage.set([...storage.keys()][0], JSON.stringify(value));

const upgradePayload = (overrides = {}) => ({
  client_id: 6, service_id: 101, name: 'باقة ريم المتقدمة', billing_unit: 'hour', quantity: 10,
  payment_due_quantity: 5, deposit_percent_snapshot: 30, overage_price_snapshot: '1400.00', total_price: '12000.00',
  paid_amount: '200.10', payment_method: 'instapay', notes: 'ترقية موثقة', validity_days: 90, bookings: [],
  idempotency_key: 'package-upgrade-demo-0001',
  upgrade_context: { source_package_id: 209, expected_source_version: 1, close_source_package: true, activation_mode: 'immediate', reason: 'طلب العميل الترقية لباقة أعلى' },
  ...overrides,
});
const productionUpgradePayload = (overrides = {}) => ({
  client_id: 11, service_id: 101, name: 'باقة إنتاجية بديلة', quantity: 10, payment_due_quantity: 5,
  overage_price_snapshot: '1400.00', total_price: '1000.00', paid_amount: '0.01',
  idempotency_key: 'package-upgrade-production-0001',
  upgrade_context: { source_package_id: 301, expected_source_version: 1, close_source_package: true, reason: 'ترقية موثقة للعميل' },
  ...overrides,
});

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('strict money contract parses integer cents and rejects ambiguous or unsafe notation', () => {
  for (const [raw, cents] of [['0', 0], ['0.01', 1], ['1.1', 110], ['001.20', 120], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) {
    assert.deepEqual(parseStrictMoney(raw), { valid: true, cents, normalized: (cents / 100).toFixed(2), reason: null });
    assert.equal(strictMoneyToCents(raw), cents);
  }
  for (const raw of ['1e3', '1.999', ' 1.00', '1.00 ', '+1', '-1', '', '90071992547409.92', 'Infinity', 1000, 200.1, JSON.parse('{"value":1e3}').value]) {
    assert.equal(parseStrictMoney(raw).valid, false, String(raw));
    assert.throws(() => strictMoneyToCents(raw), error => error.code === 'invalid_money_format');
  }
});

test('owner upgrade creates an independent package, exact payment records and append-only lineage', async () => {
  const before = database(); const originalBookings = before.bookings.filter(row => Number(row.client_package_id) === 209); const originalLedger = before.package_usage_ledger.filter(row => Number(row.client_package_id) === 209);
  const result = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload()) });
  assert.equal(result.error, null); assert.equal(result.data.upgrade.source_package_id, 209); assert.equal(result.data.upgrade.source_closed, true); assert.equal(result.data.upgrade.activation_mode, 'immediate');
  const db = database(); const source = db.client_packages.find(row => row.id === 209); const replacement = db.client_packages.find(row => row.id === result.data.id);
  assert.equal(source.status, 'completed'); assert.equal(source.version, 2); assert.equal(replacement.client_id, 6); assert.equal(replacement.service_id, 101); assert.equal(replacement.purchased_minutes, 600); assert.equal(replacement.paid_amount, '200.10'); assert.ok(replacement.starts_at); assert.ok(replacement.expires_at);
  assert.deepEqual(db.bookings.filter(row => Number(row.client_package_id) === 209), originalBookings); assert.equal(db.package_usage_ledger.filter(row => Number(row.client_package_id) === 209).length, originalLedger.length);
  assert.equal(db.payments.filter(row => Number(row.client_package_id) === Number(replacement.id)).length, 0, 'payment relation is recorded through allocation, not an invented package field');
  const payment = db.payments.find(row => row.reference === `package-${replacement.id}-opening`); assert.equal(payment.amount, '200.10');
  assert.equal(db.payment_allocations.find(row => Number(row.client_package_id) === Number(replacement.id)).amount, '200.10');
  assert.equal(db.finance.find(row => row.correlation_id === `payment:${payment.id}`).amount, '200.10');
  assert.ok(db.owner_adjustments.some(row => Number(row.entity_id) === 209 && row.adjustment_type === 'package_upgrade_close'));
  assert.ok(db.audit_logs.some(row => Number(row.entity_id) === Number(replacement.id) && row.action === 'owner_upgrade_package_create'));
  assert.ok(db.app_notifications.some(row => Number(row.entity_id) === Number(replacement.id) && row.type === 'package_upgraded'));
});

test('upgrade replay is idempotent and never duplicates package, payment, finance or notification', async () => {
  const first = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload()) }); assert.equal(first.error, null);
  const counts = Object.fromEntries(['client_packages', 'payments', 'finance', 'payment_allocations', 'app_notifications'].map(table => [table, database()[table].length]));
  const replay = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload()) }); assert.equal(replay.error, null); assert.equal(replay.data.idempotent, true); assert.equal(replay.data.id, first.data.id);
  for (const [table, count] of Object.entries(counts)) assert.equal(database()[table].length, count, `${table} must not duplicate`);
});

test('upgrade rejects malformed money with 422 before any demo mutation and stores one-piastre values exactly', async () => {
  const malformed = [
    ['total_price', '1e3'], ['total_price', '1.999'], ['total_price', ' 1000.00'], ['total_price', '90071992547409.92'],
    ['paid_amount', '1e3'], ['paid_amount', '0.001'], ['overage_price_snapshot', '1e3'], ['overage_price_snapshot', ' 1.00 '],
  ];
  for (const [field, value] of malformed) {
    resetDemoDatabase(); await demoClient.request('/dashboard/kpis', { method: 'GET' }); const before = JSON.stringify(database());
    const result = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ [field]: value, idempotency_key: `invalid-money-${field}-${malformed.indexOf(malformed.find(item => item[0] === field && item[1] === value))}` })) });
    assert.equal(result.error?.status, 422, `${field}:${value}`); assert.equal(result.error?.code, 'invalid_money_format'); assert.equal(JSON.stringify(database()), before);
  }
  resetDemoDatabase();
  const exact = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ total_price: '10.01', paid_amount: '0.01', overage_price_snapshot: '1.1', idempotency_key: 'upgrade-one-piastre-0001' })) });
  assert.equal(exact.error, null); const row = database().client_packages.find(item => Number(item.id) === Number(exact.data.id));
  assert.equal(row.total_price, '10.01'); assert.equal(row.paid_amount, '0.01'); assert.equal(row.overage_price_snapshot, '1.10');
});

test('raw JSON numeric and exponent upgrade money reject with 422 while canonical decimal text succeeds exactly', async () => {
  const rawCases = [
    JSON.stringify(upgradePayload({ total_price: 1000, idempotency_key: 'raw-json-number-0001' })),
    JSON.stringify(upgradePayload({ idempotency_key: 'raw-json-exponent-0001' })).replace('"12000.00"', '1e3'),
  ];
  for (const rawBody of rawCases) {
    resetDemoDatabase(); await demoClient.request('/dashboard/kpis', { method: 'GET' }); const before = JSON.stringify(database());
    const result = await demoClient.request('/client-packages', { method: 'POST', body: rawBody });
    assert.equal(result.error?.status, 422); assert.equal(result.error?.code, 'invalid_money_format'); assert.match(result.error?.message ?? '', /نص عشري/); assert.equal(JSON.stringify(database()), before);
  }
  resetDemoDatabase();
  const accepted = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ total_price: '1000.00', paid_amount: '0.00', idempotency_key: 'raw-json-string-0001' })) });
  assert.equal(accepted.error, null); const row = database().client_packages.find(item => Number(item.id) === Number(accepted.data.id)); assert.equal(row.total_price, '1000.00'); assert.equal(row.paid_amount, '0.00');
});

test('SQLite production harness commits exact cents/minutes and enforces idempotency atomically', async () => {
  const harness = await PackageUpgradeProductionHarness.create();
  try {
    const payload = productionUpgradePayload(); const result = await harness.upgrade({ payload });
    assert.equal(result.purchased_minutes, 600); assert.equal(result.total_cents, 100000); assert.equal(result.paid_cents, 1); assert.equal(result.overage_rate_cents, 140000); assert.equal(result.source_closed, true);
    const source = (await harness.rows('client_packages')).find(row => row.id === 301); assert.equal(source.status, 'completed'); assert.equal(source.version, 2);
    assert.equal((await harness.rows('package_usage_ledger')).at(-1).quantity_minutes, 600); assert.equal((await harness.rows('payments')).at(-1).amount_cents, 1); assert.equal((await harness.rows('finance')).at(-1).amount_cents, 1);
    const committed = await harness.snapshot(); const replay = await harness.upgrade({ payload }); assert.equal(replay.idempotent, true); assert.deepEqual(await harness.snapshot(), committed);
    await assert.rejects(() => harness.upgrade({ payload: productionUpgradePayload({ name: 'طلب مختلف' }) }), error => error.code === 'idempotency_payload_mismatch' && error.status === 409);
    assert.deepEqual(await harness.snapshot(), committed);
  } finally { await harness.close(); }
});

test('SQLite production harness rejects raw JSON money, scope and stale/committed sources without mutation', async () => {
  const cases = [
    [productionUpgradePayload({ total_price: JSON.parse('{"total_price":1e3}').total_price, idempotency_key: 'sqlite-money-exponent' }), 'invalid_money_format', 422],
    [productionUpgradePayload({ total_price: 1000, idempotency_key: 'sqlite-money-number' }), 'invalid_money_format', 422],
    [productionUpgradePayload({ upgrade_context: { ...productionUpgradePayload().upgrade_context, source_package_id: 320 }, idempotency_key: 'sqlite-cross-org' }), 'package_upgrade_source_not_found', 404],
    [productionUpgradePayload({ client_id: 12, upgrade_context: { ...productionUpgradePayload().upgrade_context, source_package_id: 301 }, idempotency_key: 'sqlite-cross-client' }), 'package_upgrade_client_mismatch', 422],
    [productionUpgradePayload({ upgrade_context: { ...productionUpgradePayload().upgrade_context, expected_source_version: 9 }, idempotency_key: 'sqlite-stale' }), 'stale_package_upgrade_source', 409],
    [productionUpgradePayload({ upgrade_context: { ...productionUpgradePayload().upgrade_context, source_package_id: 302 }, idempotency_key: 'sqlite-held' }), 'package_upgrade_source_committed', 422],
    [productionUpgradePayload({ upgrade_context: { ...productionUpgradePayload().upgrade_context, source_package_id: 303 }, idempotency_key: 'sqlite-active' }), 'package_upgrade_source_committed', 422],
  ];
  for (const [payload, code, status] of cases) {
    const harness = await PackageUpgradeProductionHarness.create();
    try { const before = await harness.snapshot(); await assert.rejects(() => harness.upgrade({ payload }), error => error.code === code && error.status === status); assert.deepEqual(await harness.snapshot(), before); }
    finally { await harness.close(); }
  }
  const canonical = await PackageUpgradeProductionHarness.create();
  try { const result = await canonical.upgrade({ payload: productionUpgradePayload({ total_price: '1000.00', paid_amount: '0.00', idempotency_key: 'sqlite-canonical-money' }) }); assert.equal(result.total_cents, 100000); assert.equal(result.paid_cents, 0); }
  finally { await canonical.close(); }
});

test('SQLite production harness rolls back byte-for-byte after every upgrade write stage', async () => {
  for (const stage of packageUpgradeFaultStages) {
    const harness = await PackageUpgradeProductionHarness.create();
    try {
      const before = await harness.snapshot();
      await assert.rejects(() => harness.upgrade({ payload: productionUpgradePayload({ idempotency_key: `sqlite-fault-${stage}` }), injectFailureAt: stage }), error => error.code === 'injected_failure');
      assert.deepEqual(await harness.snapshot(), before, stage);
    } finally { await harness.close(); }
  }
});

test('executable upgrade transaction matrix preserves isolation, rollback and idempotency', async () => {
  for (const point of ['package', 'ledger', 'finance', 'audit', 'source_close', 'notification', 'request_complete']) {
    resetDemoDatabase(); await demoClient.request('/dashboard/kpis', { method: 'GET' }); const before = JSON.stringify(database());
    const result = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: `upgrade-fault-${point}-0001`, __test_fail_at: point })) });
    assert.equal(result.error?.code, 'demo_fault_injected', point); assert.equal(JSON.stringify(database()), before, point);
  }
  resetDemoDatabase(); await demoClient.request('/dashboard/kpis', { method: 'GET' }); let db = database(); db.client_packages.push({ ...db.client_packages.find(row => row.id === 209), id: 990, organization_id: 2, version: 1 }); writeDatabase(db); const isolatedBefore = JSON.stringify(database());
  const isolated = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'upgrade-cross-org-0001', upgrade_context: { ...upgradePayload().upgrade_context, source_package_id: 990, close_source_package: false } })) });
  assert.equal(isolated.error?.code, 'package_upgrade_source_not_found'); assert.equal(JSON.stringify(database()), isolatedBefore);
  resetDemoDatabase(); const first = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'upgrade-idem-mismatch-0001' })) }); assert.equal(first.error, null); const committed = JSON.stringify(database());
  const mismatch = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'upgrade-idem-mismatch-0001', name: 'طلب مختلف' })) });
  assert.equal(mismatch.error?.status, 409); assert.equal(mismatch.error?.code, 'idempotency_payload_mismatch'); assert.equal(JSON.stringify(database()), committed);
});

test('upgrade guards stale source, cross-client source, active/held source and rollback', async () => {
  const stale = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'package-upgrade-stale-0001', upgrade_context: { ...upgradePayload().upgrade_context, expected_source_version: 99, close_source_package: false } })) }); assert.equal(stale.error?.code, 'stale_package_upgrade_source');
  const mismatch = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'package-upgrade-client-0001', upgrade_context: { ...upgradePayload().upgrade_context, source_package_id: 201, close_source_package: false } })) }); assert.equal(mismatch.error?.code, 'package_upgrade_client_mismatch');
  const committed = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...upgradePayload(), client_id: 1, idempotency_key: 'package-upgrade-held-0001', upgrade_context: { ...upgradePayload().upgrade_context, source_package_id: 201, close_source_package: true } }) }); assert.equal(committed.error?.code, 'package_upgrade_source_committed');
  const before = JSON.stringify(database()); const rollback = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'package-upgrade-rollback-0001', __test_fail_at: 'audit' })) }); assert.equal(rollback.error?.code, 'demo_fault_injected'); assert.equal(JSON.stringify(database()), before);
});

test('upgrade is owner-only and UI exposes both entry points with derived balances', async () => {
  activateDemoMode('admin');
  const denied = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(upgradePayload({ idempotency_key: 'package-upgrade-admin-0001' })) }); assert.equal(denied.error?.code, 'forbidden');
  const [timer, owner, dialog, css, api, demo] = await Promise.all([
    load('src/erp/ERPSessionTimer.jsx'), load('src/erp/OwnerPackageControl.jsx'), load('src/erp/PackageUpgradeDialog.jsx'), load('src/erp/PackageUpgradeDialog.css'), load('api/index.php'), load('src/lib/demoDataClient.js'),
  ]);
  assert.match(timer, /ترقية الباقة/); assert.match(owner, /ترقية \/ استبدال/); assert.match(dialog, /package-upgrade-comparison/); assert.match(dialog, /المحجوز/); assert.match(dialog, /المتاح/); assert.doesNotMatch(dialog, /target_remaining|setRemaining/); assert.match(css, /min-height:44px/); assert.match(css, /@media\(max-width:360px\)/);
  for (const contract of ['upgrade_context', 'stale_package_upgrade_source', 'package_upgrade_source_committed', 'owner_upgrade_package_create', 'package_upgraded']) { assert.match(api, new RegExp(contract)); assert.match(demo, new RegExp(contract)); }
});

test('excess settlement presents new package and current package price as the two primary decisions', async () => {
  const [dialog, css, settlement, demo] = await Promise.all([load('src/erp/ERPStopSessionDialog.jsx'), load('src/erp/ERPStopSessionDialog.css'), load('api/session_settlement.php'), load('src/lib/demoDataClient.js')]);
  assert.match(dialog, /فتح باقة جديدة وتحميل الوقت عليها/); assert.match(dialog, /احتسابه بسعر الباقة الحالية/); assert.match(dialog, /session-settlement-choices--primary/); assert.match(css, /grid-template-columns:repeat\(2,1fr\)/);
  for (const mode of ['new_package', 'package_overage']) { assert.match(settlement, new RegExp(`'${mode}'`)); assert.match(demo, new RegExp(`'${mode}'`)); }
});
