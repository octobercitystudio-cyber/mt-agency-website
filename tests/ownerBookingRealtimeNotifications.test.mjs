import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

const database = () => JSON.parse(localStorage.getItem('mt_agency_erp_demo_v12'));
const clientInbox = async () => {
  activateDemoMode('client');
  const response = await demoClient.request('/app-notifications?status=all&limit=100', { method: 'GET' });
  assert.equal(response.error, null);
  return response.data.items;
};

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('owner create, reschedule, and delete produce precise client notifications and sync events', async () => {
  const seeded = database(); const pkg = seeded.client_packages.find(item => Number(item.client_id) === 1 && Number(item.service_id) === 101 && item.status === 'active');
  pkg.starts_at = '2026-12-01'; pkg.expires_at = '2027-01-31';
  localStorage.setItem('mt_agency_erp_demo_v12', JSON.stringify(seeded));
  const created = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({
    client_id: 1, service_id: 101, service: 'جلسة متابعة فورية', resource_id: 1,
    date: '2026-12-20', start_time: '20:00', end_time: '21:00', status: 'confirmed',
  }) });
  assert.equal(created.error, null);

  const moved = await demoClient.request(`/bookings/${created.data.id}/admin-reschedule`, { method: 'POST', body: JSON.stringify({
    date: '2026-12-21', start_time: '21:00', end_time: '22:15', resource_id: 1,
  }) });
  assert.equal(moved.error, null);

  const removed = await demoClient.request(`/bookings/${created.data.id}`, { method: 'DELETE' });
  assert.equal(removed.error, null);

  const items = (await clientInbox()).filter(item => Number(item.entity_id) === Number(created.data.id));
  assert.deepEqual(new Set(items.map(item => item.type)), new Set(['booking_created', 'booking_rescheduled', 'booking_deleted']));
  const creation = items.find(item => item.type === 'booking_created');
  const reschedule = items.find(item => item.type === 'booking_rescheduled');
  const deletion = items.find(item => item.type === 'booking_deleted');
  assert.match(creation.message, /جلسة متابعة فورية.*2026-12-20.*8:00 م.*9:00 م/);
  assert.match(reschedule.message, /2026-12-21.*9:00 م.*10:15 م/);
  assert.match(deletion.message, /2026-12-21.*9:00 م.*10:15 م/);
  for (const item of items) {
    assert.equal(item.action_tab, 'schedule');
    assert.equal(Number(item.payload?.booking_id), Number(created.data.id));
  }
  const events = database().change_events.filter(event => Number(event.client_id) === 1);
  assert.ok(events.some(event => event.topic === 'bookings' && Number(event.entity_id) === Number(created.data.id)));
  assert.ok(events.filter(event => event.topic === 'notifications').length >= 3);
});

test('an appointment created with a custom service also reaches the client immediately', async () => {
  const created = await demoClient.request('/projects/custom-service', { method: 'POST', body: JSON.stringify({
    idempotency_key: 'custom-booking-notify-0001', client_id: 1, service_type: 'custom',
    name: 'جلسة مشروع مخصص', starts_at: '2026-12-01', pricing_model: 'custom', paid_amount: 0,
    items: [{ description: 'تنفيذ جلسة', quantity: 1, unit: 'project', unit_price: 100 }],
    milestones: [{ title: 'الإعداد' }, { title: 'التسليم' }], requires_booking: true,
    booking: { resource_id: 1, date: '2026-12-16', start_time: '20:00', end_time: '21:15' },
  }) });
  assert.equal(created.error, null);
  const items = (await clientInbox()).filter(item => item.type === 'booking_created' && Number(item.entity_id) === Number(created.data.booking_id));
  assert.equal(items.length, 1);
  assert.match(items[0].message, /جلسة مشروع مخصص.*2026-12-16.*8:00 م.*9:15 م/);
  assert.equal(Number(items[0].payload?.booking_id), Number(created.data.booking_id));
});

test('production contracts push appointment topics immediately and guard dashboard refresh ordering', async () => {
  const [api, demo, push, sync, dashboard] = await Promise.all([
    load('api/index.php'), load('src/lib/demoDataClient.js'), load('src/lib/pushNotifications.js'),
    load('src/hooks/useChangeSync.js'), load('src/pages/ClientDashboard.jsx'),
  ]);
  assert.match(api, /bookingNotificationMoment/);
  assert.match(api, /'booking_created','تمت إضافة موعد جديد'/);
  assert.match(api, /audit\(\$pdo,\$user,'create','bookings',\$bookingId/);
  assert.match(api, /'sync_topics'=>implode\(',',\$syncTopics\)/);
  assert.match(api, /payload.*booking_id/s);
  assert.match(demo, /demoAudit\(draft, 'create', 'bookings', booking\.id/);
  assert.match(push, /mtPushChange/);
  assert.match(push, /sync_topics/);
  assert.match(sync, /window\.addEventListener\('mtPushChange', onPushChange\)/);
  assert.match(sync, /document\.hidden \? 15000 : 1500/);
  assert.match(dashboard, /clientDataRequestRef/);
  assert.match(dashboard, /requestToken !== clientDataRequestRef\.current/);
  assert.match(dashboard, /clientNotificationsRefresh/);
});
