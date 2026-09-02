import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowUpCircle, CheckCircle2, Clock3,
  PackageCheck, RefreshCw, Save, ShieldCheck, X,
} from 'lucide-react';
import { dataClient } from '../dataClient';
import DurationHoursMinutesInput from '../components/DurationHoursMinutesInput';
import { formatEGP, formatPackageQuantity } from '../lib/businessFormat';
import { parseStrictMoney, strictCentsToMoney, strictMoneyError } from '../lib/strictMoney';
import { safeUiError } from '../lib/uiError';
import useModalDialog from '../hooks/useModalDialog';
import './PackageUpgradeDialog.css';

const PAYMENT_METHODS = {
  cash: 'كاش', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي',
};

const upgradeKey = packageId => `package-upgrade-${packageId}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function templateQuantity(service) {
  return String(service?.billing_unit === 'reel' ? Number(service?.total_reels || 1) : Number(service?.total_hours || 1));
}

function initialDraft() {
  return {
    serviceId: '', name: '', quantity: '1', validityDays: '30', totalPrice: '0', paidNow: '0',
    paymentDue: '0', depositPercent: '0', overagePrice: '0', paymentMethod: 'cash',
    activationMode: 'first_booking', closeSource: false, notes: '', reason: '',
  };
}

function PackageSnapshot({ title, tone, name, unit, purchased, used = 0, held = 0, available, total, paid, outstanding }) {
  const money = value => value === null ? '—' : formatEGP(value);
  return <article className={`package-upgrade-snapshot package-upgrade-snapshot--${tone}`}>
    <header><span>{title}</span><strong>{name || '—'}</strong></header>
    <dl>
      <div><dt>إجمالي الرصيد</dt><dd>{formatPackageQuantity(Number(purchased || 0), unit)}</dd></div>
      {tone === 'current' && <><div><dt>المستخدم</dt><dd>{formatPackageQuantity(Number(used || 0), unit)}</dd></div><div><dt>المحجوز</dt><dd>{formatPackageQuantity(Number(held || 0), unit)}</dd></div></>}
      <div><dt>{tone === 'current' ? 'المتاح' : 'الرصيد الجديد'}</dt><dd>{formatPackageQuantity(Number(available ?? purchased ?? 0), unit)}</dd></div>
      <div><dt>السعر</dt><dd>{money(total)}</dd></div>
      <div><dt>المدفوع</dt><dd>{money(paid)}</dd></div>
      <div><dt>المتبقي</dt><dd>{money(outstanding)}</dd></div>
    </dl>
  </article>;
}

function MoneyInput({ id, label, value, onChange, readOnly = false }) {
  const error = strictMoneyError(value, label);
  const errorId = `${id}-error`;
  return <label><span>{label}</span><input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} readOnly={readOnly} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)} />{error && <small id={errorId} className="package-upgrade-field-error">{error}</small>}</label>;
}

export default function PackageUpgradeDialog({ packageId, sessionActive = false, returnFocusRef, onClose, onCompleted }) {
  const [source, setSource] = useState(null);
  const [services, setServices] = useState([]);
  const [draft, setDraft] = useState(initialDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [idempotencyKey] = useState(() => upgradeKey(packageId));
  const close = () => { if (!busy) onClose(); };
  const dialogRef = useModalDialog(Boolean(packageId), close, { returnFocusRef });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [detailsResult, servicesResult] = await Promise.all([
      dataClient.request(`/client-packages/${packageId}/details`, { method: 'GET' }),
      dataClient.from('services').select('id,name,billing_unit,total_hours,total_reels,validity_days,price,payment_due_hours,deposit_percent,overage_price,is_active').order('name'),
    ]);
    setLoading(false);
    if (detailsResult.error) return setError(safeUiError(detailsResult.error, 'تعذر تحميل بيانات الباقة الحالية.'));
    const templates = (servicesResult.data || []).filter(item => Number(item.is_active ?? 1) === 1 && ['hour', 'reel'].includes(String(item.billing_unit)));
    setSource(detailsResult.data); setServices(templates);
    const preferred = templates.find(item => Number(item.id) !== Number(detailsResult.data.package.service?.id)) || templates[0];
    if (preferred) {
      setDraft(current => ({
        ...current, serviceId: String(preferred.id), name: preferred.name, quantity: templateQuantity(preferred),
        validityDays: String(preferred.validity_days || 30), totalPrice: String(preferred.price || 0),
        paymentDue: String(preferred.billing_unit === 'hour' ? preferred.payment_due_hours || 0 : 0),
        depositPercent: String(preferred.deposit_percent || 0), overagePrice: String(preferred.overage_price || 0),
      }));
    }
  }, [packageId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const selectedService = services.find(item => String(item.id) === String(draft.serviceId));
  const unit = selectedService?.billing_unit || source?.package?.billing_unit || 'hour';
  const financial = source?.financial || {};
  const quantities = source?.quantities || {};
  const activeSession = sessionActive || (source?.all_bookings || []).some(booking => booking.has_active_session);
  const held = Number(quantities.upcoming_held || 0);
  const canCloseSource = !activeSession && held <= 0;
  const totalMoney = parseStrictMoney(draft.totalPrice);
  const paidMoney = parseStrictMoney(draft.paidNow);
  const overageMoney = parseStrictMoney(draft.overagePrice);
  const totalCents = totalMoney.valid ? totalMoney.cents : null;
  const paidCents = paidMoney.valid ? paidMoney.cents : null;
  const outstanding = totalMoney.valid && paidMoney.valid ? Math.max(0, totalCents - paidCents) / 100 : null;
  const oldCredit = Number(financial.customer_credit || 0);
  const validation = useMemo(() => {
    if (!draft.serviceId || !draft.name.trim()) return 'اختر نموذج الباقة واكتب اسمها.';
    if (Number(draft.quantity) <= 0 || (unit === 'reel' && !Number.isInteger(Number(draft.quantity)))) return 'رصيد الباقة الجديدة غير صحيح.';
    if (!Number.isInteger(Number(draft.validityDays)) || Number(draft.validityDays) < 1) return 'صلاحية الباقة يجب أن تكون يومًا واحدًا على الأقل.';
    if (!totalMoney.valid) return strictMoneyError(draft.totalPrice, 'إجمالي السعر');
    if (!paidMoney.valid) return strictMoneyError(draft.paidNow, 'المدفوع الآن');
    if (!overageMoney.valid) return strictMoneyError(draft.overagePrice, 'سعر الساعة الإضافية');
    if (paidCents > totalCents) return 'المدفوع الآن لا يجوز أن يتجاوز سعر الباقة.';
    if (!Number.isFinite(Number(draft.paymentDue)) || Number(draft.paymentDue) < 0 || Number(draft.paymentDue) > Number(draft.quantity)) return 'حد السداد يجب أن يكون داخل رصيد الباقة.';
    if (draft.reason.trim().length < 5) return 'اكتب سبب الترقية لسجل المراجعة.';
    if (draft.closeSource && !canCloseSource) return 'لا يمكن إغلاق الباقة الحالية مع جلسة جارية أو وقت محجوز.';
    return '';
  }, [canCloseSource, draft, overageMoney.valid, paidCents, paidMoney.valid, totalCents, totalMoney.valid, unit]);

  const chooseService = serviceId => {
    const service = services.find(item => String(item.id) === String(serviceId));
    setDraft(current => service ? ({
      ...current, serviceId: String(service.id), name: service.name, quantity: templateQuantity(service),
      validityDays: String(service.validity_days || 30), totalPrice: String(service.price || 0),
      paymentDue: String(service.billing_unit === 'hour' ? service.payment_due_hours || 0 : 0),
      depositPercent: String(service.deposit_percent || 0), overagePrice: String(service.overage_price || 0),
    }) : ({ ...current, serviceId: '' }));
    setError('');
  };

  const submit = async event => {
    event.preventDefault(); if (busy || validation) { if (validation) setError(validation); return; }
    setBusy(true); setError(''); setNotice('');
    const payload = {
      client_id: source.package.client.id, service_id: Number(draft.serviceId), name: draft.name.trim(), billing_unit: unit,
      quantity: Number(draft.quantity), payment_due_quantity: Number(draft.paymentDue || 0),
      deposit_percent_snapshot: Number(draft.depositPercent || 0), overage_price_snapshot: strictCentsToMoney(overageMoney.cents),
      total_price: strictCentsToMoney(totalMoney.cents), paid_amount: strictCentsToMoney(paidMoney.cents), payment_method: draft.paymentMethod,
      notes: draft.notes.trim(), validity_days: Number(draft.validityDays), bookings: [], idempotency_key: idempotencyKey,
      upgrade_context: {
        source_package_id: Number(source.package.id), expected_source_version: Number(source.package.version || 1),
        close_source_package: Boolean(draft.closeSource), activation_mode: draft.activationMode, reason: draft.reason.trim(),
      },
    };
    const { data, error: requestError } = await dataClient.request('/client-packages', { method: 'POST', body: JSON.stringify(payload) });
    setBusy(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر إنشاء الباقة البديلة. لم يتم تغيير الباقة القديمة.'));
    setNotice(`تم إنشاء الباقة البديلة #${data.id} وحفظ تاريخ الباقة الأصلية.`);
    await onCompleted?.(data);
  };

  if (!packageId) return null;
  return <div className="package-upgrade-overlay" onMouseDown={event => event.target === event.currentTarget && close()}>
    <form ref={dialogRef} className="package-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="package-upgrade-title" aria-describedby="package-upgrade-description" onSubmit={submit} noValidate>
      <header><div><span><ArrowUpCircle /> ترقية موثقة للباقة</span><h2 id="package-upgrade-title">استبدال الباقة بدون مسح التاريخ</h2><p id="package-upgrade-description">تُنشأ باقة جديدة مستقلة، وتبقى الجلسات والدفعات والاستهلاك في الباقة الأصلية.</p></div><button data-dialog-initial type="button" onClick={close} disabled={busy} aria-label="إغلاق نافذة ترقية الباقة"><X /></button></header>
      {loading ? <div className="package-upgrade-state"><RefreshCw /><strong>جارٍ تحميل الرصيد ونماذج الباقات…</strong></div> : source && <div className="package-upgrade-body">
        {(activeSession || held > 0) && <div className="package-upgrade-guard" role="note"><AlertTriangle /><div><strong>{activeSession ? 'جلسة تصوير جارية على الباقة الحالية' : 'توجد مواعيد تحجز رصيدًا من الباقة الحالية'}</strong><p>يمكنك إنشاء الباقة البديلة الآن، لكن لن ننقل الجلسة أو المواعيد إليها ولن نغلق الباقة القديمة.</p></div></div>}
        <section className="package-upgrade-comparison" aria-label="مقارنة الباقة الحالية والجديدة">
          <PackageSnapshot title="الباقة الحالية" tone="current" name={source.package.name} unit={source.package.billing_unit} purchased={quantities.purchased} used={quantities.used} held={quantities.upcoming_held} available={quantities.available} total={financial.total_price} paid={financial.paid_amount} outstanding={financial.outstanding} />
          <span className="package-upgrade-arrow" aria-hidden="true"><ArrowLeft /></span>
          <PackageSnapshot title="الباقة البديلة" tone="next" name={draft.name || 'اختر نموذجًا'} unit={unit} purchased={draft.quantity} total={totalMoney.valid ? totalCents / 100 : null} paid={paidMoney.valid ? paidCents / 100 : null} outstanding={outstanding} />
        </section>
        <section className="package-upgrade-form"><h3><PackageCheck /> بيانات الباقة الجديدة</h3><div className="package-upgrade-grid">
          <label><span>نموذج الباقة</span><select value={draft.serviceId} onChange={event => chooseService(event.target.value)}><option value="">اختر النموذج</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
          <label><span>اسم الباقة</span><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          {unit === 'reel'
            ? <label><span>إجمالي الريلز</span><input type="number" min="1" step="1" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: event.target.value })} /></label>
            : <DurationHoursMinutesInput idPrefix="package-upgrade-balance" label="إجمالي الرصيد" value={draft.quantity} minMinutes={1} onChange={value => setDraft({ ...draft, quantity: value })}/>}
          <label><span>صلاحية الباقة بالأيام</span><input type="number" min="1" max="3650" step="1" value={draft.validityDays} onChange={event => setDraft({ ...draft, validityDays: event.target.value })} /></label>
          <MoneyInput id="package-upgrade-total-price" label="إجمالي السعر" value={draft.totalPrice} onChange={value => setDraft({ ...draft, totalPrice: value })} />
          <MoneyInput id="package-upgrade-paid-now" label="المدفوع الآن" value={draft.paidNow} onChange={value => setDraft({ ...draft, paidNow: value })} />
          <label><span>طريقة الدفع</span><select value={draft.paymentMethod} onChange={event => setDraft({ ...draft, paymentMethod: event.target.value })}>{Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <MoneyInput id="package-upgrade-overage-price" label="سعر الساعة الإضافية" value={draft.overagePrice} onChange={value => setDraft({ ...draft, overagePrice: value })} />
          {unit === 'reel'
            ? <label><span>حد السداد من الرصيد</span><input type="number" min="0" max={draft.quantity || '0'} step="1" value={draft.paymentDue} onChange={event => setDraft({ ...draft, paymentDue: event.target.value })} /></label>
            : <DurationHoursMinutesInput idPrefix="package-upgrade-payment-due" label="حد السداد من الرصيد" value={draft.paymentDue} maxMinutes={Number(draft.quantity || 0) * 60} onChange={value => setDraft({ ...draft, paymentDue: value })}/>}
          <label><span>بداية الصلاحية</span><select value={draft.activationMode} onChange={event => setDraft({ ...draft, activationMode: event.target.value })}><option value="first_booking">من أول حجز على الباقة</option><option value="immediate">فور الاعتماد</option></select></label>
        </div><label className="package-upgrade-wide"><span>ملاحظات الباقة <small>(اختياري)</small></span><textarea rows="2" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label><label className="package-upgrade-wide"><span>سبب الترقية <b>مطلوب</b></span><textarea rows="2" minLength="5" value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} placeholder="مثال: طلب العميل الترقية لباقة أعلى" /></label></section>
        <section className="package-upgrade-policy"><ShieldCheck /><div><strong>ماذا سيحدث للباقة الحالية؟</strong><label><input type="checkbox" checked={draft.closeSource} disabled={!canCloseSource} onChange={event => setDraft({ ...draft, closeSource: event.target.checked })} /> إغلاقها كباقة مكتملة بعد إنشاء البديلة</label><p>{canCloseSource ? 'الإغلاق اختياري وموثق؛ لا يحذف الاستهلاك أو الدفعات.' : 'أنهِ الجلسة وسوِّ الوقت، أو عدّل المواعيد المحجوزة قبل إغلاقها.'}</p>{oldCredit > 0 && <p className="package-upgrade-credit">يوجد رصيد دائن {formatEGP(oldCredit)} على الباقة القديمة. لن يُنقل أو يُكرر تلقائيًا؛ عالجه كتصحيح مالي موثق.</p>}</div></section>
        {validation && <p className="package-upgrade-inline-hint"><Clock3 /> {validation}</p>}
        {error && <div className="package-upgrade-message error" role="alert"><AlertTriangle />{error}</div>}
        {notice && <div className="package-upgrade-message success" role="status"><CheckCircle2 />{notice}</div>}
      </div>}
      <footer>{notice ? <button type="button" className="package-upgrade-submit package-upgrade-finish" onClick={close}>إغلاق بعد نجاح الترقية</button> : <><button type="button" className="package-upgrade-cancel" onClick={close} disabled={busy}>إلغاء</button><button type="submit" className="package-upgrade-submit" disabled={loading || busy || Boolean(validation)}>{busy ? <RefreshCw /> : <Save />}{busy ? 'جارٍ إنشاء الباقة…' : 'اعتماد الترقية'}</button></>}</footer>
    </form>
  </div>;
}
