import { cairoDateKey } from './businessFormat.js';

export const CLIENT_ACTIVE_PACKAGE_MESSAGE = 'لديك باقة سارية وبها رصيد غير مستخدم. يمكنك حجز موعد تصوير من باقتك الحالية، وطلب باقة جديدة بعد انتهاء صلاحيتها أو استهلاك رصيدها.';
export const isStudioSubscription = pkg => ['hour', 'reel'].includes(pkg?.billing_unit);
export function clientPackageBlocksPurchase(pkg, now = new Date()) {
  if (pkg?.status !== 'active' || !isStudioSubscription(pkg)) return false;
  if (pkg.expires_at && String(pkg.expires_at).slice(0, 10) < cairoDateKey(now)) return false;
  const minutes = name => pkg[`${name}_minutes`] != null ? Math.max(0, Number(pkg[`${name}_minutes`])) : Math.max(0, Math.round(Number(pkg[`${name}_quantity`] || 0) * 60));
  return pkg.billing_unit === 'hour' ? minutes('purchased') > minutes('consumed') : Number(pkg.purchased_quantity || 0) > Number(pkg.consumed_quantity || 0);
}
export function clientPackageOptionAllowed(service) {
  const name = String(service?.name || service?.service_name || '').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/\s+/g, ' ').trim();
  return !(name.includes('مخصص') && name.includes('بدون مونتاج'));
}
