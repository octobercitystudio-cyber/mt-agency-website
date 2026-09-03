import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CalendarRange, Clock3, LockKeyhole, RefreshCw, Trash2, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import useModalDialog from '../hooks/useModalDialog';
import { calculateDurationMinutes, formatBookingDate, formatDurationMinutes, formatTime12 } from '../lib/businessFormat';
import { safeUiError } from '../lib/uiError';
import './ERPBookingBlockDialog.css';

const newKey = () => globalThis.crypto?.randomUUID?.() || `booking-block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const defaultDraft = date => ({ date, resource_id: '', start_time: '12:00', end_time: '13:00', note: '', repeat_daily: false, repeat_until: '' });

export function ERPBookingBlockDialog({ isOpen, date, resources = [], returnFocusRef, onClose, onSuccess }) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  const idempotencyKeyRef = useRef(newKey());
  const [draft, setDraft] = useState(defaultDraft(date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const duration = calculateDurationMinutes(draft.start_time, draft.end_time);
  const maxRepeatDate = useMemo(() => { const start = new Date(`${draft.date || date}T12:00:00`); if (Number.isNaN(start.getTime())) return ''; start.setDate(start.getDate() + 89); return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`; }, [date, draft.date]);

  useEffect(() => {
    if (!isOpen) return;
    const active = resources.filter(resource => Number(resource.is_active ?? 1) === 1 && !resource.archived_at);
    const timer = window.setTimeout(() => { idempotencyKeyRef.current = newKey(); setDraft({ ...defaultDraft(date), resource_id: String(active[0]?.id || '') }); setError(''); setBusy(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [date, isOpen, resources]);

  if (!isOpen) return null;
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const submit = async event => {
    event.preventDefault(); setError('');
    if (draft.repeat_daily && !draft.repeat_until) return setError('حدد تاريخ نهاية التكرار.');
    if (duration < 60 || duration % 15 !== 0) return setError('فترة الحظر يجب أن تكون ساعة على الأقل وبزيادات 15 دقيقة.');
    setBusy(true);
    const { data, error: requestError } = await dataClient.request('/booking-blocks', { method: 'POST', body: JSON.stringify({ ...draft, resource_id: Number(draft.resource_id), repeat_until: draft.repeat_daily ? draft.repeat_until : null, idempotency_key: idempotencyKeyRef.current }) });
    setBusy(false); if (requestError) return setError(safeUiError(requestError, 'تعذر حظر الموعد. راجع الفترة ثم حاول مرة أخرى.'));
    onSuccess?.(data);
  };

  return <div className="booking-block-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && close()}>
    <form ref={dialogRef} className="booking-block-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-block-title" aria-describedby="booking-block-description" onSubmit={submit}>
      <header><span className="booking-block-icon"><LockKeyhole/></span><div><small>إغلاق تشغيلي</small><h2 id="booking-block-title">حظر موعد</h2><p id="booking-block-description">أغلق الاستديو في فترة محددة دون ربطها بعميل أو باقة.</p></div><button type="button" className="booking-block-close" onClick={close} disabled={busy} aria-label="إغلاق"><X/></button></header>
      <div className="booking-block-fields">
        <label>التاريخ<input required type="date" lang="ar" dir="rtl" value={draft.date} onChange={event => update('date', event.target.value)}/>{draft.date && <small className="booking-block-local-date">التاريخ المختار: {formatBookingDate(draft.date)}</small>}</label>
        <label>الاستديو / المورد<select required value={draft.resource_id} onChange={event => update('resource_id', event.target.value)}><option value="" disabled>اختر المورد</option>{resources.filter(resource => Number(resource.is_active ?? 1) === 1 && !resource.archived_at).map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>
        <label>من الساعة<BusinessTimeSelect required min="12:00" max="23:00" step={15} defaultPeriod="pm" value={draft.start_time} onChange={event => update('start_time', event.target.value)}/></label>
        <label>إلى الساعة<BusinessTimeSelect required min="13:00" max="24:00" step={15} defaultPeriod="pm" value={draft.end_time} onChange={event => update('end_time', event.target.value)}/></label>
        <label className="booking-block-note">ملاحظة داخلية — اختياري<textarea rows="3" maxLength="1000" value={draft.note} onChange={event => update('note', event.target.value)} placeholder="مثال: صيانة الاستديو أو تصوير داخلي"/></label>
      </div>
      <section className="booking-block-repeat" aria-labelledby="booking-block-repeat-title"><div><CalendarRange/><span><strong id="booking-block-repeat-title">تكرار يومي</strong><small>يوم الجمعة يُتخطى تلقائيًا لأنه يوم غير متاح للحجز.</small></span><label className="booking-block-switch"><input type="checkbox" checked={draft.repeat_daily} onChange={event => update('repeat_daily', event.target.checked)}/><i aria-hidden="true"/><b>{draft.repeat_daily ? 'نعم' : 'لا'}</b></label></div>{draft.repeat_daily && <label className="booking-block-repeat-until">حتى تاريخ<input required type="date" lang="ar" dir="rtl" min={draft.date} max={maxRepeatDate} value={draft.repeat_until} onChange={event => update('repeat_until', event.target.value)}/>{draft.repeat_until && <small className="booking-block-local-date">نهاية التكرار: {formatBookingDate(draft.repeat_until)}</small>}<small>حد أقصى 90 يومًا شاملة يوم البداية.</small></label>}</section>
      <div className="booking-block-summary"><Clock3/><span>الفترة</span><strong>{duration > 0 ? formatDurationMinutes(duration) : 'راجع الوقت'}</strong></div>
      {error && <div className="booking-block-error" role="alert"><Ban/><span>{error}</span></div>}
      <footer><button type="button" onClick={close} disabled={busy}>تراجع</button><button type="submit" className="primary" disabled={busy || !resources.length}>{busy ? <RefreshCw className="is-spinning"/> : <LockKeyhole/>}{busy ? 'جارٍ إغلاق الفترة…' : 'تأكيد حظر الموعد'}</button></footer>
    </form>
  </div>;
}

export function ERPBookingBlockDetailsDialog({ block, busy, error, returnFocusRef, onClose, onCancel }) {
  const close = useCallback(() => onClose(), [onClose]); const dialogRef = useModalDialog(Boolean(block), close, { returnFocusRef }); if (!block) return null;
  return <div className="booking-block-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && close()}><section ref={dialogRef} className="booking-block-dialog booking-block-details" role="dialog" aria-modal="true" aria-labelledby="booking-block-details-title"><header><span className="booking-block-icon"><LockKeyhole/></span><div><small>فترة إدارية</small><h2 id="booking-block-details-title">الحجز مغلق</h2><p>{block.resource_name || 'مورد الحجز'}</p></div><button type="button" className="booking-block-close" onClick={close} disabled={busy} aria-label="إغلاق"><X/></button></header><dl><div><dt>اليوم</dt><dd>{formatBookingDate(block.block_date)}</dd></div><div><dt>الوقت</dt><dd>{formatTime12(block.start_time)} — {formatTime12(block.end_time)}</dd></div><div><dt>المدة</dt><dd>{formatDurationMinutes(block.duration_minutes)}</dd></div>{block.note && <div className="wide"><dt>ملاحظة داخلية</dt><dd>{block.note}</dd></div>}</dl>{error && <div className="booking-block-error" role="alert"><Ban/><span>{error}</span></div>}<footer><button type="button" onClick={close} disabled={busy}>إغلاق</button><button type="button" className="danger" onClick={() => onCancel('single')} disabled={busy}><Trash2/>إلغاء هذا الحظر</button>{block.series_key && <button type="button" className="danger secondary" onClick={() => onCancel('series')} disabled={busy}><CalendarRange/>إلغاء هذا الحظر وما بعده</button>}</footer></section></div>;
}
