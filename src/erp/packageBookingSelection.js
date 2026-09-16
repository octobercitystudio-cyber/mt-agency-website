import { effectivePackageStatus, packageFinancialSummary, packageQuantitySummary } from '../lib/businessFormat.js';

const dateKey = value => String(value || '').slice(0, 10);
const expiryPriority = pkg => dateKey(pkg?.expires_at) || '9999-12-31';

const bookingQuantity = (row, unit) => {
  if (unit === 'reel') return Math.max(0, Number(row?.requested_quantity || 0));
  const [startHour = 0, startMinute = 0] = String(row?.start_time || '').split(':').map(Number);
  const [endHour = 0, endMinute = 0] = String(row?.end_time || '').split(':').map(Number);
  const start = (startHour * 60) + startMinute;
  const end = (endHour * 60) + endMinute;
  return end > start ? (end - start) / 60 : 0;
};

const addCalendarDays = (value, amount) => {
  const key = dateKey(value);
  if (!key) return '';
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
};

const packageAcceptsDate = (pkg, bookingDate) => {
  const date = dateKey(bookingDate);
  if (!date) return false;
  const startsAt = dateKey(pkg?.starts_at);
  const expiresAt = dateKey(pkg?.expires_at);
  if (startsAt && date < startsAt) return false;
  if (expiresAt && date > expiresAt) return false;
  if (pkg?.validity_mode_snapshot === 'shooting_day' && startsAt && date !== startsAt) return false;
  return true;
};

export const packageBookingAvailability = (pkg, todayKey) => {
  if (!pkg) return { bookable: false, reason: 'الباقة غير موجودة.' };
  const status = effectivePackageStatus(pkg, todayKey);
  const quantity = packageQuantitySummary(pkg);
  if (status !== 'active') return { bookable: false, reason: status === 'expired' ? 'منتهية الصلاحية' : 'غير نشطة' };
  if (quantity.available <= 0) return { bookable: false, reason: 'لا يوجد رصيد متاح' };
  if ((dateKey(pkg.starts_at) || dateKey(pkg.expires_at)) && (!dateKey(pkg.starts_at) || !dateKey(pkg.expires_at) || dateKey(pkg.starts_at) > dateKey(pkg.expires_at))) return { bookable: false, reason: 'فترة الصلاحية غير مكتملة' };
  return { bookable: true, reason: '' };
};

export const packagesForBookingClient = (packages, clientId, todayKey) => (
  (packages || [])
    .filter(pkg => String(pkg.client_id) === String(clientId))
    .map(pkg => ({ ...pkg, availability: packageBookingAvailability(pkg, todayKey) }))
    .sort((left, right) => {
      if (left.availability.bookable !== right.availability.bookable) return left.availability.bookable ? -1 : 1;
      const expiryOrder = expiryPriority(left).localeCompare(expiryPriority(right));
      if (expiryOrder) return expiryOrder;
      return Number(right.id || 0) - Number(left.id || 0);
    })
    .map((pkg, index, sorted) => ({
      ...pkg,
      availability: {
        ...pkg.availability,
        priority: pkg.availability.bookable
          ? sorted.slice(0, index + 1).filter(item => item.availability.bookable).length
          : null,
      },
    }))
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

export const planPackageBookingRows = ({ packages = [], clientId, rows = [], todayKey, preferredPackageId = null }) => {
  const ordered = packagesForBookingClient(packages, clientId, todayKey)
    .filter(pkg => pkg.availability.bookable);
  const preferred = ordered.find(pkg => String(pkg.id) === String(preferredPackageId));
  const unit = preferred?.billing_unit || ordered[0]?.billing_unit || 'hour';
  const compatible = ordered.filter(pkg => pkg.billing_unit === unit);
  const remaining = new Map(compatible.map(pkg => [String(pkg.id), packageQuantitySummary(pkg).available]));
  const runtimeWindows = new Map(compatible.map(pkg => [String(pkg.id), {
    startsAt: dateKey(pkg.starts_at), expiresAt: dateKey(pkg.expires_at),
  }]));
  const allocations = [];

  const chronologicalRows = rows.map((row, index) => ({ row, index }))
    .sort((left, right) => `${dateKey(left.row?.date)} ${left.row?.start_time || ''}`.localeCompare(`${dateKey(right.row?.date)} ${right.row?.start_time || ''}`) || left.index - right.index);
  for (const { row, index } of chronologicalRows) {
    const quantity = bookingQuantity(row, unit);
    const candidates = compatible.filter(pkg => {
      const window = runtimeWindows.get(String(pkg.id));
      return packageAcceptsDate({ ...pkg, starts_at: window?.startsAt, expires_at: window?.expiresAt }, row?.date);
    });
    const selected = candidates.find(pkg => (remaining.get(String(pkg.id)) || 0) + 0.0001 >= quantity);
    if (!selected || quantity <= 0) {
      return {
        ok: false,
        unit,
        allocations,
        failedIndex: index,
        reason: !quantity
          ? 'مدة الموعد أو كميته غير صحيحة.'
          : 'لا توجد باقة صالحة لهذا التاريخ وبها رصيد يكفي الموعد كاملًا.',
      };
    }
    const key = String(selected.id);
    const window = runtimeWindows.get(key);
    if (!window?.startsAt && !window?.expiresAt) {
      const startsAt = dateKey(row?.date);
      const validityDays = Math.max(1, Number(selected.validity_days_snapshot || 1));
      runtimeWindows.set(key, {
        startsAt,
        expiresAt: selected.validity_mode_snapshot === 'shooting_day' ? startsAt : addCalendarDays(startsAt, validityDays - 1),
      });
    }
    remaining.set(key, Math.max(0, (remaining.get(key) || 0) - quantity));
    allocations.push({ index, row, package: selected, quantity, remainingAfter: remaining.get(key) });
  }

  allocations.sort((left, right) => left.index - right.index);
  return { ok: true, unit, allocations, remaining, runtimeWindows };
};

export const packageChainValidRange = (packages = [], todayKey) => {
  const candidates = (packages || []).filter(pkg => packageBookingAvailability(pkg, todayKey).bookable);
  const starts = candidates.map(pkg => dateKey(pkg.starts_at)).filter(Boolean).sort();
  const hasPendingActivation = candidates.some(pkg => !dateKey(pkg.starts_at) && !dateKey(pkg.expires_at));
  const expiries = candidates.map(pkg => dateKey(pkg.expires_at)).filter(Boolean).sort();
  return {
    start: hasPendingActivation ? dateKey(todayKey) : ([dateKey(todayKey), starts[0]].filter(Boolean).sort().at(-1) || dateKey(todayKey)),
    end: hasPendingActivation ? '' : (expiries.at(-1) || ''),
  };
};

export const validatePackageBookingDraft = ({ pkg, service, dates, todayKey }) => {
  const availability = packageBookingAvailability(pkg, todayKey);
  if (!availability.bookable) return availability.reason;
  if (String(pkg.client_id) === '') return 'لا يمكن تحديد عميل الباقة.';
  if (!service || String(service.id) !== String(pkg.service_id)) return 'خدمة الباقة غير متاحة.';
  const rows = dates || [];
  if (!rows.length) return 'أضف موعدًا واحدًا على الأقل.';
  if (dateKey(pkg.starts_at) && rows.some(row => dateKey(row.date) < dateKey(pkg.starts_at) || dateKey(row.date) > dateKey(pkg.expires_at))) return 'الموعد يجب أن يكون داخل فترة صلاحية الباقة.';
  if (dateKey(pkg.starts_at) && pkg.validity_mode_snapshot === 'shooting_day' && rows.some(row => dateKey(row.date) !== dateKey(pkg.starts_at))) return 'الباقة اليومية صالحة في يوم التصوير فقط.';
  return '';
};
