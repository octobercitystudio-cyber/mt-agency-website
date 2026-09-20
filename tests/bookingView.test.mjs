import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bookingDayAgenda, bookingDaySummary, filterBlocksForDisplay,
  filterBookingsForDisplay, normalizeBookingViewStatus,
} from '../src/lib/bookingView.js';

const date = '2026-09-20';
const bookings = [
  { id: 5, client_name: 'أحمد دَرويش', service: 'تصوير بالساعة', notes: 'خلفية بيضاء', date, start_time: '14:30:00', end_time: '16:00:00', status: 'confirmed' },
  { id: 2, client_name: 'شريف عثمان', client_package_name: 'باقة أكتوبر', date, start_time: '12:00', end_time: '14:00', status: 'مؤكد' },
  { id: 3, client_name: 'باسم أنور إبراهيم', date, start_time: '19:00', end_time: '21:00', status: 'منتهي' },
  { id: 4, client_name: 'منى عبدالسلام', date, start_time: '23:00', end_time: '24:00', status: 'in_progress' },
  { id: 6, client_name: 'أحمد درويش', date, start_time: '16:00', end_time: '18:00', status: 'cancelled' },
  { id: 7, client_name: 'أحمد درويش', date, start_time: '16:00', end_time: '18:00', status: 'مرفوض' },
  { id: 8, client_name: 'أحمد درويش', date: '2026-10-20', start_time: '12:00', end_time: '13:00', status: 'pending' },
];
const blocks = [
  { id: 20, block_date: date, start_time: '16:30', end_time: '18:30', title: 'تصوير منتجات الحملة الجديدة', note: 'إحضار العبوات الزرقاء', resource_name: 'الاستديو الرئيسي', status: 'active' },
  { id: 21, block_date: date, start_time: '15:00', end_time: '17:00', title: 'حظر ملغى', status: 'cancelled' },
  { id: 22, block_date: '2026-10-20', start_time: '17:00', end_time: '18:00', title: 'حجز أكتوبر', status: 'active' },
];

test('booking display search normalizes Arabic and finds package or notes without returning cancelled records', () => {
  assert.deepEqual(filterBookingsForDisplay(bookings, { query: 'احمد درويش' }).map(row => row.id), [5, 8]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { query: 'بيضاء احمد' }).map(row => row.id), [5]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { query: 'اكتوبر' }).map(row => row.id), [2]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { query: '٢٠٢٦-١٠' }).map(row => row.id), [8]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { query: 'غير موجود' }), []);
});

test('status filters preserve canonical and legacy statuses with a dedicated temporary-only view', () => {
  assert.equal(normalizeBookingViewStatus('تصوير جارٍ'), 'in_progress');
  assert.deepEqual(filterBookingsForDisplay(bookings, { status: 'confirmed' }).map(row => row.id), [5, 2]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { status: 'completed' }).map(row => row.id), [3]);
  assert.deepEqual(filterBookingsForDisplay(bookings, { status: 'temporary' }), []);
  assert.deepEqual(filterBlocksForDisplay(blocks, { status: 'confirmed' }), []);
  assert.deepEqual(filterBlocksForDisplay(blocks, { status: 'temporary' }).map(row => row.id), [20, 22]);
  assert.deepEqual(filterBlocksForDisplay(blocks, { query: 'العبوات الحمله' }).map(row => row.id), [20]);
});

test('daily agenda interleaves holds and bookings chronologically and excludes other dates or removed records', () => {
  const agenda = bookingDayAgenda(bookings, blocks, date);
  assert.deepEqual(agenda.map(item => [item.kind, item.record.id]), [
    ['booking', 2], ['booking', 5], ['block', 20], ['booking', 3], ['booking', 4],
  ]);
  assert.equal(agenda[1].record, bookings[0], 'retain authoritative DTO for existing detail and mutation handlers');
  assert.equal(agenda[2].record, blocks[0]);
  assert.deepEqual(bookingDayAgenda(bookings, blocks, '2026-10-20').map(item => item.record.id), [8, 22]);
  assert.deepEqual(bookingDayAgenda(bookings, blocks, ''), []);
});

test('day summary counts real statuses, includes midnight duration and never bills temporary holds as sessions', () => {
  assert.deepEqual(bookingDaySummary(bookings, blocks, date), {
    total: 5, bookings: 4, temporary: 1, confirmed: 2, inProgress: 1, completed: 1, durationMinutes: 390,
  });
  const display = filterBookingsForDisplay(bookings, { query: 'احمد' });
  assert.equal(bookingDaySummary(display, [], date).durationMinutes, 90);
  assert.equal(bookingDaySummary(bookings, blocks, date).total, 5, 'search does not modify authoritative counts or rules');
});

test('selectors tolerate missing rows and do not mutate the source array used by booking availability', () => {
  const input = Object.freeze(bookings.map(row => Object.freeze({ ...row })));
  const snapshot = JSON.stringify(input);
  filterBookingsForDisplay([...input, null], { status: 'all' });
  bookingDayAgenda(input, [null, ...blocks], date);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(input.length, 7, 'cancelled source records remain available to business/audit logic');
});
