import { moneyToCents } from './businessFormat.js';
import { isSellablePackageTemplate, normalizedPackageUnit, packageDraftExpiry, templateToPackageDraft, validatePackageDraft } from './clientPackageDraft.js';

export const packageBalanceMinutes = pkg => Number(pkg?.purchased_minutes ?? Number(pkg?.purchased_quantity || 0) * 60)
  - Number(pkg?.consumed_minutes ?? Number(pkg?.consumed_quantity || 0) * 60)
  - Number(pkg?.held_minutes ?? Number(pkg?.held_quantity || 0) * 60);

export const bookingBlockPackageEligibility = (pkg, block, service) => {
  if (!pkg || !block) return { eligible: false, reason: 'بيانات الباقة غير مكتملة.', availableMinutes: 0 };
  const availableMinutes = packageBalanceMinutes(pkg);
  if (pkg.status !== 'active') return { eligible: false, reason: pkg.status === 'expired' ? 'انتهت صلاحية الباقة.' : 'الباقة غير نشطة.', availableMinutes };
  if (pkg.billing_unit !== 'hour') return { eligible: false, reason: 'هذه الباقة ليست باقة ساعات.', availableMinutes };
  if (!service) return { eligible: false, reason: 'قالب الباقة غير متاح.', availableMinutes };
  const starts = String(pkg.starts_at || '').slice(0, 10); const expires = String(pkg.expires_at || '').slice(0, 10); const date = String(block.block_date || '');
  if (Boolean(starts) !== Boolean(expires)) return { eligible: false, reason: 'تواريخ صلاحية الباقة غير مكتملة.', availableMinutes };
  if (starts && date < starts) return { eligible: false, reason: 'الحجز يسبق بداية صلاحية الباقة.', availableMinutes };
  if (expires && date > expires) return { eligible: false, reason: 'انتهت صلاحية الباقة قبل هذا الحجز.', availableMinutes };
  const duration = Number(block.duration_minutes || 0); const minimum = Math.max(15, Number(service.minimum_booking_minutes || 60)); const increment = Math.max(15, Number(service.booking_increment_minutes || 15));
  if (duration < minimum || duration % increment !== 0) return { eligible: false, reason: `مدة الحجز لا توافق حد القالب (${minimum} د / زيادة ${increment} د).`, availableMinutes };
  if (availableMinutes < duration) return { eligible: false, reason: availableMinutes <= 0 ? 'رصيد الباقة مستنفد.' : 'الرصيد المتاح لا يكفي مدة الحجز.', availableMinutes };
  return { eligible: true, reason: '', availableMinutes, remainingMinutes: availableMinutes - duration };
};

export const sellableHourTemplates = services => (Array.isArray(services) ? services : [])
  .filter(service => isSellablePackageTemplate(service) && normalizedPackageUnit(service) === 'hour');

export const newPackageDraftForBlock = (service, clientId, blockDate) => {
  const draft = templateToPackageDraft(service, { clientId, startsAt: blockDate });
  if (!draft) return null;
  const anchored = { ...draft, starts_at: blockDate, shooting_date: draft.validity_mode_snapshot === 'shooting_day' ? blockDate : '' };
  return { ...anchored, expires_at: packageDraftExpiry(anchored) };
};

export const validateBookingBlockNewPackage = (draft, service, block) => {
  const errors = validatePackageDraft(draft || {});
  if (!service || !isSellablePackageTemplate(service) || normalizedPackageUnit(service) !== 'hour') errors.service_id = 'اختر قالب باقة ساعات نشطًا وقابلًا للبيع.';
  const duration = Number(block?.duration_minutes || 0); const purchasedMinutes = Math.round(Number(draft?.quantity || 0) * 60);
  const minimum = Math.max(15, Number(service?.minimum_booking_minutes || 60)); const increment = Math.max(15, Number(service?.booking_increment_minutes || 15));
  if (duration < minimum || duration % increment !== 0) errors.schedule = `مدة الحجز لا توافق القالب المختار: حد أدنى ${minimum} دقيقة وزيادة ${increment} دقيقة.`;
  if (purchasedMinutes < duration) errors.quantity = 'رصيد الباقة الجديدة يجب أن يغطي مدة الحجز كاملة.';
  if (purchasedMinutes % 15 !== 0) errors.quantity = 'رصيد الساعات يجب أن يكون بزيادات 15 دقيقة.';
  if (moneyToCents(draft?.paid_amount) > moneyToCents(draft?.total_price)) errors.paid_amount = 'المدفوع لا يمكن أن يتجاوز السعر الإجمالي.';
  return errors;
};
