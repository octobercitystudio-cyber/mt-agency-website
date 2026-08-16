import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/pages/ClientDashboard.jsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('../src/pages/ClientDashboardOverview.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/ClientDashboard.css', import.meta.url), 'utf8');

test('selected Calm Focus concept is wired to the real mobile client Home', () => {
  assert.match(dashboard, /client-app--calm-home/);
  assert.match(dashboard, /projects=\{projects\}/);
  assert.match(overview, /featured\/>/);
  assert.match(overview, /client-simple-package-card--featured/);
  assert.match(overview, /client-package-balance-ring/);
  assert.match(overview, /ClientActiveServices/);
  assert.match(overview, /client-home-service-details/);
});

test('real package cards keep authoritative live fields and progressive detail', () => {
  for (const field of [
    'pkg.purchased', 'pkg.consumed', 'pkg.held', 'pkg.available',
    'pkg.totalPrice', 'pkg.paid_amount', 'pkg.outstanding',
    'pkg.starts_at', 'pkg.expires_at', 'pkg.payment_due_quantity',
    'pkg.deposit_percent_snapshot', 'pkg.client_notes',
  ]) assert.match(overview, new RegExp(field.replace('.', '\\.')));
  assert.match(overview, /بانتظار أول حجز/);
  assert.match(overview, /الجمعة محسوبة/);
});

test('calm mobile theme is scoped to Home and protects small-phone interaction', () => {
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*\.client-app--calm-home/);
  assert.match(styles, /#f7f4ee/);
  assert.match(styles, /client-package-balance-ring/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /@media\(max-width:350px\)/);
  assert.match(styles, /focus-visible/);
  assert.doesNotMatch(dashboard, /client-app--calm-home[^\n]*activeTab !== 'home'/);
});
