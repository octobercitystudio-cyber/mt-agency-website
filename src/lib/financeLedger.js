import { formatPaymentMethod } from './businessFormat.js';
import { normalizeClientSearchText } from './clientSearch.js';
import { normalizeFinanceEntryKind } from './financeMetrics.js';

const CATEGORY_LABELS = {
  client_revenue: 'إيراد عميل', client_payment: 'دفعة عميل', other_income: 'إيراد آخر', package_payment: 'دفعة باقة', payment_correction: 'تصحيح دفعة',
  rent: 'إيجار', equipment: 'معدات وصيانة', utilities: 'مرافق واتصالات', marketing: 'تسويق وإعلانات',
  transport: 'انتقالات', general_expense: 'مصروف عام', reminder_expense: 'سداد تذكير', wallet_adjustment: 'تسوية خزينة',
  partner_settlement: 'سداد مستحقات', partner_advance: 'سلفة شريك', partner_advance_repayment: 'سداد سلفة', internal_transfer: 'تحويل داخلي',
  employee_out_of_pocket: 'مدفوع من جيب الموظف', employee_advance: 'سلفة موظف', employee_advance_repayment: 'سداد سلفة موظف', employee_settlement: 'سداد مستحقات موظف',
};

const ENTRY_PRESENTATIONS = {
  income: { kind: 'income', label: 'إيراد', direction: 1 },
  expense: { kind: 'expense', label: 'مصروف', direction: -1 },
  advance_in: { kind: 'income', label: 'سداد سلفة', direction: 1 },
  advance_out: { kind: 'expense', label: 'صرف سلفة', direction: -1 },
  settlement_out: { kind: 'expense', label: 'سداد مستحقات', direction: -1 },
  transfer_in: { kind: 'transfer', label: 'تحويل وارد', direction: 1 },
  transfer_out: { kind: 'transfer', label: 'تحويل صادر', direction: -1 },
};

export const financeCategoryLabel = entry => {
  const category = String(entry?.category || '').replace(/^reversal_/, '');
  return CATEGORY_LABELS[category] || category.replaceAll('_', ' ') || 'غير مصنف';
};

// Direction describes the documented entry, not its current effect on a wallet.
// Voided originals remain visible for auditing and are labelled by the view.
export const financeLedgerEntryPresentation = entry => {
  const normalizedKind = normalizeFinanceEntryKind(entry);
  const isReversal = normalizedKind === 'reversal';
  const sourceKind = isReversal ? String(entry?.category || '').replace(/^reversal_/, '') : normalizedKind;
  const presentation = ENTRY_PRESENTATIONS[sourceKind] || { kind: 'other', label: 'حركة مالية', direction: 0 };
  return {
    ...presentation,
    label: isReversal ? `عكس ${presentation.label}` : presentation.label,
    direction: isReversal ? -presentation.direction : presentation.direction,
    isReversal,
  };
};

const searchText = value => normalizeClientSearchText(value).replace(/[,٬]/g, '');

export const financeLedgerEntries = (entries = [], { month = '', employeeId = '', query = '', kind = 'all' } = {}) => {
  const words = searchText(query).split(' ').filter(Boolean);
  return entries.filter(entry => {
    if (!entry || (month && String(entry.date || '').slice(0, 7) !== month)) return false;
    if (employeeId && String(entry.employee_user_id ?? '') !== String(employeeId)) return false;
    const presentation = financeLedgerEntryPresentation(entry);
    if (kind !== 'all' && presentation.kind !== kind) return false;
    if (!words.length) return true;
    const haystack = searchText([
      entry.id, entry.client_name, entry.employee_name, entry.entity, entry.detail,
      entry.source_label, ...(entry.source_labels || []), entry.category, financeCategoryLabel(entry),
      entry.reference, ...(entry.payment_references || []), ...(entry.invoice_numbers || []),
      entry.source_id, ...(entry.package_ids || []), entry.correlation_id,
      entry.date, entry.amount, entry.type, presentation.label, formatPaymentMethod(entry.method),
      entry.voided_at ? 'ملغى موثق' : '',
    ].filter(value => value !== undefined && value !== null).join(' '));
    return words.every(word => haystack.includes(word));
  }).sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))
    || String(right.id ?? '').localeCompare(String(left.id ?? ''), 'en', { numeric: true }));
};
