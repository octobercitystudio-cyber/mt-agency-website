import { durationHoursToMinutes, durationMinutesToHours, formatDurationMinutes, splitDurationMinutes } from '../lib/businessFormat';
import './DurationHoursMinutesInput.css';

const wholeNumber = value => {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export default function DurationHoursMinutesInput({
  label = 'المدة', value, onChange, valueUnit = 'hours', minMinutes = 0, maxMinutes,
  readOnly = false, disabled = false, required = false, error = '', className = '', idPrefix = 'duration',
}) {
  const sourceMinutes = valueUnit === 'minutes' ? wholeNumber(value) : durationHoursToMinutes(value);
  const { hours, minutes, totalMinutes } = splitDurationMinutes(sourceMinutes);
  const maximum = Number.isFinite(Number(maxMinutes)) ? Math.max(0, Math.round(Number(maxMinutes))) : null;
  const minimum = Math.max(0, Math.round(Number(minMinutes) || 0));

  const commit = (nextHours, nextMinutes) => {
    const normalized = Math.max(minimum, (wholeNumber(nextHours) * 60) + wholeNumber(nextMinutes));
    const bounded = maximum === null ? normalized : Math.min(normalized, maximum);
    onChange?.(String(valueUnit === 'minutes' ? bounded : durationMinutesToHours(bounded)), bounded);
  };

  return <div className={`duration-hours-minutes ${className}`.trim()}>
    <span className="duration-hours-minutes__title">{label}{required ? ' *' : ''}</span>
    <div className="duration-hours-minutes__fields">
      <label htmlFor={`${idPrefix}-hours`}><span>ساعات</span><input id={`${idPrefix}-hours`} aria-label={`${label} - ساعات`} type="number" inputMode="numeric" min="0" step="1" value={hours} readOnly={readOnly} disabled={disabled} onChange={event => commit(event.target.value, minutes)} /></label>
      <b aria-hidden="true">:</b>
      <label htmlFor={`${idPrefix}-minutes`}><span>دقائق</span><input id={`${idPrefix}-minutes`} aria-label={`${label} - دقائق`} type="number" inputMode="numeric" min="0" step="1" value={minutes} readOnly={readOnly} disabled={disabled} onChange={event => commit(hours, event.target.value)} /></label>
    </div>
    <small className="duration-hours-minutes__help">{formatDurationMinutes(totalMinutes)} · كل 60 دقيقة = ساعة واحدة</small>
    {error && <small className="duration-hours-minutes__error" role="alert">{error}</small>}
  </div>;
}
