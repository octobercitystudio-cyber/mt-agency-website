import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, PackageCheck, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import ClientAvailabilityCalendar from '../components/ClientAvailabilityCalendar';
import { clientNoticeIsLate } from '../lib/clientBookingNotice';
import { dataClient } from '../dataClient';
import { calculateDurationMinutes, formatBookingDate, formatDurationMinutes, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';
import { clientDurationError, clientDurationMinutesFromDraft, normalizeClientMinuteDraft, resolveClientBookingTime } from './clientBookingTime';
import { earliestClientBookingDate, clientBookingDateError } from '../lib/clientBookingDate';
import { packageBookingMonthWindow, shiftBookingMonth } from '../lib/packageBookingCalendar';

const emptyAvailability = { data: null, loading: false, error: '' };
const packageMinutes = (pkg, name) => Number.isSafeInteger(Number(pkg?.[`${name}_minutes`]))
  ? Number(pkg[`${name}_minutes`])
  : Math.round(Number(pkg?.[`${name}_quantity`] || 0) * 60);
const availableQuantity = pkg => pkg?.billing_unit === 'hour'
  ? Math.max(0, packageMinutes(pkg, 'purchased') - packageMinutes(pkg, 'held') - packageMinutes(pkg, 'consumed')) / 60
  : Math.max(0, Number(pkg?.purchased_quantity || 0) - Number(pkg?.held_quantity || 0) - Number(pkg?.consumed_quantity || 0));

export default function ClientBookingDialog({ open, packages = [], initialPackageId = '', booking = null, triggerRef, onClose, onSuccess, showNotice }) {
  const dialogRef = useRef(null);
  const submitErrorRef = useRef(null);
  const busyRef = useRef(false);
  const [packageId, setPackageId] = useState(String(booking?.client_package_id || initialPackageId || (booking ? '0' : '')));
  const initialDuration = booking ? Math.max(60, calculateDurationMinutes(booking.start_time, booking.end_time)) : 60;
  const [hours, setHours] = useState(String(Math.floor(initialDuration / 60)));
  const [minutes, setMinutes] = useState(String(initialDuration % 60));
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [availabilityMonth, setAvailabilityMonth] = useState('');
  const [availability, setAvailability] = useState(emptyAvailability);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const eligiblePackages = useMemo(() => booking ? [packages.find(pkg => Number(pkg.id) === Number(booking.client_package_id)) || { id: 0, name: booking.service || 'موعد تصوير', billing_unit: 'hour', purchased_quantity: 10 }] : packages.filter(pkg => ['hour', 'reel'].includes(pkg.billing_unit) && availableQuantity(pkg) > 0), [packages, booking]);
  const selectedPackage = eligiblePackages.find(pkg => String(pkg.id) === String(packageId));
  const estimatedAvailableMinutes = (availableQuantity(selectedPackage) * 60) + (booking ? initialDuration : 0);
  const serverPackage = availability.data?.package;
  const serverAvailableQuantity = serverPackage && String(serverPackage.id) === String(packageId) && Number.isFinite(Number(serverPackage.available_quantity)) ? Math.max(0, Number(serverPackage.available_quantity)) : null;
  const availableMinutes = serverAvailableQuantity === null ? estimatedAvailableMinutes : serverAvailableQuantity * 60;
  const displayedQuantity = pkg => String(pkg.id) === String(packageId) && serverAvailableQuantity !== null ? serverAvailableQuantity : availableQuantity(pkg);
  const noticeLate = Boolean(booking && clientNoticeIsLate(booking));
  const [todayKey, setEarliestDate] = useState(earliestClientBookingDate);
  useEffect(() => { const refresh = () => setEarliestDate(earliestClientBookingDate()); const timer = window.setInterval(refresh, 30000); window.addEventListener('focus', refresh); return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); }; }, []);
  const monthWindow = useMemo(
    () => packageBookingMonthWindow(selectedPackage, availabilityMonth, todayKey),
    [availabilityMonth, selectedPackage, todayKey],
  );
  const durationDraftMinutes = clientDurationMinutesFromDraft(hours, minutes);
  const durationMinutes = Number.isFinite(durationDraftMinutes) ? Math.max(0, durationDraftMinutes) : 0;
  const durationRuleError = clientDurationError(durationMinutes);
  const durationValid = Boolean(selectedPackage) && !durationRuleError && !noticeLate && (selectedPackage.billing_unit !== 'hour' || estimatedAvailableMinutes + .001 >= durationMinutes);
  const selectedDay = availability.data?.days?.find(day => day.date === selectedDate);
  const bookingTime = useMemo(() => resolveClientBookingTime({ startTime, durationMinutes, slots: selectedDay?.slots || [] }), [durationMinutes, selectedDay?.slots, startTime]);
  const selectedSlot = bookingTime.slot;

  const updateDurationDraft = (nextHours, nextMinutes) => {
    setHours(nextHours); setMinutes(nextMinutes); setSelectedDate(''); setStartTime(''); setSubmitError(''); setAvailability(emptyAvailability);
  };
  useEffect(() => {
    if (!open || !durationValid || monthWindow.days < 1) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability({ data: null, loading: true, error: '' });
      const query = new URLSearchParams({ ...(booking ? { booking_id: String(booking.id) } : {}), client_package_id: String(packageId), duration_minutes: String(durationMinutes), start_date: monthWindow.startDate, days: String(monthWindow.days) });
      const { data, error } = await dataClient.request(`/client/booking-availability?${query}`, { method: 'GET', signal: controller.signal });
      if (controller.signal.aborted) return;
      setAvailability(error ? { data: null, loading: false, error: error.message || 'تعذر تحميل المواعيد المتاحة.' } : { data, loading: false, error: '' });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, booking, packageId, durationMinutes, durationValid, availabilityRevision, monthWindow.days, monthWindow.startDate]);

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
  const moveAvailabilityMonth = amount => {
    const next = shiftBookingMonth(monthWindow.month, amount);
    if (!next || amount < 0 && !monthWindow.canPrevious || amount > 0 && !monthWindow.canNext) return;
    setAvailabilityMonth(next); setSelectedDate(''); setStartTime(''); setSubmitError(''); setAvailability(emptyAvailability);
  };
  const submit = async event => {
    event.preventDefault(); if (busyRef.current || !selectedPackage || !selectedSlot || !selectedDate || availability.loading || noticeLate) return;
    const dateError = clientBookingDateError(selectedDate); if (dateError) { reloadAvailability(); setSubmitError(dateError); return; }
    busyRef.current = true;
    setBusy(true);
    const { error } = await dataClient.request(booking ? '/reschedule-requests' : '/bookings/request', { method: 'POST', body: JSON.stringify({
      ...(booking ? { booking_id: Number(booking.id), reason: notes } : {}), client_package_id: Number(selectedPackage.id), service_id: Number(selectedPackage.service_id), service: selectedPackage.name,
      resource_id: Number(selectedSlot.resource_id), date: selectedDate, start_time: selectedSlot.start_time, end_time: selectedSlot.end_time, duration_minutes: durationMinutes, notes,
      ...(selectedPackage.billing_unit === 'reel' ? { requested_reels: 1 } : {}),
    }) });
    setBusy(false);
    if (error) {
      const message = error.status === 409 || error.code === 'booking_conflict'
        ? 'هذا الموعد لم يعد متاحًا، اختر موعدًا آخر.'
        : error.message || 'تعذر إرسال طلب الحجز.';
      setSubmitError(message);
      if (error.status === 409 || ['booking_conflict', 'client_day_already_booked'].includes(error.code)) { setSelectedDate(''); setStartTime(''); setAvailability(emptyAvailability); setAvailabilityRevision(value => value + 1); }
      window.requestAnimationFrame(() => { submitErrorRef.current?.focus(); submitErrorRef.current?.scrollIntoView({ block: 'nearest' }); });
      return;
    }
    onSuccess(); onClose();
    showNotice('success', booking ? 'تم إرسال طلب تغيير الموعد للإدارة. يبقى موعدك الحالي مؤكدًا حتى اعتماد البديل.' : 'تم إرسال طلب الحجز للإدارة، وسيصلك إشعار بعد المراجعة.');
  };

  if (!open) return null;
  return <div className="client-modal client-booking-concierge" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section ref={dialogRef} className="client-modal-card client-booking-request-dialog" role="dialog" aria-modal="true" aria-labelledby="client-booking-request-title">
      <button className="client-modal-close" type="button" onClick={onClose} disabled={busy} aria-label="إغلاق نافذة الحجز"><X/></button>
      <header className="client-booking-dialog-head"><span className="client-eyebrow"><CalendarDays/> {booking ? 'تغيير الموعد' : 'حجز جديد'}</span><h2 id="client-booking-request-title">{booking ? 'اختر الموعد البديل' : 'احجز موعد تصوير'}</h2><p>{booking ? `موعدك الحالي: ${formatBookingDate(booking.date)}، ${formatTime12(booking.start_time)}. يبقى مؤكدًا حتى اعتماد التغيير.` : 'اختر الباقة، حدّد المدة، ثم اختر موعدًا متاحًا من التقويم.'}</p><span className="client-approval-badge"><ShieldCheck/> الطلب يحتاج موافقة الإدارة</span></header>
      {noticeLate && <p className="client-booking-submit-error" role="alert">لا يمكن تعديل الموعد قبل أقل من 48 ساعة فعلية، دون احتساب يوم الجمعة.</p>}
      {submitError && <div ref={submitErrorRef} className="client-booking-submit-error" role="alert" aria-live="assertive" tabIndex="-1"><AlertTriangle/><span>{submitError}</span></div>}
      {!eligiblePackages.length ? <div className="client-booking-state" role="status"><PackageCheck/><h3>لا توجد باقة متاحة للحجز</h3><p>تحتاج إلى باقة تصوير فعالة وبها رصيد متاح.</p></div> : <form onSubmit={submit} className="client-booking-guided-form">
        <div className="client-booking-steps">
          <fieldset className="client-booking-step" disabled={Boolean(booking)}><legend><b>1</b> اختر الباقة</legend><div className="client-booking-package-list">{eligiblePackages.map(pkg => <label key={pkg.id} className={String(pkg.id) === String(packageId) ? 'selected' : ''}><input type="radio" name="booking-package" value={pkg.id} checked={String(pkg.id) === String(packageId)} onChange={() => { setPackageId(String(pkg.id)); setAvailabilityMonth(''); setSelectedDate(''); setStartTime(''); setSubmitError(''); setAvailability(emptyAvailability); }}/><span><strong>{pkg.name}</strong><small>المتاح: {formatPackageQuantity(displayedQuantity(pkg), pkg.billing_unit)}{pkg.expires_at ? ` · حتى ${formatBookingDate(pkg.expires_at)}` : ' · تبدأ مع أول حجز'}</small></span><CheckCircle2/></label>)}</div></fieldset>
          <fieldset className="client-booking-step" disabled={!selectedPackage}><legend><b>2</b> حدّد مدة الجلسة</legend><div className="client-duration-inputs"><label>الساعات<input type="number" min="0" max="10" step="1" inputMode="numeric" value={hours} onChange={event => updateDurationDraft(event.target.value, minutes)} onBlur={() => setHours(String(Math.min(10, Math.floor(Math.max(0, Number(hours || 0))))))}/></label><label>الدقائق<input type="number" min="0" max="30" step="30" inputMode="numeric" value={minutes} onChange={event => updateDurationDraft(hours, event.target.value)} onBlur={() => setMinutes(normalizeClientMinuteDraft(minutes))}/></label></div><p className={durationValid ? 'client-duration-total valid' : 'client-duration-total'}><Clock3/> المدة المطلوبة: <strong>{formatDurationMinutes(durationMinutes)}</strong></p><small>الحد الأدنى ساعة واحدة، والزيادة كل 30 دقيقة.</small>{durationRuleError && <em>اختر مدة من ساعة إلى 10 ساعات بزيادات 30 دقيقة.</em>}{selectedPackage?.billing_unit === 'hour' && availableMinutes + .001 < durationMinutes && <em>رصيد الباقة لا يكفي لهذه المدة.</em>}</fieldset>
        </div>
        <fieldset className="client-booking-step client-availability-step" disabled={!durationValid}><legend><b>3</b> اختر اليوم والموعد</legend>
          <p className="client-booking-continuous-note"><Clock3/> تظهر المواعيد التي تتسع لمدة الجلسة كاملة ومتّصلة في اليوم نفسه، ولا يتم تقسيم الساعات.</p>
          <ClientAvailabilityCalendar monthWindow={monthWindow} data={availability.data} loading={availability.loading} error={availability.error} onRetry={reloadAvailability} onMonthChange={moveAvailabilityMonth} selectedDate={selectedDate} onDateChange={date => { setSelectedDate(date); setStartTime(''); setSubmitError(''); }} selectedSlot={selectedSlot} onSlotChange={slot => { setStartTime(slot.start_time); setSubmitError(''); }} durationMinutes={durationMinutes} disabled={!durationValid || busy} validityLabel={selectedPackage?.expires_at ? `الحجز حتى ${formatBookingDate(selectedPackage.expires_at)}، بما يشمل الشهور القادمة` : 'تبدأ صلاحية الباقة مع أول حجز مؤكد'}/>
        </fieldset>
        {selectedSlot && <section className="client-booking-summary" aria-live="polite"><CheckCircle2/><div><span>ملخص طلبك</span><strong>{selectedPackage.name}</strong><p>{formatBookingDate(selectedDate)} · من {formatTime12(selectedSlot.start_time)} إلى {formatTime12(selectedSlot.end_time)} · {formatDurationMinutes(durationMinutes)}</p></div></section>}
        <label className="client-booking-notes">ملاحظات اختيارية<textarea rows="3" maxLength="1000" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تجهيزات أو تفاصيل تساعد فريق التصوير"/></label>
        <p className="client-policy"><Clock3/> التعديل أو الإلغاء قبل الموعد بـ 48 ساعة فعلية على الأقل، دون احتساب يوم الجمعة.</p>
        <button className="client-primary client-booking-submit" disabled={busy || !selectedSlot || availability.loading || noticeLate}>{busy ? <RefreshCw className="client-spin"/> : <Send/>}{busy ? 'جارٍ إرسال الطلب...' : booking ? 'إرسال طلب تغيير الموعد' : 'إرسال طلب الحجز'}</button>
      </form>}
    </section>
  </div>;
}
