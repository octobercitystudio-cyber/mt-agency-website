const GRID_MINUTES = 15;
const MINIMUM_DURATION_MINUTES = 60;
const END_OF_DAY_MINUTES = 24 * 60;

const cairoFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatMinutes = minutes => {
  const bounded = Math.max(0, Math.min(END_OF_DAY_MINUTES, Math.trunc(minutes)));
  if (bounded === END_OF_DAY_MINUTES) return '24:00';
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(bounded % 60).padStart(2, '0')}`;
};

const parseEndTime = value => {
  const text = String(value || '').slice(0, 5);
  if (text === '24:00') return END_OF_DAY_MINUTES;
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

export const cairoClockMinutes = (now = new Date()) => {
  const parts = cairoFormatter.formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return hour * 60 + minute;
};

export const directSessionClock = (now = new Date()) => {
  const currentMinutes = cairoClockMinutes(now);
  const startMinutes = Math.floor(currentMinutes / GRID_MINUTES) * GRID_MINUTES;
  const endMinutes = Math.min(END_OF_DAY_MINUTES, startMinutes + MINIMUM_DURATION_MINUTES);
  return {
    currentMinutes,
    startMinutes,
    startTime: formatMinutes(startMinutes),
    endTime: formatMinutes(endMinutes),
  };
};

export const defaultDirectSessionEndTime = (now = new Date()) => directSessionClock(now).endTime;

export const validateDirectSessionEndTime = (value, now = new Date()) => {
  const endMinutes = parseEndTime(value);
  if (!Number.isFinite(endMinutes)) return 'اختر وقت نهاية صحيحًا.';
  const { currentMinutes, startMinutes } = directSessionClock(now);
  if (endMinutes <= currentMinutes || endMinutes <= startMinutes) return 'اختر وقت نهاية لاحقًا لوقت القاهرة الحالي.';
  if (endMinutes - startMinutes < MINIMUM_DURATION_MINUTES) return 'يجب أن تكون نهاية الجلسة بعد وقت البداية بساعة على الأقل.';
  if ((endMinutes - startMinutes) % GRID_MINUTES !== 0) return 'استخدم زيادات 15 دقيقة لوقت نهاية الجلسة.';
  return '';
};
