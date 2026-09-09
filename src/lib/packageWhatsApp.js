import { formatClientPoints, formatDurationMinutes, formatEGP, formatPackageQuantity } from './businessFormat.js';

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
