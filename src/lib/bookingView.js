import { calculateDurationMinutes, normalizeTime } from './businessFormat.js';
import { normalizeClientSearchText } from './clientSearch.js';
import { isClientBookingVisible } from './clientBookingVisibility.js';

const legacyStatuses = new Map([
  ['مؤكد', 'confirmed'], ['منتهي', 'completed'], ['مكتمل', 'completed'],
  ['بانتظار التأكيد', 'pending'], ['قيد الانتظار', 'pending'],
  ['تصوير جارٍ', 'in_progress'], ['تصوير جاري', 'in_progress'],
  ['موعد بديل مقترح', 'alternative_proposed'], ['طلب إلغاء', 'cancel_requested'],
  ['إلغاء متأخر', 'late_cancel_requested'],
].map(([label, value]) => [normalizeClientSearchText(label), value]));

export const normalizeBookingViewStatus = status => {
  const value = String(status ?? '').trim().toLowerCase();
  return legacyStatuses.get(normalizeClientSearchText(value)) || value;
};

const searchWords = query => normalizeClientSearchText(query).split(' ').filter(Boolean);
const matchesSearch = (words, fields) => {
  const text = normalizeClientSearchText(fields.filter(value => value != null).join(' '));
  return words.every(word => text.includes(word));
};
const visibleBooking = row => Boolean(row) && isClientBookingVisible(row);
const activeBlock = row => Boolean(row) && String(row.status ?? 'active').trim().toLowerCase() === 'active';

// These selectors only shape the view. Keep original DTOs for details and never
// use filtered results as the source of availability or package validation.
export const filterBookingsForDisplay = (bookings = [], { query = '', status = 'all' } = {}) => {
  const words = searchWords(query);
  const wanted = normalizeBookingViewStatus(status);
  return bookings.filter(row => visibleBooking(row)
    && (wanted === 'all' || normalizeBookingViewStatus(row.status) === wanted)
    && wanted !== 'temporary'
    && matchesSearch(words, [row.client_name, row.service, row.notes, row.title,
      row.package_name, row.client_package_name, row.resource_name, row.id, row.date]));
};

export const filterBlocksForDisplay = (blocks = [], { query = '', status = 'all' } = {}) => {
  if (!['all', 'temporary'].includes(status)) return [];
  const words = searchWords(query);
  return blocks.filter(row => activeBlock(row)
    && matchesSearch(words, [row.title || 'حجز مؤقت', row.note, row.resource_name, row.id, row.block_date]));
};

const dayKey = value => String(value ?? '').slice(0, 10);
const recordTime = (row, end = false) => normalizeTime(end ? row.end_time : row.start_time, { endOfDay: end }) || '';

export const bookingDayAgenda = (bookings = [], blocks = [], date) => {
  const day = dayKey(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  return [
    ...bookings.filter(row => visibleBooking(row) && dayKey(row.date) === day).map(record => ({ kind: 'booking', record })),
    ...blocks.filter(row => activeBlock(row) && dayKey(row.block_date) === day).map(record => ({ kind: 'block', record })),
  ].sort((a, b) => recordTime(a.record).localeCompare(recordTime(b.record))
    || recordTime(a.record, true).localeCompare(recordTime(b.record, true))
    || a.kind.localeCompare(b.kind)
    || String(a.record.id ?? '').localeCompare(String(b.record.id ?? ''), 'en', { numeric: true }));
};

export const bookingDaySummary = (bookings = [], blocks = [], date) => {
  const agenda = bookingDayAgenda(bookings, blocks, date);
  const sessions = agenda.filter(item => item.kind === 'booking');
  const countStatus = status => sessions.filter(item => normalizeBookingViewStatus(item.record.status) === status).length;
  return {
    total: agenda.length,
    bookings: sessions.length,
    temporary: agenda.length - sessions.length,
    confirmed: countStatus('confirmed'),
    inProgress: countStatus('in_progress'),
    completed: countStatus('completed'),
    durationMinutes: sessions.reduce((sum, { record }) => {
      const minutes = calculateDurationMinutes(record.start_time, record.end_time);
      return sum + (Number.isFinite(minutes) ? Math.max(0, minutes) : 0);
    }, 0),
  };
};
