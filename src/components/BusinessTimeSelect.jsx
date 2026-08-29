import { useEffect, useId, useRef, useState } from 'react';
import { time12To24, time24To12Parts, timeToMinutes } from '../lib/businessFormat';
import './BusinessTimeSelect.css';

const TIME_PATTERN = '(?:0?[1-9]|1[0-2]):[0-5]\\d';
const TIME_ERROR = 'اكتب الوقت بنظام 12 ساعة، مثل 2:30، ثم اختر ص أو م. الاختيار الافتراضي مساءً.';
const latinDigits = value => String(value || '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const BusinessTimeSelect = ({ min, max, step = 15, value, defaultPeriod = 'pm', className = '', style, name, onChange, onInvalid, onInput, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props }) => {
  const generatedId = useId();
  const initial = time24To12Parts(value, { defaultPeriod });
  const [draft, setDraft] = useState(initial.value);
  const [period, setPeriod] = useState(initial.period);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(null);
  const lastValue = useRef(String(value || ''));
  const errorId = `${props.id || `business-time-${generatedId}`}-error`;

  useEffect(() => {
    const incoming = String(value || '');
    if (incoming === lastValue.current) return;
    lastValue.current = incoming;
    const next = time24To12Parts(incoming, { defaultPeriod });
    setDraft(next.value);
    setPeriod(next.period);
    setInvalid(false);
  }, [value, defaultPeriod]);

  const storedValue = (text = draft, nextPeriod = period) => time12To24(text, nextPeriod, { endOfDay: max === '24:00' });
  const validationMessage = stored => {
    if (!stored) return TIME_ERROR;
    const minutes = timeToMinutes(stored, { endOfDay: max === '24:00' });
    const minimum = min ? timeToMinutes(min) : Number.NaN;
    const maximum = max ? timeToMinutes(max, { endOfDay: true }) : Number.NaN;
    if (Number.isFinite(minimum) && minutes < minimum) return `الوقت يجب ألا يسبق ${time24To12Parts(min).value} ${time24To12Parts(min).period === 'am' ? 'ص' : 'م'}.`;
    if (Number.isFinite(maximum) && minutes > maximum) return `الوقت يجب ألا يتجاوز ${time24To12Parts(max).value} ${time24To12Parts(max).period === 'am' ? 'ص' : 'م'}.`;
    if (Number.isFinite(minimum) && Number(step) > 0 && (minutes - minimum) % Number(step) !== 0) return `استخدم زيادات ${Number(step)} دقيقة.`;
    return '';
  };
  const emit = (event, nextValue) => {
    lastValue.current = nextValue;
    onChange?.({ ...event, target: { value: nextValue, name }, currentTarget: { value: nextValue, name } });
  };
  const applyValidity = (input, stored) => {
    const message = validationMessage(stored);
    input?.setCustomValidity?.(message);
    setInvalid(Boolean(message));
    return !message;
  };
  const handleTextChange = event => {
    const nextDraft = latinDigits(event.target.value).replace(/\s+/g, '');
    setDraft(nextDraft);
    if (!nextDraft) {
      event.target.setCustomValidity('');
      setInvalid(false);
      emit(event, '');
      return;
    }
    const stored = storedValue(nextDraft, period);
    if (stored) {
      applyValidity(event.target, stored);
      emit(event, stored);
    } else {
      event.target.setCustomValidity(TIME_ERROR);
      setInvalid(true);
    }
  };
  const choosePeriod = (event, nextPeriod) => {
    setPeriod(nextPeriod);
    const stored = storedValue(draft, nextPeriod);
    if (stored && applyValidity(inputRef.current, stored)) emit(event, stored);
  };

  return <>
    <span className="business-time-control" data-default-period="pm">
      <input
        ref={inputRef}
        {...props}
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={draft}
        placeholder="2:30"
        pattern={TIME_PATTERN}
        title={TIME_ERROR}
        data-min-time={min}
        data-max-time={max}
        data-step-minutes={step}
        data-period={period}
        aria-invalid={invalid || ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
        aria-describedby={[describedBy, invalid ? errorId : ''].filter(Boolean).join(' ') || undefined}
        className={`business-time-input ${className}`.trim()}
        style={{ width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: '.08em', ...style }}
        onChange={handleTextChange}
        onBlur={event => { const stored = storedValue(); if (stored) { const next = time24To12Parts(stored); setDraft(next.value); applyValidity(event.currentTarget, stored); } }}
        onInvalid={event => { event.preventDefault(); setInvalid(true); onInvalid?.(event); }}
        onInput={event => { if (event.currentTarget.validity.valid) setInvalid(false); onInput?.(event); }}
      />
      <span className="business-time-period" role="group" aria-label="صباحًا أو مساءً">
        <button type="button" className={period === 'am' ? 'active' : ''} aria-pressed={period === 'am'} title="صباحًا" onClick={event => choosePeriod(event, 'am')}>ص</button>
        <button type="button" className={period === 'pm' ? 'active' : ''} aria-pressed={period === 'pm'} title="مساءً" onClick={event => choosePeriod(event, 'pm')}>م</button>
      </span>
      {name && <input type="hidden" name={name} value={storedValue()} />}
    </span>
    {invalid && <small id={errorId} className="business-time-error" role="alert">{TIME_ERROR}</small>}
  </>;
};

export default BusinessTimeSelect;
