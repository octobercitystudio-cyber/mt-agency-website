import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

function lastRule(css, selector) {
  const start = css.lastIndexOf(`${selector}{`);
  assert.notEqual(start, -1, `missing ${selector}`);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1);
}

test('client portal owns one scoped calm light color system', async () => {
  const css = await readSource('../src/pages/ClientDashboard.css');

  const calmRule = lastRule(css, '.client-app--calm');
  assert.match(calmRule, /--client-bg:#f7f4ee/);
  assert.match(calmRule, /--client-panel:#fffefa/);
  assert.match(calmRule, /--client-text:#171a27/);
  assert.match(calmRule, /--client-muted:#6f707a/);
  assert.match(calmRule, /--client-chart-track:#d8d2ca/);
  assert.match(calmRule, /color-scheme:light/);
});

test('appointment surfaces use the same calm cards at every viewport', async () => {
  const css = await readSource('../src/pages/ClientDashboard.css');

  assert.match(lastRule(css, '.client-app--calm .client-simple-next-card'), /background:#fffefa/);
  assert.match(lastRule(css, '.client-app--calm .client-simple-date-block'), /background:#f2ebff/);
  assert.match(lastRule(css, '.client-app--calm .client-next-appointment,.client-app--calm .client-appointment-cards'), /background:#fffefa/);
  assert.match(lastRule(css, '.client-app--calm .client-booking-date'), /background:#f2ebff/);
  assert.match(css, /\.client-home-focus-grid\{[^}]*grid-template-columns:220px minmax\(0,1fr\)/);
  assert.match(css, /\.client-app--calm \.client-modal-card :is\(input,select,textarea\)\{[^}]*min-height:44px/);
});

test('client finance charts and payment sheet share the calm light system', async () => {
  const css = await readSource('../src/pages/ClientFinanceView.css');

  assert.match(lastRule(css, '.client-app--calm .client-finance-overview'), /background:#faf8f4/);
  assert.match(css, /\.client-finance-obligation-card\{[^}]*background:#fffefa/);
  assert.match(lastRule(css, '.client-app--calm .client-package-finance-card,.client-app--calm .client-finance-invoices>article'), /background:#fff/);
  assert.match(css, /client-transaction-status\.accepted[^}]*#e5f5ee/);
  assert.match(css, /client-transaction-status\.pending[^}]*#fff0d9/);
  assert.match(css, /client-transaction-status\.rejected[^}]*#fde8eb/);
  assert.match(css, /client-payment-modal[^}]*background:rgba/);
  assert.match(css, /client-payment-modal>section[^}]*background:#fffefa/);
});

test('package cards keep the shared light palette without adding Home charts', async () => {
  const [source, css] = await Promise.all([readSource('../src/pages/ClientDashboardOverview.jsx'), readSource('../src/pages/ClientDashboard.css')]);
  assert.match(css, /\.client-app--calm \.client-home-notification-card,[^}]*\.client-app--calm \.client-simple-package-card,[^}]*background:#fffefa/);
  assert.match(lastRule(css, '.client-app--calm .client-package-metrics>div'), /background:#faf8f4/);
  assert.doesNotMatch(source, /PieChart|ResponsiveContainer|recharts/);
  assert.doesNotMatch(source, /'#31263c'/);
});
