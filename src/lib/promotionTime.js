const CAIRO_ZONE = 'Africa/Cairo';

const cairoParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]),
);

const hasExplicitZone = (value) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);

export const cairoDateTimeToEpoch = (value) => {
  if (!value) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  const raw = String(value).trim();
  if (hasExplicitZone(raw)) return new Date(raw).getTime();

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return new Date(raw).getTime();
  const [, year, month, day, hour, minute, second = '0'] = match;
  const wallClockUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);

  let instant = wallClockUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = cairoParts(new Date(instant));
    const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    instant -= renderedAsUtc - wallClockUtc;
  }
  return instant;
};

export const cairoDateTimeToIso = (value) => {
  const epoch = cairoDateTimeToEpoch(value);
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : '';
};
