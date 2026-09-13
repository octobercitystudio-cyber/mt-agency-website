import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { addBusinessMonths, businessDateTimeStorage, cairoDateKey } from '../src/lib/businessFormat.js';

const root = new URL('../', import.meta.url);
const storage = new Map();
const databaseKey = 'mt_agency_erp_demo_v12';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

const readDatabase = () => JSON.parse(storage.get(databaseKey));
const writeDatabase = database => storage.set(databaseKey, JSON.stringify(database));
const todayAt = time => `${cairoDateKey()} ${time}`;

test.beforeEach(() => { storage.clear(); activateDemoMode('owner'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('operational package alerts use the sold package and its client IDs as the authority', async () => {
  const database = readDatabase();
  const pkg = database.client_packages.find(row => Number(row.id) === 201);
  Object.assign(pkg, { status: 'active', purchased_quantity: 10, purchased_minutes: 600, consumed_quantity: 5, consumed_minutes: 300, held_quantity: 1, held_minutes: 60, payment_due_quantity: 5, payment_due_minutes: 300, total_price: '10000.00', overage_amount: '500.00', paid_amount: '2500.00' });
  database.services.find(row => Number(row.id) === Number(pkg.service_id)).price = 999999;
  database.bookings.filter(row => Number(row.client_package_id) === 201).forEach(row => { row.client_name = 'اسم غير صحيح داخل حجز قديم'; row.service = 'خدمة قديمة'; row.actual_seconds = 999999; });
  writeDatabase(database);

  const { data, error } = await demoClient.request('/operational-alerts', { method: 'GET' });
  assert.equal(error, null);
  const payment = data.items.find(item => item.type === 'package_payment_due' && Number(item.package_id) === 201);
  assert.ok(payment);
  assert.equal(payment.client_id, 1);
  assert.equal(payment.client_name, 'سارة أحمد');
  assert.equal(payment.package_name, pkg.name);
  assert.equal(payment.amount, '8000.00');
  assert.match(payment.message, /8000\.00 ج\.م/);
  assert.doesNotMatch(payment.message, /999999|اسم غير صحيح|خدمة قديمة/);
});

test('reminders, project tasks, and deliveries retain their trusted client and package links', async () => {
  const database = readDatabase();
  const project = database.projects.find(row => Number(row.id) === 1101);
  project.client_package_id = 201;
  const task = database.project_tasks.find(row => Number(row.id) === 1202);
  Object.assign(task, { assigned_to: 4, due_at: todayAt('23:55:00'), status: 'in_progress' });
  database.reminders.push({ id: 1099, title: 'مراجعة عقد العميل', due_date: '2000-01-01 12:00:00', notify_before: 60, type: 'مهمة', status: 'pending', amount: '125.50' });
  const booking = database.bookings.find(row => Number(row.client_package_id) === 201);
  Object.assign(booking, { project_id: 1101, delivery_date: cairoDateKey(), status: 'confirmed', client_name: 'اسم قديم غير موثوق' });
  writeDatabase(database);

  const { data } = await demoClient.request('/operational-alerts', { method: 'GET' });
  const taskAlert = data.items.find(item => item.type === 'project_task' && Number(item.entity_id) === 1202);
  const reminderAlert = data.items.find(item => item.type === 'reminder' && Number(item.entity_id) === 1099);
  const deliveryAlert = data.items.find(item => item.type === 'delivery' && Number(item.entity_id) === Number(booking.id));
  assert.deepEqual([taskAlert.client_id, taskAlert.package_id, taskAlert.project_id], [1, 201, 1101]);
  assert.equal(taskAlert.client_name, 'سارة أحمد');
  assert.equal(taskAlert.package_name, database.client_packages.find(row => Number(row.id) === 201).name);
  assert.equal(reminderAlert.amount, '125.50');
  assert.equal(reminderAlert.action_tab, 'reminders');
  assert.equal(deliveryAlert.client_name, 'سارة أحمد');
  assert.equal(deliveryAlert.package_id, 201);
  assert.equal(deliveryAlert.project_id, 1101);
});

test('staff receive only tasks assigned to their own user and no financial package alerts', async () => {
  const database = readDatabase();
  database.project_tasks.find(row => Number(row.id) === 1202).due_at = '2000-01-01 12:00:00';
  database.project_tasks.find(row => Number(row.id) === 1203).due_at = '2000-01-01 12:00:00';
  writeDatabase(database);
  activateDemoMode('staff', 4);
  const { data, error } = await demoClient.request('/operational-alerts', { method: 'GET' });
  assert.equal(error, null);
  const taskIds = data.items.filter(item => item.type === 'project_task').map(item => Number(item.entity_id));
  assert.ok(taskIds.includes(1202));
  assert.ok(!taskIds.includes(1203));
  assert.ok(!data.items.some(item => item.type.startsWith('package_payment')));
});

test('reminder date storage preserves Cairo wall time and monthly recurrence clamps month end', () => {
  assert.equal(businessDateTimeStorage('2026-09-13T18:30'), '2026-09-13 18:30:00');
  assert.equal(addBusinessMonths('2026-01-31 18:30:00', 1), '2026-02-28 18:30:00');
  assert.equal(businessDateTimeStorage('2026-02-31T18:30'), '');
});

test('production endpoint reads sold packages directly and exposes trusted linked records', async () => {
  const api = await readFile(new URL('../api/index.php', import.meta.url), 'utf8');
  assert.match(api, /function operationalAlerts[\s\S]*FROM client_packages cp JOIN clients c/);
  assert.match(api, /project_tasks t JOIN projects p[\s\S]*LEFT JOIN client_packages cp/);
  assert.match(api, /FROM bookings b JOIN clients c[\s\S]*b\.client_package_id/);
  assert.match(api, /\$path === '\/operational-alerts'/);
});
