import { useMemo, useState } from 'react';
import { CalendarClock, Check, Clock3, PlayCircle, ShieldAlert, Video, X } from 'lucide-react';
import { formatBookingDate, formatTime12 } from '../lib/businessFormat';
import useModalDialog from '../hooks/useModalDialog';
import { startStudioSession } from './studioSessionStart';
import './ERPStartSessionDialog.css';

export default function ERPStartSessionDialog({ open, bookings = [], clientName = '', contextName = '', returnFocusRef, onClose, onStarted, onCreateBooking }) {
  const confirmed = useMemo(() => bookings.filter(item => item.status === 'confirmed'), [bookings]);
  const running = useMemo(() => bookings.find(item => item.status === 'in_progress'), [bookings]);
  const [selectedOverride, setSelectedOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { setSelectedOverride(''); setError(''); onClose(); };
  const dialogRef = useModalDialog(open, () => !busy && close(), { returnFocusRef });

  if (!open) return null;
  const selectedId = selectedOverride || (confirmed.length === 1 ? String(confirmed[0].id) : '');
  const selected = confirmed.find(item => String(item.id) === String(selectedId)) || null;

  const handleStart = async () => {
    if (!selected) return setError('اختر موعد التصوير الذي تريد تشغيله.');
    setBusy(true); setError('');
    try {
      const session = await startStudioSession(selected);
      await onStarted?.(selected, session);
      close();
    } catch (requestError) {
      setError(requestError?.message || 'تعذر بدء جلسة التصوير الآن.');
    } finally { setBusy(false); }
  };

  return <div className="session-start-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && close()}>
    <section ref={dialogRef} className="session-start-dialog" role="dialog" aria-modal="true" aria-labelledby="session-start-title" aria-describedby="session-start-description">
      <header><div><span><Video /> غرفة تشغيل الاستديو</span><h2 id="session-start-title">{running ? 'التصوير جارٍ بالفعل' : confirmed.length > 1 ? 'اختر موعد التصوير' : confirmed.length === 1 ? 'تأكيد بدء التصوير' : 'لا يوجد موعد جاهز للبدء'}</h2><p id="session-start-description">{clientName || confirmed[0]?.client_name || running?.client_name || 'عميل الاستديو'} · {contextName || confirmed[0]?.service || running?.service || 'جلسة تصوير'}</p></div><button type="button" onClick={close} disabled={busy} aria-label="إغلاق نافذة بدء التصوير"><X /></button></header>

      <div className="session-start-body">
        {running ? <div className="session-start-running" role="status"><span className="session-live-dot" /><div><strong>التصوير جارٍ</strong><p>{formatBookingDate(running.date)} · {formatTime12(running.start_time)} – {formatTime12(running.end_time)}</p></div></div> : confirmed.length ? <>
          {confirmed.length > 1 && <div className="session-start-choice" role="radiogroup" aria-label="مواعيد التصوير المؤكدة اليوم">{confirmed.map(item => <button type="button" role="radio" aria-checked={String(item.id) === selectedId} className={String(item.id) === selectedId ? 'selected' : ''} key={item.id} onClick={() => { setSelectedOverride(String(item.id)); setError(''); }}><span><Clock3 /></span><div><strong>{formatTime12(item.start_time)} – {formatTime12(item.end_time)}</strong><small>{item.service || contextName || 'جلسة تصوير'} · {item.resource_name || 'الاستديو'}</small></div>{String(item.id) === selectedId && <Check />}</button>)}</div>}
          {selected && <dl className="session-start-summary"><div><dt>العميل</dt><dd>{selected.client_name || clientName}</dd></div><div><dt>الباقة / الخدمة</dt><dd>{contextName || selected.package_name || selected.service}</dd></div><div><dt>اليوم والتاريخ</dt><dd>{formatBookingDate(selected.date)}</dd></div><div><dt>موعد التصوير</dt><dd>{formatTime12(selected.start_time)} – {formatTime12(selected.end_time)}</dd></div></dl>}
          <div className="session-start-note"><ShieldAlert /><p>سيبدأ التايمر الآن على هذا الحجز. عند الإنهاء ستحدد الساعات والدقائق الفعلية التي تُخصم من الباقة.</p></div>
        </> : <div className="session-start-empty"><CalendarClock /><strong>لا يوجد موعد مؤكد اليوم لهذه الباقة</strong><p>يجب تأكيد حجز مرتبط بالباقة قبل تشغيل تايمر التصوير حتى يُحتسب الرصيد بدقة.</p></div>}
        {error && <div className="session-start-error" role="alert"><ShieldAlert />{error}</div>}
      </div>

      <footer>{!running && !confirmed.length ? <><button type="button" className="session-start-secondary" onClick={close}>إغلاق</button><button type="button" className="session-start-primary" onClick={onCreateBooking}><CalendarClock /> فتح جدول الحجوزات</button></> : running ? <button type="button" className="session-start-primary" onClick={close}>حسنًا</button> : <><button type="button" className="session-start-secondary" onClick={close} disabled={busy}>إلغاء</button><button type="button" className="session-start-primary" onClick={handleStart} disabled={busy || !selected}><PlayCircle /> {busy ? 'جارٍ البدء...' : 'بدء التايمر الآن'}</button></>}</footer>
    </section>
  </div>;
}
