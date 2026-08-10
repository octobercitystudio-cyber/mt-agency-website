import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, X } from 'lucide-react';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { supabase } from '../supabaseClient';
import { calculateDurationMinutes, formatBookingDate, formatTime12, isValidBusinessBooking, normalizeTime } from '../lib/businessFormat';
import useModalDialog from '../hooks/useModalDialog';
import './ERPRescheduleBookingDialog.css';

const initialDraft = { date: '', start_time: '12:00', end_time: '13:00', notes: '' };

export default function ERPRescheduleBookingDialog({ isOpen, booking, proposal, service, returnFocusRef, onClose, onSuccess }) {
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  const minimumMinutes = Math.max(15, Number(service?.minimum_booking_minutes || 60));
  const incrementMinutes = Math.max(15, Number(service?.booking_increment_minutes || 15));

  useEffect(() => {
    if (!isOpen || !booking) return undefined;
    const timer = window.setTimeout(() => {
      setDraft({
        date: proposal?.date || booking.date,
        start_time: normalizeTime(proposal?.start_time || booking.start_time || '12:00'),
        end_time: normalizeTime(proposal?.end_time || booking.end_time || '13:00', { endOfDay: true }),
        notes: booking.notes || '',
      });
      setBusy(false);
      setError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [booking, isOpen, proposal]);

  const validation = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'اختر تاريخًا صحيحًا.';
    const date = new Date(`${draft.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) return 'اختر تاريخًا صحيحًا.';
    if (date.getDay() === 5) return 'يوم الجمعة إجازة رسمية للشركة. اختر يومًا آخر.';
    const duration = calculateDurationMinutes(draft.start_time, draft.end_time);
    if (!isValidBusinessBooking(draft.start_time, draft.end_time, minimumMinutes) || duration % incrementMinutes !== 0) {
      return `الموعد يجب أن يكون من 12:00 م إلى 12:00 ص، بحد أدنى ${minimumMinutes} دقيقة وبزيادات ${incrementMinutes} دقيقة.`;
    }
    return '';
  }, [draft, incrementMinutes, minimumMinutes]);

  const submit = async event => {
    event.preventDefault();
    if (validation) return setError(validation);
    setBusy(true); setError('');
    const { data, error: requestError } = await supabase.request(`/bookings/${booking.id}/admin-reschedule`, {
      method: 'POST',
      body: JSON.stringify({ date: draft.date, start_time: draft.start_time, end_time: draft.end_time, notes: draft.notes }),
    });
    if (requestError) {
      setBusy(false);
      setError(requestError.message || 'تعذر تغيير الموعد. راجع التوقيت وحاول مرة أخرى.');
      return;
    }
    await onSuccess?.(data || { id: booking.id, status: 'confirmed', ...draft });
    setBusy(false);
    onClose();
  };

  if (!isOpen || !booking) return null;
  return <div className="booking-reschedule-overlay" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} className="booking-reschedule-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-reschedule-title">
      <header><div><span>تعديل إداري للحجز</span><h2 id="booking-reschedule-title"><CalendarClock /> تغيير الموعد</h2><p>{booking.client_name} · {booking.service}</p></div><button type="button" onClick={close} aria-label="إغلاق تغيير الموعد"><X /></button></header>
      <form onSubmit={submit}>
        <div className="booking-reschedule-fields">
          <label>التاريخ الجديد<input type="date" required value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} /></label>
          <label>من الساعة<BusinessTimeSelect required min="12:00" max="23:00" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></label>
          <label>إلى الساعة<BusinessTimeSelect required min="13:00" max="24:00" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></label>
        </div>
        <div className="booking-reschedule-comparison" aria-label="مقارنة الموعد القديم والجديد">
          <div><small>الموعد الحالي</small><strong>{formatBookingDate(booking.date)}</strong><span>{formatTime12(booking.start_time)} — {formatTime12(booking.end_time)}</span></div>
          <ArrowLeft aria-hidden="true" />
          <div className="is-new"><small>الموعد الجديد</small><strong>{draft.date ? formatBookingDate(draft.date) : '—'}</strong><span>{formatTime12(draft.start_time)} — {formatTime12(draft.end_time)}</span></div>
        </div>
        <label className="booking-reschedule-note">ملاحظة داخلية للحجز <small>اختيارية</small><textarea rows="3" value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="سبب التغيير أو أي تعليمات للفريق" /></label>
        {(error || validation) && <div className="booking-reschedule-error" role="alert">{error || validation}</div>}
        <footer><button type="button" onClick={close} disabled={busy}>إلغاء</button><button className="primary" type="submit" disabled={busy || Boolean(validation)}><CheckCircle2 /> {busy ? 'جارٍ تثبيت الموعد…' : 'تأكيد تغيير الموعد'}</button></footer>
      </form>
    </section>
  </div>;
}
