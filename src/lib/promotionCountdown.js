const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

const twoDigits = value => String(value).padStart(2, '0');

/**
 * Build all four countdown units from one authoritative millisecond value.
 * Invalid input deliberately produces no countdown so a malformed expiry
 * cannot look like a genuine, running offer timer.
 */
export const promotionCountdownParts = (remainingMs, labels) => {
  const numericRemaining = Number(remainingMs);
  if (!Number.isFinite(numericRemaining)) return null;

  const totalSeconds = Math.max(0, Math.floor(numericRemaining / SECOND_MS));
  const days = Math.floor(totalSeconds / DAY_SECONDS);
  const hours = Math.floor((totalSeconds % DAY_SECONDS) / HOUR_SECONDS);
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS);
  const seconds = totalSeconds % MINUTE_SECONDS;

  return [
    { unit: 'days', value: twoDigits(days), label: labels.day },
    { unit: 'hours', value: twoDigits(hours), label: labels.hour },
    { unit: 'minutes', value: twoDigits(minutes), label: labels.minute },
    { unit: 'seconds', value: twoDigits(seconds), label: labels.second },
  ];
};

export const promotionIsVisibleAt = (promotion, now, toEpoch) => {
  const startsAt = toEpoch(promotion?.starts_at);
  const endsAt = toEpoch(promotion?.ends_at);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || !Number.isFinite(now)) return false;

  // Keep the offer for one final clock frame so 00:00:00 is shown without
  // changing the existing expired-offer behavior after that frame.
  return startsAt <= now && now < endsAt + SECOND_MS;
};

export const millisecondsToNextSecond = now => {
  const numericNow = Number(now);
  if (!Number.isFinite(numericNow)) return SECOND_MS;
  const elapsed = ((numericNow % SECOND_MS) + SECOND_MS) % SECOND_MS;
  return elapsed === 0 ? SECOND_MS : SECOND_MS - elapsed;
};
