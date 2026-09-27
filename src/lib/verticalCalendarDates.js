const DAY = 86400000;
const parseDay = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
const key = date => date.toISOString().slice(0, 10);

export function verticalCalendarRange(anchor, view = 'month') {
  const date = parseDay(anchor);
  if (!date) return { start: '', endExclusive: '', days: [] };
  const start = view === 'week'
    ? new Date(date.getTime() - ((date.getUTCDay() + 1) % 7) * DAY)
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
  const end = view === 'week' ? new Date(start.getTime() + 7 * DAY) : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12));
  return { start: key(start), endExclusive: key(end), days: Array.from({ length: Math.round((end - start) / DAY) }, (_, index) => key(new Date(start.getTime() + index * DAY))) };
}

export function shiftVerticalCalendar(anchor, view, delta) {
  const date = parseDay(anchor);
  if (!date) return '';
  return key(view === 'week' ? new Date(date.getTime() + delta * 7 * DAY) : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 12)));
}

export function groupVerticalCalendarEvents(events, days) {
  const groups = new Map(days.map(date => [date, []]));
  for (const event of events || []) {
    const date = String(event.start || '').slice(0, 10);
    groups.get(date)?.push(event);
  }
  for (const rows of groups.values()) rows.sort((a, b) => String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id)));
  return groups;
}

// A month matrix transposed: weekday rows, Saturday-start week columns.
export function transposeCalendarDays(days) {
  const dates = [...new Set(days)].filter(value => parseDay(value)).sort();
  const rows = [6, 0, 1, 2, 3, 4, 5].map(weekday => ({ weekday, cells: [] }));
  if (!dates.length) return { weekCount: 0, rows };
  const first = parseDay(dates[0]);
  const weekStart = first.getTime() - ((first.getUTCDay() + 1) % 7) * DAY;
  const weekCount = Math.floor((parseDay(dates.at(-1)).getTime() - weekStart) / (7 * DAY)) + 1;
  rows.forEach(row => { row.cells = Array(weekCount).fill(null); });
  for (const value of dates) {
    const date = parseDay(value);
    const weekdayIndex = (date.getUTCDay() + 1) % 7;
    const weekIndex = Math.floor((date.getTime() - weekStart) / (7 * DAY));
    rows[weekdayIndex].cells[weekIndex] = value;
  }
  return { weekCount, rows };
}
