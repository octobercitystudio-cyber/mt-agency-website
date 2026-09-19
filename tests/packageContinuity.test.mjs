import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { organizeClientPackageGroups, packageContinuityTag } from '../src/erp/packageContinuity.js';

const base = { client_id: 7, service_id: 101, billing_unit: 'hour', purchased_quantity: 10, consumed_quantity: 2, held_quantity: 0, status: 'active' };

test('client package file keeps renewals together and prioritizes the balance expiring first', () => {
  const previous = { ...base, id: 10, name: 'الباقة السابقة', starts_at: '2026-05-01', expires_at: '2026-06-01' };
  const current = { ...base, id: 11, name: 'الباقة الحالية', starts_at: '2026-08-01', expires_at: '2026-09-20' };
  const next = { ...base, id: 12, name: 'الباقة التالية', starts_at: null, expires_at: null };
  const packages = [next, previous, current];
  const collapsed = organizeClientPackageGroups({ packages, visiblePackages: [current, next], clients: [{ id: 7, name: 'شريف عثمان' }], todayKey: '2026-09-13' });

  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].client.name, 'شريف عثمان');
  assert.deepEqual(collapsed[0].packages.map(pkg => pkg.id), [11, 12]);
  assert.equal(collapsed[0].priorityPackageId, 11);
  assert.equal(collapsed[0].relatedCount, 1);
  assert.equal(packageContinuityTag(current, collapsed[0], '2026-09-13').label, 'أولوية الحجز');
  assert.equal(packageContinuityTag(next, collapsed[0], '2026-09-13').label, 'الباقة التالية');

  const expanded = organizeClientPackageGroups({ packages, visiblePackages: [current, next], clients: [{ id: 7, name: 'شريف عثمان' }], expandedClientIds: ['7'], todayKey: '2026-09-13' });
  assert.deepEqual(expanded[0].packages.map(pkg => pkg.id), [11, 12, 10]);
  assert.equal(expanded[0].hiddenCount, 0);
  assert.equal(packageContinuityTag(previous, expanded[0], '2026-09-13').label, 'سجل سابق');
});

test('sold packages and booking entry explain the continuity rule in the interface', async () => {
  const [packagesPage, packageCss, bookingModal, blockConversion, upgradeDialog] = await Promise.all([
    readFile(new URL('../src/erp/PackageWorkbench.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/PackageWorkbench.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/ERPAddBookingModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/BookingBlockConversionForm.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/PackageUpgradeDialog.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(packagesPage, /باقات العميل/);
  assert.match(packagesPage, /أولوية الحجز للباقة الصالحة الأقرب انتهاءً/);
  assert.match(packagesPage, /عرض باقي الباقات/);
  assert.match(packageCss, /package-workbench/);
  assert.match(packageCss, /pw-continuity--priority/);
  assert.match(bookingModal, /الأولوية الآن/);
  assert.match(blockConversion, /الأولوية الآن/);
  assert.match(blockConversion, /setPackageId\(priority/);
  assert.match(upgradeDialog, /تُنشأ باقة جديدة داخل ملف العميل نفسه/);
});
