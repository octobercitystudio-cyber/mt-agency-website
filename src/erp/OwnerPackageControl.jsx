import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowUpCircle, Banknote, CalendarCheck2, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, RefreshCw, Save, ShieldAlert, TimerReset, Trash2, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { safeUiError } from '../lib/uiError';
import { formatBookingDate, formatEGP, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import useModalDialog from '../hooks/useModalDialog';
import PackageUpgradeDialog from './PackageUpgradeDialog';
import './OwnerPackageControl.css';
import './OwnerPackageControlFixes.css';

const STATUS_LABELS = { pending: 'بانتظار التأكيد', confirmed: 'مؤكد', alternative_proposed: 'موعد بديل', cancel_requested: 'طلب إلغاء', late_cancel_requested: 'إلغاء متأخر', in_progress: 'جارٍ التصوير', completed: 'مكتمل', cancelled: 'ملغي' };
const PACKAGE_STATUSES = { active: 'نشطة', suspended: 'موقوفة', completed: 'مكتملة', expired: 'منتهية', cancelled: 'ملغاة' };
const PAYMENT_METHODS = { cash: 'كاش', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي' };
const correctionKey = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export default function OwnerPackageControl({ pkg, person, resources, returnFocusRef, childOpen = false, refreshToken, onClose, onChanged, onNewBooking, onNewPayment }) {
  const dialogRef = useModalDialog(true, onClose, { returnFocusRef });
  const lastRefreshTokenRef = useRef(refreshToken);
  const [tab, setTab] = useState('balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [balance, setBalance] = useState({ purchased: '', consumed: '', purchasedReason: '', consumedReason: '' });
  const [finance, setFinance] = useState({ total: '', paid: '', method: '', reason: '' });
  const [details, setDetails] = useState({ name: '', serviceId: '', notes: '', starts: '', expires: '', status: 'active', validityMode: 'rolling', validityDays: '1', paymentDue: '0', depositPercent: '0', overagePrice: '0', reason: '' });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [bookingDrafts, setBookingDrafts] = useState({});
  const [archive, setArchive] = useState({ open: false, reason: '', confirmed: false });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const upgradeButtonRef = useRef(null);

  const hydrate = useCallback(response => {
    setData(response);
    const info = response.package; const quantities = response.quantities; const financial = response.financial; const validity = response.validity;
    setBalance(current => ({ ...current, purchased: String(quantities.purchased), consumed: String(quantities.used) }));
    setFinance(current => ({ ...current, total: String(financial.total_price), paid: String(financial.paid_amount) }));
    setDetails(current => ({ ...current, name: info.name || '', serviceId: String(info.service?.id || ''), notes: info.notes || '', starts: String(validity.starts_at || '').slice(0, 10), expires: String(validity.expires_at || '').slice(0, 10), status: info.status || 'active', validityMode: info.validity_mode_snapshot === 'shooting_day' ? 'shooting_day' : 'rolling', validityDays: String(info.validity_days_snapshot || 1), paymentDue: String(info.payment_due_quantity || 0), depositPercent: String(info.deposit_percent_snapshot || 0), overagePrice: String(info.overage_price_snapshot || 0) }));
    setBookingDrafts(Object.fromEntries((response.all_bookings || []).map(booking => [booking.id, { date: String(booking.date || '').slice(0, 10), start_time: String(booking.start_time || '').slice(0, 5), end_time: String(booking.end_time || '').slice(0, 5), resource_id: String(booking.resource_id || ''), notes: booking.notes || '' }])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [{ data: response, error: requestError }, servicesResult] = await Promise.all([dataClient.request(`/client-packages/${pkg.id}/details`, { method: 'GET' }), dataClient.from('services').select('id,name,billing_unit,is_active').order('name')]);
    setLoading(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر تحميل مركز تحكم الباقة.'));
    if (!servicesResult.error) setServiceOptions((servicesResult.data || []).filter(service => String(service.billing_unit) === String(response.package.billing_unit)));
    hydrate(response);
  }, [pkg.id, hydrate]);

  useEffect(() => {
    if (refreshToken !== lastRefreshTokenRef.current) {
      lastRefreshTokenRef.current = refreshToken;
      setNotice('تم تحديث بيانات الباقة وسجلاتها المالية والتشغيلية.');
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshToken]);

  const perform = async (key, endpoint, body, success, method = 'POST') => {
    setBusy(key); setError(''); setNotice('');
    const { error: requestError } = await dataClient.request(endpoint, { method, body: JSON.stringify(body) });
    setBusy('');
    if (requestError) return setError(safeUiError(requestError, 'تعذر حفظ التعديل.'));
    setNotice(success); await load(); await onChanged?.();
  };

  const info = data?.package; const quantities = data?.quantities; const financial = data?.financial; const bookings = data?.all_bookings || [];
  const unit = info?.billing_unit || pkg.billing_unit; const step = unit === 'reel' ? 1 : 1 / 60;
  const quantity = value => formatPackageQuantity(Number(value || 0), unit);
  const purchasedMinimum = Number(quantities?.used || 0) + Number(quantities?.upcoming_held || 0);
  const consumedMaximum = Math.max(0, Number(quantities?.purchased || 0) - Number(quantities?.upcoming_held || 0));
  const financePreview = useMemo(() => { const total = Math.max(0, Number(finance.total || 0)); const paid = Math.max(0, Number(finance.paid || 0)); const overage = Number(financial?.overage_amount || 0); return { outstanding: Math.max(0, total + overage - paid), credit: Math.max(0, paid - total - overage) }; }, [finance.total, finance.paid, financial?.overage_amount]);
  const activeBookings = bookings.filter(booking => !['completed','cancelled'].includes(booking.status));
  const historyBookings = bookings.filter(booking => ['completed','cancelled'].includes(booking.status));
  const pendingValidity = !details.starts && !details.expires;
  const tabs = [['balance', TimerReset, 'الرصيد والاستخدام', 'الرصيد'], ['finance', CircleDollarSign, 'السعر والمدفوع', 'المالية'], ['details', CalendarClock, 'الصلاحية والبيانات', 'الصلاحية'], ['bookings', CalendarCheck2, 'مواعيد الباقة', 'المواعيد']];
  const savePurchased = () => perform('purchased', `/client-packages/${pkg.id}/adjust`, { target_quantity: Number(balance.purchased), reason: balance.purchasedReason, expected_version: info.version }, 'تم تصحيح إجمالي الباقة وتسجيل الأثر.');
  const saveConsumed = () => perform('consumed', `/client-packages/${pkg.id}/usage-adjustment`, { target_consumed_quantity: Number(balance.consumed), reason: balance.consumedReason, expected_version: info.version, correction_key: correctionKey('usage') }, 'تم تصحيح المستخدم بقيد مراجعة مستقل.');
  const saveFinance = () => perform('finance', `/client-packages/${pkg.id}/commercial-adjustment`, { target_total_price: finance.total, target_paid_amount: finance.paid, method: finance.method, reason: finance.reason, expected_version: info.version }, 'تم تحديث السعر والمدفوع وإنشاء القيود اللازمة.');
  const saveDetails = () => perform('details', `/client-packages/${pkg.id}`, { name: details.name, service_id: Number(details.serviceId), notes: details.notes, starts_at: details.starts, expires_at: details.expires, status: details.status, validity_mode_snapshot: details.validityMode, validity_days_snapshot: Number(details.validityDays), payment_due_quantity: Number(details.paymentDue), deposit_percent_snapshot: Number(details.depositPercent), overage_price_snapshot: details.overagePrice, reason: details.reason, expected_version: info.version }, 'تم تحديث عقد الباقة وصلاحيتها وحدود الدفع.', 'PATCH');
  const saveBooking = booking => perform(`booking-${booking.id}`, `/bookings/${booking.id}/admin-reschedule`, bookingDrafts[booking.id], 'تم تعديل الموعد وحجز المورد الجديد بأمان.');
  const deleteBooking = booking => { if (!window.confirm('حذف الموعد نهائيًا من الحجوزات؟ سيتم تحرير الرصيد المحجوز ولن يظهر الموعد للعميل.')) return; return perform(`delete-${booking.id}`, `/bookings/${booking.id}`, {}, 'تم حذف الموعد وتحرير رصيده بالكامل.', 'DELETE'); };
  const archivePackage = () => perform('archive', `/client-packages/${pkg.id}/archive`, { reason: archive.reason, hard_delete: false }, 'تمت أرشفة الباقة مع الاحتفاظ بسجلها.');

  // Booking-child baseline remains: aria-modal={childOpen ? undefined : 'true'}, aria-hidden={childOpen ? 'true' : undefined}, inert={childOpen ? true : undefined}. Upgrade uses the same nesting contract.
  const nestedOpen = childOpen || upgradeOpen;
  return <><div className="packages-modal owner-package-modal" aria-hidden={nestedOpen ? 'true' : undefined} onMouseDown={event => { if (event.target === event.currentTarget && !busy && !nestedOpen) onClose(); }}>
    <section ref={dialogRef} className="owner-package-center" role="dialog" aria-modal={nestedOpen ? undefined : 'true'} aria-hidden={nestedOpen ? 'true' : undefined} inert={nestedOpen ? true : undefined} aria-labelledby="owner-package-title" aria-describedby="owner-package-description">
      <header className="owner-center-header"><div><span><PackageCheck/> مركز تحكم المالك</span><h2 id="owner-package-title">{info?.name || pkg.name}</h2><p id="owner-package-description">{info?.client?.name || person?.name || 'العميل'} · باقة #{pkg.id} · كل تصحيح موثق ولا يحذف التاريخ</p></div><div className="owner-header-actions"><button ref={upgradeButtonRef} type="button" className="owner-upgrade-entry" onClick={() => setUpgradeOpen(true)}><ArrowUpCircle/> ترقية / استبدال</button><div className="owner-health-chips"><b className={`health-${info?.effective_status || pkg.status}`}>{PACKAGE_STATUSES[info?.effective_status] || info?.effective_status || '—'}</b>{info?.validity_mode_snapshot === 'shooting_day' && <b className="health-day">باقة يوم تصوير</b>}<b>نسخة {info?.version || pkg.version || 1}</b></div></div><button data-dialog-initial type="button" className="owner-center-close" onClick={onClose} aria-label="إغلاق مركز تحكم الباقة"><X/></button></header>
      <nav className="owner-center-tabs" role="tablist" aria-label="أقسام تحكم الباقة">{tabs.map(([key, Icon, label, shortLabel]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} aria-label={label}><Icon/><span className="owner-tab-label">{label}</span><span className="owner-tab-short" aria-hidden="true">{shortLabel}</span>{key === 'bookings' && <small>{bookings.length}</small>}</button>)}</nav>
      {error && <div className="owner-center-message error" role="alert"><ShieldAlert/><span>{error}</span><button type="button" onClick={load}>إعادة التحميل</button></div>}{notice && <div className="owner-center-message success" role="status"><CheckCircle2/>{notice}</div>}
      {loading ? <div className="owner-center-state"><RefreshCw className="packages-spin"/><strong>جارٍ تحميل عقد الباقة ومواعيدها…</strong></div> : data && <div className="owner-center-scroll">
        {tab === 'balance' && <section className="owner-balance-panel" role="tabpanel"><div className="owner-metric-strip"><Metric label="إجمالي المشترى" value={quantity(quantities.purchased)}/><Metric label="المستخدم" value={quantity(quantities.used)} tone="used"/><Metric label="محجوز بالمواعيد" value={quantity(quantities.upcoming_held)} tone="held"/><Metric label="متاح لحجز جديد" value={quantity(quantities.available)} tone="available"/><Metric label="المتبقي غير المستهلك" value={quantity(quantities.remaining)}/></div><div className="owner-editor-grid"><Editor title="تصحيح إجمالي الباقة" note={`لا يقل عن المستخدم + المحجوز: ${quantity(purchasedMinimum)}`}><label>الإجمالي الجديد<input type="number" min={purchasedMinimum} step={step} value={balance.purchased} onChange={event => setBalance({ ...balance, purchased: event.target.value })}/></label><label>سبب تصحيح الإجمالي<textarea rows="3" minLength="5" value={balance.purchasedReason} onChange={event => setBalance({ ...balance, purchasedReason: event.target.value })}/></label><SaveButton busy={busy === 'purchased'} disabled={balance.purchasedReason.trim().length < 5 || Number(balance.purchased) < purchasedMinimum} onClick={savePurchased}>حفظ إجمالي الباقة</SaveButton></Editor><Editor title="تصحيح المستخدم الفعلي" note={`الحد الأقصى بعد خصم المحجوز: ${quantity(consumedMaximum)}`}><label>المستخدم المستهدف<input type="number" min="0" max={consumedMaximum} step={step} value={balance.consumed} onChange={event => setBalance({ ...balance, consumed: event.target.value })}/></label><label>سبب تصحيح الاستخدام<textarea rows="3" minLength="5" value={balance.consumedReason} onChange={event => setBalance({ ...balance, consumedReason: event.target.value })}/></label><SaveButton busy={busy === 'consumed'} disabled={balance.consumedReason.trim().length < 5 || Number(balance.consumed) < 0 || Number(balance.consumed) > consumedMaximum} onClick={saveConsumed}>حفظ المستخدم الموثق</SaveButton></Editor></div><div className="owner-readonly-explain"><Clock3/><div><strong>المحجوز والمتاح لا يُعدّلان يدويًا</strong><p>المحجوز مشتق من المواعيد المؤكدة. استخدم قسم مواعيد الباقة لإضافة أو تعديل أو إلغاء موعد، وسيُعاد حساب المتاح تلقائيًا.</p><button type="button" onClick={() => setTab('bookings')}>إدارة المواعيد</button></div></div></section>}
        {tab === 'finance' && <section role="tabpanel" className="owner-finance-panel"><div className="owner-metric-strip finance"><Metric label="إجمالي السعر" value={formatEGP(finance.total)}/><Metric label="المدفوع" value={formatEGP(finance.paid)} tone="available"/><Metric label="المتبقي" value={formatEGP(financePreview.outstanding)} tone={financePreview.outstanding ? 'held' : 'available'}/><Metric label="رصيد دائن" value={formatEGP(financePreview.credit)}/></div>{Number(financial.outstanding)>0&&<button type="button" className="owner-record-payment" onClick={onNewPayment}><Banknote/> تسجيل دفعة فعلية في مدفوعات العميل <small>{formatEGP(financial.outstanding)} متبقي</small></button>}<Editor title="تصحيح القيمة التجارية" note="استخدم تسجيل دفعة للتحصيل الحقيقي. هذه الأداة مخصصة لتصحيح سعر أو رقم مسجل خطأ مع سبب مراجعة."><div className="owner-fields-grid"><label>إجمالي سعر الباقة<input type="number" min="0" step="0.01" value={finance.total} onChange={event => setFinance({ ...finance, total: event.target.value })}/></label><label>المدفوع المستهدف<input type="number" min="0" step="0.01" value={finance.paid} onChange={event => setFinance({ ...finance, paid: event.target.value })}/></label><label>طريقة التحصيل<select value={finance.method} onChange={event => setFinance({ ...finance, method: event.target.value })}><option value="">اختر عند زيادة المدفوع</option>{Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label>سبب التصحيح المالي<textarea rows="3" minLength="5" value={finance.reason} onChange={event => setFinance({ ...finance, reason: event.target.value })}/></label><SaveButton busy={busy === 'finance'} disabled={finance.reason.trim().length < 5 || Number(finance.total) < 0 || Number(finance.paid) < 0 || (Number(finance.paid) > Number(financial.paid_amount) && !finance.method)} onClick={saveFinance}>حفظ السعر والمدفوع</SaveButton></Editor></section>}
        {tab === 'details' && <section role="tabpanel" className="owner-details-panel">
          <Editor title="الصلاحية وكل بيانات العقد" note={pendingValidity ? 'اترك التاريخين فارغين ليبدأ العقد تلقائيًا مع أول حجز، أو حددهما يدويًا بصلاحية المالك.' : details.validityMode === 'shooting_day' ? 'هذه باقة يوم تصوير؛ البداية والانتهاء في اليوم نفسه.' : 'لن تُقبل فترة تستبعد موعدًا نشطًا؛ عدّل المواعيد أولًا.'}>
            <div className="owner-fields-grid">
              <label>اسم الباقة<input value={details.name} onChange={event => setDetails({ ...details, name: event.target.value })}/></label>
              <label>الخدمة<select value={details.serviceId} onChange={event => setDetails({ ...details, serviceId: event.target.value })}>{serviceOptions.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select><small>تبديل الخدمة متاح قبل وجود مواعيد أو استخدام أو دفعات فقط.</small></label>
              <label>الحالة<select value={details.status} onChange={event => setDetails({ ...details, status: event.target.value })}>{Object.entries(PACKAGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>نظام الصلاحية<select value={details.validityMode} onChange={event => setDetails({ ...details, validityMode: event.target.value, ...(event.target.value === 'shooting_day' && details.starts ? { expires: details.starts, validityDays: '1' } : {}) })}><option value="rolling">عدد أيام تقويمية</option><option value="shooting_day">يوم تصوير واحد</option></select></label>
              <label>مدة الصلاحية بالأيام<input type="number" min="1" max="3650" value={details.validityDays} onChange={event => setDetails({ ...details, validityDays: event.target.value })}/></label>
              <label>حد السداد من الرصيد<input type="number" min="0" max={quantities.purchased} step={step} value={details.paymentDue} onChange={event => setDetails({ ...details, paymentDue: event.target.value })}/></label>
              <label>نسبة المقدم %<input type="number" min="0" max="100" step="0.01" value={details.depositPercent} onChange={event => setDetails({ ...details, depositPercent: event.target.value })}/></label>
              <label>سعر الإضافي<input type="number" min="0" step="0.01" value={details.overagePrice} onChange={event => setDetails({ ...details, overagePrice: event.target.value })}/></label>
              <label>تاريخ البداية<input type="date" value={details.starts} onChange={event => setDetails({ ...details, starts: event.target.value, ...(details.validityMode === 'shooting_day' ? { expires: event.target.value } : {}) })}/><small>{pendingValidity ? 'اختياري — يبدأ مع أول حجز' : 'محدد يدويًا'}</small></label>
              <label>تاريخ الانتهاء<input type="date" min={details.starts} disabled={details.validityMode === 'shooting_day'} value={details.expires} onChange={event => setDetails({ ...details, expires: event.target.value })}/></label>
            </div>
            <label>ملاحظات المالك<textarea rows="3" value={details.notes} onChange={event => setDetails({ ...details, notes: event.target.value })}/></label>
            <label>سبب تعديل العقد أو الصلاحية<textarea rows="3" minLength="5" value={details.reason} onChange={event => setDetails({ ...details, reason: event.target.value })}/></label>
            <SaveButton busy={busy === 'details'} disabled={details.reason.trim().length < 5 || !details.name.trim() || !details.serviceId || Number(details.validityDays) < 1 || Number(details.paymentDue) < 0 || Number(details.paymentDue) > Number(quantities.purchased) || Number(details.depositPercent) < 0 || Number(details.depositPercent) > 100 || Number(details.overagePrice) < 0 || (!pendingValidity && (!details.starts || !details.expires || details.expires < details.starts))} onClick={saveDetails}>حفظ كل بيانات العقد</SaveButton>
          </Editor>
          <section className="owner-archive-zone"><button type="button" onClick={() => setArchive(current => ({ ...current, open: !current.open }))}><Archive/> أرشفة الباقة</button>{archive.open && <div><p>الأرشفة توقف العمل بالباقة وتحفظ جميع المواعيد والدفعات والسجلات.</p><label>سبب الأرشفة<textarea rows="2" minLength="5" value={archive.reason} onChange={event => setArchive({ ...archive, reason: event.target.value })}/></label><label className="owner-confirm-row"><input type="checkbox" checked={archive.confirmed} onChange={event => setArchive({ ...archive, confirmed: event.target.checked })}/> أفهم أن الباقة ستتوقف مع حفظ تاريخها</label><SaveButton danger busy={busy === 'archive'} disabled={!archive.confirmed || archive.reason.trim().length < 5} onClick={archivePackage}>تأكيد أرشفة الباقة</SaveButton></div>}</section>
        </section>}
        {tab === 'bookings' && <section role="tabpanel" className="owner-bookings-panel"><header><div><span>الرصيد المحجوز يتغير من هنا فقط</span><h3>كل مواعيد الباقة</h3></div><button type="button" className="owner-new-booking" onClick={onNewBooking}><CalendarCheck2/> حجز موعد جديد من الباقة</button></header>{activeBookings.length ? <BookingGroup title="المواعيد النشطة والقادمة" items={activeBookings} unit={unit} drafts={bookingDrafts} setDrafts={setBookingDrafts} resources={resources} busy={busy} onSave={saveBooking} onDelete={deleteBooking}/> : <EmptyBookings title="لا توجد مواعيد نشطة" text="يمكن حجز موعد جديد وسيظهر أثره على الرصيد فورًا."/>}{historyBookings.length ? <BookingGroup title="السجل المكتمل والملغي" items={historyBookings} unit={unit} drafts={bookingDrafts} setDrafts={setBookingDrafts} resources={resources} busy={busy} onSave={saveBooking} onDelete={deleteBooking}/> : null}</section>}
      </div>}
    </section>
  </div>{upgradeOpen && <PackageUpgradeDialog packageId={pkg.id} returnFocusRef={upgradeButtonRef} onClose={() => setUpgradeOpen(false)} onCompleted={async () => { setNotice('تم إنشاء باقة بديلة مع حفظ سجل هذه الباقة.'); await load(); await onChanged?.(); }} />}</>;
}

function Metric({ label, value, tone = '' }) { return <article className={tone}><span>{label}</span><strong>{value}</strong></article>; }
function Editor({ title, note, children }) { return <section className="owner-editor"><header><h3>{title}</h3><p>{note}</p></header>{children}</section>; }
function SaveButton({ busy, disabled, onClick, children, danger = false }) { return <button type="button" className={`owner-save ${danger ? 'danger' : ''}`} disabled={busy || disabled} onClick={onClick}>{busy ? <RefreshCw className="packages-spin"/> : danger ? <Trash2/> : <Save/>}{busy ? 'جارٍ الحفظ…' : children}</button>; }
function EmptyBookings({ title, text }) { return <div className="owner-empty-bookings"><CalendarCheck2/><strong>{title}</strong><p>{text}</p></div>; }
function BookingGroup({ title, items, unit, drafts, setDrafts, resources, busy, onSave, onDelete }) { return <section className="owner-booking-group"><h4>{title} <small>{items.length}</small></h4><div>{items.map(booking => { const draft = drafts[booking.id] || {}; return <article key={booking.id} className={`owner-booking-card status-${booking.status}`}><header><div><strong>{formatBookingDate(booking.date)}</strong><span>{formatTime12(booking.start_time)} — {formatTime12(booking.end_time)}</span></div><b>{STATUS_LABELS[booking.status] || booking.status}</b></header><dl><div><dt>المورد</dt><dd>{booking.resource_name || 'غير محدد'}</dd></div><div><dt>المدة / الكمية</dt><dd>{formatPackageQuantity(booking.requested_quantity || booking.balance_effect, unit)}</dd></div><div><dt>أثره على المحجوز</dt><dd>{formatPackageQuantity(booking.balance_effect, unit)}</dd></div></dl>{booking.notes && <p className="booking-current-note">{booking.notes}</p>}{booking.can_reschedule && <div className="owner-booking-edit"><div className="owner-fields-grid"><label>التاريخ<input type="date" value={draft.date || ''} onChange={event => setDrafts({ ...drafts, [booking.id]: { ...draft, date: event.target.value } })}/></label><label>من<BusinessTimeSelect min="12:00" max="23:45" step={15} required value={draft.start_time || ''} onChange={event => setDrafts({ ...drafts, [booking.id]: { ...draft, start_time: event.target.value } })}/></label><label>إلى<BusinessTimeSelect min="12:15" max="24:00" step={15} required value={draft.end_time || ''} onChange={event => setDrafts({ ...drafts, [booking.id]: { ...draft, end_time: event.target.value } })}/></label><label>المورد<select value={draft.resource_id || ''} onChange={event => setDrafts({ ...drafts, [booking.id]: { ...draft, resource_id: event.target.value } })}>{resources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label></div><label>ملاحظات الموعد<textarea rows="2" value={draft.notes || ''} onChange={event => setDrafts({ ...drafts, [booking.id]: { ...draft, notes: event.target.value } })}/></label><SaveButton busy={busy === `booking-${booking.id}`} disabled={!draft.date || !draft.start_time || !draft.end_time || !draft.resource_id} onClick={() => onSave(booking)}>حفظ تعديل الموعد</SaveButton></div>}{booking.can_cancel && <div className="owner-cancel-booking"><p>الحذف يزيل الموعد من الحجوزات ويعيد الرصيد المحجوز للعميل دون طلب سبب.</p><SaveButton danger busy={busy === `delete-${booking.id}`} onClick={() => onDelete(booking)}>حذف الموعد</SaveButton></div>}{booking.immutable_reason && <p className="owner-immutable"><ShieldAlert/>{booking.immutable_reason}</p>}</article>; })}</div></section>; }
