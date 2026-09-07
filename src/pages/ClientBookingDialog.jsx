import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, PackageCheck, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { dataClient } from '../dataClient';
import { cairoDateKey, formatBookingDate, formatDurationMinutes, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';
import { clientDurationError, clientDurationMinutesFromDraft, normalizeClientMinuteDraft, resolveClientBookingTime } from './clientBookingTime';

const emptyAvailability = { data: null, loading: false, error: '' };
const packageMinutes = (pkg, name) => Number.isSafeInteger(Number(pkg?.[`${name}_minutes`]))
  ? Number(pkg[`${name}_minutes`])
  : Math.round(Number(pkg?.[`${name}_quantity`] || 0) * 60);
const availableQuantity = pkg => pkg?.billing_unit === 'hour'
  ? Math.max(0, packageMinutes(pkg, 'purchased') - packageMinutes(pkg, 'held') - packageMinutes(pkg, 'consumed')) / 60
  : Math.max(0, Number(pkg?.purchased_quantity || 0) - Number(pkg?.held_quantity || 0) - Number(pkg?.consumed_quantity || 0));

export default function ClientBookingDialog({ open, packages = [], initialPackageId = '', triggerRef, onClose, onSuccess, showNotice }) {
  const dialogRef = useRef(null);
  const submitErrorRef = useRef(null);
  const busyRef = useRef(false);
  const [packageId, setPackageId] = useState(String(initialPackageId || ''));
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState(emptyAvailability);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const eligiblePackages = useMemo(() => packages.filter(pkg => ['hour', 'reel'].includes(pkg.billing_unit) && availableQuantity(pkg) > 0), [packages]);
  const selectedPackage = eligiblePackages.find(pkg => String(pkg.id) === String(packageId));
  const durationDraftMinutes = clientDurationMinutesFromDraft(hours, minutes);
  const durationMinutes = Number.isFinite(durationDraftMinutes) ? Math.max(0, durationDraftMinutes) : 0;
  const durationRuleError = clientDurationError(durationMinutes);
  const durationValid = Boolean(selectedPackage) && !durationRuleError && (selectedPackage.billing_unit !== 'hour' || availableQuantity(selectedPackage) * 60 + .001 >= durationMinutes);
  const selectedDay = availability.data?.days?.find(day => day.date === selectedDate);
  const bookingTime = useMemo(() => resolveClientBookingTime({ startTime, durationMinutes, slots: selectedDay?.slots || [] }), [durationMinutes, selectedDay?.slots, startTime]);
  const selectedSlot = bookingTime.slot;

  const updateDurationDraft = (nextHours, nextMinutes) => {
    setHours(nextHours); setMinutes(nextMinutes); setSelectedDate(''); setStartTime(''); setSubmitError(''); setAvailability(emptyAvailability);
  };
  useEffect(() => {
    if (!open || !durationValid) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability({ data: null, loading: true, error: '' });
      const query = new URLSearchParams({ client_package_id: String(packageId), duration_minutes: String(durationMinutes), start_date: cairoDateKey(), days: '21' });
      const { data, error } = await dataClient.request(`/client/booking-availability?${query}`, { method: 'GET', signal: controller.signal });
      if (controller.signal.aborted) return;
      setAvailability(error ? { data: null, loading: false, error: error.message || 'تعذر تحميل المواعيد المتاحة.' } : { data, loading: false, error: '' });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, packageId, durationMinutes, durationValid, availabilityRevision]);

  useEffect(() => {
    if (!open) return undefined;
    const overlay = dialogRef.current?.closest('.client-booking-concierge');
    const fallbackTrigger = triggerRef?.current;
    const trigger = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : fallbackTrigger;
    const parent = overlay?.parentElement;
    const background = parent ? [...parent.children].filter(node => node !== overlay) : [];
    const backgroundState = background.map(node => ({ node, inert: node.hasAttribute('inert'), ariaHidden: node.getAttribute('aria-hidden') }));
    background.forEach(node => { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); });
    const focusable = () => [...(dialogRef.current?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') || [])]
      .filter(node => node.getClientRects().length > 0);
    const focusFirst = () => focusable()[0]?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1]; const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) { event.preventDefault(); first.focus(); }
    };
    const onFocusIn = event => { if (!dialogRef.current?.contains(event.target)) focusFirst(); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(focusFirst);
    return () => {
      document.removeEventListener('keydown', onKeyDown); document.removeEventListener('focusin', onFocusIn); document.body.style.overflow = previous;
      backgroundState.forEach(({ node, inert, ariaHidden }) => { if (!inert) node.removeAttribute('inert'); if (ariaHidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', ariaHidden); });
      window.requestAnimationFrame(() => { const target = trigger?.isConnected ? trigger : fallbackTrigger; if (target?.isConnected) target.focus(); });
    };
  }, [open, onClose, triggerRef]);

  const reloadAvailability = () => { setSubmitError(''); setSelectedDate(''); setStartTime(''); setAvailability(emptyAvailability); setAvailabilityRevision(value => value + 1); };
  const submit = async event => {
    event.preventDefault(); if (!selectedPackage || !selectedSlot || !selectedDate) return;
    setBusy(true);
    const { error } = await dataClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({
      client_package_id: Number(selectedPackage.id), service_id: Number(selectedPackage.service_id), service: selectedPackage.name,
      resource_id: Number(selectedSlot.resource_id), date: selectedDate, start_time: selectedSlot.start_time, end_time: selectedSlot.end_time, duration_minutes: durationMinutes, notes,
      ...(selectedPackage.billing_unit === 'reel' ? { requested_reels: 1 } : {}),
    }) });
    setBusy(false);
    if (error) {
      const message = error.status === 409 || error.code === 'booking_conflict'
        ? 'هذا الموعد لم يعد متاحًا، اختر موعدًا آخر.'
        : error.message || 'تعذر إرسال طلب الحجز.';
      setSubmitError(message);
      if (error.status === 409 || error.code === 'booking_conflict') { setAvailability(emptyAvailability); setAvailabilityRevision(value => value + 1); }
      window.requestAnimationFrame(() => { submitErrorRef.current?.focus(); submitErrorRef.current?.scrollIntoView({ block: 'nearest' }); });
      return;
    }
    onSuccess(); onClose();
    showNotice('success', 'تم إرسال طلب الحجز للإدارة، وسيصلك إشعار بعد المراجعة.');
  };

  if (!open) return null;
  return <div className="client-modal client-booking-concierge" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section ref={dialogRef} className="client-modal-card client-booking-request-dialog" role="dialog" aria-modal="true" aria-labelledby="client-booking-request-title">
      <button className="client-modal-close" type="button" onClick={onClose} disabled={busy} aria-label="إغلاق نافذة الحجز"><X/></button>
      <header className="client-booking-dialog-head"><span className="client-eyebrow"><CalendarDays/> حجز جديد</span><h2 id="client-booking-request-title">احجز موعد تصوير</h2><p>اختر الباقة، حدّد المدة، ثم اختر الموعد المناسب لك.</p><span className="client-approval-badge"><ShieldCheck/> الطلب يحتاج موافقة الإدارة</span></header>
      {submitError && <div ref={submitErrorRef} className="client-booking-submit-error" role="alert" aria-live="assertive" tabIndex="-1"><AlertTriangle/><span>{submitError}</span></div>}
      {!eligiblePackages.length ? <div className="client-booking-state" role="status"><PackageCheck/><h3>لا توجد باقة متاحة للحجز</h3><p>تحتاج إلى باقة تصوير فعالة وبها رصيد متاح.</p></div> : <form onSubmit={submit} className="client-booking-guided-form">
        <div className="client-booking-steps">
          <fieldset className="client-booking-step"><legend><b>1</b> اختر الباقة</legend><div className="client-booking-package-list">{eligiblePackages.map(pkg => <label key={pkg.id} className={String(pkg.id) === String(packageId) ? 'selected' : ''}><input type="radio" name="booking-package" value={pkg.id} checked={String(pkg.id) === String(packageId)} onChange={() => { setPackageId(String(pkg.id)); setSelectedDate(''); setStartTime(''); setSubmitError(''); setAvailability(emptyAvailability); }}/><span><strong>{pkg.name}</strong><small>المتاح: {formatPackageQuantity(availableQuantity(pkg), pkg.billing_unit)}{pkg.expires_at ? ` · حتى ${formatBookingDate(pkg.expires_at)}` : ' · تبدأ مع أول حجز'}</small></span><CheckCircle2/></label>)}</div></fieldset>
          <fieldset className="client-booking-step" disabled={!selectedPackage}><legend><b>2</b> حدّد مدة الجلسة</legend><div className="client-duration-inputs"><label>الساعات<input type="number" min="0" max="12" step="1" inputMode="numeric" value={hours} onChange={event => updateDurationDraft(event.target.value, minutes)} onBlur={() => setHours(String(Math.min(12, Math.floor(Math.max(0, Number(hours || 0))))))}/></label><label>الدقائق<input type="number" min="0" max="30" step="30" inputMode="numeric" value={minutes} onChange={event => updateDurationDraft(hours, event.target.value)} onBlur={() => setMinutes(normalizeClientMinuteDraft(minutes))}/></label></div><p className={durationValid ? 'client-duration-total valid' : 'client-duration-total'}><Clock3/> المدة المطلوبة: <strong>{formatDurationMinutes(durationMinutes)}</strong></p><small>الحد الأدنى 30 دقيقة، والزيادة كل 30 دقيقة.</small>{durationRuleError && <em>اختر مدة من 30 دقيقة إلى 12 ساعة بزيادات 30 دقيقة.</em>}{selectedPackage?.billing_unit === 'hour' && availableQuantity(selectedPackage) * 60 + .001 < durationMinutes && <em>رصيد الباقة لا يكفي لهذه المدة.</em>}</fieldset>
        </div>
        <fieldset className="client-booking-step client-availability-step" disabled={!durationValid}><legend><b>3</b> اختر اليوم والموعد</legend>
          <p className="client-booking-continuous-note"><Clock3/> تظهر المواعيد التي تتسع لمدة الجلسة كاملة ومتّصلة في اليوم نفسه، ولا يتم تقسيم الساعات.</p>
          <div aria-live="polite">{availability.loading && <div className="client-booking-state compact"><RefreshCw className="client-spin"/><p>نبحث عن المواعيد التي تناسب مدتك...</p></div>}{availability.error && <div className="client-booking-state compact error"><p>{availability.error}</p><button type="button" onClick={reloadAvailability}><RefreshCw/> إعادة المحاولة</button></div>}</div>
          {availability.data && <><div className="client-available-days" aria-label="الأيام المتاحة">{availability.data.days.map(day => <button type="button" key={day.date} disabled={!day.available} className={selectedDate === day.date ? 'selected' : ''} onClick={() => { setSelectedDate(day.date); setStartTime(''); setSubmitError(''); }}><span>{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(new Date(`${day.date}T12:00:00`))}</span><strong>{new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(new Date(`${day.date}T12:00:00`))}</strong><small>{day.available ? 'متاح' : 'غير متاح'}</small></button>)}</div>{!availability.data.days.some(day => day.available) && <div className="client-booking-state compact"><CalendarDays/><p>لا توجد مواعيد تناسب هذه المدة خلال الفترة الحالية. جرّب مدة أقصر.</p></div>}</>}
          {selectedDay?.available && <div className="client-booking-manual-time"><div className="client-booking-time-heading"><div><h3>وقت البداية يوم {formatBookingDate(selectedDate)}</h3><p>اكتب الساعة بنظام 12 ساعة، واختر صباحًا أو مساءً.</p></div><span aria-label="دقائق البداية ثابتة صفر">الدقائق ثابتة <b>:00</b></span></div><label htmlFor="client-booking-start-time">بداية الموعد</label><BusinessTimeSelect id="client-booking-start-time" min="12:00" max="23:00" step={60} value={startTime} defaultPeriod="pm" example="2:00" onChange={event => { setStartTime(event.target.value); setSubmitError(''); }} aria-describedby="client-booking-time-guidance client-booking-time-state" aria-invalid={Boolean(startTime && ['start_invalid', 'start_before_open', 'start_grid_invalid', 'after_midnight', 'unavailable'].includes(bookingTime.errorCode))}/><small id="client-booking-time-guidance">مثال صحيح: 1:00 م. البداية من 12:00 م إلى 11:00 م، والدقائق دائمًا :00.</small>{startTime && bookingTime.endTime && <section className="client-booking-timeline" aria-label="خط زمني للموعد"><div><span>البداية</span><strong>{formatTime12(startTime)}</strong></div><ArrowLeft aria-hidden="true"/><div><span>المدة</span><strong>{formatDurationMinutes(durationMinutes)}</strong></div><ArrowLeft aria-hidden="true"/><div><span>النهاية</span><strong>{formatTime12(bookingTime.endTime)}</strong></div></section>}<div id="client-booking-time-state" className={`client-booking-time-state ${selectedSlot ? 'available' : bookingTime.errorCode === 'start_required' ? 'incomplete' : 'error'}`} role={selectedSlot ? 'status' : 'alert'} aria-live="polite">{selectedSlot ? <><CheckCircle2/> الموعد متاح كاملًا ومتصلًا.</> : bookingTime.errorCode === 'start_required' ? <><Clock3/> أدخل وقت بداية صحيحًا لإكمال الحجز.</> : bookingTime.errorCode === 'start_before_open' ? <><AlertTriangle/> وقت البداية من 12:00 م إلى 11:00 م.</> : bookingTime.errorCode === 'start_invalid' ? <><AlertTriangle/> اكتب ساعة صحيحة بنظام 12 ساعة.</> : bookingTime.errorCode === 'start_grid_invalid' ? <><AlertTriangle/> يجب أن يبدأ الموعد عند ساعة كاملة ودقائق :00.</> : bookingTime.errorCode === 'after_midnight' ? <><AlertTriangle/> هذه المدة تنتهي بعد منتصف الليل. اختر وقتًا أبكر.</> : <><AlertTriangle/> الفترة المحسوبة غير متاحة كاملة. جرّب ساعة بداية أخرى.</>}</div></div>}
        </fieldset>
        {selectedSlot && <section className="client-booking-summary" aria-live="polite"><CheckCircle2/><div><span>ملخص طلبك</span><strong>{selectedPackage.name}</strong><p>{formatBookingDate(selectedDate)} · من {formatTime12(selectedSlot.start_time)} إلى {formatTime12(selectedSlot.end_time)} · {formatDurationMinutes(durationMinutes)}</p></div></section>}
        <label className="client-booking-notes">ملاحظات اختيارية<textarea rows="3" maxLength="1000" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تجهيزات أو تفاصيل تساعد فريق التصوير"/></label>
        <button className="client-primary client-booking-submit" disabled={busy || !selectedSlot}>{busy ? <RefreshCw className="client-spin"/> : <Send/>}{busy ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الحجز'}</button>
      </form>}
    </section>
  </div>;
}
