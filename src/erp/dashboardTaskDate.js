import { cairoDateKey, formatTime12 } from '../lib/businessFormat.js';

// Reminders store ISO instants; legacy unzoned values represent Cairo wall time.
export function dashboardTaskDate(value, now = new Date()) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!match) return { label: 'دون موعد', time: '', status: '', dateTime: '' };
  let key = match[1];
  let time = match[2] || '';
  const calendar = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== key || (time && (Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59))) {
    return { label: 'دون موعد', time: '', status: '', dateTime: '' };
  }
  if (match[3]) {
    const instant = new Date(raw.replace(' ', 'T'));
    if (!Number.isFinite(instant.getTime())) return { label: 'دون موعد', time: '', status: '', dateTime: '' };
    key = cairoDateKey(instant);
    time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
  }
  const today = cairoDateKey(now);
  return {
    label: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
    time: time ? formatTime12(time) : '',
    // Calendar-day urgency: a task due today stays "today" throughout Cairo's day.
    status: key < today ? 'overdue' : key === today ? 'today' : '',
    dateTime: raw.replace(' ', 'T'),
  };
}
