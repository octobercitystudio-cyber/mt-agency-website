// Persistent daily rules expand only the calendar window being read.
export const nextBlockDate = date => {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10);
};
export function recurringBlocks(database, organizationId, from, to) {
  const existing = new Set((database.booking_blocks || []).filter(row => Number(row.organization_id ?? organizationId) === Number(organizationId)).map(row => `${row.series_key}|${row.block_date}`));
  const result = [];
  for (const rule of database.booking_block_series || []) {
    if (Number(rule.organization_id) !== Number(organizationId) || rule.status !== 'active' || rule.starts_on > to || rule.repeat_until && rule.repeat_until < from) continue;
    const end = rule.repeat_until && rule.repeat_until < to ? rule.repeat_until : to;
    for (let date = rule.starts_on > from ? rule.starts_on : from; date <= end; date = nextBlockDate(date)) {
      if (existing.has(`${rule.series_key}|${date}`)) continue;
      const fields = { ...rule }; delete fields.id;
      result.push({ ...fields, id: `recurrence:${rule.series_key}:${date}`, block_date: date, idempotency_key: `recurrence:${rule.series_key}:${date}` });
      if (date === end) break;
    }
  }
  return result;
}
export const calendarBlocks = (db, org, from, to) => [...(db.booking_blocks || []).filter(row => Number(row.organization_id ?? org) === Number(org)), ...recurringBlocks(db, org, from, to)];
export function firstSeriesOverlap(db, org, resource, from, until, start, end) {
  const minutes = (time, ending = false) => { const [h, m] = time.split(':').map(Number); return ending && h === 0 && m === 0 ? 1440 : h * 60 + m; };
  const overlap = row => Number(row.resource_id) === resource && minutes(row.start_time) < minutes(end, true) && minutes(row.end_time, true) > minutes(start);
  const last = until || '9999-12-31';
  for (const rule of db.booking_block_series || []) {
    if (Number(rule.organization_id) !== Number(org) || rule.status !== 'active' || !overlap(rule)) continue;
    const a = from > rule.starts_on ? from : rule.starts_on, b = rule.repeat_until && rule.repeat_until < last ? rule.repeat_until : last;
    const exceptions = new Set((db.booking_blocks || []).filter(row => Number(row.organization_id ?? org) === Number(org) && row.series_key === rule.series_key).map(row => row.block_date));
    for (let day = a; day <= b; day = nextBlockDate(day)) { if (!exceptions.has(day)) return day; if (day === b) break; }
  }
  return null;
}
