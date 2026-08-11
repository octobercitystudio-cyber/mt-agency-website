import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CheckCircle2, RefreshCw, ShieldAlert, WalletCards, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { centsToMoney, formatEGP, moneyToCents, packageFinancialSummary } from '../lib/businessFormat';
import { safeUiError } from '../lib/uiError';
import './PackagePaymentModal.css';

const METHODS = { cash: 'نقدي', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي' };
const requestKey = () => `package-payment-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export default function PackagePaymentModal({ isOpen, pkg, person, returnFocusRef, onClose, onSuccess }) {
  const [form, setForm] = useState({ amount: '', method: 'cash', reference: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKeyRef = useRef('');
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  const financial = useMemo(() => packageFinancialSummary(pkg), [pkg]);

  useEffect(() => {
    if (!isOpen) return;
    idempotencyKeyRef.current = requestKey();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ amount: centsToMoney(financial.outstandingCents), method: 'cash', reference: '', note: '' });
    setError(''); setBusy(false);
  }, [isOpen, pkg?.id, financial.outstandingCents]);

  if (!isOpen || !pkg) return null;
  const rawAmount = String(form.amount).trim();
  const amountCents = moneyToCents(rawAmount);
  const amountError = rawAmount === '' ? 'أدخل مبلغ الدفعة.'
    : !/^\d+(?:\.\d+)?$/.test(rawAmount) ? 'استخدم أرقامًا صحيحة للمبلغ.'
      : (rawAmount.split('.')[1]?.length || 0) > 2 ? 'اكتب المبلغ بحد أقصى رقمين بعد العلامة العشرية.'
        : amountCents <= 0 ? 'أدخل مبلغًا أكبر من صفر.'
          : amountCents > financial.outstandingCents ? `مبلغ الدفعة لا يمكن أن يتجاوز ${formatEGP(centsToMoney(financial.outstandingCents))}.` : '';
  const remainingCents = Math.max(0, financial.outstandingCents - Math.max(0, amountCents));
  const invalid = Boolean(amountError) || !METHODS[form.method];

  const submit = async event => {
    event.preventDefault(); if (busy || invalid) return;
    setBusy(true); setError('');
    const { data, error: requestError } = await dataClient.request(`/client-packages/${pkg.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: centsToMoney(amountCents), method: form.method, reference: form.reference.trim(), note: form.note.trim(), idempotency_key: idempotencyKeyRef.current }) });
    setBusy(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر حفظ الدفعة في مدفوعات العميل.'));
    await onSuccess?.(data);
  };

  return <div className="packages-modal package-payment-modal" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <form ref={dialogRef} className="package-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="package-payment-title" aria-describedby="package-payment-description" onSubmit={submit} noValidate>
      <header><div className="package-payment-icon"><WalletCards/></div><div><span>تحصيل مباشر موثق</span><h2 id="package-payment-title">تسجيل دفعة على الباقة</h2><p id="package-payment-description">{person?.name || 'العميل'} · {pkg.name} · باقة #{pkg.id}</p></div><button data-dialog-initial type="button" className="package-payment-close" onClick={close} disabled={busy} aria-label="إغلاق نافذة تسجيل الدفعة"><X/></button></header>
      <section className={`package-payment-metrics ${financial.overageCents > 0 ? 'has-overage' : 'standard'}`} aria-label="ملخص الباقة المالي"><article><span>إجمالي السعر</span><strong>{formatEGP(centsToMoney(financial.totalCents))}</strong></article><article><span>المدفوع</span><strong>{formatEGP(centsToMoney(financial.paidCents))}</strong></article><article className="outstanding"><span>المتبقي الآن</span><strong>{formatEGP(centsToMoney(financial.outstandingCents))}</strong></article>{financial.overageCents > 0 && <article className="overage"><span>تجاوز مشمول</span><strong>{formatEGP(centsToMoney(financial.overageCents))}</strong></article>}</section>
      {error && <div className="package-payment-message error" role="alert"><ShieldAlert/><span>{error}</span></div>}
      <div className="package-payment-fields">
        <label className="amount"><span>مبلغ الدفعة</span><div className="package-payment-amount-control"><input type="number" inputMode="decimal" min="0.01" max={centsToMoney(financial.outstandingCents)} step="0.01" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} aria-invalid={Boolean(amountError)} aria-describedby="package-payment-amount-help package-payment-amount-error"/><small>ج.م</small></div><em id="package-payment-amount-help">الحد الأقصى {formatEGP(centsToMoney(financial.outstandingCents))}</em><small id="package-payment-amount-error" className="package-payment-amount-error" aria-live="polite">{amountError}</small></label>
        <button type="button" className="package-payment-full" onClick={() => setForm(current => ({ ...current, amount: centsToMoney(financial.outstandingCents) }))}><CheckCircle2/> سداد كامل</button>
        <label><span>طريقة الدفع</span><select value={form.method} onChange={event => setForm(current => ({ ...current, method: event.target.value }))}>{Object.entries(METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>مرجع الدفع <small>اختياري</small></span><input maxLength="120" value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value }))} placeholder="رقم التحويل أو الإيصال"/></label>
        <label className="wide"><span>ملاحظة داخلية <small>اختيارية</small></span><textarea rows="3" maxLength="500" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} placeholder="تفاصيل تساعد في مراجعة الدفعة لاحقًا"/></label>
      </div>
      <section className="package-payment-after" aria-live="polite"><span>المتبقي بعد الدفعة</span><strong>{formatEGP(centsToMoney(remainingCents))}</strong></section>
      <footer><p><Banknote/> ستُحفظ دفعة معتمدة وتخصيص للباقة وقيد إيراد واحد.</p><button type="submit" disabled={busy || invalid}>{busy ? <RefreshCw className="packages-spin"/> : <CheckCircle2/>}{busy ? 'جارٍ حفظ الدفعة…' : 'حفظ الدفعة في مدفوعات العميل'}</button></footer>
    </form>
  </div>;
}
