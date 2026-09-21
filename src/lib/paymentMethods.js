// New payments share these three wallet methods. Historical methods remain readable.
export const PAYMENT_METHODS = Object.freeze({ cash: 'كاش', instapay: 'انستاباي', vodafone_cash: 'فودافون كاش' });
export const PAYMENT_METHOD_OPTIONS = Object.freeze(Object.entries(PAYMENT_METHODS).map(([value, label]) => Object.freeze({ value, label })));
const aliases = { cash: 'cash', 'كاش': 'cash', 'نقدي': 'cash', instapay: 'instapay', 'انستاباي': 'instapay', 'إنستاباي': 'instapay', 'إنستاباي (InstaPay)': 'instapay', vodafone_cash: 'vodafone_cash', 'فودافون كاش': 'vodafone_cash' };
export const normalizePaymentMethod = value => { const key = String(value || '').trim(); return Object.hasOwn(aliases, key) ? aliases[key] : ''; };
export const paymentMethodLabel = value => PAYMENT_METHODS[normalizePaymentMethod(value)] || (String(value || '').trim() === 'bank_transfer' ? 'تحويل بنكي' : '') || String(value || '').trim() || 'غير محدد';
