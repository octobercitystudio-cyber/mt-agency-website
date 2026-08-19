import { formatDurationMinutes } from './businessFormat.js';

const timeMinutes = value => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})/);
  if (!match) return -1;
  if (match[1] === '24' && match[2] === '00') return 1440;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < 1440 ? minutes : -1;
};

export const appointmentDurationMinutes = appointment => timeMinutes(appointment?.end_time) - timeMinutes(appointment?.start_time);

const dateKeyFromParts = parts => {
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const cairoAppointmentNowKey = (now = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${dateKeyFromParts(parts)} ${values.hour}:${values.minute}`;
};

export const appointmentStartIsPast = (candidate, nowKey = cairoAppointmentNowKey()) => /^\d{4}-\d{2}-\d{2}$/.test(String(candidate?.date || '')) && /^\d{2}:\d{2}/.test(String(candidate?.start_time || '')) && `${candidate.date} ${String(candidate.start_time).slice(0, 5)}` <= nowKey;

export const shiftPackageCalendarDate = (dateKey, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Number(days || 0));
  return value.toISOString().slice(0, 10);
};

export const packageCalendarWeek = (anchorDate, { startsAt = '', expiresAt = '', shootingDate = '', resourceId = '', occupied = [], appointments = [], todayKey = cairoAppointmentNowKey().slice(0, 10) } = {}) => {
  const anchor = shootingDate || anchorDate || todayKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return [];
  const anchorValue = new Date(`${anchor}T12:00:00Z`);
  const saturdayOffset = (anchorValue.getUTCDay() + 1) % 7;
  const firstDate = shootingDate || shiftPackageCalendarDate(anchor, -saturdayOffset);
  return Array.from({ length: shootingDate ? 1 : 7 }, (_, index) => {
    const date = shiftPackageCalendarDate(firstDate, index);
    const resourceMatches = item => !resourceId || Number(item.resource_id) === Number(resourceId);
    const occupiedCount = occupied.filter(item => resourceMatches(item) && String(item.date).slice(0, 10) === date && ['confirmed', 'in_progress'].includes(item.status)).length;
    const plannedCount = appointments.filter(item => resourceMatches(item) && String(item.date).slice(0, 10) === date).length;
    const outsidePackage = Boolean(startsAt && date < startsAt || expiresAt && date > expiresAt || shootingDate && date !== shootingDate);
    return { date, occupiedCount, plannedCount, disabled: date < todayKey || outsidePackage, outsidePackage };
  });
};

export const partitionPackageAppointments = (appointments, draft, expiresAt) => (appointments || []).reduce((result, item) => {
  const valid = (!draft?.starts_at || item.date >= draft.starts_at) && (!expiresAt || item.date <= expiresAt) && (draft?.validity_mode_snapshot !== 'shooting_day' || item.date === draft.shooting_date);
  result[valid ? 'kept' : 'invalid'].push(item);
  return result;
}, { kept: [], invalid: [] });

export const packageAppointmentUsage = (appointments, unit, purchased) => {
  const selected = (appointments || []).reduce((sum, item) => sum + (unit === 'reel' ? Number(item.requested_quantity || 0) : Math.max(0, appointmentDurationMinutes(item)) / 60), 0);
  return { selected, remaining: Math.max(0, Number(purchased || 0) - selected), exceeded: selected > Number(purchased || 0) + 0.000001 };
};

export const appointmentConflicts = (candidate, appointments = [], occupied = [], editIndex = -1) => {
  const overlaps = item => Number(item.resource_id) === Number(candidate.resource_id) && String(item.date).slice(0, 10) === candidate.date && String(item.start_time).slice(0, 5) < candidate.end_time && String(item.end_time).slice(0, 5) > candidate.start_time;
  return appointments.some((item, index) => index !== editIndex && overlaps(item)) || occupied.some(item => ['confirmed', 'in_progress'].includes(item.status) && overlaps(item));
};

export const validatePackageAppointment = (candidate, { unit = 'hour', minimumMinutes = 60, incrementMinutes = 15, startsAt = '', expiresAt = '', shootingDate = '', appointments = [], occupied = [], editIndex = -1, nowKey = cairoAppointmentNowKey() } = {}) => {
  const errors = {};
  const duration = appointmentDurationMinutes(candidate);
  if (!(Number(candidate?.resource_id) > 0)) errors.resource_id = 'اختر الاستديو أو المورد.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(candidate?.date || ''))) errors.date = 'حدد تاريخ الموعد.';
  if (timeMinutes(candidate?.start_time) < 720 || timeMinutes(candidate?.end_time) > 1440 || duration < minimumMinutes || duration % incrementMinutes !== 0) errors.time = `الموعد من 12:00 م إلى 12:00 ص، بحد أدنى ${formatDurationMinutes(minimumMinutes)} وبزيادات ${formatDurationMinutes(incrementMinutes)}.`;
  if (candidate?.date && ((startsAt && candidate.date < startsAt) || (expiresAt && candidate.date > expiresAt) || (shootingDate && candidate.date !== shootingDate))) errors.date = 'الموعد خارج فترة صلاحية الباقة.';
  if (!errors.date && !errors.time && appointmentStartIsPast(candidate, nowKey)) errors.past = 'لا يمكن إضافة موعد في وقت ماضٍ.';
  if (unit === 'reel' && (!Number.isSafeInteger(Number(candidate?.requested_quantity)) || Number(candidate.requested_quantity) < 1)) errors.requested_quantity = 'عدد الريلز يجب أن يكون رقمًا صحيحًا موجبًا.';
  if (!Object.keys(errors).length && appointmentConflicts(candidate, appointments, occupied, editIndex)) errors.conflict = 'هذا الموعد متعارض مع حجز آخر.';
  return errors;
};

export const normalizePackageSaleAppointments = appointments => [...(appointments || [])].map(item => ({ resource_id: Number(item.resource_id), date: item.date, start_time: String(item.start_time).slice(0, 5), end_time: String(item.end_time).slice(0, 5), requested_quantity: Number(item.requested_quantity || 0), notes: String(item.notes || '').trim() })).sort((a, b) => `${a.date}|${a.start_time}|${a.end_time}|${a.resource_id}`.localeCompare(`${b.date}|${b.start_time}|${b.end_time}|${b.resource_id}`));
