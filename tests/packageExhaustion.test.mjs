import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { effectivePackageStatus, packageFinancialSummary } from '../src/lib/businessFormat.js';
import { organizeClientPackageGroups } from '../src/erp/packageContinuity.js';
import { clientPackageWorkspaceSummary } from '../src/erp/packageWorkspace.js';

const todayKey = '2026-10-06';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/packageExhaustion.json', import.meta.url), 'utf8'));
for (const fixture of fixtures) test(fixture.name, () => {
  assert.equal(effectivePackageStatus({ status: 'active', expires_at: '2026-11-01', ...fixture.package }, todayKey), fixture.expected);
});

test('exhausted package leaves active list and counts but keeps its history and amount owed', () => {
  const spent = { id: 1, client_id: 7, status: 'active', billing_unit: 'hour', purchased_minutes: 600, consumed_minutes: 600, expires_at: '2026-11-01', total_price: 1800, paid_amount: 900 };
  const renewal = { ...spent, id: 2, consumed_minutes: 0, expires_at: null };
  const packages = [spent, renewal];
  const active = packages.filter(pkg => effectivePackageStatus(pkg, todayKey) === 'active');
  assert.deepEqual(active.map(pkg => pkg.id), [2]);
  const groups = organizeClientPackageGroups({ packages, visiblePackages: active, todayKey });
  assert.equal(groups[0].activeCount, 1);
  assert.equal(groups[0].relatedCount, 1);
  assert.equal(groups[0].priorityPackageId, 2);
  assert.equal(clientPackageWorkspaceSummary(packages, 7, todayKey).activeCount, 1);
  assert.deepEqual(packages.filter(pkg => effectivePackageStatus(pkg, todayKey) === 'completed').map(pkg => pkg.id), [1]);
  assert.equal(packageFinancialSummary(spent).outstandingCents, 90000);
  assert.equal(spent.status, 'active', 'display classification does not rewrite account records');
  assert.equal(effectivePackageStatus({ ...spent, purchased_minutes: 660 }, todayKey), 'active', 'owner balance correction restores active classification');
});
