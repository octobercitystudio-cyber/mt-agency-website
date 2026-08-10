import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
const inbox = async (status = 'all', limit = 50, cursor = null) => (await demoClient.request(`/app-notifications?status=${status}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, { method: 'GET' })).data;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

test.beforeEach(() => { storage.clear(); activateDemoMode('client'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('client notification list is client/audience scoped and returns only the safe contract', async () => {
  const response = await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' });
  assert.equal(response.error, null);
  assert.equal(response.data.items.length, 4);
  assert.equal(response.data.unread_count, 3);
  assert.deepEqual(new Set(response.data.items.map(item => item.entity_type)), new Set(['client_packages', 'bookings', 'projects', 'payment_proofs']));
  const serialized = JSON.stringify(response.data);
  for (const hidden of ['dedupe_key', 'source_event_key', 'recipient_user_id', 'audience', 'client_id', 'organization_id', 'internal_note', 'before_data', 'after_data', 'file_path', 'created_by']) assert.equal(serialized.includes(hidden), false, `${hidden} must stay private`);
  assert.equal(serialized.includes('عرض خاص بعميل آخر'), false);
  assert.equal(serialized.includes('عميل تجاوز ساعات الدفع'), false);
});

test('read, bounded read-all, dismiss, and cross-device notification events preserve newer unread updates', async () => {
  const initial = (await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' })).data;
  const boundary = Math.max(...initial.items.map(item => Number(item.id)));
  activateDemoMode('owner');
  const update = await demoClient.request('/client-packages/201', { method: 'PATCH', body: JSON.stringify({ expires_at: '2027-12-31', reason: 'تحديث الصلاحية للعميل' }) });
  assert.equal(update.error, null);
  activateDemoMode('client');
  const marked = await demoClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary }) });
  assert.ok(marked.data.changed >= 1);
  let unread = (await demoClient.request('/app-notifications?status=unread&limit=50', { method: 'GET' })).data;
  assert.equal(unread.items.length, 1, 'the notification created after up_to_id must remain unread');
  const fresh = unread.items[0];
  await demoClient.request(`/app-notifications/${fresh.id}/read`, { method: 'POST', body: '{}' });
  unread = (await demoClient.request('/app-notifications?status=unread&limit=50', { method: 'GET' })).data;
  assert.equal(unread.items.length, 0);
  await demoClient.request(`/app-notifications/${fresh.id}/dismiss`, { method: 'POST', body: '{}' });
  const all = (await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' })).data;
  assert.equal(all.items.some(item => Number(item.id) === Number(fresh.id)), false);
  const database = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12'));
  assert.ok(database.change_events.some(event => event.topic === 'notifications' && event.action === 'created'));
  assert.ok(database.change_events.some(event => event.topic === 'notifications' && event.action === 'read_all'));
  assert.ok(database.change_events.some(event => event.topic === 'notifications' && event.action === 'dismissed'));
});

test('each committed source event stays distinct even when later updates keep the same status', async () => {
  activateDemoMode('owner');
  const patch = expires_at => demoClient.request('/client-packages/201', { method: 'PATCH', body: JSON.stringify({ status: 'active', expires_at, reason: 'تحديث ظاهر للعميل' }) });
  await patch('2027-10-01'); await patch('2027-10-01'); await patch('2027-11-01');
  activateDemoMode('client');
  const { data } = await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' });
  const generated = data.items.filter(item => item.type === 'package_balance_updated' && Number(item.id) > 1510);
  assert.equal(generated.length, 3, 'separate committed changes must never collapse because their final payload happens to match');
  assert.equal(new Set(generated.map(item => item.id)).size, 3);
});

test('failed studio settlement rolls back its notification and a successful idempotent replay inserts only once', async () => {
  activateDemoMode('owner');
  const start = await demoClient.request('/bookings/301/session/start', { method: 'POST' }); assert.equal(start.error, null);
  const preview = await demoClient.request('/bookings/301/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: 300 }) }); assert.equal(preview.error, null);
  const before = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')).app_notifications.length;
  const base = { actual_minutes: 300, idempotency_key: 'notification-rollback-001', expected_session_version: preview.data.session_version, settlement: { mode: 'waive', internal_reason: 'تجربة تراجع المعاملة بأمان' } };
  const failed = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ ...base, preview_hash: 'invalid-preview-hash' }) });
  assert.ok(failed.error);
  assert.equal(JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')).app_notifications.length, before);
  const success = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ ...base, preview_hash: preview.data.preview_hash }) }); assert.equal(success.error, null);
  const afterSuccess = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')).app_notifications.length; assert.equal(afterSuccess, before + 1);
  const replay = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ ...base, preview_hash: preview.data.preview_hash }) }); assert.equal(replay.error, null);
  assert.equal(JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')).app_notifications.length, afterSuccess);
});

test('owner offer send and client acceptance each create one exact client notification', async () => {
  activateDemoMode('owner');
  const created = await demoClient.request('/offers', { method: 'POST', body: JSON.stringify({ client_id: 1, title: 'عرض إشعارات تجريبي', valid_until: '2026-12-31', items: [{ description: 'تصوير إعلان', quantity: 1, unit: 'project', unit_price: 2500 }] }) });
  assert.equal(created.error, null);
  const sent = await demoClient.request(`/offers/${created.data.id}/send`, { method: 'POST', body: '{}' }); assert.equal(sent.error, null);
  activateDemoMode('client');
  let rows = (await inbox()).items.filter(item => Number(item.entity_id) === Number(created.data.id));
  assert.deepEqual(rows.map(item => item.type), ['offer_sent']);
  const accepted = await demoClient.request(`/offers/${created.data.id}/accept`, { method: 'POST', body: '{}' }); assert.equal(accepted.error, null);
  rows = (await inbox()).items.filter(item => Number(item.entity_id) === Number(created.data.id));
  assert.deepEqual(rows.map(item => item.type).sort(), ['offer_accepted', 'offer_sent']);
});

test('trusted milestone visibility suppresses hidden work and notifies visible transitions and completion', async () => {
  activateDemoMode('owner');
  const hidden = await demoClient.request('/projects/1101/milestones', { method: 'POST', body: JSON.stringify({ title: 'مرحلة داخلية سرية', is_client_visible: false }) }); assert.equal(hidden.error, null);
  await demoClient.request(`/project-milestones/${hidden.data.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'in_progress' }) });
  activateDemoMode('client');
  assert.equal((await inbox()).items.some(item => Number(item.entity_id) === Number(hidden.data.id)), false);
  activateDemoMode('owner');
  await demoClient.request(`/project-milestones/${hidden.data.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'مرحلة ظاهرة', is_client_visible: true }) });
  await demoClient.request(`/project-milestones/${hidden.data.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'completed' }) });
  activateDemoMode('client');
  let rows = (await inbox()).items.filter(item => Number(item.entity_id) === Number(hidden.data.id)); assert.equal(rows.length, 2); assert.ok(rows.every(item => item.type === 'project_progress'));
  activateDemoMode('owner');
  await demoClient.request(`/project-milestones/${hidden.data.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'مرحلة أعيد إخفاؤها', is_client_visible: false }) });
  activateDemoMode('client'); rows = (await inbox()).items.filter(item => Number(item.entity_id) === Number(hidden.data.id)); assert.equal(rows.length, 2);
});

test('alternative proposal, cancellation rejection, and session start use their exact public semantics', async () => {
  activateDemoMode('owner');
  const created = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 1, service_id: 101, service: 'جلسة إشعارات', resource_id: 1, date: '2026-12-20', start_time: '18:00', end_time: '19:00' }) }); assert.equal(created.error, null);
  await demoClient.request(`/bookings/${created.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'alternative', date: '2026-12-21', start_time: '19:00', end_time: '20:00' }) });
  const database = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')); const booking = database.bookings.find(row => Number(row.id) === 306); booking.status = 'cancel_requested'; localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(database));
  await demoClient.request('/bookings/306/cancel-decision', { method: 'POST', body: JSON.stringify({ approve: false }) });
  const start = await demoClient.request('/bookings/301/session/start', { method: 'POST', body: '{}' }); assert.equal(start.error, null);
  activateDemoMode('client'); const types = (await inbox()).items.map(item => item.type); assert.ok(types.includes('appointment_alternative')); assert.ok(types.includes('cancellation_rejected')); assert.ok(types.includes('session_started'));
});

test('project creation, proof review, payment correction, and overage move produce client-safe mapped updates', async () => {
  activateDemoMode('owner');
  const project = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({ idempotency_key: 'notification-project-001', client_id: 1, service_type: 'custom', name: 'مشروع إشعارات', starts_at: '2026-08-10', pricing_model: 'custom', paid_amount: 0, items: [{ description: 'تنفيذ', quantity: 1, unit: 'project', unit_price: 100 }], milestones: [{ title: 'الإعداد' }, { title: 'التسليم' }], requires_booking: false }) }); assert.equal(project.error, null);
  activateDemoMode('client'); const proof = await demoClient.request('/payment-proofs', { method: 'POST', body: JSON.stringify({ client_id: 1, client_package_id: 201, amount: 100 }) }); assert.equal(proof.error, null);
  activateDemoMode('owner'); await demoClient.request(`/payment-proofs/${proof.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'reject', note: 'البيانات غير واضحة' }) });
  const correction = await demoClient.request('/payments/603/correct', { method: 'POST', body: JSON.stringify({ amount: 4100, reason: 'تصحيح قيمة التحويل', method: 'bank_transfer' }) }); assert.equal(correction.error, null);
  const start = await demoClient.request('/bookings/301/session/start', { method: 'POST', body: '{}' }); assert.equal(start.error, null);
  const preview = await demoClient.request('/bookings/301/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: 300 }) }); assert.ok(preview.data.excess_minutes > 0);
  const complete = await demoClient.request('/bookings/301/session/complete', { method: 'POST', body: JSON.stringify({ actual_minutes: 300, idempotency_key: 'notification-overage-001', expected_session_version: preview.data.session_version, preview_hash: preview.data.preview_hash, settlement: { mode: 'new_package', service_id: 103, name: 'باقة تسوية', purchased_minutes: 60, validity_days: 30, total_price: 1000, initial_paid: 0 } }) }); assert.equal(complete.error, null);
  activateDemoMode('client'); const types = (await inbox()).items.map(item => item.type); for (const type of ['project_created', 'payment_proof_rejected', 'payment_corrected', 'overage_moved']) assert.ok(types.includes(type), `${type} must be emitted`);
});

test('cursor pagination returns 50 plus older items without cross-client leakage', async () => {
  const database = JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12')); const next = Math.max(...database.app_notifications.map(item => Number(item.id))) + 1;
  for (let index = 0; index < 55; index += 1) database.app_notifications.push({ id: next + index, client_id: 1, audience: 'client', type: 'package_balance_updated', title: `تحديث ${index}`, message: 'تحديث آمن', entity_type: 'client_packages', entity_id: 201, severity: 'info', action_tab: 'home', read_at: null, dismissed_at: null, created_at: new Date().toISOString() });
  database.app_notifications.push({ id: next + 100, client_id: 2, audience: 'client', type: 'private', title: 'خاص', message: 'لا يظهر', entity_type: 'projects', entity_id: 999, created_at: new Date().toISOString() }); localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(database));
  const first = await inbox('all', 50); assert.equal(first.items.length, 50); assert.ok(first.next_cursor); const second = await inbox('all', 50, first.next_cursor); assert.ok(second.items.length >= 9); assert.equal([...first.items, ...second.items].some(item => item.type === 'private'), false);
});

test('production notification contract keeps source-event identity, safe response fields, and client sync isolation', async () => {
  const [api, migration] = await Promise.all([load('api/index.php'), load('database/mysql/020_client_notification_center.sql')]);
  assert.match(api, /function notifyClientChange\(/);
  assert.match(api, /notifyClientChange\(\$pdo,\$user,\$action,\$entityType,\$entityId,\$before,\$after,\$sourceEventId\)/);
  assert.match(api, /change-event:'\.\$sourceEventId/);
  assert.match(api, /INSERT IGNORE INTO app_notifications/);
  assert.match(api, /if\(\$stmt->rowCount\(\)!==1\)\{if\(\$ownTransaction\)\$pdo->commit\(\);return false;\}/);
  assert.match(api, /recordChangeEvent\(\$pdo,\$organizationId,\$clientId,'notifications'/);
  for (const hidden of ["'dedupe_key'", "'source_event_key'", "'recipient_user_id'", "'before_data'", "'after_data'"]) {
    const endpoint = api.slice(api.indexOf("if ($path === '/app-notifications'"), api.indexOf("if ($path === '/social-profits'"));
    assert.equal(endpoint.includes(hidden), false, `${hidden} must not be in the client response contract`);
  }
  assert.match(api, /topic='services'/);
  assert.doesNotMatch(api, /topic IN \('services','offers'\)/);
  assert.match(api, /app-notifications\/read-all/);
  assert.match(api, /app-notifications\/\(\\d\+\)\/dismiss/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /source_event_key/);
  assert.match(migration, /idx_app_notifications_client_cursor/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN)\b/i);
});

test('notification center UI covers badge, filters, navigation, offline retention, focus return, and all states', async () => {
  const [view, css, dashboard, dialog] = await Promise.all([
    load('src/pages/ClientNotifications.jsx'), load('src/pages/ClientNotifications.css'), load('src/pages/ClientDashboard.jsx'), load('src/hooks/useModalDialog.js'),
  ]);
  assert.match(view, /unreadCount > 99 \? '99\+' : unreadCount/);
  assert.match(view, /aria-expanded=\{open\}/);
  assert.match(view, /aria-controls="client-notification-center"/);
  assert.match(view, /role="dialog" aria-modal="true"/);
  assert.match(view, /غير المقروء/);
  assert.match(view, /تعليم الكل كمقروء/);
  assert.match(view, /اليوم.*أمس.*الأقدم/s);
  assert.match(view, /destinationFor\(item\)/);
  assert.match(view, /localStorage\.setItem\(cacheKey\(clientId\)/);
  assert.match(view, /آخر نسخة محفوظة/);
  assert.match(view, /client-notifications__skeleton/);
  assert.match(view, /لا توجد إشعارات/);
  assert.match(view, /إعادة المحاولة/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /triggerRef\.current\?\.focus/);
  assert.match(dashboard, /<ClientNotifications key=\{clientId\} clientId=\{clientId\} onNavigate=\{setActiveTab\}\/>/);
  assert.match(css, /min-width:44px/);
  assert.match(css, /@media\(max-width:800px\)/);
  assert.doesNotMatch(css, /background:\s*#fff/i);
});
