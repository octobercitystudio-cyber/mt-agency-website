import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('global owner actions require impact review, reason, and typed hard-delete confirmation', async () => {
  const [dialog, actions, permissions] = await Promise.all([
    load('src/erp/OwnerActionDialog.jsx'),
    load('src/erp/OwnerRecordActions.jsx'),
    load('src/erp/ownerPermissions.js'),
  ]);
  assert.match(dialog, /\/owner\/records\/\$\{entity\}\/\$\{record\.id\}\/impact/);
  assert.match(dialog, /reason/);
  assert.match(dialog, /حذف/);
  assert.match(actions, /isOwner\(user\)/);
  for (const entity of ['clients', 'bookings', 'client_packages', 'projects', 'offers', 'invoices', 'users', 'resources']) assert.match(permissions, new RegExp(`['"]${entity}['"]`));
});

test('server and migration preserve linked history and expose owner-only safe actions', async () => {
  const [api, migration] = await Promise.all([load('api/index.php'), load('database/mysql/017_owner_global_record_controls.sql')]);
  assert.ok(api.includes("#^/owner/records/([a-z_]+)/([0-9]+)/impact$#"));
  assert.ok(api.includes("#^/owner/records/([a-z_]+)/([0-9]+)/action$#"));
  assert.match(api, /owner_action_required/);
  assert.match(api, /last_owner_protected/);
  assert.match(api, /formation-fund\/entries\/\(\\d\+\)\/correct/);
  assert.match(api, /social-profits\/\(\\d\+\)\/correct/);
  assert.match(api, /owner_update_offer/);
  assert.match(api, /owner_update_invoice_metadata/);
  assert.match(migration, /corrected_from_id/);
  assert.match(migration, /archive_reason/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN)\b/i);
});

test('listed ERP screens expose coherent owner controls and audited correction entry points', async () => {
  const files = await Promise.all([
    'ERPClientCRM.jsx', 'ERPBookings.jsx', 'ERPProjects.jsx', 'ERPReminders.jsx', 'ERPSettings.jsx', 'ERPOfferGenerator.jsx',
  ].map(file => load(`src/erp/${file}`)));
  for (const source of files) assert.match(source, /OwnerRecordActions/);
  assert.match(await load('src/erp/ERPClients.jsx'), /OwnerActionDialog/);
  const [formation, social, offers] = await Promise.all([load('src/erp/ERPFormationFund.jsx'), load('src/erp/ERPSocialProfits.jsx'), load('src/erp/ERPOfferGenerator.jsx')]);
  assert.match(formation, /formation-fund\/entries\/\$\{entry\.id\}\/correct/);
  assert.match(formation, /تعديل بقيد تصحيح/);
  assert.match(social, /social-profits\/\$\{entry\.id\}\/correct/);
  assert.match(social, /تعديل بقيد تصحيح/);
  assert.match(offers, /entity="offers"/);
  assert.match(offers, /entity="invoices"/);
});

test('demo API enforces owner-only offer and invoice corrections', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  activateDemoMode('admin');
  const created = await demoClient.request('/offers', { method: 'POST', body: JSON.stringify({ client_id: 101, title: 'عرض اختبار', discount: 0, items: [{ description: 'خدمة اختبار', quantity: 1, unit: 'project', unit_price: 100 }] }) });
  assert.equal(created.error, null);
  const denied = await demoClient.request(`/offers/${created.data.id}`, { method: 'PATCH', body: JSON.stringify({ client_id: 101, title: 'تعديل مرفوض', reason: 'اختبار صلاحية غير المالك', items: [{ description: 'خدمة', quantity: 1, unit: 'project', unit_price: 100 }] }) });
  assert.equal(denied.error?.code, 'forbidden');
  activateDemoMode('owner');
  const corrected = await demoClient.request(`/offers/${created.data.id}`, { method: 'PATCH', body: JSON.stringify({ client_id: 101, title: 'تعديل مالك', reason: 'تصحيح موثق للعرض', items: [{ description: 'خدمة', quantity: 2, unit: 'project', unit_price: 100 }] }) });
  assert.equal(corrected.error, null);
  assert.equal(corrected.data.total, 200);
  deactivateDemoMode();
});

test('demo generic DELETE rejects the complete sensitive child/history matrix for every write role', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  const protectedMatrix = ['project_tasks', 'project_items', 'project_milestones', 'content_items', 'reminders', 'reschedule_requests', 'attendance_adjustments', 'booking_status_history', 'booking_sessions', 'package_usage_ledger', 'payment_allocations', 'offer_items', 'invoice_items', 'audit_logs'];
  for (const role of ['admin', 'operations', 'staff', 'finance']) {
    activateDemoMode(role);
    for (const table of protectedMatrix) await assert.rejects(Promise.resolve(demoClient.from(table).delete().eq('id', -1)), error => error?.code === 'owner_action_required', `${role} must not hard-delete ${table}`);
  }
  deactivateDemoMode();
});

test('demo project milestones use owner impact/action and preserve progressed stage history', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const { data: stages } = await demoClient.from('project_milestones').select('*');
  const progressed = stages.find(stage => stage.status === 'completed');
  const impact = await demoClient.request(`/owner/records/project_milestones/${progressed.id}/impact`, { method: 'GET' });
  assert.equal(impact.error, null); assert.equal(impact.data.action, 'archive');
  const action = await demoClient.request(`/owner/records/project_milestones/${progressed.id}/action`, { method: 'POST', body: JSON.stringify({ reason: 'حفظ تاريخ المرحلة المكتملة', expected_action: 'archive', version: progressed.version ?? null }) });
  assert.equal(action.error, null); assert.equal(action.data.action, 'archive');
  const { data: after } = await demoClient.from('project_milestones').select('*').eq('id', progressed.id).single();
  assert.ok(after.archived_at); assert.equal(after.status, 'completed');
  const direct = await demoClient.request(`/project-milestones/${stages[1].id}`, { method: 'DELETE' });
  assert.equal(direct.error?.code, 'owner_action_required');
  deactivateDemoMode();
});

test('demo attendance adjustment correction is atomic, audited and exact-once on retry', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const created = await demoClient.request('/attendance/adjustments', { method: 'POST', body: JSON.stringify({ user_id: 3, month: '2026-08', amount: 100, minutes: 15, reason: 'تسوية حضور أصلية للاختبار' }) });
  assert.equal(created.error, null);
  const payload = { amount: 75.25, minutes: 10, entry_reason: 'التسوية البديلة الصحيحة', correction_reason: 'تصحيح قيمة التسوية الأصلية' };
  const first = await demoClient.request(`/attendance/adjustments/${created.data.id}/correct`, { method: 'POST', body: JSON.stringify(payload) });
  const retry = await demoClient.request(`/attendance/adjustments/${created.data.id}/correct`, { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(first.error, null); assert.equal(first.data.idempotent, false); assert.equal(retry.error, null); assert.equal(retry.data.idempotent, true); assert.equal(retry.data.replacement_id, first.data.replacement_id);
  const { data: original } = await demoClient.from('attendance_adjustments').select('*').eq('id', created.data.id).single();
  const { data: replacement } = await demoClient.from('attendance_adjustments').select('*').eq('id', first.data.replacement_id).single();
  assert.ok(original.voided_at); assert.equal(original.replacement_adjustment_id, replacement.id); assert.equal(Number(replacement.amount), 75.25);
  const { data: audits } = await demoClient.from('audit_logs').select('*').eq('entity_type', 'attendance_adjustments').eq('entity_id', created.data.id);
  assert.ok(audits.some(row => row.action === 'correct' && row.before_data && row.after_data));
  deactivateDemoMode();
});

test('demo formation and social corrections return their existing replacement on retry', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const socialPayload = { reason: 'تصحيح قيد أرباح مكرر', platform: 'youtube', amount: '12000.50', receipt_date: '2026-08-01', earning_year: 2026, earning_month: 7, channel_name: 'MT Agency Studio', payout_reference: 'RETRY-YT', note: '' };
  const socialFirst = await demoClient.request('/social-profits/3201/correct', { method: 'POST', body: JSON.stringify(socialPayload) });
  const socialRetry = await demoClient.request('/social-profits/3201/correct', { method: 'POST', body: JSON.stringify(socialPayload) });
  assert.equal(socialFirst.error, null); assert.equal(socialRetry.error, null); assert.equal(socialRetry.data.idempotent, true); assert.equal(socialRetry.data.replacement_id, socialFirst.data.replacement_id);
  const fundPayload = { reason: 'تصحيح قيمة مساهمة التأسيس', founder_id: 1, amount: 150001, title: 'مساهمة رأس المال المصححة', category: 'capital', payment_method: 'تحويل بنكي', reference: 'RETRY-FUND', entry_date: '2026-08-01', note: '' };
  const fundFirst = await demoClient.request('/formation-fund/entries/3001/correct', { method: 'POST', body: JSON.stringify(fundPayload) });
  const fundRetry = await demoClient.request('/formation-fund/entries/3001/correct', { method: 'POST', body: JSON.stringify(fundPayload) });
  assert.equal(fundFirst.error, null); assert.equal(fundRetry.error, null); assert.equal(fundRetry.data.idempotent, true); assert.equal(fundRetry.data.replacement_id, fundFirst.data.replacement_id);
  deactivateDemoMode();
});

test('demo last-owner protection and accepted-offer cancellation preserve commercial history', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const firstOwner = await demoClient.request('/owner/records/users/1/action', { method: 'POST', body: JSON.stringify({ reason: 'تعطيل مالك تجريبي مع بقاء بديل', expected_action: 'deactivate' }) });
  assert.equal(firstOwner.error, null);
  const lastOwner = await demoClient.request('/owner/records/users/2/action', { method: 'POST', body: JSON.stringify({ reason: 'محاولة تعطيل آخر مالك نشط', expected_action: 'deactivate' }) });
  assert.equal(lastOwner.error?.code, 'last_owner_protected');
  const { data: invoicesBefore } = await demoClient.from('invoices').select('*').eq('offer_id', 803);
  const offerImpact = await demoClient.request('/owner/records/offers/803/impact', { method: 'GET' });
  const offerAction = await demoClient.request('/owner/records/offers/803/action', { method: 'POST', body: JSON.stringify({ reason: 'إلغاء عرض مقبول مع حفظ الفاتورة', expected_action: offerImpact.data.action }) });
  assert.equal(offerAction.error, null); assert.equal(offerAction.data.action, 'cancel');
  const { data: invoicesAfter } = await demoClient.from('invoices').select('*').eq('offer_id', 803);
  assert.equal(invoicesAfter.length, invoicesBefore.length);
  deactivateDemoMode();
});

test('migration 017 guards every repeatable column/index/constraint mutation', async () => {
  const migration = await load('database/mysql/017_owner_global_record_controls.sql');
  assert.match(migration, /information_schema\.COLUMNS/); assert.match(migration, /information_schema\.STATISTICS/); assert.match(migration, /information_schema\.TABLE_CONSTRAINTS/);
  assert.doesNotMatch(migration.replace(/CREATE PROCEDURE[\s\S]*?DELIMITER ;/, ''), /^\s*ALTER TABLE/gm);
  for (const entity of ['project_milestones', 'attendance_adjustments', 'formation_fund_entries', 'social_profit_entries']) assert.match(migration, new RegExp(`mta_add_(?:column|index|constraint)\\('${entity}'`));
});
