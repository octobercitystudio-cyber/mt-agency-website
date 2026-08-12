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

test('client portal owns a scoped dark color system', async () => {
  const css = await readSource('../src/pages/ClientDashboard.css');

  assert.match(css, /\.client-app,\.client-state\s*\{[^}]*--client-bg:#0b0711/);
  assert.match(css, /--client-panel:#15101d/);
  assert.match(css, /--client-text:#f8f4ff/);
  assert.match(css, /--client-muted:#a99db4/);
  assert.match(css, /--client-chart-track:#715b85/);
  assert.match(css, /color-scheme:dark/);
  assert.doesNotMatch(css, /color-scheme\s*:\s*light/);
});

test('appointment and live-session cards finish with dark surfaces', async () => {
  const css = await readSource('../src/pages/ClientDashboard.css');

  assert.match(lastRule(css, '.client-next-home'), /background:linear-gradient\([^}]*var\(--client-panel\)/);
  assert.match(lastRule(css, '.client-simple-next-card'), /background:#100b16/);
  assert.match(lastRule(css, '.client-simple-empty'), /background:#100b16/);
  assert.match(lastRule(css, '.client-next-home--live'), /background:linear-gradient\([^}]*#13231f/);
  assert.match(lastRule(css, '.client-appointment-live'), /background:#11231e/);
  assert.match(lastRule(css, '.client-session-settlement'), /background:#171222/);
});

test('client finance proof and charts finish with the shared dark palette', async () => {
  const css = await readSource('../src/pages/ClientFinanceView.css');

  assert.match(lastRule(css, '.client-transfer-section'), /var\(--client-panel\)/);
  assert.match(lastRule(css, '.client-proof-preview'), /background:#100b16/);
  assert.match(lastRule(css, '.client-finance-overview'), /var\(--client-panel\)/);
  assert.match(lastRule(css, '.client-finance-ring-card,.client-finance-breakdown-card'), /background:#100b16/);
  assert.match(lastRule(css, '.client-finance-breakdown-list>article'), /background:#15101d/);
  assert.doesNotMatch(css, /color-scheme\s*:\s*light/);
});

test('package cards keep the shared dark palette without adding Home charts', async () => {
  const [source, css] = await Promise.all([readSource('../src/pages/ClientDashboardOverview.jsx'), readSource('../src/pages/ClientDashboard.css')]);
  assert.match(css, /\.client-simple-package-card[^{]*\{[^}]*var\(--client-purple\)/s);
  assert.doesNotMatch(source, /PieChart|ResponsiveContainer|recharts/);
  assert.doesNotMatch(source, /'#31263c'/);
});
