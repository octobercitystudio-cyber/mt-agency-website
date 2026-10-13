import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { centsToMoney, formatDurationMinutes, formatEGP, moneyToCents } from '../lib/businessFormat';
import { PAYMENT_METHODS } from '../lib/paymentMethods';
import { packageCancellationMessage } from '../lib/packageCancellationMessage';
import { safeUiError } from '../lib/uiError';
import './PackageCancellationModal.css';

const money = cents => formatEGP(centsToMoney(cents));

export default function PackageCancellationModal({ pkg, onClose, onChanged }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState({ amount: '', method: 'cash', reason: '', override: '', confirmed: false });
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialog = useModalDialog(true, close, { isolateBackground: true });
  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const result = await dataClient.request(`/client-packages/${pkg.id}/cancellation`, { method: 'GET' });
        if (result.error) throw result.error;
        if (!current) return;
        setQuote(result.data);
        setForm(previous => ({ ...previous, amount: result.data.suggested_refund_cents === null ? '' : String(centsToMoney(result.data.suggested_refund_cents)), confirmed: false }));
      } catch (failure) { if (current) setError(safeUiError(failure, 'تعذر تحميل حساب الاسترداد.')); }
      finally { if (current) setLoading(false); }
    }
    load();
    return () => { current = false; };
  }, [pkg.id, attempt]);
  const amount = moneyToCents(form.amount);
  const changed = quote && amount !== quote.suggested_refund_cents;
  const invalid = !quote || loading || busy || quote.completed || quote.blocked_reasons?.length || !/^\d+(?:\.\d{1,2})?$/.test(form.amount) || amount > quote.paid_cents || amount < 0 || !form.reason.trim() || (changed && !form.override.trim()) || !form.confirmed;
  const message = quote?.completed ? packageCancellationMessage(quote) : '';
  const appointments = quote ? [...quote.bookings, ...(quote.pending_dates || [])] : [];
  const submit = async event => {
    event.preventDefault(); if (invalid) return;
    setBusy(true); setError('');
    try {
      const result = await dataClient.request(`/client-packages/${pkg.id}/cancellation`, { method: 'POST', body: JSON.stringify({ quote_hash: quote.quote_hash, refund_amount: form.amount, method: form.method, reason: form.reason.trim(), override_reason: changed ? form.override.trim() : '', confirmation: 'cancel_and_refund' }) });
      if (result.error) throw result.error;
      setQuote(result.data);
      onChanged?.();
    } catch (failure) {setError(safeUiError(failure, 'تعذر إتمام الإلغاء. حدّث الحساب للتحقق من حالة العملية قبل المحاولة مرة أخرى.'));}
    finally {setBusy(false);}
  };
  return <div className="package-cancel-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <form ref={dialog} className="package-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="package-cancel-title" onSubmit={submit}>
      <header><div><span>تسوية موثقة للمالك</span><h2 id="package-cancel-title">{quote?.completed ? 'تم إلغاء الباقة وتسويتها' : 'إلغاء الباقة واسترداد المبلغ'}</h2><p>{pkg.name} · باقة #{pkg.id}</p></div><button type="button" onClick={close} disabled={busy} aria-label="إغلاق"><X/></button></header>
      <div className="package-cancel-body">
        {loading && <p role="status">جارٍ مراجعة المدفوعات والاستخدام…</p>}
        {error && <p className="package-cancel-error" role="alert">{error}</p>}
        {!loading && !quote?.completed && <button type="button" className="package-cancel-refresh" disabled={busy} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={18}/> تحديث حساب الاسترداد</button>}
        {!loading && quote && <>
          <p><strong>{quote.client_name}</strong> · {quote.package_name}</p>
          <dl className="package-cancel-metrics"><div><dt>المسدّد قبل الإلغاء</dt><dd>{money(quote.paid_cents)}</dd></div><div><dt>الاستخدام المحتسب</dt><dd>{quote.consumed_minutes === null ? `${quote.consumed_quantity} ريل` : formatDurationMinutes(quote.consumed_minutes)}</dd></div><div><dt>{quote.completed ? 'المبلغ الذي تم رده' : 'الاسترداد المحسوب'}</dt><dd>{quote.completed ? money(quote.refund_cents) : quote.suggested_refund_cents === null ? 'تسوية يدوية' : money(quote.suggested_refund_cents)}</dd></div></dl>
          {quote.consumed_minutes !== null && <p>قيمة الاستخدام: <strong>{money(quote.usage_cost_cents)}</strong> بسعر {money(quote.hourly_rate_cents)} للساعة الفردية، مع احتساب أجزاء الساعة بالدقائق والساعات المخصومة وفق سياسة الحجز. لا تُضاف مديونية إذا تجاوزت القيمة المبلغ المسدّد.</p>}
          {quote.blocked_reasons?.map(reason => <p className="package-cancel-error" role="alert" key={reason}>{reason}</p>)}
          {quote.completed ? <>
            <p className="package-cancel-success" role="status">الباقة غير نشطة. {quote.refund_cents > 0 ? `تم تسجيل مصروف الاسترداد رقم ${quote.finance_id}.` : 'لم يُسجل مصروف لأن مبلغ الاسترداد صفر.'}</p>
            <label>رسالة جاهزة لإرسالها للعميل<textarea readOnly rows={12} value={message}/></label>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(message); setNotice('تم نسخ الرسالة.'); } catch { setNotice('تعذر النسخ تلقائيًا. يمكنك تحديد نص الرسالة ونسخه.'); } }}><Copy size={18}/> نسخ رسالة التسوية</button>
            {notice && <p role="status">{notice}</p>}
          </> : !quote.blocked_reasons?.length && <>
            <div className="package-cancel-fields"><label>المبلغ المراد رده — ج.م<input type="number" min="0" max={centsToMoney(quote.paid_cents)} step="0.01" inputMode="decimal" required value={form.amount} disabled={busy} onChange={e => setForm({ ...form, amount: e.target.value, confirmed: false })}/><small>يمكن تعديله يدويًا، بحد أقصى {money(quote.paid_cents)}.</small></label><label>الرد من محفظة<select value={form.method} disabled={busy || amount === 0} onChange={e => setForm({ ...form, method: e.target.value, confirmed: false })}>{Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <label>سبب إلغاء الباقة<textarea required maxLength={500} rows={2} disabled={busy} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}/></label>
            {changed && <label>سبب اعتماد مبلغ استرداد مختلف — يظهر في رسالة العميل<textarea required maxLength={500} rows={2} disabled={busy} value={form.override} onChange={e => setForm({ ...form, override: e.target.value })}/></label>}
            <p className="package-cancel-warning">سيتم إلغاء المواعيد والطلبات المتبقية ({appointments.length}) وطلبات تعديلها، وإغلاق الباقة نهائيًا. تظل الجلسات السابقة والمدفوعات محفوظة للمراجعة.</p>
            {appointments.length > 0 && <details><summary>مراجعة المواعيد التي ستُلغى</summary><ul>{appointments.map((b, index) => <li key={index}>{b.date} · {String(b.start_time || '').slice(0, 5)} — {String(b.end_time || '').slice(0, 5)}</li>)}</ul></details>}
            <label className="package-cancel-consent"><input type="checkbox" checked={form.confirmed} disabled={busy} onChange={e => setForm({ ...form, confirmed: e.target.checked })}/><span>أؤكد إلغاء الباقة{amount > 0 ? ` ورد مبلغ ${money(amount)} فعليًا للعميل من المحفظة المحددة. هذا الزر يسجل المصروف ولا ينفذ تحويلًا بنكيًا.` : ' بدون استرداد وبدون إضافة أي مديونية.'}</span></label>
          </>}
        </>}
      </div>
      <footer><button type="button" disabled={busy} onClick={close}>{quote?.completed ? 'إغلاق' : 'رجوع بدون إلغاء'}</button>{!quote?.completed && <button className="package-cancel-confirm" type="submit" disabled={Boolean(invalid)}>{busy ? 'جارٍ إتمام التسوية…' : 'تأكيد الإلغاء وتسجيل التسوية'}</button>}</footer>
    </form>
  </div>;
}
