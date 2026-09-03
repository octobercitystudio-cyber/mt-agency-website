import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bookingBlockCalendarItem, getBookingAvailability } from '../src/erp/bookingAvailability.js';
import { bindBookingBlockDoubleClick } from '../src/erp/bookingBlockInteraction.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const slot = overrides => ({
  id: 91,
  date: '2027-02-01',
  start_time: '14:00',
  end_time: '16:00',
  resource_id: 1,
  status: 'pending',
  ...overrides,
});

test('administrative blocks occupy availability without exposing a client', () => {
  const block = { id: 7, block_date: '2027-02-01', start_time: '14:30', end_time: '15:30', resource_id: 1, status: 'active' };
  const result = getBookingAvailability(slot(), [], { blocks: [block] });
  assert.equal(result.status, 'blocked');
  assert.equal(result.available, false);
  assert.equal(result.conflicts[0].owner_label, 'مغلق بواسطة الإدارة');
  assert.equal(getBookingAvailability(slot({ start_time: '15:30', end_time: '16:30' }), [], { blocks: [block] }).status, 'available');
  assert.equal(getBookingAvailability(slot({ resource_id: 2 }), [], { blocks: [block] }).status, 'available');
  assert.deepEqual(bookingBlockCalendarItem(block), { ...block, date: block.block_date, title: 'الحجز مغلق', kind: 'booking_block', owner_label: 'مغلق بواسطة الإدارة' });
});

test('native day-cell DOM dblclick opens once and cleans up independently of click detail', () => {
  const dayCell = new EventTarget();
  const received = [];
  const cleanup = bindBookingBlockDoubleClick(dayCell, event => received.push(event.type));
  dayCell.dispatchEvent(new Event('click'));
  dayCell.dispatchEvent(new Event('click'));
  assert.deepEqual(received, [], 'two forwarded click events must not be mistaken for a browser dblclick');
  dayCell.dispatchEvent(new Event('dblclick'));
  assert.deepEqual(received, ['dblclick']);
  const secondary = new Event('dblclick'); Object.defineProperty(secondary, 'button', { value: 2 }); dayCell.dispatchEvent(secondary);
  assert.deepEqual(received, ['dblclick'], 'secondary-button double click must be ignored');
  cleanup();
  dayCell.dispatchEvent(new Event('dblclick'));
  assert.deepEqual(received, ['dblclick'], 'unmounted FullCalendar cells must release their listener');
});

test('demo booking blocks are atomic, idempotent, scoped, and side-effect free', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  activateDemoMode('owner');

  const countsBefore = {};
  for (const table of ['client_packages', 'finance_transactions', 'app_notifications', 'booking_sessions']) {
    countsBefore[table] = (await demoClient.from(table).select('*')).data.length;
  }

  const singleBody = { date: '2027-02-01', start_time: '14:00', end_time: '16:00', resource_id: 1, repeat_daily: false, note: 'اجتماع داخلي', idempotency_key: 'block-test-single-0001' };
  const created = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify(singleBody) });
  assert.equal(created.error, null);
  assert.equal(created.data.count, 1);
  assert.equal(created.data.items[0].title, 'الحجز مغلق');
  assert.equal(created.data.items[0].duration_minutes, 120);

  const replay = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify(singleBody) });
  assert.equal(replay.error, null);
  assert.equal(replay.data.idempotent, true);
  assert.equal(replay.data.items[0].id, created.data.items[0].id);
  const mismatch = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ ...singleBody, note: 'بيانات مختلفة' }) });
  assert.equal(mismatch.error?.code, 'idempotency_conflict');

  const bookingsBeforeBlockedCreate = (await demoClient.from('bookings').select('*')).data.length;
  const blockedBooking = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 1, client_package_id: 201, service_id: 101, resource_id: 1, date: singleBody.date, start_time: '15:00', end_time: '16:00', status: 'confirmed' }) });
  assert.equal(blockedBooking.error?.code, 'booking_conflict');
  assert.equal((await demoClient.from('bookings').select('*')).data.length, bookingsBeforeBlockedCreate);

  const missingRepeatEnd = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date: '2027-03-01', start_time: '14:00', end_time: '15:00', resource_id: 1, repeat_daily: true, idempotency_key: 'block-test-repeat-missing' }) });
  assert.equal(missingRepeatEnd.error?.code, 'booking_block_repeat_until_required');
  const overNinetyDays = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date: '2027-03-01', start_time: '14:00', end_time: '15:00', resource_id: 1, repeat_daily: true, repeat_until: '2027-05-30', idempotency_key: 'block-test-repeat-too-long' }) });
  assert.equal(overNinetyDays.error?.code, 'booking_block_range_too_long');

  const repeated = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date: '2027-01-04', start_time: '18:00', end_time: '19:00', resource_id: 1, repeat_daily: true, repeat_until: '2027-01-09', note: '', idempotency_key: 'block-test-series-0001' }) });
  assert.equal(repeated.error, null);
  assert.equal(repeated.data.count, 5);
  assert.equal(repeated.data.skipped_fridays, 1);
  assert.equal(repeated.data.items.some(item => item.block_date === '2027-01-08'), false);

  const confirmed = (await demoClient.from('bookings').select('*')).data.find(item => ['confirmed', 'in_progress'].includes(item.status) && new Date(`${item.date}T12:00:00`).getDay() !== 5);
  assert.ok(confirmed, 'the demo fixture must contain a blocking booking');
  const blockCountBeforeConflict = (await demoClient.from('booking_blocks').select('*')).data.length;
  const conflictEnd = new Date(`${confirmed.date}T12:00:00`); conflictEnd.setDate(conflictEnd.getDate() + 1);
  const conflict = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date: confirmed.date, start_time: confirmed.start_time, end_time: confirmed.end_time, resource_id: confirmed.resource_id || 1, repeat_daily: true, repeat_until: `${conflictEnd.getFullYear()}-${String(conflictEnd.getMonth() + 1).padStart(2, '0')}-${String(conflictEnd.getDate()).padStart(2, '0')}`, idempotency_key: 'block-test-conflict-001' }) });
  assert.equal(conflict.error?.code, 'booking_conflict');
  assert.equal((await demoClient.from('booking_blocks').select('*')).data.length, blockCountBeforeConflict);

  const singleCancelled = await demoClient.request(`/booking-blocks/${created.data.items[0].id}?scope=single`, { method: 'DELETE' });
  assert.equal(singleCancelled.error, null);
  assert.equal(singleCancelled.data.cancelled, 1);
  assert.equal((await demoClient.from('booking_slots').select('*')).data.some(slot => Number(slot.booking_block_id) === Number(created.data.items[0].id)), false);

  const seriesMiddle = repeated.data.items[1];
  const cancelled = await demoClient.request(`/booking-blocks/${seriesMiddle.id}?scope=series`, { method: 'DELETE' });
  assert.equal(cancelled.error, null);
  assert.equal(cancelled.data.cancelled, 4);
  const activeSeries = (await demoClient.request('/booking-blocks?from=2027-01-01&to=2027-01-31')).data;
  assert.deepEqual(activeSeries.filter(item => item.series_key === repeated.data.series_key).map(item => item.id), [repeated.data.items[0].id]);
  const activeBlockIds = new Set((await demoClient.from('booking_blocks').select('*')).data.filter(item => item.status === 'active').map(item => Number(item.id)));
  const orphanedSlots = (await demoClient.from('booking_slots').select('*')).data.filter(item => item.booking_block_id && !activeBlockIds.has(Number(item.booking_block_id)));
  assert.equal(orphanedSlots.length, 0);

  const blockChanges = (await demoClient.from('change_events').select('*')).data.filter(item => item.entity_type === 'booking_blocks');
  assert.deepEqual(blockChanges.map(item => item.action), ['create', 'create', 'cancel', 'cancel_series']);
  assert.ok(blockChanges.every(item => item.topic === 'bookings' && item.client_id == null));

  for (const table of Object.keys(countsBefore)) {
    assert.equal((await demoClient.from(table).select('*')).data.length, countsBefore[table], `${table} must not change when a block is created or cancelled`);
  }

  activateDemoMode('client');
  const forbidden = await demoClient.request('/booking-blocks?from=2027-01-01&to=2027-03-01');
  assert.equal(forbidden.error?.code, 'forbidden');
  activateDemoMode('owner', 1, 2);
  const otherOrganization = await demoClient.request('/booking-blocks?from=2027-01-01&to=2027-03-01');
  assert.equal(otherOrganization.error, null);
  assert.deepEqual(otherOrganization.data, []);
  const crossOrganizationCreate = await demoClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ date: '2027-02-03', start_time: '14:00', end_time: '15:00', resource_id: 1, repeat_daily: false, idempotency_key: 'block-test-cross-org-001' }) });
  assert.equal(crossOrganizationCreate.error?.code, 'invalid_booking_resource');
  deactivateDemoMode();
});

test('production API and migration enforce a single atomic schedule owner', async () => {
  const [api, migration] = await Promise.all([load('api/index.php'), load('database/mysql/036_booking_blocks.sql')]);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS booking_blocks/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /booking_id BIGINT UNSIGNED NULL/);
  assert.match(migration, /booking_block_id/);
  assert.match(migration, /chk_booking_slots_one_owner/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE)\s+(?:bookings|client_packages|finance_transactions)\b/i);
  assert.match(api, /booking_blocks_migration_required/);
  assert.match(api, /requireRole\(\$user,\['owner','admin','operations'\]\)/);
  assert.match(api, /FOR UPDATE/);
  assert.match(api, /reserveBookingBlockSlots/);
  assert.match(api, /releaseBookingBlockSlots/);
  assert.match(api, /function auditBookingBlockChange/);
  assert.match(api, /recordChangeEvent\(\$pdo,\(int\)\$user\['organization_id'\],null,'bookings','booking_blocks'/);
  assert.match(api, /auditBookingBlockChange\(\$pdo,\$user,'create'/);
  assert.match(api, /auditBookingBlockChange\(\$pdo,\$user,\$scope==='series'\?'cancel_series':'cancel'/);
  const blockAudit = api.slice(api.indexOf('function auditBookingBlockChange'), api.indexOf('function reserveBookingSlots'));
  assert.doesNotMatch(blockAudit, /notifyClientChange|notifyOwnersOfClientAction/);
  const demo = await load('src/lib/demoDataClient.js');
  assert.match(demo, /const demoAuditBookingBlockChange/);
  const demoBlockAudit = demo.slice(demo.indexOf('const demoAuditBookingBlockChange'), demo.indexOf('const demoReverseFinance'));
  assert.match(demoBlockAudit, /topic: 'bookings'/);
  assert.doesNotMatch(demoBlockAudit, /demoNotifyClientChange|demoNotifyOwnersOfClientAction/);
  assert.match(api, /status='active' AND start_time<\? AND end_time>\?/);
  assert.match(api, /duration%15/);
  assert.match(api, /bookingBlockDates/);
});

test('owner calendar uses true double-click and an accessible responsive dialog', async () => {
  const [calendar, dialog, css, addBooking, requests] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPBookingBlockDialog.jsx'),
    load('src/erp/ERPBookingBlockDialog.css'),
    load('src/erp/ERPAddBookingModal.jsx'),
    load('src/erp/ERPRequests.jsx'),
  ]);
  assert.match(calendar, /dayCellDidMount=\{handleDayCellDidMount\}/);
  assert.match(calendar, /dayCellWillUnmount=\{handleDayCellWillUnmount\}/);
  assert.match(calendar, /bindBookingBlockDoubleClick\(arg\.el/);
  assert.doesNotMatch(calendar, /jsEvent\?\.detail/);
  assert.match(calendar, /حظر موعد/);
  assert.match(calendar, /const blockEvents = bookingBlocks\.map/);
  assert.match(calendar, /editable: false/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /defaultPeriod="pm"/);
  assert.match(dialog, /repeat_daily/);
  assert.match(dialog, /idempotency_key/);
  assert.match(dialog, /التاريخ المختار:/);
  assert.match(dialog, /نهاية التكرار:/);
  assert.match(dialog, /إلغاء هذا الحظر وما بعده/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(addBooking, /blocks: bookingBlocks/);
  assert.match(requests, /blocks: source\.bookingBlocks/);
  assert.match(requests, /مغلق بواسطة الإدارة/);
  assert.match(calendar, /booking-block-label-compact/);
  assert.match(calendar, /booking-block-label-full \{ display: none; \}/);
});
