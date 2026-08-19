import { useId, useState } from 'react';

const TIME_PATTERN = '(?:[01]\\d|2[0-3]):[0-5]\\d|24:00';
const TIME_ERROR = 'اكتب الوقت بصيغة HH:MM، مثل 14:30. يمكن استخدام 24:00 كنهاية لليوم.';

const BusinessTimeSelect = ({ min, max, step = 15, value, className = '', style, onInvalid, onInput, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props }) => {
  const generatedId = useId();
  const [invalid, setInvalid] = useState(false);
  const errorId = `${props.id || `business-time-${generatedId}`}-error`;
  return <>
    <input
      {...props}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={value || ''}
      placeholder="HH:MM"
      pattern={TIME_PATTERN}
      title={TIME_ERROR}
      data-min-time={min}
      data-max-time={max}
      data-step-minutes={step}
      aria-invalid={invalid || ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
      aria-describedby={[describedBy, invalid ? errorId : ''].filter(Boolean).join(' ') || undefined}
      className={`business-time-input ${className}`.trim()}
      style={{ width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: '.08em', ...style }}
      onInvalid={event => { event.preventDefault(); setInvalid(true); onInvalid?.(event); }}
      onInput={event => { if (event.currentTarget.validity.valid) setInvalid(false); onInput?.(event); }}
    />
    {invalid && <small id={errorId} className="business-time-error" role="alert">{TIME_ERROR}</small>}
  </>;
};

export default BusinessTimeSelect;
