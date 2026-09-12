import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Camera, Clock3, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import useModalDialog from '../hooks/useModalDialog';
import { formatBookingDate, formatTime12 } from '../lib/businessFormat';
import { safeUiError } from '../lib/uiError';
import {
  defaultDirectSessionEndTime,
  directSessionClock,
  validateDirectSessionEndTime,
} from './directSessionTime';
import './ERPBookingBlockDialog.css';

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `direct-session-${Date.now()}`;
const directSessionDraft = resources => ({
  client_id: '',
  resource_id: String(resources[0]?.id || ''),
  end_time: defaultDirectSessionEndTime(),
  title: '',
  note: '',
});

export function ERPBookingDayActionsDialog({
  date,
  isOpen,
  returnFocusRef,
  onClose,
  onTemporary,
  onDirect,
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  if (!isOpen) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const canStartDirect = date === today;

  return (
    <div
      className="booking-block-overlay"
      onMouseDown={event => event.target === event.currentTarget && close()}
    >
      <section
        ref={dialogRef}
        className="booking-block-dialog booking-day-actions"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-actions-title"
      >
        <header>
          <span className="booking-block-icon"><CalendarClock /></span>
          <div>
            <small>{formatBookingDate(date)}</small>
            <h2 id="day-actions-title">ماذا تريد أن تفعل؟</h2>
            <p>اختر مسارًا واحدًا لهذا اليوم.</p>
          </div>
          <button type="button" className="booking-block-close" onClick={close} aria-label="إغلاق">
            <X />
          </button>
        </header>
        <div className="booking-day-actions__grid">
          <button type="button" data-dialog-initial onClick={onTemporary}>
            <LockKeyhole />
            <span>
              <strong>حجز مؤقت</strong>
              <small>احفظ الفترة وأضف عنوانًا يظهر في التقويم.</small>
            </span>
          </button>
          <button type="button" onClick={onDirect} disabled={!canStartDirect}>
            <Camera />
            <span>
              <strong>بدء جلسة تصوير</strong>
              <small>
                {canStartDirect
                  ? 'اختر العميل والاستديو، وابدأ المؤقت الآن بدون باقة.'
                  : 'بدء الجلسة متاح ليوم العمل الحالي فقط.'}
              </small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function ERPDirectSessionDialog({
  isOpen,
  date,
  clients = [],
  resources = [],
  returnFocusRef,
  onClose,
  onSuccess,
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const [draft, setDraft] = useState(() => directSessionDraft(resources));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      idempotencyKeyRef.current = newIdempotencyKey();
      setDraft(directSessionDraft(resources));
      setBusy(false);
      setError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, resources]);

  if (!isOpen) return null;
  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const currentClock = directSessionClock();

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const timeError = validateDirectSessionEndTime(draft.end_time);
    if (timeError) {
      setError(timeError);
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: requestError } = await dataClient.request('/studio-sessions/start-direct', {
      method: 'POST',
      body: JSON.stringify({
        ...draft,
        date,
        client_id: Number(draft.client_id),
        resource_id: Number(draft.resource_id),
        idempotency_key: idempotencyKeyRef.current,
      }),
    });
    setBusy(false);
    if (requestError) {
      setError(safeUiError(requestError, 'تعذر بدء الجلسة.'));
      return;
    }
    onSuccess?.(data);
  };

  return (
    <div
      className="booking-block-overlay"
      onMouseDown={event => event.target === event.currentTarget && !busy && close()}
    >
      <form
        ref={dialogRef}
        className="booking-block-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-title"
        onSubmit={submit}
      >
        <header>
          <span className="booking-block-icon direct"><Camera /></span>
          <div>
            <small>جلسة بدون باقة</small>
            <h2 id="direct-title">بدء جلسة تصوير الآن</h2>
            <p>{formatBookingDate(date)} · تبدأ المدة من وقت الحفظ.</p>
          </div>
          <button
            type="button"
            className="booking-block-close"
            onClick={close}
            disabled={busy}
            aria-label="إغلاق"
          >
            <X />
          </button>
        </header>
        <div className="booking-block-fields">
          <label>
            العميل
            <select
              data-dialog-initial
              required
              value={draft.client_id}
              onChange={event => update('client_id', event.target.value)}
            >
              <option value="">اختر العميل</option>
              {clients.filter(client => client.status === 'active').map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label>
            الاستديو
            <select
              required
              value={draft.resource_id}
              onChange={event => update('resource_id', event.target.value)}
            >
              {resources.map(resource => (
                <option key={resource.id} value={resource.id}>{resource.name}</option>
              ))}
            </select>
          </label>
          <label>
            البداية
            <div className="direct-now"><Clock3 />الآن · {formatTime12(currentClock.startTime)}</div>
          </label>
          <label>
            النهاية المخططة
            <BusinessTimeSelect
              required
              min={currentClock.endTime}
              max="24:00"
              step={15}
              value={draft.end_time}
              onChange={event => {
                update('end_time', event.target.value);
                setError('');
              }}
            />
          </label>
          <label className="booking-block-note">
            عنوان الجلسة
            <input
              maxLength="120"
              value={draft.title}
              onChange={event => update('title', event.target.value)}
              placeholder="جلسة تصوير مباشرة"
            />
          </label>
          <label className="booking-block-note">
            ملاحظة
            <textarea
              rows="3"
              maxLength="1000"
              value={draft.note}
              onChange={event => update('note', event.target.value)}
            />
          </label>
        </div>
        <div className="direct-package-note">
          عند إنهاء الجلسة ستختار باقة ساعات للعميل لخصم المدة الفعلية.
        </div>
        {error && <div className="booking-block-error" role="alert"><span>{error}</span></div>}
        <footer>
          <button type="button" onClick={close} disabled={busy}>تراجع</button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? <RefreshCw className="is-spinning" /> : <Camera />}
            {busy ? 'جارٍ البدء…' : 'بدء الجلسة'}
          </button>
        </footer>
      </form>
    </div>
  );
}
