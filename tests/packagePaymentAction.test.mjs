import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};

test('package payment UI is shared, exact, accessible and responsive', async () => {
  const [view, modal, css, owner, clients] = await Promise.all([load('src/erp/ERPPackages.jsx'), load('src/erp/PackagePaymentModal.jsx'), load('src/erp/PackagePaymentModal.css'), load('src/erp/OwnerPackageControl.jsx'), load('src/erp/ERPClients.jsx')]);
  assert.match(view, /package-payment-button/); assert.match(view, /canPay=canAssign&&packageFinancialSummary/); assert.match(view, /<PackagePaymentModal/); assert.match(view, /bookingPackage\.open \|\| paymentPackage\.open/);
  assert.match(owner, /owner-record-payment/); assert.match(owner, /onNewPayment/); assert.match(modal, /useModalDialog\(isOpen, close, \{ returnFocusRef \}\)/); assert.match(modal, /سداد كامل/); assert.match(modal, /المتبقي بعد الدفعة/); assert.match(modal, /حفظ الدفعة في مدفوعات العميل/);
  assert.match(modal, /max=\{centsToMoney\(financial\.outstandingCents\)\}/); assert.match(modal, /step="0\.01"/); assert.match(modal, /amountError/); assert.match(modal, /أدخل مبلغًا أكبر من صفر/); assert.match(modal, /رقمين بعد العلامة العشرية/); assert.match(modal, /aria-describedby="package-payment-amount-help package-payment-amount-error"/); assert.match(modal, /aria-live="polite"/); assert.match(css, /package-payment-metrics\.standard/); assert.match(css, /repeat\(3, 1fr\)/); assert.match(css, /min-height:\s*44px/); assert.match(css, /max-width: 390px/); assert.match(css, /max-width: 330px/); assert.match(css, /width: min\(700px, calc\(100vw - 36px\)\)/);
  assert.match(clients, /\/clients\/\$\{selectedClient\.id\}\/payment-history/); assert.match(clients, /row\.package_name/); assert.match(clients, /row\.reference/); assert.match(clients, /row\.note/); assert.doesNotMatch(clients, /from\('finance'\)\.select\('\*'\)\.ilike\('detail'/);
});

test('demo package payment creates one exact payment, allocation and finance row and refreshes package/invoice cents', async () => {
  const storage = browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); let db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = db.client_packages.find(row => row.id === 203); pkg.source_invoice_id = 703; storage.set('mt_agency_erp_demo_v12', JSON.stringify(db)); activateDemoMode('finance');
  const body = { amount: '100.25', method: 'bank_transfer', reference: 'EVAL-10025', note: 'اختبار مستقل لمسار الدفعة', payment_date: '2026-08-30', idempotency_key: 'package-payment-exact-001' };
  const result = await demoClient.request('/client-packages/203/payments', { method: 'POST', body: JSON.stringify(body) }); assert.equal(result.error, null); assert.equal(result.data.idempotent, false); assert.equal(result.data.amount, '100.25');
  db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const payment = db.payments.find(row => row.id === result.data.payment_id); const allocation = db.payment_allocations.filter(row => row.payment_id === payment.id); const finance = db.finance.filter(row => row.source_type === 'payment' && row.source_id === payment.id);
  assert.equal(payment.status, 'approved'); assert.equal(payment.amount, '100.25'); assert.equal(payment.note, body.note); assert.equal(allocation.length, 1); assert.equal(allocation[0].client_package_id, 203); assert.equal(allocation[0].invoice_id, 703); assert.equal(allocation[0].amount, '100.25'); assert.equal(finance.length, 1); assert.equal(finance[0].amount, '100.25'); assert.equal(finance[0].date, body.payment_date); assert.equal(finance[0].detail, body.note);
  assert.equal(db.client_packages.find(row => row.id === 203).paid_amount, '10100.25'); assert.equal(db.invoices.find(row => row.id === 703).paid_amount, '10100.25');
  assert.equal(db.audit_logs.filter(row => row.action === 'record_package_payment' && row.entity_id === payment.id).length, 1); assert.equal(db.app_notifications.filter(row => row.type === 'payment_recorded' && row.entity_id === payment.id).length, 1);
  const replay = await demoClient.request('/client-packages/203/payments', { method: 'POST', body: JSON.stringify(body) }); assert.equal(replay.error, null); assert.equal(replay.data.payment_id, payment.id); assert.equal(replay.data.idempotent, true);
  const afterReplay = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(afterReplay.payments.filter(row => row.id === payment.id).length, 1); assert.equal(afterReplay.payment_allocations.filter(row => row.payment_id === payment.id).length, 1); assert.equal(afterReplay.finance.filter(row => row.source_type === 'payment' && row.source_id === payment.id).length, 1); deactivateDemoMode();
});

test('package payment crosses into the client finance-history consumer exactly once with structured metadata', async () => {
  browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js'); resetDemoDatabase(); activateDemoMode('admin');
  const body = { amount: '100.25', method: 'bank_transfer', reference: 'EVAL-10025', note: 'اختبار مستقل لمسار الدفعة', idempotency_key: 'package-payment-client-history-001' };
  const created = await demoClient.request('/client-packages/206/payments', { method: 'POST', body: JSON.stringify(body) }); assert.equal(created.error, null);
  const history = await demoClient.request('/clients/5/payment-history', { method: 'GET' }); assert.equal(history.error, null); const exact = history.data.items.filter(item => item.record_type === 'payment' && item.payment_id === created.data.payment_id); assert.equal(exact.length, 1);
  assert.equal(exact[0].amount, '100.25'); assert.equal(exact[0].method, 'bank_transfer'); assert.equal(exact[0].reference, 'EVAL-10025'); assert.equal(exact[0].note, 'اختبار مستقل لمسار الدفعة'); assert.equal(exact[0].package_id, 206); assert.equal(exact[0].package_name, 'يوم تصوير العيادة'); assert.equal(exact[0].status, 'approved'); assert.equal(exact[0].allocations.length, 1);
  activateDemoMode('client'); const denied = await demoClient.request('/clients/5/payment-history', { method: 'GET' }); assert.equal(denied.error?.code, 'forbidden'); deactivateDemoMode();
});

test('demo package payment validates roles, money, method, outstanding, idempotency mismatch and rollback', async () => {
  const storage = browserGlobals(); const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  const make = (overrides = {}) => ({ amount: '10.25', method: 'cash', idempotency_key: `package-payment-${Math.random().toString(36).slice(2)}-safe`, ...overrides });
  for (const role of ['operations','staff','client']) { resetDemoDatabase(); activateDemoMode(role); const denied = await demoClient.request('/client-packages/201/payments', { method: 'POST', body: JSON.stringify(make()) }); assert.equal(denied.error?.code, 'forbidden'); }
  resetDemoDatabase(); activateDemoMode('owner');
  for (const [overrides, code] of [[{ amount: '0' }, 'invalid_payment_amount'], [{ amount: '-1' }, 'invalid_payment_amount'], [{ amount: '1.001' }, 'invalid_payment_amount'], [{ method: 'card' }, 'invalid_payment_method'], [{ amount: '999999' }, 'payment_exceeds_outstanding']]) { const result = await demoClient.request('/client-packages/201/payments', { method: 'POST', body: JSON.stringify(make(overrides)) }); assert.equal(result.error?.code, code); }
  const settled = await demoClient.request('/client-packages/202/payments', { method: 'POST', body: JSON.stringify(make()) }); assert.equal(settled.error?.code, 'package_already_settled');
  const firstBody = make({ idempotency_key: 'package-payment-mismatch-001' }); const first = await demoClient.request('/client-packages/201/payments', { method: 'POST', body: JSON.stringify(firstBody) }); assert.equal(first.error, null); const mismatch = await demoClient.request('/client-packages/201/payments', { method: 'POST', body: JSON.stringify({ ...firstBody, amount: '11.25' }) }); assert.equal(mismatch.error?.code, 'idempotency_payload_mismatch');
  resetDemoDatabase(); activateDemoMode('admin'); const before = storage.get('mt_agency_erp_demo_v12'); const failed = await demoClient.request('/client-packages/201/payments', { method: 'POST', body: JSON.stringify(make({ idempotency_key: 'package-payment-rollback-001', __test_fail_at: 'notification' })) }); assert.equal(failed.error?.code, 'injected_failure'); assert.equal(storage.get('mt_agency_erp_demo_v12'), before); deactivateDemoMode();
});

test('production endpoint is transactional, package scoped and exact-once', async () => {
  const [api, migration] = await Promise.all([load('api/index.php'), load('database/mysql/025_client_package_payment_idempotency.sql')]);
  assert.ok(api.includes("client-packages/(\\d+)/payments")); assert.match(api, /requireRole\(\$user,\['owner','admin','finance'\]\)/); assert.match(api, /SELECT \* FROM client_packages WHERE id=\? AND organization_id=\? FOR UPDATE/); assert.match(api, /SELECT \* FROM invoices WHERE id=\? AND organization_id=\? AND client_id=\? FOR UPDATE/);
  assert.match(api, /client_package_payment_requests/); assert.match(api, /idempotency_payload_mismatch/); assert.match(api, /payment_exceeds_outstanding/); assert.match(api, /INSERT INTO payment_allocations/); assert.match(api, /'package_payment'/); assert.match(api, /refreshInvoicePaidStatus/); assert.match(api, /record_package_payment/); assert.match(api, /payment_recorded/); assert.match(api, /queueClientWhatsAppSummary/); assert.match(api, /if\(\$pdo->inTransaction\(\)\)\$pdo->rollBack\(\)/);
  assert.match(migration, /UNIQUE KEY uq_client_package_payment_request \(organization_id,idempotency_key\)/); assert.match(migration, /ADD COLUMN IF NOT EXISTS note VARCHAR\(500\)/);
  assert.ok(api.includes("clients/(\\d+)/payment-history")); assert.match(api, /WHERE p\.organization_id=\? AND p\.client_id=\?/); assert.match(api, /LEFT JOIN payment_allocations pa ON pa\.payment_id=p\.id/); assert.match(api, /package_name/); assert.match(api, /source_type<>\'payment\'/);
});

test('cashbox package relation submits a real protected package payment instead of a descriptive finance row', async () => {
  const finance = await load('src/erp/ERPFinance.jsx');
  assert.match(finance, /packagePayment = txForm\.entry_kind === 'income' && txForm\.source_type === 'client_package'/);
  assert.match(finance, /`\/client-packages\/\$\{Number\(txForm\.source_id\)\}\/payments`/);
  assert.match(finance, /payment_date: txForm\.date/);
  assert.match(finance, /idempotency_key: transactionRequestKeyRef\.current/);
  assert.match(finance, /ستُسجّل كدفعة فعلية على الباقة/);
  assert.doesNotMatch(finance, /هذا الربط وصفي في دفتر الحسابات فقط/);
});
