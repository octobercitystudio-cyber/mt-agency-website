import { moneyToCents, centsToMoney } from './businessFormat.js';

const HOUR_TEMPLATE_UNITS = new Set(['hour', 'day', 'month']);
const PROJECT_UNITS = new Set(['project', 'custom']);
const PROJECT_CATEGORIES = new Set(['graphics', 'graphic', 'montage', 'editing', 'custom', 'custom_project', 'project']);

const text = value => String(value ?? '').trim();
const number = value => Number(value ?? 0);
const money = value => centsToMoney(moneyToCents(value));

export const normalizedPackageUnit = service => {
  const unit = text(service?.billing_unit).toLowerCase();
  if (unit === 'reel' || (number(service?.total_reels) > 0 && number(service?.total_hours) <= 0)) return 'reel';
  return HOUR_TEMPLATE_UNITS.has(unit) ? 'hour' : '';
};

export const isSellablePackageTemplate = service => {
  if (!service || Number(service.is_active ?? 1) !== 1 || Number(service.is_draft ?? 0) === 1 || service.archived_at) return false;
  const rawUnit = text(service.billing_unit).toLowerCase();
  const category = text(service.category).toLowerCase();
  const serviceType = text(service.service_type).toLowerCase();
  if (PROJECT_UNITS.has(rawUnit) || PROJECT_CATEGORIES.has(category) || PROJECT_CATEGORIES.has(serviceType)) return false;
  const unit = normalizedPackageUnit(service);
  return unit === 'reel' ? number(service.total_reels) > 0 : unit === 'hour' && number(service.total_hours) > 0;
};

export const packageDraftExpiry = draft => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(draft?.starts_at))) return '';
  const date = new Date(`${draft.starts_at}T12:00:00`);
  const days = Number(draft.validity_days);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(days) || days < 1) return '';
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const templateToPackageDraft = (service, { clientId = '', startsAt = '' } = {}) => {
  if (!isSellablePackageTemplate(service)) return null;
  const billingUnit = normalizedPackageUnit(service);
  const quantity = billingUnit === 'reel' ? number(service.total_reels) : number(service.total_hours);
  const paymentDue = billingUnit === 'hour' ? number(service.payment_due_hours) : number(service.payment_due_reels);
  const draft = {
    client_id: String(clientId || ''),
    service_id: String(service.id),
    name: text(service.name),
    billing_unit: billingUnit,
    starts_at: startsAt,
    validity_days: Math.max(1, Number.parseInt(service.validity_days || 90, 10)),
    quantity,
    payment_due_quantity: Math.max(0, paymentDue || 0),
    deposit_percent_snapshot: Math.min(100, Math.max(0, number(service.deposit_percent))),
    overage_price_snapshot: money(service.overage_price),
    total_price: money(service.price),
    paid_amount: 0,
    payment_method: 'cash',
    notes: '',
  };
  return { ...draft, expires_at: packageDraftExpiry(draft) };
};

export const resetPackageDraftToTemplate = (draft, service, { startsAt = draft?.starts_at } = {}) => templateToPackageDraft(service, {
  clientId: draft?.client_id,
  startsAt,
});

const comparableDraft = draft => ({
  name: text(draft?.name), billing_unit: text(draft?.billing_unit), quantity: number(draft?.quantity),
  starts_at: text(draft?.starts_at), validity_days: number(draft?.validity_days),
  payment_due_quantity: number(draft?.payment_due_quantity), deposit_percent_snapshot: number(draft?.deposit_percent_snapshot),
  overage_price_snapshot: money(draft?.overage_price_snapshot), total_price: money(draft?.total_price),
  paid_amount: money(draft?.paid_amount), payment_method: text(draft?.payment_method), notes: text(draft?.notes),
});

export const packageDraftIsDirty = (draft, service) => {
  const original = templateToPackageDraft(service, { clientId: draft?.client_id, startsAt: draft?.starts_at });
  return !original || JSON.stringify(comparableDraft(draft)) !== JSON.stringify(comparableDraft(original));
};

export const validatePackageDraft = draft => {
  const errors = {};
  if (!(number(draft?.client_id) > 0)) errors.client_id = 'اختر العميل.';
  if (!(number(draft?.service_id) > 0)) errors.service_id = 'اختر قالب الخدمة.';
  if (!text(draft?.name)) errors.name = 'اسم الباقة مطلوب.';
  if (!['hour', 'reel'].includes(text(draft?.billing_unit))) errors.billing_unit = 'وحدة الرصيد غير صحيحة.';
  if (!(number(draft?.quantity) > 0)) errors.quantity = 'الرصيد يجب أن يكون أكبر من صفر.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(draft?.starts_at)) || !packageDraftExpiry(draft)) errors.starts_at = 'تاريخ البداية أو الصلاحية غير صحيح.';
  if (!Number.isInteger(number(draft?.validity_days)) || number(draft?.validity_days) < 1) errors.validity_days = 'مدة الصلاحية يجب أن تكون يومًا واحدًا على الأقل.';
  if (number(draft?.payment_due_quantity) < 0) errors.payment_due_quantity = 'حد الاستحقاق لا يمكن أن يكون سالبًا.';
  else if (number(draft?.payment_due_quantity) > number(draft?.quantity)) errors.payment_due_quantity = 'حد الاستحقاق لا يمكن أن يتجاوز رصيد الباقة.';
  if (number(draft?.deposit_percent_snapshot) < 0 || number(draft?.deposit_percent_snapshot) > 100) errors.deposit_percent_snapshot = 'نسبة المقدم يجب أن تكون بين 0 و100.';
  if (moneyToCents(draft?.overage_price_snapshot) < 0) errors.overage_price_snapshot = 'سعر الزيادة لا يمكن أن يكون سالبًا.';
  const totalCents = moneyToCents(draft?.total_price); const paidCents = moneyToCents(draft?.paid_amount);
  if (totalCents < 0) errors.total_price = 'السعر الإجمالي لا يمكن أن يكون سالبًا.';
  if (paidCents < 0 || paidCents > totalCents) errors.paid_amount = 'المدفوع يجب أن يكون بين صفر والسعر الإجمالي.';
  if (!text(draft?.payment_method)) errors.payment_method = 'اختر طريقة الدفع.';
  return errors;
};
