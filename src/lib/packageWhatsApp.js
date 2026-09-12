import { calculateDurationMinutes, formatBookingStatus, formatClientPoints, formatDurationMinutes, formatEGP, formatPackageQuantity, formatTime12 } from './businessFormat.js';

const APPOINTMENTS_EMPTY_MESSAGE = 'لا توجد مواعيد تصوير قادمة مرتبطة بهذه الباقة.';
const APPOINTMENTS_POLICY_NOTE = 'حرصًا منا على تنظيم جدول التصوير وتقديم أفضل مستوى من الخدمة، نرجو التكرم بإبلاغنا بأي طلب لتأجيل الموعد أو إلغائه قبل الموعد المحدد بمدة لا تقل عن *48 ساعة*. شاكرين تفهمكم وحسن تعاونكم.';
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const appointmentDateFormatters = {
  weekday: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', timeZone: 'Africa/Cairo' }),
  date: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }),
};

export { APPOINTMENTS_EMPTY_MESSAGE };

export function whatsappPhone(value) {
  let phone = String(value || '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[\s()+.-]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (/^01\d{9}$/.test(phone)) phone = `2${phone}`;
  return /^[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

export function buildPackageWhatsApp(details, client, config = {}) {
  const { package: pkg, quantities: q, financial: f, validity } = details;
  const quantity = (value, minutes) => (pkg.billing_unit === 'hour' && minutes != null
    ? formatDurationMinutes(minutes, { compact: true }) : formatPackageQuantity(value, pkg.billing_unit)).replace(/ س (\d)/, ' س و $1');
  const expiry = validity.expires_at?.slice(0, 10);
  const expiryLabel = expiry ? `${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' }).format(new Date(`${expiry}T12:00:00+02:00`))} ${expiry}` : 'لم تبدأ الصلاحية بعد؛ تبدأ عند أول حجز تصوير';
  const lines = [
    `مرحباً بك أستاذ/ة *${client.name || pkg.client.name}*،`,
    'تحية طيبة من عائلة *Multi Task Agency* 📸', '',
    `📋 *ملخص باقة التصوير (${pkg.name}):*`, '',
    `- ${pkg.billing_unit === 'hour' ? 'إجمالي الساعات' : 'إجمالي الباقة'}: ${quantity(q.purchased, q.purchased_minutes)}`,
    `- تم تصويره سابقاً: ${quantity(q.used, q.used_minutes)}`,
    `- الإجمالي المستخدم: ${quantity(q.used, q.used_minutes)}`,
    `- المتبقي في الباقة: ${quantity(q.remaining, q.purchased_minutes != null && q.used_minutes != null ? Math.max(0, q.purchased_minutes - q.used_minutes) : null)}`,
  ];
  if (Number(q.upcoming_held) > 0) lines.push(`- محجوز قادمًا: ${quantity(q.upcoming_held, q.held_minutes)}`, `- المتاح لحجز جديد: ${quantity(q.available, q.available_minutes)}`);
  lines.push(`- الصلاحية تنتهي في: ${expiryLabel}`, '', '💳 *الحالة المالية للباقة:*', '',
    `- التكلفة: ${formatEGP(f.total_price)} | المدفوع: ${formatEGP(f.paid_amount)} | المتبقي للدفع: ${formatEGP(f.outstanding)}`);
  if (Number(f.overage_amount) > 0) lines.push(`- رسوم التجاوز: ${formatEGP(f.overage_amount)} (محتسبة ضمن المتبقي للدفع)`);
  if (Number(f.customer_credit) > 0) lines.push(`- رصيد دائن: ${formatEGP(f.customer_credit)}`);
  if (client.points != null) {
    const threshold = Number(config.points_redeem_threshold);
    const reward = threshold > 0 ? Number(client.points) >= threshold
      ? '، يمكنك الآن استبدال نقاطك بخصومات وفق نظام الولاء!' : `، يمكنك استبدالها بخصومات عند الوصول لـ ${formatClientPoints(threshold)} نقطة!` : '.';
    lines.push('', `🌟 *نقاط الولاء الخاصة بك:* لديك الآن (${formatClientPoints(client.points)} نقطة)${reward}`);
  }
  lines.push('', 'نتشرف دائماً بوجودك معنا، ونتمنى لك يوماً سعيداً! 🌟');
  return lines.join('\n');
}

const appointmentDate = value => {
  const match = String(value || '').slice(0, 10).match(dateOnlyPattern);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return date;
};

const appointmentDuration = booking => {
  const authoritative = Number(booking?.duration_minutes);
  if (Number.isFinite(authoritative) && authoritative > 0) return Math.round(authoritative);
  return calculateDurationMinutes(booking?.start_time, booking?.end_time);
};

export function sortPackageAppointments(appointments = []) {
  return [...appointments].sort((left, right) => (
    String(left?.date || '').localeCompare(String(right?.date || ''))
    || String(left?.start_time || '').localeCompare(String(right?.start_time || ''))
    || String(left?.id ?? '').localeCompare(String(right?.id ?? ''), 'en', { numeric: true })
  ));
}

export function buildPackageAppointmentsWhatsApp(details, client) {
  const appointments = sortPackageAppointments(details?.upcoming_bookings || []);
  if (!appointments.length) return '';

  const pkg = details?.package || {};
  const clientName = client?.name || pkg.client?.name || 'عميلنا الكريم';
  const packageName = pkg.name || 'باقة التصوير';
  const appointmentBlocks = appointments.map((booking, index) => {
    const date = appointmentDate(booking.date);
    const lines = [
      `*الموعد رقم ${index + 1}*`,
      `- اليوم: ${date ? appointmentDateFormatters.weekday.format(date) : '—'}`,
      `- التاريخ: ${date ? appointmentDateFormatters.date.format(date) : '—'}`,
      `- من: ${formatTime12(booking.start_time)}`,
      `- إلى: ${formatTime12(booking.end_time)}`,
      `- مدة التصوير: ${formatDurationMinutes(appointmentDuration(booking))}`,
    ];
    if (booking.status !== 'confirmed') lines.push(`- حالة الموعد: ${formatBookingStatus(booking.status)}`);
    return lines.join('\n');
  });

  return [
    `مرحبًا أستاذ/ة *${clientName}*،`,
    'تحية طيبة من فريق *Multi Task Agency* 📸',
    '',
    `يسعدنا تأكيد مواعيد التصوير المسجلة ضمن *${packageName}*:`,
    '',
    '📅 *مواعيد التصوير:*',
    '',
    appointmentBlocks.join('\n\n'),
    '',
    '📌 *تنويه مهم:*',
    APPOINTMENTS_POLICY_NOTE,
    '',
    'نتطلع إلى استقبالكم، ونتمنى لكم تجربة تصوير مميزة.',
    'مع خالص التحية،',
    '*Multi Task Agency*',
  ].join('\n');
}
