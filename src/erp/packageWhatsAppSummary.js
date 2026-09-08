const cleanNumber = value => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const compactNumber = value => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(cleanNumber(value));

export function normalizeWhatsAppPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : '';
}

export function packageDurationLabel(minutes) {
  const total = Math.max(0, Math.round(cleanNumber(minutes)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours && remainder) return `${hours} س و${remainder} د`;
  if (hours) return `${hours} س`;
  return `${remainder} د`;
}

const quantityLabel = (value, unit) => unit === 'hour'
  ? packageDurationLabel(value)
  : `${compactNumber(value)} ${unit === 'reel' ? 'ريل' : 'وحدة'}`;

const expiryLabel = value => {
  const isoDate = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'غير محددة';
  const date = new Date(`${isoDate}T12:00:00`);
  const weekday = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(date);
  return `${weekday} ${isoDate}`.trim();
};

export function formatPackageWhatsAppMessage(summary = {}) {
  const unit = summary.billing_unit === 'reel' ? 'reel' : 'hour';
  const purchased = unit === 'hour' ? summary.purchased_minutes : summary.purchased_quantity;
  const consumed = unit === 'hour' ? summary.consumed_minutes : summary.consumed_quantity;
  const remaining = unit === 'hour' ? summary.remaining_minutes : summary.remaining_quantity;
  const today = unit === 'hour' ? summary.today_minutes : summary.today_quantity;
  const threshold = unit === 'hour' ? summary.payment_due_minutes : summary.payment_due_quantity;
  const outstanding = Math.max(0, cleanNumber(summary.outstanding_amount));
  const paymentDueReached = Boolean(summary.payment_due_reached) && cleanNumber(threshold) > 0 && outstanding > 0;
  const lines = [
    `مرحباً بك أستاذ ${String(summary.client_name || 'عميلنا العزيز').trim()}،`,
    'تحية طيبة من عائلة Multi Task Agency 📸',
    '',
    `📋 ملخص باقة التصوير (${String(summary.package_name || 'الباقة الحالية').trim()}):`,
    '',
    `- إجمالي ${unit === 'hour' ? 'الساعات' : 'الريلز'}: ${quantityLabel(purchased, unit)}`,
    `- تم تصويره اليوم: ${quantityLabel(today, unit)}`,
    `- الإجمالي المستخدم: ${quantityLabel(consumed, unit)}`,
    `- المتبقي في الباقة: ${quantityLabel(remaining, unit)}`,
    `- الصلاحية تنتهي في: ${expiryLabel(summary.expires_at)}`,
    '',
    '💳 الحالة المالية للباقة:',
    '',
    `- التكلفة: ${compactNumber(summary.total_amount)} ج.م | المدفوع: ${compactNumber(summary.paid_amount)} ج.م | المتبقي للدفع: ${compactNumber(outstanding)} ج.م`,
  ];
  if (paymentDueReached) {
    lines.push(
      '',
      `⚠️ تنبيه هام: لقد تم تجاوز ${unit === 'hour' ? 'ساعات' : 'حد'} الاستحقاق المتفق عليها (${quantityLabel(threshold, unit)}). يرجى تسديد المبلغ المتبقي (${compactNumber(outstanding)} ج.م).`,
    );
  }
  lines.push(
    '',
    `🌟 نقاط الولاء الخاصة بك: لديك الآن (${Math.max(0, Math.round(cleanNumber(summary.client_points)))} نقطة)، يمكنك استبدالها بخصومات رائعة عند الوصول لـ 400 نقطة!`,
    '',
    'نتشرف دائماً بوجودك معنا، ونتمنى لك يوماً سعيداً! 🌟',
  );
  return lines.join('\n');
}

export function buildPackageWhatsAppUrl(summary = {}) {
  const recipient = normalizeWhatsAppPhone(summary.recipient || summary.client_phone);
  if (!recipient) return '';
  return `https://wa.me/${recipient}?text=${encodeURIComponent(formatPackageWhatsAppMessage(summary))}`;
}
