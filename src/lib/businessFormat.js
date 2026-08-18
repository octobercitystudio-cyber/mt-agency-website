export const BUSINESS_START = '12:00';
export const BUSINESS_END = '24:00';
export const BUSINESS_HOURS_LABEL = 'من 12:00 م إلى 12:00 ص';
export const CURRENCY_CODE = 'EGP';
export const CURRENCY_LABEL = 'ج.م';

const PAYMENT_METHOD_LABELS = new Map([
  ['cash', 'نقدي'], ['كاش', 'نقدي'], ['نقدي', 'نقدي'],
  ['bank_transfer', 'تحويل بنكي'], ['تحويل بنكي', 'تحويل بنكي'],
  ['vodafone_cash', 'فودافون كاش'], ['فودافون كاش', 'فودافون كاش'],
  ['instapay', 'إنستاباي'], ['انستاباي', 'إنستاباي'], ['إنستاباي', 'إنستاباي'], ['إنستاباي (InstaPay)', 'إنستاباي'],
]);

export const formatPaymentMethod = value => PAYMENT_METHOD_LABELS.get(String(value || '').trim()) || String(value || '').trim() || 'غير محدد';

const BOOKING_STATUS_LABELS = Object.freeze({
  pending: 'بانتظار التأكيد', confirmed: 'مؤكد', alternative_proposed: 'موعد بديل مقترح',
  cancel_requested: 'إلغاء قيد المراجعة', late_cancel_requested: 'إلغاء متأخر قيد المراجعة',
  in_progress: 'جارٍ الآن', completed: 'مكتمل', cancelled: 'ملغي', rejected: 'مرفوض',
});
const PACKAGE_STATUS_LABELS = Object.freeze({
  draft: 'مسودة', active: 'نشطة', expired: 'منتهية', suspended: 'موقوفة',
  completed: 'مكتملة', cancelled: 'ملغاة', archived: 'مؤرشفة',
});
const warnedUnknownStatuses = new Set();
const formatStatus = (scope, labels, value) => {
  const key = String(value || '').trim();
  if (labels[key]) return labels[key];
  if (key && !warnedUnknownStatuses.has(`${scope}:${key}`)) {
    warnedUnknownStatuses.add(`${scope}:${key}`);
    console.warn(`[business-status] Unknown ${scope} status:`, key);
  }
  return 'حالة غير معروفة';
};

export const formatBookingStatus = value => formatStatus('booking', BOOKING_STATUS_LABELS, value);
export const formatPackageStatus = value => formatStatus('package', PACKAGE_STATUS_LABELS, value);

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatClientPoints = value => {
  const points = Number(value);
  return (Number.isFinite(points) ? points : 0).toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 2 });
};

export const formatEGP = (value, options = {}) => {
  const { minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;
  const formatter = minimumFractionDigits === 0 && maximumFractionDigits === 2
    ? numberFormatter
    : new Intl.NumberFormat('ar-EG-u-nu-latn', { minimumFractionDigits, maximumFractionDigits });
  return `${formatter.format(Number(value) || 0)} ${CURRENCY_LABEL}`;
};

export const moneyToCents = value => {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * ((Number(match[2]) * 100) + Number((match[3] || '').padEnd(2, '0')));
};

export const centsToMoney = cents => (Number(cents || 0) / 100).toFixed(2);

export const packageFinancialSummary = pkg => {
  const totalCents = Math.max(0, moneyToCents(pkg?.total_price));
  const overageCents = Math.max(0, moneyToCents(pkg?.overage_amount));
  const paidCents = Math.max(0, moneyToCents(pkg?.paid_amount));
  return {
    totalCents,
    overageCents,
    paidCents,
    outstandingCents: Math.max(0, totalCents + overageCents - paidCents),
    creditCents: Math.max(0, paidCents - totalCents - overageCents),
  };
};

export const packageQuantitySummary = pkg => {
  const purchased = Math.max(0, Number(pkg?.purchased_quantity || 0));
  const consumed = Math.max(0, Number(pkg?.consumed_quantity || 0));
  const held = Math.max(0, Number(pkg?.held_quantity || 0));
  return {
    purchased,
    consumed,
    held,
    remaining: Math.max(0, purchased - consumed),
    available: Math.max(0, purchased - consumed - held),
  };
};

const datePartsInCairo = value => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Cairo',
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const cairoDateKey = (value = new Date()) => datePartsInCairo(value instanceof Date ? value : new Date(value));

const dateOnlyToUtc = value => {
  const match = String(value || '').slice(0, 10).match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return date;
};

export const remainingBusinessDays = (expiresAt, todayKey = cairoDateKey()) => {
  const today = dateOnlyToUtc(todayKey);
  const expiry = dateOnlyToUtc(expiresAt);
  if (!today || !expiry || expiry <= today) return 0;
  let count = 0;
  for (const cursor = new Date(today.getTime() + 86400000); cursor <= expiry; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 5) count += 1;
  }
  return count;
};

export const remainingCalendarDays = (expiresAt, todayKey = cairoDateKey()) => {
  const today = dateOnlyToUtc(todayKey);
  const expiry = dateOnlyToUtc(expiresAt);
  if (!today || !expiry || expiry < today) return 0;
  return Math.floor((expiry.getTime() - today.getTime()) / 86400000) + 1;
};

export const effectivePackageStatus = (pkg, todayKey = cairoDateKey()) => (
  pkg?.status === 'active' && pkg?.expires_at && String(pkg.expires_at).slice(0, 10) < todayKey ? 'expired' : pkg?.status
);

export const formatPackageQuantity = (value, billingUnit = 'hour') => {
  const quantity = Math.max(0, Number(value || 0));
  if (billingUnit !== 'hour') {
    const unit = billingUnit === 'reel' ? 'ريل' : billingUnit === 'day' ? 'يوم' : billingUnit === 'month' ? 'شهر' : 'وحدة';
    return `${numberFormatter.format(quantity)} ${unit}`;
  }
  const minutes = Math.round(quantity * 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!remainder) return `${numberFormatter.format(hours)} س`;
  if (!hours) return `${numberFormatter.format(remainder)} د`;
  return `${numberFormatter.format(hours)} س ${numberFormatter.format(remainder)} د`;
};

export const normalizeTime = (value, { endOfDay = false } = {}) => {
  if (!value) return '';
  const match = String(value).match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return '24:00';
  if (hours === 0 && minutes === 0 && endOfDay) return '24:00';
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const timeToMinutes = (value, { endOfDay = false } = {}) => {
  const normalized = normalizeTime(value, { endOfDay });
  if (!normalized) return Number.NaN;
  if (normalized === '24:00') return 24 * 60;
  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours * 60) + minutes;
};

export const calculateDurationMinutes = (start, end) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end, { endOfDay: true });
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return 0;
  return Math.max(0, endMinutes - startMinutes);
};

export const isValidBusinessBooking = (start, end, minimumMinutes = 60) => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end, { endOfDay: true });
  const duration = endMinutes - startMinutes;
  return Number.isFinite(duration)
    && startMinutes >= timeToMinutes(BUSINESS_START)
    && endMinutes <= timeToMinutes(BUSINESS_END)
    && duration >= minimumMinutes
    && duration % 15 === 0;
};

export const formatTime12 = (value, fallback = '—') => {
  const normalized = normalizeTime(value);
  if (!normalized) return fallback;
  const [rawHours, minutes] = normalized.split(':').map(Number);
  const hours = rawHours === 24 ? 0 : rawHours;
  const displayHours = hours % 12 || 12;
  const period = hours < 12 ? 'ص' : 'م';
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

export const formatDateTime12 = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Africa/Cairo',
  }).format(date);
};

export const formatBookingDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const rawDate = String(value).slice(0, 10);
  const date = new Date(`${rawDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
};

export const formatBookingSchedule = (date, start, end) => {
  const dateLabel = formatBookingDate(date);
  if (!start && !end) return dateLabel;
  return `${dateLabel} · ${formatTime12(start)} – ${formatTime12(end)}`;
};

export const createBusinessTimeOptions = ({
  min = BUSINESS_START,
  max = BUSINESS_END,
  step = 15,
} = {}) => {
  const first = timeToMinutes(min);
  const last = timeToMinutes(max, { endOfDay: true });
  const options = [];
  for (let total = first; total <= last; total += step) {
    const value = total === 1440
      ? '24:00'
      : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    options.push({ value, label: formatTime12(value) });
  }
  return options;
};
