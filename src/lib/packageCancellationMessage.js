import { centsToMoney, formatEGP, formatDurationMinutes, formatPaymentMethod } from './businessFormat.js';

export function packageCancellationMessage(receipt) {
  const money = cents => formatEGP(centsToMoney(cents));
  const usage = receipt.consumed_minutes === null ? `${receipt.consumed_quantity} ريل` : formatDurationMinutes(receipt.consumed_minutes);
  return [
    `السيد/السيدة ${receipt.client_name}،`,
    `نؤكد إلغاء باقة «${receipt.package_name}» رقم ${receipt.package_id} بناءً على طلبكم، وإيقاف المواعيد المتبقية المرتبطة بها.`,
    `تاريخ الإلغاء: ${receipt.cancelled_at}`,
    receipt.purchased_minutes !== null ? `مدة الباقة الأصلية: ${formatDurationMinutes(receipt.purchased_minutes)}.` : '',
    `فترة الصلاحية الأصلية: ${receipt.starts_at || 'لم تبدأ'} — ${receipt.expires_at || 'لم تُحدد'}.`,
    `إجمالي تكلفة الباقة قبل الإلغاء: ${money(receipt.original_total_cents)}.`,
    `إجمالي المبلغ المسدّد قبل التسوية: ${money(receipt.paid_cents)}.`,
    `الاستخدام المحتسب: ${usage}.`,
    receipt.usage_cost_cents !== null ? `قيمة الاستخدام بسعر الساعة الفردية (${money(receipt.hourly_rate_cents)}): ${money(receipt.usage_cost_cents)}.` : '',
    receipt.override_reason ? `تم اعتماد تسوية خاصة لمبلغ الاسترداد: ${receipt.override_reason}.` : '',
    `المبلغ المحتفظ به بعد التسوية: ${money(receipt.retained_cents)}.`,
    receipt.refund_cents > 0 ? `المبلغ الذي تم رده إليكم: ${money(receipt.refund_cents)} عبر ${formatPaymentMethod(receipt.method)}.` : 'لا يوجد مبلغ مستحق للاسترداد.',
    'تم إغلاق الباقة، ولا توجد مبالغ إضافية مطلوبة عنها بعد هذه التسوية.',
    `المواعيد والطلبات الملغاة: ${receipt.bookings.length + (receipt.pending_dates?.length || 0)}.`,
    ...[...receipt.bookings, ...(receipt.pending_dates || [])].map(b => `• ${b.date || 'غير محدد'}، من ${String(b.start_time || '').slice(0, 5)} إلى ${String(b.end_time || '').slice(0, 5)}.`),
    'نشكركم على ثقتكم، ويسعدنا خدمتكم مجددًا.',
    'فريق Multi Task Agency',
  ].filter(Boolean).join('\n');
}
