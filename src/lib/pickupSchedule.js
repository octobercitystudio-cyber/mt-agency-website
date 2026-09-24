export const COMPANY_PICKUP_SCHEDULE_KEY = 'post_production_pickup_schedule';
export const emptyCompanyPickupSchedule = () => ({ revision: 0, enabled: false, timezone: 'Africa/Cairo', note: '', windows: [], updated_at: null });
const reject = (message, code) => { const error = new Error(message); error.code = code; error.status = 422; throw error; };
export function validateCompanyPickupSchedule(payload) {
  if (typeof payload.enabled !== 'boolean' || typeof (payload.note ?? '') !== 'string' || [...(payload.note ?? '').trim()].length > 500) reject('راجع تفعيل جدول الاستلام والملاحظة (بحد أقصى 500 حرف).', 'invalid_pickup_schedule');
  if (!Array.isArray(payload.windows) || payload.windows.length > 21 || (payload.enabled && !payload.windows.length)) reject('أضف فترة استلام واحدة على الأقل عند تفعيل الجدول، وبحد أقصى 21 فترة.', 'invalid_pickup_windows');
  const windows = payload.windows.map(window => {
    if (!window || !Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) reject('اختر يومًا صحيحًا من أيام الأسبوع.', 'invalid_pickup_weekday');
    if (typeof window.start_time !== 'string' || typeof window.end_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.start_time) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.end_time) || window.end_time <= window.start_time) reject('وقت نهاية الاستلام يجب أن يكون بعد البداية في اليوم نفسه.', 'invalid_pickup_window');
    return { weekday: window.weekday, start_time: window.start_time, end_time: window.end_time };
  }).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  windows.forEach((window, index) => { const previous = windows[index - 1]; if (previous && previous.weekday === window.weekday && window.start_time < previous.end_time) reject('توجد فترات استلام متداخلة في اليوم نفسه.', 'pickup_schedule_overlap'); });
  return { enabled: payload.enabled, timezone: 'Africa/Cairo', note: (payload.note ?? '').trim(), windows };
}
