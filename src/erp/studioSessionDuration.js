import { formatDurationMinutes } from '../lib/businessFormat.js';

export const roundedElapsedMinutes = elapsedSeconds => {
  const seconds = Number(elapsedSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
};

export const sessionStartedAtMilliseconds = session => {
  const explicitIso = String(session?.started_at_iso || '').trim();
  const isoValue = explicitIso ? Date.parse(explicitIso) : Number.NaN;
  if (Number.isFinite(isoValue)) return isoValue;
  const fallback = String(session?.started_at || '').trim();
  if (!fallback) return Number.NaN;
  const fallbackValue = new Date(fallback).getTime();
  return Number.isFinite(fallbackValue) ? fallbackValue : Number.NaN;
};

export const elapsedSessionSeconds = (session, nowMilliseconds = Date.now(), serverOffset = 0) => {
  const startedAt = sessionStartedAtMilliseconds(session);
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.floor(((Number(nowMilliseconds) + Number(serverOffset || 0)) - startedAt) / 1000));
};

export const formatElapsedTime = seconds => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return [hours, minutes, remainder].map(part => String(part).padStart(2, '0')).join(':');
};

export const durationInputToMinutes = (hours, minutes) => {
  const hoursText = String(hours ?? '').trim();
  const minutesText = String(minutes ?? '').trim();
  if (!/^\d+$/.test(hoursText) || !/^\d+$/.test(minutesText)) {
    throw new Error('أدخل الساعات والدقائق كأرقام صحيحة غير سالبة.');
  }
  const parsedHours = Number(hoursText);
  const parsedMinutes = Number(minutesText);
  if (!Number.isSafeInteger(parsedHours) || !Number.isSafeInteger(parsedMinutes) || parsedMinutes > 59) {
    throw new Error('الدقائق يجب أن تكون من 0 إلى 59، والساعات رقمًا صحيحًا غير سالب.');
  }
  const total = (parsedHours * 60) + parsedMinutes;
  if (total <= 0) throw new Error('مدة التصوير يجب أن تكون دقيقة واحدة على الأقل.');
  return total;
};

export const sessionMaximumMinutes = session => {
  if (!session) return null;
  const unit = session.billing_unit || 'hour';
  if (unit === 'hour') {
    const bookingHeld = Number(session.booking_held_quantity);
    const packageHeld = Number(session.held_quantity);
    const requested = Number(session.requested_quantity);
    const held = Number.isFinite(bookingHeld) && bookingHeld > 0
      ? bookingHeld
      : Math.min(...[packageHeld, requested].filter(value => Number.isFinite(value) && value > 0));
    return Number.isFinite(held) && held > 0 ? Math.max(1, Math.floor((held * 60) + 0.0001)) : null;
  }
  const scheduled = Number(session.duration_minutes);
  return Number.isFinite(scheduled) && scheduled > 0 ? Math.floor(scheduled) : null;
};

export const durationLabel = totalMinutes => formatDurationMinutes(totalMinutes);
