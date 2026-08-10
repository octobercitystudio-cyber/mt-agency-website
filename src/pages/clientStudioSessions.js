import { sessionStartedAtMilliseconds } from '../erp/studioSessionDuration.js';

export const validClientBookingId = value => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeClientStudioSessions = payload => {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return rows.filter(session => validClientBookingId(session?.booking_id) && session?.status === 'active');
};

export const clientSessionMap = sessions => {
  const map = new Map();
  normalizeClientStudioSessions(sessions).forEach(session => {
    const bookingId = validClientBookingId(session.booking_id);
    const existing = map.get(bookingId);
    if (!existing || sessionStartedAtMilliseconds(session) < sessionStartedAtMilliseconds(existing)) map.set(bookingId, session);
  });
  return map;
};

export const sessionServerOffset = (serverNow, receivedAt = Date.now()) => {
  const serverMilliseconds = Date.parse(String(serverNow || ''));
  return Number.isFinite(serverMilliseconds) ? serverMilliseconds - Number(receivedAt) : 0;
};

export const earliestClientSession = sessions => normalizeClientStudioSessions(sessions)
  .slice()
  .sort((left, right) => {
    const leftStarted = sessionStartedAtMilliseconds(left);
    const rightStarted = sessionStartedAtMilliseconds(right);
    const safeLeft = Number.isFinite(leftStarted) ? leftStarted : Number.MAX_SAFE_INTEGER;
    const safeRight = Number.isFinite(rightStarted) ? rightStarted : Number.MAX_SAFE_INTEGER;
    return safeLeft - safeRight || Number(left.booking_id) - Number(right.booking_id);
  })[0] || null;

export const activeBookingProjection = session => {
  const bookingId = validClientBookingId(session?.booking_id);
  if (!bookingId) return null;
  return {
    id: bookingId,
    client_package_id: session.client_package_id || null,
    service: session.service || session.title || session.package_name || 'جلسة تصوير',
    date: session.date || '',
    start_time: session.start_time || '',
    end_time: session.end_time || '',
    status: 'in_progress',
  };
};

export const promoteActiveBookings = (bookings, sessions) => {
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const active = earliestClientSession(sessions);
  if (!active) return safeBookings;
  const bookingId = Number(active.booking_id);
  const booking = safeBookings.find(item => Number(item.id) === bookingId) || activeBookingProjection(active);
  if (!booking) return safeBookings;
  return [{ ...booking, status: 'in_progress' }, ...safeBookings.filter(item => Number(item.id) !== bookingId)];
};

export const formatElapsedHoursMinutes = elapsedSeconds => {
  const value = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
