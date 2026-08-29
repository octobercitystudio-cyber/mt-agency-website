import { useEffect, useRef, useState } from 'react';
import BusinessTimeSelect from './BusinessTimeSelect';
import { normalizeTime } from '../lib/businessFormat';

const splitDateTime = rawValue => {
  const raw = String(rawValue || '').trim().replace(' ', 'T').slice(0, 16);
  const [date = '', rawTime = ''] = raw.split('T');
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', time: normalizeTime(rawTime) };
};
const joinDateTime = parts => parts.date && parts.time ? `${parts.date}T${parts.time}` : '';

export default function BusinessDateTimeInput({ value, defaultValue, name, onChange, required = false, defaultTime = '12:00', className = '', inputClassName = '', style, min, max, ...props }) {
  const externalValue = value !== undefined ? value : defaultValue;
  const [parts, setParts] = useState(() => splitDateTime(externalValue));
  const lastExternal = useRef(String(externalValue || ''));

  useEffect(() => {
    const incoming = String(externalValue || '');
    if (incoming === lastExternal.current) return;
    lastExternal.current = incoming;
    setParts(splitDateTime(incoming));
  }, [externalValue]);

  const commit = (event, next) => {
    setParts(next);
    const combined = joinDateTime(next);
    lastExternal.current = combined;
    onChange?.({ ...event, target: { value: combined, name }, currentTarget: { value: combined, name } });
  };

  return <span className={`business-datetime-control ${className}`.trim()} style={style}>
    <input {...props} className={inputClassName} type="date" required={required} min={min ? String(min).slice(0, 10) : undefined} max={max ? String(max).slice(0, 10) : undefined} value={parts.date} onChange={event => commit(event, { date: event.target.value, time: parts.time || defaultTime })} />
    <BusinessTimeSelect className={inputClassName} required={required} value={parts.time} defaultPeriod="pm" onChange={event => commit(event, { date: parts.date, time: event.target.value })} />
    {name && <input type="hidden" name={name} value={joinDateTime(parts)} />}
  </span>;
}
