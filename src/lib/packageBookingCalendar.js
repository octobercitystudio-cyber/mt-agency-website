const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const dateKey = value => {
  const key = String(value || '').slice(0, 10);
  return DATE_KEY.test(key) ? key : '';
};

const utcDate = value => {
  const key = dateKey(value);
  if (!key) return null;
  const result = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(result.getTime()) ? null : result;
};

const formatUtcDate = value => value.toISOString().slice(0, 10);

const laterDate = (...values) => values.map(dateKey).filter(Boolean).sort().at(-1) || '';
const earlierDate = (...values) => values.map(dateKey).filter(Boolean).sort()[0] || '';

export const bookingMonthKey = value => {
  const parsed = utcDate(value);
  if (!parsed) return '';
  parsed.setUTCDate(1);
  return formatUtcDate(parsed);
};

export const shiftBookingMonth = (value, amount) => {
  const parsed = utcDate(bookingMonthKey(value));
  if (!parsed) return '';
  parsed.setUTCMonth(parsed.getUTCMonth() + Number(amount || 0));
  return formatUtcDate(parsed);
};

export const shiftBookingDate = (value, amount) => {
  const parsed = utcDate(value);
  if (!parsed) return '';
  parsed.setUTCDate(parsed.getUTCDate() + Number(amount || 0));
  return formatUtcDate(parsed);
};

const monthEnd = value => {
  const parsed = utcDate(bookingMonthKey(value));
  if (!parsed) return '';
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(0);
  return formatUtcDate(parsed);
};

const inclusiveDays = (start, end) => {
  const first = utcDate(start);
  const last = utcDate(end);
  if (!first || !last || last < first) return 0;
  return Math.round((last - first) / 86400000) + 1;
};

export const initialPackageBookingMonth = (pkg, todayKey) => (
  bookingMonthKey(laterDate(todayKey, pkg?.starts_at) || todayKey)
);

export const packageBookingMonthWindow = (pkg, requestedMonth, todayKey) => {
  const startsAt = dateKey(pkg?.starts_at);
  const expiresAt = dateKey(pkg?.expires_at);
  const earliestAllowed = laterDate(todayKey, startsAt);
  const minimumMonth = bookingMonthKey(earliestAllowed || todayKey);
  const maximumMonth = bookingMonthKey(expiresAt);
  let month = bookingMonthKey(requestedMonth) || minimumMonth;
  if (minimumMonth && month < minimumMonth) month = minimumMonth;
  if (maximumMonth && month > maximumMonth) month = maximumMonth;

  const startDate = laterDate(month, earliestAllowed);
  const endDate = earlierDate(monthEnd(month), expiresAt) || monthEnd(month);
  const days = Math.min(31, inclusiveDays(startDate, endDate));
  const previousMonth = shiftBookingMonth(month, -1);
  const nextMonth = shiftBookingMonth(month, 1);

  return {
    month,
    startDate,
    endDate,
    days,
    previousMonth,
    nextMonth,
    canPrevious: Boolean(previousMonth && (!minimumMonth || previousMonth >= minimumMonth)),
    canNext: Boolean(nextMonth && (!maximumMonth || nextMonth <= maximumMonth)),
    minimumMonth,
    maximumMonth,
  };
};


export const packageBookingValidRange = (pkg, todayKey) => {
  const start = laterDate(todayKey, pkg?.starts_at) || dateKey(todayKey);
  const expiresAt = dateKey(pkg?.expires_at);
  return {
    ...(start ? { start } : {}),
    ...(expiresAt ? { end: shiftBookingDate(expiresAt, 1) } : {}),
  };
};
