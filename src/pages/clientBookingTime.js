import { timeToMinutes } from '../lib/businessFormat.js';

export const CLIENT_BOOKING_MINUTES_MIN = 30;
export const CLIENT_BOOKING_MINUTES_MAX = 720;
export const CLIENT_BOOKING_MINUTES_STEP = 30;

const formatMinuteValue = value => value === 1440
  ? '24:00'
  : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const compactTime = value => String(value || '').slice(0, 5);

export const clientDurationMinutesFromDraft = (hours, minutes) => {
  const hourValue = Number(String(hours ?? '').trim() || 0);
  const minuteValue = Number(String(minutes ?? '').trim() || 0);
  return Number.isFinite(hourValue) && Number.isFinite(minuteValue) ? (hourValue * 60) + minuteValue : Number.NaN;
};

export const normalizeClientMinuteDraft = value => {
  if (String(value ?? '').trim() === '') return '0';
  return Number(value) >= 15 ? '30' : '0';
};

export const clientDurationError = durationMinutes => {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < CLIENT_BOOKING_MINUTES_MIN) return 'duration_too_short';
  if (durationMinutes > CLIENT_BOOKING_MINUTES_MAX) return 'duration_too_long';
  if (durationMinutes % CLIENT_BOOKING_MINUTES_STEP !== 0) return 'duration_increment';
  return '';
};

export const resolveClientBookingTime = ({ startTime, durationMinutes, slots = [] }) => {
  const durationError = clientDurationError(durationMinutes);
  if (durationError) return { errorCode: durationError, endTime: '', slot: null };
  if (!startTime) return { errorCode: 'start_required', endTime: '', slot: null };
  const startMinutes = timeToMinutes(compactTime(startTime));
  if (!Number.isSafeInteger(startMinutes) || startMinutes < 0) return { errorCode: 'start_invalid', endTime: '', slot: null };
  if (startMinutes < 720) return { errorCode: 'start_before_open', endTime: '', slot: null };
  if (startMinutes >= 1440 || startMinutes % 60 !== 0) {
    return { errorCode: 'start_grid_invalid', endTime: '', slot: null };
  }
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes > 1440) return { errorCode: 'after_midnight', endTime: '', slot: null };
  const endTime = formatMinuteValue(endMinutes);
  const slot = slots.find(item => compactTime(item.start_time) === compactTime(startTime) && compactTime(item.end_time) === endTime) || null;
  return { errorCode: slot ? '' : 'unavailable', endTime, slot };
};
