import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PACKAGE_PAYMENT_DUE_MESSAGE,
  isPackagePaymentDue,
  packagePaymentDueItems,
} from '../src/lib/clientFinanceSummary.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

const hourlyPackage = overrides => ({
  id: 12,
  name: 'باقة التصوير الشهرية',
  billing_unit: 'hour',
  status: 'active',
  total_price: '10000.00',
  overage_amount: '0.00',
  paid_amount: '4000.00',
  payment_due_quantity: 5,
  consumed_quantity: 5,
  payment_due_minutes: 300,
  consumed_minutes: 300,
  ...overrides,
});

test('hourly payment alarm prefers authoritative integer minutes and falls back to quantities', () => {
  assert.equal(isPackagePaymentDue(hourlyPackage({ consumed_quantity: 99, consumed_minutes: 299 })), false);
  assert.equal(isPackagePaymentDue(hourlyPackage({ consumed_quantity: 0, consumed_minutes: 300 })), true);
  assert.equal(isPackagePaymentDue(hourlyPackage({ payment_due_minutes: null, consumed_minutes: null, payment_due_quantity: 4.5, consumed_quantity: 4.5 })), true);
});

test('payment alarm includes due reels and excludes near, zero, paid, and inactive packages', () => {
  assert.equal(isPackagePaymentDue({ ...hourlyPackage({ billing_unit: 'reel' }), payment_due_quantity: 3, consumed_quantity: 3 }), true);
  assert.equal(isPackagePaymentDue(hourlyPackage({ consumed_minutes: 299 })), false);
  assert.equal(isPackagePaymentDue(hourlyPackage({ payment_due_minutes: 0, payment_due_quantity: 0 })), false);
  assert.equal(isPackagePaymentDue(hourlyPackage({ paid_amount: 10000 })), false);
  for (const status of ['archived', 'draft', 'completed', 'cancelled', 'suspended']) {
    assert.equal(isPackagePaymentDue(hourlyPackage({ status })), false, `status ${status} must not alarm`);
  }
});

test('due package items identify each package and its exact remaining balance', () => {
  const due = packagePaymentDueItems([
    hourlyPackage({ id: 1, name: 'باقة أولى' }),
    hourlyPackage({ id: 2, name: 'باقة ثانية', total_price: 2500, paid_amount: 500 }),
    hourlyPackage({ id: 3, name: 'قريبة فقط', consumed_minutes: 299 }),
  ]);
  assert.deepEqual(due, [
    { id: 1, name: 'باقة أولى', outstandingPiastres: 600000 },
    { id: 2, name: 'باقة ثانية', outstandingPiastres: 200000 },
  ]);
});

test('home DOM and visual order place appointment first and alarm before packages', async () => {
  const [overview, css] = await Promise.all([
    load('src/pages/ClientDashboardOverview.jsx'),
    load('src/pages/ClientDashboard.css'),
  ]);
  const appointment = overview.indexOf('className={`client-next-home');
  const alarm = overview.indexOf('<ClientPaymentDueAlarm');
  const packages = overview.indexOf('<ClientPackageCards');
  assert.ok(appointment >= 0 && appointment < alarm && alarm < packages);
  assert.match(css, /\.client-next-home\{order:0\}/);
  assert.match(css, /\.client-payment-due-alarm\{order:1/);
  assert.match(css, /\.client-packages-home\{order:2\}/);
});

test('alarm uses the exact copy, live alert semantics, finance action, and reduced motion', async () => {
  const [overview, css, api, demo] = await Promise.all([
    load('src/pages/ClientDashboardOverview.jsx'),
    load('src/pages/ClientDashboard.css'),
    load('api/index.php'),
    load('src/lib/demoDataClient.js'),
  ]);
  assert.equal(PACKAGE_PAYMENT_DUE_MESSAGE, 'لقد تجاوزتم حد الدفع للباقة برجاء سرعة سداد باقي المستحقات لتجنب توقف الباقة');
  assert.match(overview, /role="alert" aria-live="polite" aria-atomic="true"/);
  assert.match(overview, /<AlarmClock\/>/);
  assert.match(overview, /onNavigate\('finance'\)/);
  assert.match(overview, /المتبقي \{formatEGP/);
  assert.ok(api.includes(PACKAGE_PAYMENT_DUE_MESSAGE));
  assert.ok(demo.includes(PACKAGE_PAYMENT_DUE_MESSAGE));
  assert.match(css, /min-height:46px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.client-payment-due-alarm__icon::after\{animation:none/);
});

test('global points badge gives the numeric value stronger responsive sizing without clipping names', async () => {
  const [dashboard, css] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'),
    load('src/pages/ClientDashboard.css'),
  ]);
  assert.match(dashboard, /client-topbar-points[\s\S]*?<strong>\{formatClientPoints\(client\?\.points\)\}<\/strong><span>نقطة<\/span>/);
  assert.match(css, /\.client-topbar-points\{min-height:42px/);
  assert.match(css, /\.client-topbar-points strong\{[^}]*font-size:1\.08rem/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?\.client-topbar-points\{min-height:40px/);
  assert.match(css, /white-space:normal!important;overflow:visible!important;text-overflow:clip!important/);
  assert.match(css, /@media\(max-width:350px\)/);
});
