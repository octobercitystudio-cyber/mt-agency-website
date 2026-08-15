import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { formatBookingStatus, formatPackageStatus } from '../src/lib/businessFormat.js';
import { calculateDashboardCashMovement, calculateDashboardPackageCounts } from '../src/lib/dashboardKpis.js';
import { calculateOperationalFinanceMovement } from '../src/lib/financeMetrics.js';
import { activateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };

test('dashboard packages use the exact sold-studio service scope used by packages page', () => {
  const services = [
    { id: 1, is_active: 1, is_draft: 0, billing_unit: 'hour', total_hours: 10, total_reels: 0, category: 'باقة شهرية' },
    { id: 2, is_active: 1, is_draft: 0, billing_unit: 'month', total_hours: 0, total_reels: 0, category: 'خدمة إضافية' },
    { id: 3, is_active: 1, is_draft: 1, billing_unit: 'reel', total_hours: 0, total_reels: 8, category: 'باقة ريلز' },
  ];
  const packages = [
    { service_id: 1, status: 'active', starts_at: null, expires_at: null },
    { service_id: 2, status: 'active', starts_at: '2026-08-01', expires_at: '2026-09-01' },
    { service_id: 3, status: 'active', starts_at: '2026-08-01', expires_at: '2026-09-01' },
  ];
  assert.deepEqual(calculateDashboardPackageCounts(packages, '2026-08-15', services), { count: 1, expiring_within_14_days: 0 });
});

test('dashboard and finance use one exact-piastre operational definition and exclude internal transfers', () => {
  const entries = [
    { date: '2026-08-01', entry_kind: 'income', amount: '42500.10' },
    { date: '2026-08-02', entry_kind: 'expense', amount: '11451.23' },
    { date: '2026-08-03', entry_kind: 'transfer_out', amount: '3000.00' },
    { date: '2026-08-03', entry_kind: 'transfer_in', amount: '3000.00' },
    { date: '2026-08-04', entry_kind: 'income', amount: '0.01' },
    { date: '2026-08-05', entry_kind: 'reversal', category: 'reversal_income', amount: '0.01' },
  ];
  const finance = calculateOperationalFinanceMovement(entries, '2026-08');
  const dashboard = calculateDashboardCashMovement(entries, '2026-08');
  assert.equal(finance.income, '42500.10');
  assert.equal(finance.expense, '11451.23');
  assert.equal(finance.net, '31048.87');
  assert.deepEqual(dashboard, { definition: 'operational', transfers_included: false, cash_in: finance.income, cash_out: finance.expense });
});

test('pending package validity stays nullable in data and never renders a false zero', async () => {
  resetDemoDatabase(); activateDemoMode('owner');
  const result = await demoClient.request('/client-packages/209/details', { method: 'GET' });
  assert.equal(result.error, null);
  assert.equal(result.data.validity.state, 'pending_activation');
  assert.equal(result.data.validity.starts_at, null);
  assert.equal(result.data.validity.expires_at, null);
  assert.equal(result.data.validity.remaining_calendar_days, null);

  const [packagesSource, apiSource] = await Promise.all([load('src/erp/ERPPackages.jsx'), load('api/index.php')]);
  assert.match(packagesSource, /remainingValidity===null\?'—'/);
  assert.match(packagesSource, /تبدأ عند أول حجز/);
  assert.doesNotMatch(packagesSource, /validity\.remaining_calendar_days\?\?0/);
  assert.match(apiSource, /\$calendarDays=!empty\(\$package\['expires_at'\]\)\?remainingPackageCalendarDays/);
});

test('booking and package status labels are centralized Arabic with a safe unknown fallback', () => {
  assert.equal(formatBookingStatus('alternative_proposed'), 'موعد بديل مقترح');
  assert.equal(formatPackageStatus('draft'), 'مسودة');
  const originalWarn = console.warn; console.warn = () => {};
  try { assert.equal(formatPackageStatus('future_raw_state'), 'حالة غير معروفة'); }
  finally { console.warn = originalWarn; }
});

test('finance uses stable lucide icons and accessible 44px month controls on mobile', async () => {
  const [source, css] = await Promise.all([load('src/erp/ERPFinance.jsx'), load('src/erp/ERPFinance.css')]);
  assert.doesNotMatch(source, /\bfas\b|fa-[a-z]/);
  assert.match(source, /aria-label="عرض الشهر التالي"/);
  assert.match(source, /aria-label="عرض الشهر السابق"/);
  assert.match(css, /\.finance-month-button\{width:44px;height:44px;min-width:44px/);
  assert.match(css, /\.finance-kpi-watermark\{[^}]*width:44px;[^}]*height:44px;[^}]*padding:11px/);
  assert.match(css, /@media\(max-width:390px\)[^{]*\{[^}]*\.finance-page \.month-selector/);
});

test('ERP interaction contract enforces 44px targets across dashboard, calendars and scoped pages', async () => {
  const css = await load('src/erp/ERPLayout.css');
  for (const selector of ['.erp-sidebar .erp-nav-link', '.erp-bottom-nav .erp-bottom-nav-item', '[role="tab"]', '.fc-event']) assert.ok(css.includes(selector), selector);
  assert.match(css, /min-height:\s*44px\s*!important/);
  assert.match(css, /min-width:\s*44px\s*!important/);
  assert.match(css, /\.erp-main \.fc-event\s*\{[^}]*min-height:\s*44px\s*!important/);
});

test('production KPI SQL documents the same service scope and operational transfer exclusion', async () => {
  const source = await load('api/index.php');
  assert.match(source, /JOIN services s ON s\.id=cp\.service_id/);
  assert.match(source, /'definition'=>'operational','transfers_included'=>false/);
  const kpiBlock = source.slice(source.indexOf("if ($path === '/dashboard/kpis'"), source.indexOf("if ($path === '/readiness/package-sales'"));
  assert.match(kpiBlock, /entry_kind IN \('income','advance_in'\)/);
  assert.doesNotMatch(kpiBlock, /entry_kind IN \('income','transfer_in','advance_in'\)/);
});
