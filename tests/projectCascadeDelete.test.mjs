import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const database = () => JSON.parse(storage.get('mt_agency_erp_demo_v12'));
const demo = await import('../src/lib/demoDataClient.js');

test('owner can delete a project package and its dedicated operational and financial records', async () => {
  demo.resetDemoDatabase();
  demo.activateDemoMode('owner');

  const seeded = database();
  seeded.payment_proofs.push({ id: 599, client_id: 1, client_package_id: null, invoice_id: 711, payment_id: null, amount: 250, original_name: 'project-proof.jpg', status: 'pending' });
  seeded.finance.push({ id: 99912, type: 'إيراد', entry_kind: 'income', category: 'client_payment', client_id: 1, amount: 250, detail: 'إثبات دفع للمشروع', date: '2026-09-10', entity: 'الشركة', source_type: 'payment_proof', source_id: 599, is_system: 1 });
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(seeded));
  const before = database();
  assert.ok(before.projects.some(row => Number(row.id) === 1111));
  assert.ok(before.invoices.some(row => Number(row.id) === 711));
  assert.ok(before.payments.some(row => Number(row.id) === 607));
  assert.ok(before.payment_allocations.some(row => Number(row.id) === 6107));
  assert.ok(before.payment_proofs.some(row => Number(row.id) === 599));
  assert.ok(before.finance.some(row => Number(row.id) === 912));
  assert.ok(before.finance.some(row => Number(row.id) === 99912));
  assert.ok(before.bookings.some(row => Number(row.id) === 309));

  const impact = await demo.demoClient.request('/owner/records/projects/1111/impact', { method: 'GET' });
  assert.equal(impact.error, null);
  assert.equal(impact.data.action, 'cascade_delete');
  assert.equal(impact.data.requires_confirmation, true);
  assert.deepEqual(
    { bookings: impact.data.links.bookings, invoices: impact.data.links.invoices, payments: impact.data.links.payments, finance: impact.data.links.finance },
    { bookings: 1, invoices: 1, payments: 1, finance: 2 },
  );
  assert.equal(impact.data.links.proofs, 1);

  const unconfirmed = await demo.demoClient.request('/owner/records/projects/1111/action', {
    method: 'POST',
    body: JSON.stringify({ reason: 'حذف باقة اختبار كاملة', expected_action: 'cascade_delete' }),
  });
  assert.equal(unconfirmed.error?.code, 'hard_delete_confirmation_required');
  assert.ok(database().projects.some(row => Number(row.id) === 1111));

  const removed = await demo.demoClient.request('/owner/records/projects/1111/action', {
    method: 'POST',
    body: JSON.stringify({ reason: 'حذف باقة اختبار كاملة', confirmation: 'حذف', expected_action: 'cascade_delete' }),
  });
  assert.equal(removed.error, null);
  assert.equal(removed.data.action, 'cascade_delete');
  assert.deepEqual(removed.data.deleted_records, { bookings: 1, invoices: 1, payments: 1, payment_proofs: 1, payment_allocations: 1, finance: 2 });

  const after = database();
  const absent = [
    ['projects', 1111], ['invoices', 711], ['payments', 607], ['payment_allocations', 6107], ['payment_proofs', 599], ['finance', 912], ['finance', 99912], ['bookings', 309],
  ];
  for (const [table, id] of absent) assert.equal(after[table].some(row => Number(row.id) === id), false, `${table} ${id} should be deleted`);
  for (const table of ['project_items', 'project_milestones', 'project_tasks', 'content_items']) assert.equal(after[table].some(row => Number(row.project_id) === 1111), false, `${table} should have no project 1111 records`);
  assert.ok(after.projects.some(row => Number(row.id) === 1112));
  assert.ok(after.invoices.some(row => Number(row.id) === 712));
  assert.ok(after.payments.some(row => Number(row.id) === 608));
  assert.ok(after.audit_logs.some(row => row.action === 'owner_cascade_delete' && Number(row.entity_id) === 1111));
  demo.deactivateDemoMode();
});

test('project deletion is owner-only and refuses shared payment records', async () => {
  demo.resetDemoDatabase();
  demo.activateDemoMode('admin');
  const denied = await demo.demoClient.request('/owner/records/projects/1111/impact', { method: 'GET' });
  assert.equal(denied.error?.code, 'forbidden');

  const sharedProof = database();
  sharedProof.payment_proofs.push({ id: 598, client_id: 1, client_package_id: 201, invoice_id: 711, payment_id: null, amount: 1, original_name: 'shared-proof.jpg', status: 'pending' });
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(sharedProof));
  demo.activateDemoMode('owner');
  const proofImpact = await demo.demoClient.request('/owner/records/projects/1111/impact', { method: 'GET' });
  assert.equal(proofImpact.error?.code, 'shared_project_payment_proof');

  demo.resetDemoDatabase();
  const shared = database();
  shared.payment_allocations.push({ id: 99991, client_id: 1, payment_id: 607, payment_proof_id: null, client_package_id: null, invoice_id: 712, amount: 1 });
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(shared));
  const impact = await demo.demoClient.request('/owner/records/projects/1111/impact', { method: 'GET' });
  assert.equal(impact.error?.code, 'shared_project_payment');
  const after = database();
  assert.ok(after.projects.some(row => Number(row.id) === 1111));
  assert.ok(after.invoices.some(row => Number(row.id) === 711));
  assert.ok(after.payments.some(row => Number(row.id) === 607));
  demo.deactivateDemoMode();
});

test('projects screen and server expose the reviewed transactional cascade action', async () => {
  const [projects, dialog, api] = await Promise.all([
    load('src/erp/ERPProjects.jsx'),
    load('src/erp/OwnerActionDialog.jsx'),
    load('api/index.php'),
  ]);
  assert.match(projects, /actionLabel="حذف الباقة وسجلاتها"/);
  assert.match(dialog, /cascade_delete:\s*\{ label: 'حذف المشروع وسجلاته'/);
  assert.match(api, /function ownerDeleteProjectCascade/);
  assert.match(api, /requireRole\(\$user,\['owner'\]\)/);
  assert.match(api, /\$pdo->beginTransaction\(\)/);
  assert.match(api, /DELETE FROM payment_allocations/);
  assert.match(api, /DELETE FROM payment_proofs/);
  assert.match(api, /DELETE FROM payments/);
  assert.match(api, /DELETE FROM invoices/);
  assert.match(api, /DELETE FROM finance/);
  assert.match(api, /shared_project_payment/);
  assert.match(api, /if\(\$pdo->inTransaction\(\)\)\$pdo->rollBack\(\)/);
});
