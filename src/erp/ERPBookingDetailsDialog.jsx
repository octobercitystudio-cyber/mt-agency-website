import { CalendarClock, PlayCircle, Trash2, X } from 'lucide-react';
import { formatBookingDate, formatDurationMinutes, formatTime12 } from '../lib/businessFormat';
import useModalDialog from '../hooks/useModalDialog';
import './ERPBookingDetailsDialog.css';

export default function ERPBookingDetailsDialog({ booking, isAdmin, busy, error, status, returnFocusRef, onClose, onStart, onCancel, onReschedule, ownerActions }) {
  const dialogRef = useModalDialog(Boolean(booking), onClose, { returnFocusRef });
  if (!booking) return null;
  const isConfirmed = booking.status === 'confirmed';

  return <div className="booking-details-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="booking-details-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-details-title">
      <header><div><span>تفاصيل الحجز</span><h2 id="booking-details-title">{booking.client_name}</h2><p>{booking.service}</p></div><button type="button" onClick={onClose} aria-label="إغلاق تفاصيل الحجز"><X /></button></header>
      <div className="booking-details-body">
        <span className="booking-details-status" style={{ background: status.color }}>{status.label}</span>
        <dl className="booking-details-schedule"><div><dt>التاريخ</dt><dd>{formatBookingDate(booking.date)}</dd></div><div><dt>التوقيت</dt><dd>{formatTime12(booking.start_time)} — {formatTime12(booking.end_time)}</dd></div></dl>
        <dl className="booking-details-metrics"><div><dt>مدة التصوير</dt><dd>{formatDurationMinutes(Number(booking.actual_seconds || 0) > 0 ? Number(booking.actual_seconds) / 60 : Number(booking.actual_hours || 0) * 60)}</dd></div><div><dt>الريلز</dt><dd>{booking.actual_reels || 0}</dd></div><div><dt>الدفعة</dt><dd>{booking.payment || 0} ج.م</dd></div></dl>
        {booking.notes && <div className="booking-details-note"><small>ملاحظات</small><p>{booking.notes}</p></div>}
        <div className="booking-details-actions">
          {isConfirmed && <button type="button" className="start" disabled={busy === `start-${booking.id}`} onClick={onStart}><PlayCircle />{busy === `start-${booking.id}` ? 'جارٍ التشغيل…' : 'بدء جلسة التصوير'}</button>}
          {booking.status === 'in_progress' && <div className="booking-details-running">التايمر يعمل الآن — أنهِ الجلسة من شريط التايمر.</div>}
          {isAdmin && isConfirmed && <button type="button" className="reschedule" onClick={event => onReschedule(event.currentTarget)}><CalendarClock /> تغيير الموعد</button>}
          {isAdmin && !['in_progress', 'completed', 'cancelled', 'منتهي'].includes(booking.status) && <button type="button" className="cancel" disabled={busy === `cancel-${booking.id}`} onClick={onCancel}><Trash2 />{busy === `cancel-${booking.id}` ? 'جارٍ الحذف…' : 'حذف الموعد'}</button>}
          {ownerActions}
        </div>
        {error && <div className="booking-details-error" role="alert">{error}</div>}
      </div>
    </section>
  </div>;
}
