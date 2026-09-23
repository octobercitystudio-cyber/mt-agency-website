import { cairoDateTimeToEpoch } from './promotionTime.js';

const cairoDate = epoch => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(epoch));
const nextDay = date => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
export const clientNoticeRemainingSeconds = (booking, now = new Date()) => {
  const end = cairoDateTimeToEpoch(`${booking?.date}T${String(booking?.start_time || '').slice(0, 5)}:00`);
  let cursor = new Date(now).getTime(), total = 0;
  if (!Number.isFinite(cursor) || !Number.isFinite(end) || end <= cursor) return 0;
  while (cursor < end) {
    const date = cairoDate(cursor);
    const boundary = Math.min(end, cairoDateTimeToEpoch(`${nextDay(date)}T00:00:00`));
    if (!Number.isFinite(boundary) || boundary <= cursor) return 0;
    if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 5) total += (boundary - cursor) / 1000;
    cursor = boundary;
  }
  return total;
};
export const clientNoticeIsLate = (booking, now = new Date()) => clientNoticeRemainingSeconds(booking, now) < 48 * 3600;
