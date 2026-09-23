import { cairoDateKey } from './businessFormat.js';

export const CLIENT_BOOKING_DATE_MESSAGE = 'الحجز متاح بدايةً من الغد بتوقيت مصر. لا يمكن الحجز في نفس اليوم.';

// Add a calendar day to Cairo's date, independently of browser timezone and DST.
export function earliestClientBookingDate(now = new Date()) {
  const day = new Date(`${cairoDateKey(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export function clientBookingDateError(date, now = new Date()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'تاريخ الحجز غير صحيح.';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return 'تاريخ الحجز غير صحيح.';
  return date < earliestClientBookingDate(now) ? CLIENT_BOOKING_DATE_MESSAGE : '';
}
