import { effectivePackageStatus, packageFinancialSummary, packageQuantitySummary } from '../lib/businessFormat.js';

const dateKey = value => String(value || '').slice(0, 10);

export const packageBookingAvailability = (pkg, todayKey) => {
  if (!pkg) return { bookable: false, reason: 'الباقة غير موجودة.' };
  const status = effectivePackageStatus(pkg, todayKey);
  const quantity = packageQuantitySummary(pkg);
  if (status !== 'active') return { bookable: false, reason: status === 'expired' ? 'منتهية الصلاحية' : 'غير نشطة' };
  if (quantity.available <= 0) return { bookable: false, reason: 'لا يوجد رصيد متاح' };
  if (!dateKey(pkg.starts_at) || !dateKey(pkg.expires_at) || dateKey(pkg.starts_at) > dateKey(pkg.expires_at)) {
    return { bookable: false, reason: 'فترة الصلاحية غير مكتملة' };
  }
  return { bookable: true, reason: '' };
};

export const packagesForBookingClient = (packages, clientId, todayKey) => (
  (packages || [])
    .filter(pkg => String(pkg.client_id) === String(clientId))
    .map(pkg => ({ ...pkg, availability: packageBookingAvailability(pkg, todayKey) }))
    .sort((left, right) => {
      if (left.availability.bookable !== right.availability.bookable) return left.availability.bookable ? -1 : 1;
      return dateKey(left.expires_at).localeCompare(dateKey(right.expires_at));
    })
);

export const packageBookingSnapshot = (pkg, service) => {
  if (!pkg) return null;
  const quantity = packageQuantitySummary(pkg);
  const financial = packageFinancialSummary(pkg);
  const billingUnit = pkg.billing_unit === 'reel' ? 'reel' : 'hour';
  return {
    pkg,
    service,
    billingUnit,
    quantity,
    financial,
    balancePercent: quantity.purchased ? Math.min(100, (quantity.available / quantity.purchased) * 100) : 0,
    paymentPercent: financial.totalCents ? Math.min(100, (financial.paidCents / financial.totalCents) * 100) : 0,
  };
};

export const validatePackageBookingDraft = ({ pkg, service, dates, todayKey }) => {
  const availability = packageBookingAvailability(pkg, todayKey);
  if (!availability.bookable) return availability.reason;
  if (String(pkg.client_id) === '') return 'لا يمكن تحديد عميل الباقة.';
  if (!service || String(service.id) !== String(pkg.service_id)) return 'خدمة الباقة غير متاحة.';
  const rows = dates || [];
  if (!rows.length) return 'أضف موعدًا واحدًا على الأقل.';
  if (rows.some(row => dateKey(row.date) < dateKey(pkg.starts_at) || dateKey(row.date) > dateKey(pkg.expires_at))) return 'الموعد يجب أن يكون داخل فترة صلاحية الباقة.';
  if (pkg.validity_mode_snapshot === 'shooting_day' && rows.some(row => dateKey(row.date) !== dateKey(pkg.starts_at))) return 'الباقة اليومية صالحة في يوم التصوير فقط.';
  return '';
};
