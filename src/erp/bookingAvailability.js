const BLOCKING_STATUSES = new Set([
  'confirmed',
  'in_progress',
  'cancel_requested',
  'late_cancel_requested',
  'مؤكد',
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_BOOKING_RESOURCE_ID = 1;
export const isBlockingBooking = booking => BLOCKING_STATUSES.has(String(booking?.status || '').trim());

export const bookingResourceId = booking => String(booking?.resource_id ?? DEFAULT_BOOKING_RESOURCE_ID);

export function bookingTimeToMinutes(value, { end = false } = {}) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute < 0 || minute > 59 || hour < 0 || hour > 24 || (hour === 24 && minute !== 0)) return null;
  if (hour === 24 || (end && hour === 0 && minute === 0)) return 1440;
  return hour * 60 + minute;
}

export function normalizeBookingCandidate(candidate = {}) {
  const date = String(candidate.date || '').slice(0, 10);
  const startMinutes = bookingTimeToMinutes(candidate.start_time);
  const endMinutes = bookingTimeToMinutes(candidate.end_time, { end: true });
  const resourceId = bookingResourceId(candidate);
  const valid = DATE_PATTERN.test(date)
    && !Number.isNaN(new Date(`${date}T12:00:00`).getTime())
    && startMinutes !== null
    && endMinutes !== null
    && endMinutes > startMinutes;
  return { ...candidate, date, startMinutes, endMinutes, resourceId, valid };
}

export function getBookingAvailability(candidate, bookings = [], options = {}) {
  const normalized = normalizeBookingCandidate(candidate);
  if (!normalized.valid) return { status: 'invalid', available: false, candidate: normalized, conflicts: [] };

  const excludedId = options.excludeBookingId;
  const conflicts = bookings.filter(existing => {
    if (!isBlockingBooking(existing)) return false;
    if (excludedId != null && String(existing.id) === String(excludedId)) return false;
    const slot = normalizeBookingCandidate(existing);
    if (!slot.valid || slot.date !== normalized.date || slot.resourceId !== normalized.resourceId) return false;
    return slot.startMinutes < normalized.endMinutes && slot.endMinutes > normalized.startMinutes;
  });

  return {
    status: conflicts.length ? 'conflict' : 'available',
    available: conflicts.length === 0,
    candidate: normalized,
    conflicts,
  };
}

export const blockingBookings = bookings => (bookings || []).filter(booking => {
  if (!isBlockingBooking(booking)) return false;
  return normalizeBookingCandidate(booking).valid;
});

export function safeBookingColor(value, fallback = '#4318ff') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

export function readableBookingTextColor(value) {
  const hex = safeBookingColor(value).slice(1);
  const channels = [0, 2, 4]
    .map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return luminance > .179 ? '#111827' : '#ffffff';
}

export function candidateForRequest(kind, item, booking) {
  if (kind === 'reschedule') return {
    date: item?.proposed_date,
    start_time: item?.proposed_start_time,
    end_time: item?.proposed_end_time,
    resource_id: item?.resource_id ?? booking?.resource_id ?? DEFAULT_BOOKING_RESOURCE_ID,
  };
  return {
    date: item?.date,
    start_time: item?.start_time,
    end_time: item?.end_time,
    resource_id: item?.resource_id ?? DEFAULT_BOOKING_RESOURCE_ID,
  };
}
