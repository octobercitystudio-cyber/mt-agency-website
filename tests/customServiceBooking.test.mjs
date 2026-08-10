import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const minHeightForSelector = (css, selector) => {
  const marker = `${selector}{`;
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `missing rule for ${selector}`);
  const bodyStart = start + marker.length;
  const bodyEnd = css.indexOf('}', bodyStart);
  const match = css.slice(bodyStart, bodyEnd).match(/min-height\s*:\s*([\d.]+)px/);
  assert.ok(match, `missing min-height for ${selector}`);
  return Number(match[1]);
};
const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
};

test('all authorised booking entry points use the shared custom-service flow', async () => {
  const [modal, bookings, projects, form, schedule, slot, catalog] = await Promise.all([
    load('src/erp/ERPAddBookingModal.jsx'), load('src/erp/ERPBookings.jsx'), load('src/erp/ERPProjects.jsx'),
    load('src/erp/CustomServiceForm.jsx'), load('src/erp/CustomServiceSchedule.jsx'), load('src/erp/customServiceSlot.js'), load('src/erp/customServices.js'),
  ]);
  assert.match(modal, /CUSTOM_SERVICE_OPTION = '__custom_service__'/);
  assert.match(modal, /＋ خدمة مخصصة جديدة/);
  assert.match(modal, /<CustomServiceForm/);
  assert.match(bookings, /<ERPAddBookingModal isOpen={isModalOpen}/);
  assert.match(projects, /<CustomServiceForm/);
  assert.match(form, /initialService = 'custom'/);
  assert.match(form, /إضافة موعد لهذه الخدمة في جدول الحجوزات/);
  assert.match(slot, /getBookingAvailability/);
  assert.match(schedule, /fc-day-fri/);
  assert.match(catalog, /custom: \{ label: 'خدمة مخصصة'/);
});

test('demo custom service creates exact project finance without a sold package', async () => {
  browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const beforeBookings = (await demoClient.from('bookings').select('*')).data.length;
  const beforePackages = (await demoClient.from('client_packages').select('*')).data.length;
  const result = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({
    idempotency_key: 'custom-test-exact-money-001', client_id: 1, service_type: 'custom', name: 'خدمة تجريبية مخصصة', starts_at: '2026-08-10', pricing_model: 'custom', paid_amount: 10.20,
    items: [
      { description: 'بند أول', quantity: 3, unit: 'وحدة', unit_price: 0.10, total_price: 999 },
      { description: 'بند ثانٍ', quantity: 2, unit: 'وحدة', unit_price: 10.05, total_price: 1 },
    ], milestones: [{ title: 'الإعداد' }, { title: 'التسليم' }], requires_booking: false,
  }) });
  assert.equal(result.error, null);
  const project = (await demoClient.from('projects').select('*')).data.find(row => row.id === result.data.id);
  const invoice = (await demoClient.from('invoices').select('*')).data.find(row => row.id === result.data.invoice_id);
  const payment = (await demoClient.from('payments').select('*')).data.find(row => row.id === result.data.payment_id);
  const finance = (await demoClient.from('finance').select('*')).data.find(row => row.source_type === 'payment' && row.source_id === payment.id);
  assert.equal(project.service_type, 'custom');
  assert.equal(Number(project.agreed_price), 20.4);
  assert.equal(Number(invoice.total), 20.4);
  assert.equal(Number(invoice.paid_amount), 10.2);
  assert.equal(Number(payment.amount), 10.2);
  assert.equal(finance.client_id, 1);
  assert.equal((await demoClient.from('bookings').select('*')).data.length, beforeBookings);
  assert.equal((await demoClient.from('client_packages').select('*')).data.length, beforePackages);
  deactivateDemoMode();
});

test('demo optional booking is pending and invalid Friday rolls back every child', async () => {
  browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const resources = (await demoClient.from('resources').select('*')).data;
  const resource = resources.find(row => Number(row.is_active ?? 1) === 1);
  const base = { client_id: 1, service_type: 'custom', starts_at: '2026-08-10', pricing_model: 'custom', paid_amount: 0, items: [{ description: 'الخدمة', quantity: 1, unit: 'مشروع', unit_price: 100 }], milestones: [{ title: 'الإعداد' }, { title: 'التسليم' }], requires_booking: true };
  const success = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({ ...base, idempotency_key: 'custom-test-with-booking-001', name: 'خدمة بموعد', booking: { resource_id: resource.id, date: '2026-12-16', start_time: '18:00', end_time: '19:15' } }) });
  assert.equal(success.error, null);
  const booking = (await demoClient.from('bookings').select('*')).data.find(row => row.id === success.data.booking_id);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.service, 'خدمة بموعد');
  assert.equal(booking.client_package_id, null);
  assert.equal(booking.duration_minutes, 75);
  const before = await Promise.all(['projects','project_items','project_milestones','invoices','bookings'].map(table => demoClient.from(table).select('*')));
  const failure = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({ ...base, idempotency_key: 'custom-test-invalid-friday-001', name: 'يجب ألا يُنشأ', booking: { resource_id: resource.id, date: '2026-08-14', start_time: '18:00', end_time: '19:00' } }) });
  assert.equal(failure.error?.code, 'invalid_project_booking');
  const after = await Promise.all(['projects','project_items','project_milestones','invoices','bookings'].map(table => demoClient.from(table).select('*')));
  assert.deepEqual(after.map(result => result.data.length), before.map(result => result.data.length));
  deactivateDemoMode();
});

test('production custom flow remains one atomic pending booking transaction', async () => {
  const api = await load('api/index.php');
  assert.match(api, /'custom' => \['label' => 'خدمة مخصصة'/);
  assert.match(api, /itemsTotalCents=array_sum/);
  assert.match(api, /SELECT id FROM resources WHERE id=\? AND organization_id=\? AND is_active=1 FOR UPDATE/);
  assert.match(api, /'pending','موعد مرتبط بخدمة مخصصة/);
  assert.match(api, /client_package_id,project_id[\s\S]*?VALUES \(\?,\?,NULL/);
  assert.match(api, /'project_payment'[\s\S]*?'payment',\?,\?,1,\?\)/);
  assert.doesNotMatch(api, /'project_payment'[\s\S]*?'payment',\?,\?,\?,1,\?\)/);
  assert.match(api, /INSERT INTO custom_service_requests/);
  assert.match(api, /SELECT request_hash,status,response_json FROM custom_service_requests[\s\S]*?FOR UPDATE/);
  assert.match(api, /UPDATE custom_service_requests SET status='completed'/);
  assert.match(api, /\$pdo->commit\(\);respond\(\$response,201\)/);
});

test('demo retries the same custom-service request exactly once and rejects key reuse', async () => {
  browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const payload = { idempotency_key: 'custom-idempotent-retry-001', client_id: 1, service_type: 'custom', name: 'مشروع لا يتكرر', starts_at: '2026-08-10', pricing_model: 'custom', paid_amount: 25, items: [{ description: 'خدمة', quantity: 1, unit: 'مشروع', unit_price: 100 }], milestones: [{ title: 'الإعداد' }, { title: 'التسليم' }], requires_booking: false };
  const first = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify(payload) });
  const countsBeforeRetry = await Promise.all(['projects','project_items','project_milestones','invoices','payments','payment_allocations','finance'].map(table => demoClient.from(table).select('*')));
  const retry = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify(payload) });
  const countsAfterRetry = await Promise.all(['projects','project_items','project_milestones','invoices','payments','payment_allocations','finance'].map(table => demoClient.from(table).select('*')));
  assert.equal(first.error, null); assert.equal(retry.error, null); assert.deepEqual(retry.data, first.data);
  assert.deepEqual(countsAfterRetry.map(result => result.data.length), countsBeforeRetry.map(result => result.data.length));
  const mismatch = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({ ...payload, name: 'مشروع آخر' }) });
  assert.equal(mismatch.error?.code, 'idempotency_mismatch');
  deactivateDemoMode();
});

test('custom editor is responsive, reorders items, restores focus and explicitly sizes measured controls', async () => {
  const [form, css, modal, dashboard, bookings, clients, migration] = await Promise.all([
    load('src/erp/CustomServiceForm.jsx'), load('src/erp/ERPProjectsCustomServices.css'), load('src/erp/ERPAddBookingModal.jsx'),
    load('src/erp/ERPDashboard.jsx'), load('src/erp/ERPBookings.jsx'), load('src/erp/ERPClients.jsx'), load('database/mysql/018_custom_service_idempotency.sql'),
  ]);
  assert.match(form, /move\(setItems, index, -1\)/); assert.match(form, /move\(setItems, index, 1\)/);
  assert.match(form, /disabled=\{index === 0\}/); assert.match(form, /disabled=\{index === items\.length - 1\}/);
  assert.match(form, /idempotency_key: requestKeyRef\.current/);
  assert.match(css, /max-width:min\(900px,calc\(100vw - 24px\)\)!important/);
  assert.match(css, /@media\(max-width:600px\)[\s\S]*?\.custom-item-row\{grid-template-columns:1fr\}/);
  assert.match(css, /\.custom-items-labels,\.custom-item-row\{[^}]*min-width:0;width:100%/);
  for (const selector of ['.custom-service-form .custom-pricing-head select', '.custom-service-form .custom-item-row input', '.custom-service-form .custom-financial-summary input']) {
    assert.ok(minHeightForSelector(css, selector) >= 44, `${selector} must be at least 44px tall`);
  }
  assert.match(css, /\.erp-booking-modal-header h2\{color:#fff!important\}/);
  assert.match(modal, /useModalDialog\(isOpen, close, \{ returnFocusRef \}\)/);
  assert.match(dashboard, /returnFocusRef=\{bookingTriggerRef\}/); assert.match(bookings, /returnFocusRef=\{bookingTriggerRef\}/); assert.match(clients, /returnFocusRef=\{bookingTriggerRef\}/);
  assert.match(migration, /UNIQUE KEY uq_custom_service_request \(organization_id,idempotency_key\)/);
});
