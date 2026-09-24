import { moneyToCents, centsToMoney, calculateDurationMinutes } from './businessFormat.js';
import { clientBookingDateError } from './clientBookingDate.js';
import { cairoDateTimeToEpoch } from './promotionTime.js';
import { clientWindowError, isClientBookingDateClosed } from './registrationPolicy.js';
export const STUDIO_TRANSFER_ACCOUNT = '01094084424';
export const STUDIO_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const STUDIO_SUCCESS_MESSAGE = 'تم إرسال طلبك بنجاح، وبانتظار تأكيد الحجز خلال ساعة من ساعات العمل الرسمية: من 12 ظهرًا إلى 10 مساءً، والجمعة إجازة.';
export const sortedStudioBookings = rows => [...rows].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`));
export const studioSelectedMinutes = rows => rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
export const studioPurchaseSelection = (service, hours) => {
  if (!service || service.kind !== 'hourly') return service;
  if (!Number.isSafeInteger(Number(hours)) || Number(hours) < 1 || Number(hours) > 300) return null;
  const price = Math.round(moneyToCents(service.price) * Number(hours) / Number(service.total_hours));
  return { ...service, total_hours: Number(hours), price: centsToMoney(price), deposit_amount: centsToMoney(Math.ceil(price / 2)), payment_due_hours: 0, payment_due_text: 'يُسدد باقي تكلفة كل يوم تصوير بالتنسيق مع الإدارة.', hourly_day_allocation: true };
};
export const studioDayShares = (service, bookings) => {
  const total = studioSelectedMinutes(bookings), price = moneyToCents(service.price), paid = moneyToCents(service.deposit_amount); let minutes = 0, priorPrice = 0, priorPaid = 0;
  return sortedStudioBookings(bookings).map(row => { minutes += Number(row.duration_minutes); const nextPrice = Math.round(price * minutes / total), nextPaid = Math.round(paid * minutes / total); const result = { ...row, price: centsToMoney(nextPrice - priorPrice), paid: centsToMoney(nextPaid - priorPaid) }; priorPrice = nextPrice; priorPaid = nextPaid; return result; });
};
export const validateStudioBookings = (service, bookings, requireOne = true, complete = true) => {
  if (!service) return 'اختر باقة تصوير أولًا.';
  if (!bookings.length) return requireOne ? 'أضف موعد تصوير واحدًا على الأقل.' : '';
  if (bookings.length > 30) return 'الحد الأقصى 30 موعدًا في الطلب الواحد.';
  const sorted = sortedStudioBookings(bookings); const first = sorted[0].date; if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !Number.isFinite(new Date(`${first}T12:00:00Z`).getTime())) return 'اختر تاريخًا صحيحًا.';
  const expiry = new Date(`${first}T12:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + Math.max(1, Number(service.validity_days || 1)) - 1); const endDate = expiry.toISOString().slice(0, 10);
  for (let index = 0; index < sorted.length; index++) {
    const row = sorted[index]; const policyError = clientWindowError(row); if (policyError) return policyError;
    const dateError = clientBookingDateError(row.date); if (dateError) return dateError;
    const duration = Number(row.duration_minutes); if (!Number.isInteger(duration) || duration < 60 || duration % 30 || duration !== calculateDurationMinutes(row.start_time, row.end_time)) return 'راجع مدة الموعد ووقت بدايته ونهايته.';
    if ((service.kind === 'daily' || service.package_validity_mode === 'shooting_day') && row.date !== first) return 'مواعيد الباقة اليومية يجب أن تكون في يوم واحد.';
    if (service.kind !== 'hourly' && row.date > endDate) return 'أحد المواعيد خارج صلاحية الباقة، المحسوبة من أول موعد مقترح.';
    if (sorted.slice(0, index).some(prior => prior.date === row.date)) return 'يمكن حجز فترة واحدة متصلة فقط في اليوم. عدّل مدة الموعد بدل إضافة فترة أخرى.';
  }
  const remaining = Math.round(Number(service.total_hours) * 60) - studioSelectedMinutes(sorted);
  if (!complete && service.kind === 'hourly' && remaining > 0 && remaining < 60) return 'هذا التقسيم يترك أقل من ساعة. عدّل المدة ليكون كل يوم ساعة على الأقل.';
  if (complete && (service.kind === 'daily' || service.package_validity_mode === 'shooting_day' || service.kind === 'hourly') && studioSelectedMinutes(sorted) < Math.round(Number(service.total_hours) * 60)) return service.kind === 'hourly' ? 'وزّع كل الساعات المختارة على المواعيد قبل المتابعة، بحد أدنى ساعة في اليوم.' : 'يجب حجز ساعات الباقة اليومية كاملة في جلسة واحدة متصلة في يوم واحد.';
  return studioSelectedMinutes(sorted) > Math.round(Number(service.total_hours) * 60) ? 'إجمالي المواعيد يتجاوز ساعات الباقة. قلّل المدة أو احذف موعدًا.' : '';
};
export const validateStudioProof = file => !file ? 'أرفق صورة إيصال التحويل لإرسال الطلب.' : !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'الصورة يجب أن تكون JPEG أو PNG أو WebP.' : file.size <= 0 || file.size > STUDIO_PROOF_MAX_BYTES ? 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت.' : '';
export const studioBookingReady = (request, appointment) => request.package_status === 'approved' && appointment.status === 'pending' && !sortedStudioBookings(request.bookings).some(row => row.status === 'pending' && `${row.date} ${row.start_time}` < `${appointment.date} ${appointment.start_time}`);
const shiftDay = date => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
export const studioReviewDeadline = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  let date = `${parts.year}-${parts.month}-${parts.day}`; let seconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second); let remaining = 3600;
  while (remaining > 0) { if (isClientBookingDateClosed(date) || seconds >= 22 * 3600) { date = shiftDay(date); seconds = 12 * 3600; continue; } seconds = Math.max(seconds, 12 * 3600); const used = Math.min(remaining, 22 * 3600 - seconds); remaining -= used; seconds += used; if (remaining) { date = shiftDay(date); seconds = 12 * 3600; } }
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return new Date(cairoDateTimeToEpoch(`${date}T${time}`)).toISOString();
};
