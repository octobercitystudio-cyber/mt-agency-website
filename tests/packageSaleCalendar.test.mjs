import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { cairoAppointmentNowKey, packageAppointmentUsage, packageCalendarWeek, partitionPackageAppointments, shiftPackageCalendarDate, validatePackageAppointment } from '../src/lib/packageSaleAppointments.js';
import { templateToPackageDraft } from '../src/lib/clientPackageDraft.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const futureBookableDate = (days = 30) => {
  let date = shiftPackageCalendarDate(cairoAppointmentNowKey().slice(0, 10), days);
  while (new Date(`${date}T12:00:00`).getDay() === 5) date = shiftPackageCalendarDate(date, 1);
  return date;
};
const browserGlobals = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};

test('appointment helper separates studio duration from reel usage and catches overlaps', () => {
  const first = { resource_id: 1, date: '2026-08-20', start_time: '12:00', end_time: '13:30', requested_quantity: 2 };
  const second = { resource_id: 1, date: '2026-08-20', start_time: '13:00', end_time: '14:00', requested_quantity: 3 };
  assert.deepEqual(packageAppointmentUsage([first], 'hour', 4), { selected: 1.5, remaining: 2.5, exceeded: false });
  assert.deepEqual(packageAppointmentUsage([first, second], 'reel', 4), { selected: 5, remaining: 0, exceeded: true });
  assert.equal(validatePackageAppointment(second, { unit: 'reel', startsAt: '2026-08-10', expiresAt: '2026-09-10', appointments: [first] }).conflict.length > 0, true);
  assert.equal(validatePackageAppointment({ ...first, date: '2026-08-21' }, { shootingDate: '2026-08-20' }).date.length > 0, true);
});

test('past appointments are rejected and the compact calendar exposes week availability', () => {
  const past = { resource_id: 1, date: '2026-08-10', start_time: '12:00', end_time: '13:00' };
  assert.equal(validatePackageAppointment(past, { startsAt: '2026-08-01', expiresAt: '2026-08-31', nowKey: '2026-08-10 18:57' }).past, 'لا يمكن إضافة موعد في وقت ماضٍ.');
  const days = packageCalendarWeek('2026-08-20', { startsAt: '2026-08-10', expiresAt: '2026-09-10', resourceId: 1, todayKey: '2026-08-10', occupied: [{ resource_id: 1, date: '2026-08-20', status: 'confirmed' }], appointments: [{ resource_id: 1, date: '2026-08-21' }] });
  assert.equal(days.length, 7); assert.equal(days.find(day => day.date === '2026-08-20')?.occupiedCount, 1); assert.equal(days.find(day => day.date === '2026-08-21')?.plannedCount, 1);
  const plan = [{ date: '2026-08-12' }, { date: '2026-10-01' }];
  assert.deepEqual(partitionPackageAppointments(plan, { starts_at: '2026-08-10', validity_mode_snapshot: 'rolling' }, '2026-09-10'), { kept: [plan[0]], invalid: [plan[1]] });
});

test('demo rejects a past package appointment without mutating storage', async () => {
  const storage = browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const service = (await demoClient.from('services').select('*')).data.find(item => ['hour', 'day', 'month'].includes(item.billing_unit) && Number(item.total_hours) >= 2);
  const todayKey = cairoAppointmentNowKey().slice(0, 10); const pastDate = shiftPackageCalendarDate(todayKey, -1);
  const draft = templateToPackageDraft(service, { clientId: 1, startsAt: pastDate });
  const before = storage.get('mt_agency_erp_demo_v12');
  const result = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, starts_at: pastDate, expires_at: '', bookings: [{ resource_id: 1, date: pastDate, start_time: '12:00', end_time: '13:00' }], idempotency_key: 'calendar-sale-past-no-write' }) });
  assert.equal(result.error?.code, 'booking_in_past'); assert.equal(storage.get('mt_agency_erp_demo_v12'), before);
  deactivateDemoMode();
});

test('demo sale atomically creates multiple confirmed bookings, exact holds and replays ids', async () => {
  const storage = browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const services = (await demoClient.from('services').select('*')).data;
  const service = services.find(item => ['hour', 'day', 'month'].includes(item.billing_unit) && Number(item.total_hours) >= 3);
  const bookingDate = futureBookableDate(40);
  const rollbackDate = futureBookableDate(43);
  const draft = templateToPackageDraft(service, { clientId: 1, startsAt: bookingDate });
  const body = { ...draft, paid_amount: 100, idempotency_key: 'calendar-sale-multi-001', bookings: [
    { resource_id: 1, date: bookingDate, start_time: '12:00', end_time: '13:30' },
    { resource_id: 1, date: bookingDate, start_time: '14:00', end_time: '15:00' },
  ] };
  const first = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify(body) });
  assert.equal(first.error, null); assert.equal(first.data.booking_ids.length, 2);
  let db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = db.client_packages.find(item => item.id === first.data.id);
  assert.equal(pkg.held_minutes, 150); assert.equal(db.bookings.filter(item => item.client_package_id === pkg.id).length, 2);
  const replay = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...body, bookings: [...body.bookings].reverse() }) });
  assert.equal(replay.error, null); assert.equal(replay.data.idempotent, true); assert.deepEqual(replay.data.booking_ids, first.data.booking_ids);
  const before = storage.get('mt_agency_erp_demo_v12');
  const rollbackBookings = body.bookings.map(item => ({ ...item, date: rollbackDate }));
  const failed = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...body, bookings: rollbackBookings, idempotency_key: 'calendar-sale-rollback-002', __test_fail_at: 'booking:2' }) });
  assert.equal(failed.error?.code, 'demo_fault_injected'); assert.equal(storage.get('mt_agency_erp_demo_v12'), before);
  deactivateDemoMode();
});

test('demo sale executes zero and one appointment paths without phantom holds', async () => {
  const storage = browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  activateDemoMode('owner');
  for (const count of [0, 1]) {
    resetDemoDatabase();
    const service = (await demoClient.from('services').select('*')).data.find(item => ['hour', 'day', 'month'].includes(item.billing_unit) && Number(item.total_hours) >= 2);
    const bookingDate = futureBookableDate(46 + count);
    const draft = templateToPackageDraft(service, { clientId: 1, startsAt: bookingDate });
    const bookings = count ? [{ resource_id: 1, date: bookingDate, start_time: '12:00', end_time: '13:00' }] : [];
    const result = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, bookings, idempotency_key: `calendar-sale-count-${count}` }) });
    assert.equal(result.error, null); assert.equal(result.data.booking_ids.length, count);
    const db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = db.client_packages.find(item => item.id === result.data.id);
    assert.equal(pkg.held_minutes, count * 60); assert.equal(db.bookings.filter(item => item.client_package_id === pkg.id).length, count);
  }
  const invalid = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ client_id: 1, service_id: 1, idempotency_key: 'calendar-sale-invalid-list', bookings: 'invalid' }) });
  assert.equal(invalid.error?.code, 'invalid_bookings');
  deactivateDemoMode();
});

test('daily package waits for its first booking and then allows that day only', async () => {
  const storage = browserGlobals();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const service = db.services.find(item => ['hour', 'day', 'month'].includes(item.billing_unit) && Number(item.total_hours) > 0); service.package_validity_mode = 'shooting_day'; storage.set('mt_agency_erp_demo_v12', JSON.stringify(db));
  const shootingDate = futureBookableDate(52); const outsideDate = futureBookableDate(55);
  const draft = templateToPackageDraft(service, { clientId: 1, startsAt: shootingDate });
  const ok = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, shooting_date: shootingDate, starts_at: shootingDate, expires_at: shootingDate, idempotency_key: 'daily-sale-ok-001', bookings: [] }) });
  assert.equal(ok.error, null); assert.equal(ok.data.expires_at, null);
  const bad = await demoClient.request('/client-packages', { method: 'POST', body: JSON.stringify({ ...draft, idempotency_key: 'daily-sale-bad-001', bookings: [{ resource_id: 1, date: shootingDate, start_time: '12:00', end_time: '13:00' }, { resource_id: 1, date: outsideDate, start_time: '12:00', end_time: '13:00' }] }) });
  assert.equal(bad.error?.code, 'booking_outside_package_validity'); deactivateDemoMode();
});

test('production finance, readiness, migration and light UI contracts are explicit', async () => {
  const [api, migration, view, css, docs] = await Promise.all([load('api/index.php'), load('database/mysql/024_package_sale_calendar.sql'), load('src/erp/ERPPackages.jsx'), load('src/erp/ERPPackages.css'), load('docs/HOSTINGER_DEPLOYMENT_AR.md')]);
  const finance = api.match(/INSERT INTO finance \(organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by\) VALUES \(([^)]*)\)/)?.[1] || '';
  assert.equal((finance.match(/\?/g) || []).length, 11); assert.match(finance, /'payment',\?,\?,1,\?/);
  assert.match(api, /packageSaleSchemaReadiness/); assert.match(api, /booking_ids/); assert.doesNotMatch(api, /response_json'\],true\)\+\['idempotent'/);
  for (const field of ['request_hash','status','response_json','created_by','completed_at','slot_date','slot_start']) assert.match(api, new RegExp(`'${field}'`));
  assert.match(api, /requiredUniqueIndexes/); assert.match(api, /NON_UNIQUE=0/); assert.match(api, /schema_inspection_failed/); assert.match(api, /'unique:'\.\$table/);
  assert.match(api, /'package_validity_mode','minimum_booking_minutes'/); assert.match(api, /'purchased_quantity','purchased_minutes','held_quantity','held_minutes','consumed_quantity','consumed_minutes','payment_due_quantity','payment_due_minutes','validity_mode_snapshot'/);
  assert.match(migration, /package_validity_mode/); assert.match(migration, /validity_mode_snapshot/); assert.match(migration, /information_schema\.COLUMNS/); assert.match(docs, /readiness\/package-sales/);
  const resetSource = view.slice(view.indexOf('const resetFormTemplate'), view.indexOf('const selectClient'));
  assert.match(view, /packages-appointments-section/); assert.match(view, /packages-inline-calendar/); assert.match(view, /partitionPackageAppointments/); assert.doesNotMatch(resetSource, /setSaleBookings/); assert.match(resetSource, /لم نحذف أي موعد/); assert.equal(view.includes('appearance="package-sale-dark"'), false);
  assert.match(css, /color-scheme:light/); assert.ok(css.lastIndexOf('color-scheme:light') > css.indexOf('color-scheme:dark'));
  assert.match(css, /packages-appointment-editor/); assert.match(css, /packages-calendar-week\{[^}]*repeat\(7,minmax\(0,1fr\)\)/); assert.match(css, /packages-inline-calendar nav button\{width:44px;height:44px/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*packages-calendar-week\{grid-template-columns:repeat\(4/); assert.match(css, /@media\(max-width:390px\)[\s\S]*packages-calendar-week\{grid-template-columns:repeat\(2/);
});
