export const MAX_SESSION_COMPENSATION_SECONDS = 7 * 24 * 60 * 60;

const wholeNonNegative = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export const validateSessionCompensation = ({
  additionalMinutes,
  currentSeconds,
  grossSeconds,
  reason,
  maximumSeconds = MAX_SESSION_COMPENSATION_SECONDS,
}) => {
  const additional = wholeNonNegative(additionalMinutes);
  const current = wholeNonNegative(currentSeconds);
  const gross = wholeNonNegative(grossSeconds);
  const maximum = wholeNonNegative(maximumSeconds);
  const requestedTotal = current + (additional * 60);
  const maximumTotal = Math.min(gross, maximum);
  const maximumAdditionalSeconds = Math.max(0, maximumTotal - current);
  const normalizedReason = String(reason || '').trim();

  let durationErrorCode = '';
  if (additional < 1) durationErrorCode = 'duration_required';
  else if (requestedTotal > maximum) durationErrorCode = 'seven_day_limit';
  else if (requestedTotal > gross) durationErrorCode = 'gross_elapsed_limit';

  const reasonErrorCode = normalizedReason.length < 5 ? 'reason_too_short' : '';

  return {
    additionalMinutes: additional,
    requestedTotal,
    maximumAdditionalSeconds,
    normalizedReason,
    remainingReasonCharacters: Math.max(0, 5 - normalizedReason.length),
    durationErrorCode,
    reasonErrorCode,
    valid: !durationErrorCode && !reasonErrorCode,
  };
};
