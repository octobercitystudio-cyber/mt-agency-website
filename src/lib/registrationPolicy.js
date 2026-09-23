export const REGISTRATION_TERMS_VERSION = '2026-09-23';
export const CLIENT_BOOKING_POLICY = Object.freeze({ opens: '12:00', closes: '22:00', closed_weekday: 5, cancellation_hours: 48, notice_excludes_friday: true, minimum_booking_minutes: 60, one_session_per_day: true });
export const CLIENT_BOOKING_POLICY_LABEL = 'يوميًا من 12 ظهرًا إلى 10 مساءً، عدا الجمعة.';
export const CANCELLATION_TERMS = 'يجب طلب تأجيل الموعد أو إلغائه قبل موعد التصوير بـ 48 ساعة على الأقل، دون احتساب يوم الجمعة. بخلاف ذلك يظل الموعد مؤكدًا وتُخصم مدته من الباقة.';
export const REGISTRATION_KIND_LABELS = { hourly: 'التصوير بالساعة', daily: 'الباقات اليومية', monthly: 'الباقات الشهرية' };
export const registrationValidityLabel = service => service?.package_validity_mode === 'shooting_day' || service?.kind === 'daily' ? 'يوم التصوير الأول فقط' : `${Number(service?.validity_days || 0)} يومًا من أول موعد معتمد`;
export const isClientBookingDateClosed = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
export const clientWindowError = ({ date, start_time, end_time, duration_minutes }) => {
  if (isClientBookingDateClosed(date)) return 'الجمعة إجازة. اختر يومًا آخر.';
  const start = String(start_time || '').slice(0, 5); const end = String(end_time || '').slice(0, 5);
  if (start < '12:00' || end > '22:00' || end <= start || !/^\d{2}:\d{2}$/.test(start + '') || !/^\d{2}:\d{2}$/.test(end + '')) return 'الحجز متاح من 12 ظهرًا إلى 10 مساءً.';
  if (Number(duration_minutes) < 60) return 'الحد الأدنى للحجز ساعة متصلة.';
  if (Number(duration_minutes) > 600) return 'أقصى مدة متاحة في اليوم 10 ساعات.';
  return '';
};
export const pendingIntakeCount = items => (items || []).reduce((sum, item) => sum + ['registration', 'package', 'booking'].filter(stage => item[`${stage}_status`] === 'pending').length, 0);
export const intakeStageReady = (item, stage) => item?.[`${stage}_status`] === 'pending' && (stage === 'registration' || item.registration_status === 'approved') && (stage !== 'booking' || item.package_status === 'approved');

export const normalizeRegistrationDigits = value => String(value || "").replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
