import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildClientFinanceSummary } from '../src/lib/clientFinanceSummary.js';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('each subscribed package or service keeps an independent financial chart row', () => {
  const summary = buildClientFinanceSummary(
    [{ id: 11, name: 'باقة تصوير المنتجات', total_price: 12000, paid_amount: 4000, status: 'active' }],
    [{ id: 22, client_label: 'إدارة المحتوى الشهري', client_kind: 'service', total: 8000, paid_amount: 2000, status: 'issued' }],
  );

  assert.equal(summary.rows.length, 2);
  assert.deepEqual(summary.rows.map(row => ({ label: row.label, displayKind: row.displayKind, total: row.totalPiastres, paid: row.paidPiastres, remaining: row.remainingPiastres })), [
    { label: 'إدارة المحتوى الشهري', displayKind: 'service', total: 800000, paid: 200000, remaining: 600000 },
    { label: 'باقة تصوير المنتجات', displayKind: 'package', total: 1200000, paid: 400000, remaining: 800000 },
  ]);
});

test('a zero-price subscribed service remains visible as its own financial row', () => {
  const summary = buildClientFinanceSummary([], [
    { id: 30, client_label: 'جلسة استشارية مجانية', client_kind: 'service', total: 0, paid_amount: 0, status: 'issued' },
  ]);

  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].label, 'جلسة استشارية مجانية');
  assert.equal(summary.rows[0].totalPiastres, 0);
  assert.equal(summary.rows[0].remainingPiastres, 0);
  assert.equal(summary.rows[0].paidPercent, 100);
});

test('finance removes the obligations breakdown and renders one circular card per row', async () => {
  const [source, dashboard, css] = await Promise.all([
    readSource('../src/pages/ClientFinanceView.jsx'),
    readSource('../src/pages/ClientDashboard.jsx'),
    readSource('../src/pages/ClientFinanceView.css'),
  ]);

  assert.doesNotMatch(source, /تفصيل الالتزامات|client-finance-breakdown-card/);
  assert.match(source, /summary\.rows\.map\(row => <FinanceObligationCard/);
  assert.match(source, /كل باقة أو خدمة لها رسم مستقل/);
  assert.match(source, /client_label: linkedPackage\?\.name \|\| linkedProject\?\.name \|\| linkedOffer\?\.title/);
  assert.match(dashboard, /projects=\{projects\} offers=\{offers\}/);
  assert.match(css, /\.client-finance-obligation-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:900px\)\{\.client-finance-obligation-grid\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  assert.match(css, /\.client-finance-obligation-card \.client-finance-ring\{width:145px/);
});
