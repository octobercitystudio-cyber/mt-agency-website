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
};

test('client home shows safe points, packages before appointment, and complete progressive package details', async () => {
  const [dashboard, overview, css] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientDashboardOverview.jsx'), load('src/pages/ClientDashboard.css'),
  ]);
  assert.match(dashboard, /<ClientDashboardOverview[\s\S]*?client=\{client\}/);
  assert.match(overview, /Number\.isFinite\(points\) \? points : 0/);
  assert.match(overview, /maximumFractionDigits: 2/);
  assert.ok(overview.indexOf('<ClientPointsCard') < overview.indexOf('<ClientPackageCards'));
  assert.ok(overview.indexOf('<ClientPackageCards') < overview.indexOf('client-next-home'));
  for (const label of ['إجمالي الرصيد', 'المستخدم', 'محجوز لمواعيد قادمة', 'متاح الآن', 'حد السداد', 'قيمة الباقة', 'إضافات الجلسات', 'المدفوع', 'المتبقي المالي', 'الدفعة المقدمة', 'بداية الصلاحية', 'نهاية الصلاحية', 'نظام الصلاحية', 'نقاط حسابك']) assert.ok(overview.includes(label), `missing ${label}`);
  assert.doesNotMatch(overview, /pkg\.notes/);
  assert.match(overview, /pkg\.client_notes/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /min-height:54px/);
});

test('only four primary tabs remain while history and offers stay reachable on Home', async () => {
  const dashboard = await load('src/pages/ClientDashboard.jsx');
  const nav = dashboard.slice(dashboard.indexOf('<nav aria-label="التنقل الرئيسي"'), dashboard.indexOf('</nav>'));
  for (const key of ["'home'", "'schedule'", "'projects'", "'finance'"]) assert.ok(nav.includes(key));
  assert.doesNotMatch(nav, /'history'|'offers'/);
  const overview = await load('src/pages/ClientDashboardOverview.jsx');
  assert.match(overview, /onNavigate\('history'\)/);
  assert.match(overview, /onNavigate\('offers'\)/);
});

test('owner creation forms keep a short default path and collapsed advanced controls', async () => {
  const [packages, custom] = await Promise.all([load('src/erp/ERPPackages.jsx'), load('src/erp/CustomServiceForm.jsx')]);
  assert.match(packages, /packages-sale-basics/);
  assert.match(packages, /<details className="packages-progressive-section">/);
  assert.match(packages, /إضافة موعد الآن \(اختياري\)/);
  assert.match(packages, /حفظ الباقة بدون موعد/);
  assert.match(custom, /<details className="custom-advanced-options">/);
  assert.match(custom, /إجمالي الاتفاق/);
  assert.match(custom, /setAgreedTotal/);
  assert.match(custom, /getProjectStageTemplate/);
  assert.match(custom, /useState\(\(\) => \[buildItem/);
  assert.match(custom, /booking: form\.requires_booking/);
});

test('void without a reason keeps immutable storage but hides original and reversal from normal lists', async () => {
  browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const beforeRaw = (await demoClient.from('finance').select('*')).data;
  const income = beforeRaw.find(row => row.source_type === 'payment' && Number(row.source_id) === 603);
  assert.ok(income);
  const result = await demoClient.request('/payments/603/void', { method: 'POST', body: '{}' });
  assert.equal(result.error, null);
  const payment = (await demoClient.from('payments').select('*')).data.find(row => Number(row.id) === 603);
  const raw = (await demoClient.from('finance').select('*')).data;
  const original = raw.find(row => Number(row.id) === Number(income.id));
  const reversal = raw.find(row => Number(row.reversed_entry_id) === Number(income.id));
  assert.ok(original.voided_at); assert.equal(original.reversal_reason, 'تم الإلغاء بواسطة المالك.');
  assert.equal(payment.void_reason, 'تم الإلغاء بواسطة المالك.');
  assert.equal(reversal.entry_kind, 'reversal');
  const visible = (await demoClient.request('/finance/entries', { method: 'GET' })).data;
  assert.ok(!visible.some(row => Number(row.id) === Number(original.id) || Number(row.id) === Number(reversal.id)));
  assert.equal(Number(original.amount), Number(reversal.amount));
  deactivateDemoMode();
});

test('optional void note is stored and correction endpoints still require a reason', async () => {
  browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const voided = await demoClient.request('/payments/604/void', { method: 'POST', body: JSON.stringify({ reason: 'دفعة مكررة داخليًا' }) });
  assert.equal(voided.error, null);
  const payment = (await demoClient.from('payments').select('*')).data.find(row => Number(row.id) === 604);
  assert.equal(payment.void_reason, 'دفعة مكررة داخليًا');
  resetDemoDatabase(); activateDemoMode('owner');
  const correction = await demoClient.request('/payments/603/correct', { method: 'POST', body: JSON.stringify({ amount: 3500 }) });
  assert.equal(correction.error?.code, 'correction_reason_required');
  deactivateDemoMode();
});

test('production uses a dedicated optional void helper and keeps correction validation strict', async () => {
  const [api, finance, clientFinance] = await Promise.all([load('api/index.php'), load('src/erp/ERPFinance.jsx'), load('src/pages/ClientFinanceView.jsx')]);
  assert.match(api, /function financeVoidReason/);
  assert.match(api, /تم الإلغاء بواسطة المالك/);
  assert.match(api, /voidPayment[\s\S]*?financeVoidReason\(\$payload\)/);
  assert.match(api, /voided_at IS NULL AND entry_kind<>'reversal'/);
  assert.match(api, /function ownerCorrectionReason[\s\S]*?correction_reason_required/);
  assert.match(finance, /ملاحظة داخلية \(اختيارية\)/);
  assert.match(finance, /required=\{correct\}/);
  assert.match(clientFinance, /!payment\.voided_at && payment\.entry_kind !== 'reversal'/);
});
