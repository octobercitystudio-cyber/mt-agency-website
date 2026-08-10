import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('owner sidebar exposes the requested navigation groups in order', async () => {
  const layout = await load('src/erp/ERPLayout.jsx');
  const labels = ['التشغيل اليومي', 'الخدمات والعمل', 'المالية والفريق', 'النظام'];

  let previousIndex = -1;
  for (const label of labels) {
    const currentIndex = layout.indexOf(`>${label}</h2>`);
    assert.ok(currentIndex > previousIndex, `${label} should follow the previous navigation group`);
    previousIndex = currentIndex;
  }

  assert.match(layout, /<section className="erp-nav-group" aria-labelledby="erp-nav-daily-label">/);
  assert.match(layout, /<ul className="erp-nav-list">/);
  assert.match(layout, /<section className="erp-sidebar-actions" aria-labelledby="erp-nav-system-label">/);
});

test('sidebar grouping keeps permission gates and request badge behavior', async () => {
  const layout = await load('src/erp/ERPLayout.jsx');

  assert.match(layout, /\{canOpenRequests && <li className="erp-nav-item">/);
  assert.match(layout, /\{requestsCount > 0 && <span className="badge rounded-pill bg-danger"/);
  assert.match(layout, /\{canOpenPackages && <li className="erp-nav-item">/);
  assert.match(layout, /\{canOpenProjects && <li className="erp-nav-item">/);
  assert.match(layout, /\{canOpenOffers && <li className="erp-nav-item">/);
  assert.match(layout, /\{canManageFinance && <li className="erp-nav-item">/);
  assert.match(layout, /\{canManageFormationFund && <li className="erp-nav-item erp-nav-item--formation">/);
  assert.match(layout, /\{canManageSocialProfits && <li className="erp-nav-item erp-nav-item--social-profits">/);
  assert.match(layout, /\{canOpenSettings && <div className="erp-nav-item mb-1">/);
});
