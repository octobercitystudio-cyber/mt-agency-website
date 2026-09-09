import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDashboardKpis,
  calculateDashboardPackageCounts,
  calculateDashboardReceivables,
  calculateDashboardServiceCounts,
} from '../src/lib/dashboardKpis.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dashboard receivables use only unpaid package balances regardless of invoices or legacy client debt', () => {
  const summary = calculateDashboardReceivables({
    invoices: [
      { id: 1, client_id: 1, total: '100.00', paid_amount: '20.00', status: 'issued' },
      { id: 2, client_id: 2, total: '999.00', paid_amount: '0.00', status: 'cancelled' },
    ],
    packages: [
      { client_id: 2, total_price: '50.00', overage_amount: '5.00', paid_amount: '10.00', source_invoice_id: null, status: 'active' },
      { client_id: 1, total_price: '100.00', overage_amount: '3.00', paid_amount: '20.00', source_invoice_id: 1, status: 'active' },
      { total_price: '500.00', overage_amount: '0.00', paid_amount: '0.00', source_invoice_id: null, status: 'archived' },
    ],
    clients: [
      { id: 3, debt: '7.00', status: 'active' },
      { debt: '400.00', status: 'archived' },
      { debt: '-10.00', status: 'active' },
    ],
  });
  assert.deepEqual(summary, { definition: 'unpaid_sold_packages', amount: '128.00', package_amount: '128.00' });
});

test('package receivables include expired, completed and suspended sales and do not offset one sale with another', () => {
  const summary = calculateDashboardReceivables({ packages: [
    { status: 'active', total_price: '100.00', paid_amount: '150.00' },
    { status: 'expired', total_price: '100.50', paid_amount: '50.25' },
    { status: 'completed', total_price: '100.00', paid_amount: '100.00', overage_amount: '20.25' },
    { status: 'suspended', total_price: '70.00', paid_amount: '20.00' },
    ...['draft', 'cancelled', 'archived'].map(status => ({ status, total_price: '999.00', paid_amount: '0.00' })),
  ] });
  assert.equal(summary.amount, '120.50');
  assert.equal(calculateDashboardReceivables({ invoices: [{ total: '999' }], clients: [{ debt: '999' }] }).amount, '0.00');
});

test('dashboard labels explain package receivables and preserve the monthly profit calculation', async () => {
  const dashboard = await load('src/erp/ERPDashboard.jsx');
  assert.match(dashboard, /المتبقي للدفع من جميع الباقات المباعة/);
  assert.match(dashboard, /<span>الأرباح<\/span>/);
  assert.match(dashboard, /هذا الشهر · إيراد/);
  assert.doesNotMatch(dashboard, /صافي التشغيل للشهر/);
});

test('active packages include first-booking null dates and use Cairo calendar expiry', () => {
  const result = calculateDashboardPackageCounts([
    { status: 'active', starts_at: null, expires_at: null },
    { status: 'active', expires_at: '2026-08-12' },
    { status: 'active', expires_at: '2026-08-26' },
    { status: 'active', expires_at: '2026-08-11' },
    { status: 'suspended', expires_at: '2026-08-20' },
  ], '2026-08-12');
  assert.deepEqual(result, { count: 3, expiring_within_14_days: 2 });
});

test('active services count projects as the primary unit and nonterminal child content only', () => {
  const projects = [
    { id: 1, status: 'planning' }, { id: 2, status: 'active' },
    { id: 3, status: 'on_hold' }, { id: 4, status: 'completed' },
  ];
  const content = [
    { project_id: 1, status: 'idea' }, { project_id: 2, status: 'published' },
    { project_id: 3, status: 'in_review' }, { project_id: 4, status: 'draft' },
    { project_id: 2, status: 'editing' },
    { project_id: 1, status: 'draft', archived_at: '2026-08-12 12:00:00' },
    { project_id: 1, status: 'idea', archived_at: '' },
  ];
  assert.deepEqual(calculateDashboardServiceCounts(projects, content), {
    active_projects: 3,
    paused_projects: 1,
    active_content_items: 3,
  });
});

test('dashboard KPI DTO redacts groups by role and denies staff/client access', () => {
  const database = { invoices: [], client_packages: [], clients: [], finance: [], projects: [], content_items: [] };
  const operations = buildDashboardKpis(database, 'operations', '2026-08-12');
  assert.deepEqual(operations.partial_errors, []);
  assert.equal(operations.receivables.available, false);
  assert.equal(operations.cash_movement.available, false);
  assert.equal(operations.active_packages.available, true);
  assert.equal(operations.active_services.available, true);
  const finance = buildDashboardKpis(database, 'finance', '2026-08-12');
  assert.equal(finance.receivables.available, true);
  assert.equal(finance.active_packages.available, true);
  assert.equal(finance.active_services.available, false);
  assert.throws(() => buildDashboardKpis(database, 'staff', '2026-08-12'), error => error.code === 'forbidden' && error.status === 403);
  assert.throws(() => buildDashboardKpis(database, 'client', '2026-08-12'), error => error.code === 'forbidden' && error.status === 403);
});

test('production and demo expose one dashboard KPI contract with partial failure reporting', async () => {
  const [api, demo] = await Promise.all([load('api/index.php'), load('src/lib/demoDataClient.js')]);
  assert.match(api, /\$path === '\/dashboard\/kpis'/);
  assert.match(api, /requireRole\(\$user,\['owner','admin','operations','finance'\]\)/);
  assert.match(api, /organization_id=\?/);
  assert.match(api, /definition'=>'unpaid_sold_packages'/);
  assert.match(api, /source_invoice_id/);
  assert.match(api, /partial_errors/);
  assert.match(api, /SUM\(status IN \('planning','active','on_hold'\)\) AS active_projects/);
  assert.match(api, /c\.archived_at IS NULL/);
  assert.match(api, /catch\(Throwable \$error\).*?\$partialErrors\[\]='finance'/s);
  assert.match(demo, /route === '\/dashboard\/kpis'/);
  assert.match(demo, /buildDashboardKpis\(database, demoRole, cairoDateKey\(\)\)/);
  assert.match(await load('src/lib/dashboardKpis.js'), /partial_errors: \[\]/);
});

test('owner dashboard renders four responsive KPI cells and never turns unavailable values into zero', async () => {
  const [dashboard, css] = await Promise.all([load('src/erp/ERPDashboard.jsx'), load('src/erp/ERPDashboard.css')]);
  assert.match(dashboard, /dataClient\.request\('\/dashboard\/kpis'\)/);
  const strip = dashboard.slice(dashboard.indexOf('<section className="ops-health"'), dashboard.indexOf('</section>', dashboard.indexOf('<section className="ops-health"')));
  assert.equal((strip.match(/<div>/g) || []).length, 4);
  assert.match(strip, /!state\.health\.receivablesAvailable \? '—'/);
  assert.match(strip, /!state\.health\.packagesAvailable \? '—'/);
  assert.match(strip, /الخدمات النشطة/);
  assert.match(strip, /`\$\{state\.health\.activeProjects\} \$\{activeProjectsUnit\}`/);
  assert.match(strip, /state\.health\.activeProjects} مشروع · {state\.health\.activeContent} محتوى/);
  assert.doesNotMatch(strip, /activePackages \|\| 0/);
  assert.match(dashboard, /'clients', 'projects', 'content_items'/);
  assert.match(css, /\.ops-health\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1100px\)[\s\S]*?repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.ops-health\{grid-template-columns:1fr\}/);
});
