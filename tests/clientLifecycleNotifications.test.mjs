import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
const databaseKey = 'mt_agency_erp_demo_v12';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

const dateAfter = days => {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const utc = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + days));
  return utc.toISOString().slice(0, 10);
};

const readDatabase = () => JSON.parse(storage.get(databaseKey));
const writeDatabase = database => storage.set(databaseKey, JSON.stringify(database));

test.beforeEach(() => { storage.clear(); activateDemoMode('client'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('client inbox materializes upcoming payment and expiry reminders exactly once with remaining balance', async () => {
  const database = readDatabase(); const pkg = database.client_packages.find(row => Number(row.id) === 201);
  Object.assign(pkg, { purchased_quantity: 10, purchased_minutes: 600, held_quantity: 1, held_minutes: 60, consumed_quantity: 4, consumed_minutes: 240, payment_due_quantity: 5, payment_due_minutes: 300, total_price: '12000.00', overage_amount: '0.00', paid_amount: '6000.00', expires_at: dateAfter(5), status: 'active' });
  database.app_notifications = database.app_notifications.filter(item => !['payment_upcoming', 'payment_due', 'package_expiry_reminder'].includes(item.type)); writeDatabase(database);

  const first = await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' }); assert.equal(first.error, null);
  const upcoming = first.data.items.find(item => item.type === 'payment_upcoming' && Number(item.entity_id) === 201);
  const expiry = first.data.items.find(item => item.type === 'package_expiry_reminder' && Number(item.entity_id) === 201);
  assert.ok(upcoming); assert.match(upcoming.message, /6000\.00 ج\.م/); assert.match(upcoming.message, /1 ساعة/);
  assert.ok(expiry); assert.match(expiry.message, /5 أيام/); assert.match(expiry.message, /5 ساعة/);

  await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' });
  const afterReplay = readDatabase().app_notifications;
  assert.equal(afterReplay.filter(item => item.type === 'payment_upcoming' && Number(item.entity_id) === 201).length, 1);
  assert.equal(afterReplay.filter(item => item.type === 'package_expiry_reminder' && Number(item.entity_id) === 201).length, 1);
});

test('payment due reminder appears at the configured consumption threshold and package start is announced once', async () => {
  let database = readDatabase(); const pkg = database.client_packages.find(row => Number(row.id) === 201);
  Object.assign(pkg, { consumed_quantity: 5, consumed_minutes: 300, payment_due_quantity: 5, payment_due_minutes: 300, total_price: '12000.00', paid_amount: '6000.00', expires_at: dateAfter(20) });
  database.app_notifications = database.app_notifications.filter(item => item.type !== 'payment_due'); writeDatabase(database);
  const due = await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' }); assert.ok(due.data.items.some(item => item.type === 'payment_due' && Number(item.entity_id) === 201));

  database = readDatabase(); const reelPackage = database.client_packages.find(row => Number(row.id) === 202); Object.assign(reelPackage, { starts_at: null, expires_at: null, validity_mode_snapshot: 'rolling', validity_days_snapshot: 14 }); writeDatabase(database);
  activateDemoMode('owner'); const accepted = await demoClient.request('/bookings/306/alternative-decision', { method: 'POST', body: JSON.stringify({ action: 'accept' }) }); assert.equal(accepted.error, null);
  activateDemoMode('client'); const inbox = await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' }); const started = inbox.data.items.filter(item => item.type === 'package_started' && Number(item.entity_id) === 202); assert.equal(started.length, 1); assert.match(started[0].message, /أول موعد تصوير/);
});

test('production lifecycle reminders feed Firebase cron and retain all owner booking/session notification semantics', async () => {
  const api = await load('api/index.php');
  assert.match(api, /function materializePackageLifecycleNotifications/);
  assert.match(api, /package_expiry_reminder/); assert.match(api, /payment_upcoming/); assert.match(api, /payment_due/); assert.match(api, /package_started/);
  assert.match(api, /cron\/push-queue[\s\S]*materializePackageLifecycleNotifications/);
  assert.match(api, /cron\/booking-tick[\s\S]*materializePackageLifecycleNotifications/);
  assert.match(api, /app-notifications'[\s\S]*materializePackageLifecycleNotifications/);
  for (const type of ['booking_confirmed', 'booking_rejected', 'booking_rescheduled', 'booking_cancelled', 'appointment_alternative', 'session_started', 'session_completed', 'package_created']) assert.match(api, new RegExp(type));
  assert.match(api, /INSERT IGNORE INTO app_push_jobs/); assert.match(api, /queuePushNotification/);
});
