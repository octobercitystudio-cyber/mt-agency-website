import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, PackageCheck, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { cairoDateKey, formatBookingDate, formatDurationMinutes, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';

const emptyAvailability = { data: null, loading: false, error: '' };
const packageMinutes = (pkg, name) => Number.isSafeInteger(Number(pkg?.[`${name}_minutes`]))
  ? Number(pkg[`${name}_minutes`])
  : Math.round(Number(pkg?.[`${name}_quantity`] || 0) * 60);
const availableQuantity = pkg => pkg?.billing_unit === 'hour'
  ? Math.max(0, packageMinutes(pkg, 'purchased') - packageMinutes(pkg, 'held') - packageMinutes(pkg, 'consumed')) / 60
  : Math.max(0, Number(pkg?.purchased_quantity || 0) - Number(pkg?.held_quantity || 0) - Number(pkg?.consumed_quantity || 0));

export default function ClientBookingDialog({ open, packages = [], services = [], initialPackageId = '', triggerRef, onClose, onSuccess, showNotice }) {
  const dialogRef = useRef(null);
  const submitErrorRef = useRef(null);
  const busyRef = useRef(false);
  const [packageId, setPackageId] = useState(String(initialPackageId || ''));
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState(emptyAvailability);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const eligiblePackages = useMemo(() => packages.filter(pkg => ['hour', 'reel'].includes(pkg.billing_unit) && availableQuantity(pkg) > 0), [packages]);
  const selectedPackage = eligiblePackages.find(pkg => String(pkg.id) === String(packageId));
  const service = services.find(item => Number(item.id) === Number(selectedPackage?.service_id));
  const minimum = Math.max(15, Number(service?.minimum_booking_minutes || 60));
  const increment = Math.max(15, Number(service?.booking_increment_minutes || 15));
  const durationMinutes = Math.max(0, Number(hours || 0) * 60 + Number(minutes || 0));
  const durationValid = Boolean(selectedPackage) && durationMinutes >= minimum && durationMinutes <= 720 && durationMinutes % increment === 0 && (selectedPackage.billing_unit !== 'hour' || availableQuantity(selectedPackage) * 60 + .001 >= durationMinutes);
  const selectedDay = availability.data?.days?.find(day => day.date === selectedDate);

  const normalizeDuration = (nextHours, nextMinutes) => {
    const total = Math.max(0, Math.min(720, Math.round(Number(nextHours || 0) * 60 + Number(nextMinutes || 0))));
    setHours(Math.floor(total / 60)); setMinutes(total % 60); setSelectedDate(''); setSelectedSlot(null); setSubmitError(''); setAvailability(emptyAvailability);
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

  const reloadAvailability = () => { setSubmitError(''); setSelectedDate(''); setSelectedSlot(null); setAvailability(emptyAvailability); setAvailabilityRevision(value => value + 1); };
  const submit = async event => {
    event.preventDefault(); if (!selectedPackage || !selectedSlot || !selectedDate) return;
    setBusy(true);
    const { error } = await dataClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({
      client_package_id: Number(selectedPackage.id), service_id: Number(selectedPackage.service_id), service: selectedPackage.name,
      resource_id: Number(selectedSlot.resource_id), date: selectedDate, start_time: selectedSlot.start_time, end_time: selectedSlot.end_time, notes,
      ...(selectedPackage.billing_unit === 'reel' ? { requested_reels: 1 } : {}),
    }) });
    setBusy(false);
    if (error) {
      const message = error.status === 409 || error.code === 'booking_conflict'
        ? 'هذا الموعد لم يعد متاحًا، اختر موعدًا آخر.'
        : error.message || 'تعذر إرسال طلب الحجز.';
      setSubmitError(message);
      if (error.status === 409 || error.code === 'booking_conflict') { setSelectedSlot(null); setAvailability(emptyAvailability); setAvailabilityRevision(value => value + 1); }
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
          <fieldset className="client-booking-step"><legend><b>1</b> اختر الباقة</legend><div className="client-booking-package-list">{eligiblePackages.map(pkg => <label key={pkg.id} className={String(pkg.id) === String(packageId) ? 'selected' : ''}><input type="radio" name="booking-package" value={pkg.id} checked={String(pkg.id) === String(packageId)} onChange={() => { setPackageId(String(pkg.id)); setSelectedDate(''); setSelectedSlot(null); setSubmitError(''); setAvailability(emptyAvailability); }}/><span><strong>{pkg.name}</strong><small>المتاح: {formatPackageQuantity(availableQuantity(pkg), pkg.billing_unit)}{pkg.expires_at ? ` · حتى ${formatBookingDate(pkg.expires_at)}` : ' · تبدأ مع أول حجز'}</small></span><CheckCircle2/></label>)}</div></fieldset>
          <fieldset className="client-booking-step" disabled={!selectedPackage}><legend><b>2</b> حدّد مدة الجلسة</legend><div className="client-duration-inputs"><label>الساعات<input type="number" min="0" max="12" inputMode="numeric" value={hours} onChange={event => normalizeDuration(event.target.value, minutes)}/></label><label>الدقائق<input type="number" min="0" max="59" step={increment} inputMode="numeric" value={minutes} onChange={event => normalizeDuration(hours, event.target.value)}/></label></div><p className={durationValid ? 'client-duration-total valid' : 'client-duration-total'}><Clock3/> المدة المطلوبة: <strong>{formatDurationMinutes(durationMinutes)}</strong></p><small>الحد الأدنى {formatDurationMinutes(minimum)}، والزيادة كل {formatDurationMinutes(increment)}.</small>{selectedPackage?.billing_unit === 'hour' && availableQuantity(selectedPackage) * 60 + .001 < durationMinutes && <em>رصيد الباقة لا يكفي لهذه المدة.</em>}</fieldset>
        </div>
        <fieldset className="client-booking-step client-availability-step" disabled={!durationValid}><legend><b>3</b> اختر اليوم والموعد</legend>
          <div aria-live="polite">{availability.loading && <div className="client-booking-state compact"><RefreshCw className="client-spin"/><p>نبحث عن المواعيد التي تناسب مدتك...</p></div>}{availability.error && <div className="client-booking-state compact error"><p>{availability.error}</p><button type="button" onClick={reloadAvailability}><RefreshCw/> إعادة المحاولة</button></div>}</div>
          {availability.data && <><div className="client-available-days" aria-label="الأيام المتاحة">{availability.data.days.map(day => <button type="button" key={day.date} disabled={!day.available} className={selectedDate === day.date ? 'selected' : ''} onClick={() => { setSelectedDate(day.date); setSelectedSlot(null); setSubmitError(''); }}><span>{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(new Date(`${day.date}T12:00:00`))}</span><strong>{new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(new Date(`${day.date}T12:00:00`))}</strong><small>{day.available ? 'متاح' : 'غير متاح'}</small></button>)}</div>{!availability.data.days.some(day => day.available) && <div className="client-booking-state compact"><CalendarDays/><p>لا توجد مواعيد تناسب هذه المدة خلال الفترة الحالية. جرّب مدة أقصر.</p></div>}</>}
          {selectedDay?.available && <div className="client-available-slots"><h3>المواعيد المتاحة يوم {formatBookingDate(selectedDate)}</h3><div>{selectedDay.slots.map(slot => <button type="button" key={`${slot.start_time}-${slot.end_time}-${slot.resource_id}`} className={selectedSlot === slot ? 'selected' : ''} onClick={() => { setSelectedSlot(slot); setSubmitError(''); }}><Clock3/><span>من {formatTime12(slot.start_time)} إلى {formatTime12(slot.end_time)}</span></button>)}</div></div>}
        </fieldset>
        {selectedSlot && <section className="client-booking-summary" aria-live="polite"><CheckCircle2/><div><span>ملخص طلبك</span><strong>{selectedPackage.name}</strong><p>{formatBookingDate(selectedDate)} · من {formatTime12(selectedSlot.start_time)} إلى {formatTime12(selectedSlot.end_time)} · {formatDurationMinutes(durationMinutes)}</p></div></section>}
        <label className="client-booking-notes">ملاحظات اختيارية<textarea rows="3" maxLength="1000" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تجهيزات أو تفاصيل تساعد فريق التصوير"/></label>
        <button className="client-primary client-booking-submit" disabled={busy || !selectedSlot}>{busy ? <RefreshCw className="client-spin"/> : <Send/>}{busy ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الحجز'}</button>
      </form>}
    </section>
  </div>;
}
