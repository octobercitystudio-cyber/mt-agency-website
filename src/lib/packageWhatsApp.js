import { cairoDateKey, remainingCalendarDays, calculateDurationMinutes, formatBookingStatus, formatClientPoints, formatDurationMinutes, formatEGP, formatPackageQuantity, formatTime12 } from './businessFormat.js';

const APPOINTMENTS_EMPTY_MESSAGE = 'لا توجد مواعيد تصوير قادمة مرتبطة بهذه الباقة.';
const APPOINTMENTS_POLICY_NOTE = 'حرصًا منا على تنظيم جدول التصوير وتقديم أفضل مستوى من الخدمة، نرجو التكرم بإبلاغنا بأي طلب لتأجيل الموعد أو إلغائه قبل الموعد المحدد بمدة لا تقل عن *48 ساعة*. شاكرين تفهمكم وحسن تعاونكم.';
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const appointmentDateFormatters = {
  weekday: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', timeZone: 'Africa/Cairo' }),
  date: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }),
};

export { APPOINTMENTS_EMPTY_MESSAGE };

export function buildPackageReminderWhatsApp(details, client = {}) {
  const { package: pkg, quantities: q, validity } = details;
  const expiry = validity.expires_at?.slice(0, 10);
  const today = validity.today || cairoDateKey();
  if (!expiry || !appointmentDate(expiry)) throw new Error('صلاحية الباقة لم تبدأ بعد أو تاريخ انتهائها غير محدد. لا يمكن تجهيز تذكير بانتهائها الآن.');
  if (expiry < today || pkg.effective_status === 'expired' || pkg.status === 'expired') throw new Error('انتهت صلاحية هذه الباقة بالفعل. لا يمكن تذكير العميل بحجز مواعيد منها.');
  if (['suspended', 'cancelled', 'archived'].includes(pkg.effective_status || pkg.status)) throw new Error('هذه الباقة غير نشطة حاليًا. راجع حالتها قبل تذكير العميل بالحجز.');
  const hourly = pkg.billing_unit === 'hour';
  const remainingMinutes = q.purchased_minutes != null && q.used_minutes != null ? Math.max(0, q.purchased_minutes - q.used_minutes) : Math.round(Number(q.remaining) * 60);
  if ((hourly ? remainingMinutes : Number(q.remaining)) <= 0 || (pkg.effective_status || pkg.status) === 'completed') throw new Error('تم استهلاك رصيد هذه الباقة بالكامل. لا يوجد رصيد متبقٍ للتذكير.');
  const quantity = (value, minutes) => hourly ? formatDurationMinutes(minutes ?? Math.round(Number(value) * 60)) : formatPackageQuantity(value, pkg.billing_unit);
  const days = remainingCalendarDays(expiry, today);
  const balanceWord = hourly ? 'ساعات متبقية' : 'رصيد متبقٍ';
  return [
    `السلام عليكم أستاذ/ة *${client.name || pkg.client?.name || 'عميلنا الكريم'}*، نتمنى تكون بخير 🌷`, '',
    expiry === today ? '⏳ *تنتهي صلاحية باقتك اليوم — متبقي يوم واحد شامل اليوم.*' : `⏳ *متبقي ${days} يوم على انتهاء صلاحية باقتك.*`, '',
    'بنذكّرك باستغلال رصيد التصوير المتبقي وحجز مواعيدك قبل انتهاء الصلاحية.', '',
    '📦 *تفاصيل باقتك:*',
    `• اسم الباقة: *${pkg.name}*`,
    `• إجمالي رصيد التصوير: *${quantity(q.purchased, q.purchased_minutes)}*`,
    `• المستخدم: *${quantity(q.used, q.used_minutes)}*`,
    `• المتبقي لك: *${quantity(q.remaining, remainingMinutes)}*`,
    ...(Number(q.upcoming_held) > 0 ? [`• محجوز في مواعيد قادمة: *${quantity(q.upcoming_held, q.held_minutes)}*`, `• المتاح لحجز جديد: *${quantity(q.available, q.available_minutes)}*`] : []),
    `• تاريخ انتهاء الصلاحية: *${appointmentDateFormatters.date.format(appointmentDate(expiry))}*`, '',
    '📲 *افتح التطبيق، وادخل على قسم حجز مواعيد التصوير، واختَر مواعيد تتيح لك إتمام التصوير قبل انتهاء صلاحية الباقة.*', '',
    '📅 *احرص على الحجز بدري لضمان توافر موعد مناسب ليك، لأن المواعيد بتتأكد حسب المتاح وأسبقية الحجز.*', '',
    `⚠️ *بعد انتهاء صلاحية الباقة، لا يمكن استخدام أي ${balanceWord} بها؛ لذلك احجز مواعيدك واستغل رصيدك قبل تاريخ الانتهاء.*`, '',
    '*فريق Multi Task Agency*',
  ].join('\n');
}

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
