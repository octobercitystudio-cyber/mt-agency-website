import { useEffect, useMemo, useState } from 'react';
import { Clock3, HandHeart, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import DurationHoursMinutesInput from '../components/DurationHoursMinutesInput';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { safeUiError } from '../lib/uiError';
import { formatElapsedTime, grossSessionSeconds } from './studioSessionDuration';
import { validateSessionCompensation } from './sessionCompensationValidation';
import './ERPSessionCompensationDialog.css';

export default function ERPSessionCompensationDialog({ session, serverOffset = 0, returnFocusRef, onClose, onUpdated }) {
  const [minutes, setMinutes] = useState('0');
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!busy) onClose?.(); };
  const dialogRef = useModalDialog(Boolean(session), close, { returnFocusRef, isolateBackground: true });
  const sessionId = session?.id;

  useEffect(() => {
    if (busy) dialogRef.current?.focus({ preventScroll: true });
  }, [busy, dialogRef]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const reset = window.setTimeout(() => { setMinutes('0'); setReason(''); setError(''); setBusy(false); }, 0);
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(reset); window.clearInterval(ticker); };
  }, [sessionId]);

  const gross = useMemo(() => session ? grossSessionSeconds(session, now, serverOffset) : 0, [session, now, serverOffset]);
  const current = Math.max(0, Math.floor(Number(session?.complimentary_seconds) || 0));
  const additionalMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  const validation = validateSessionCompensation({ additionalMinutes, currentSeconds: current, grossSeconds: gross, reason });
  const requestedTotal = validation.requestedTotal;
  const net = Math.max(0, gross - requestedTotal);
  const maximumAddition = formatElapsedTime(validation.maximumAdditionalSeconds);
  const durationError = validation.durationErrorCode === 'duration_required'
    ? (validation.maximumAdditionalSeconds < 60
      ? 'لا يتوفر حتى الآن وقت كامل بالدقائق يمكن إضافته كتعويض.'
      : `أدخل دقيقة واحدة على الأقل. الحد الأقصى المتاح الآن ${maximumAddition}.`)
    : validation.durationErrorCode === 'seven_day_limit'
      ? `إجمالي الوقت التعويضي لا يمكن أن يتجاوز 7 أيام. الحد الأقصى المتاح الآن ${maximumAddition}.`
      : validation.durationErrorCode === 'gross_elapsed_limit'
        ? `الوقت المطلوب يتجاوز الوقت المنقضي فعليًا. الحد الأقصى الذي يمكنك إضافته الآن ${maximumAddition}.`
        : '';
  const reasonError = validation.reasonErrorCode
    ? `السبب مطلوب بحد أدنى 5 أحرف؛ متبقٍ ${validation.remainingReasonCharacters}.`
    : '';
  const valid = validation.valid;

  if (!session) return null;

  const submit = async event => {
    event.preventDefault(); setError('');
    if (durationError || reasonError) return setError(durationError || reasonError);
    setBusy(true);
    const { error: requestError } = await dataClient.request(`/studio-sessions/${session.id}/compensation`, {
      method: 'POST',
      body: JSON.stringify({
        complimentary_seconds: requestedTotal,
        expected_session_version: Number(session.settlement_version || 1),
        reason: validation.normalizedReason,
      }),
    });
    if (requestError) {
      setBusy(false);
      setError(requestError.code === 'stale_session_version'
        ? 'تم تحديث الجلسة من شاشة أخرى. تم تحميل الوقت الحالي؛ راجعه ثم أعد المحاولة.'
        : safeUiError(requestError, 'تعذر إضافة الوقت التعويضي الآن.'));
      if (requestError.code === 'stale_session_version') await onUpdated?.();
      return;
    }
    await onUpdated?.();
    setBusy(false);
    onClose?.();
  };

  return <div className="session-compensation-overlay" onMouseDown={event => event.target === event.currentTarget && close()}>
    <form ref={dialogRef} className="session-compensation-dialog" role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="session-compensation-title" aria-describedby="session-compensation-description" tabIndex="-1" onSubmit={submit} noValidate>
      <header>
        <span className="session-compensation-icon"><Clock3 /><i aria-hidden="true">+</i></span>
        <div><small>معالجة وقت الشركة</small><h2 id="session-compensation-title">إضافة وقت تعويضي</h2><p id="session-compensation-description">أضف وقت التأخير الذي تسببت فيه الشركة ليُخصم فورًا من مؤقت العميل.</p></div>
        <button data-dialog-initial type="button" className="session-compensation-close" onClick={close} disabled={busy} aria-label="إغلاق نافذة الوقت التعويضي"><X /></button>
      </header>

      <dl className="session-compensation-context"><div><dt>العميل</dt><dd>{session.client_name || '—'}</dd></div><div><dt>الباقة / الخدمة</dt><dd>{session.package_name || session.service || '—'}</dd></div></dl>

      <div className="session-compensation-body">
        <DurationHoursMinutesInput idPrefix="session-compensation" label="الوقت الإضافي الآن" value={minutes} valueUnit="minutes" minMinutes={0} required error={durationError} disabled={busy} onChange={value => { setMinutes(value); setError(''); }} />

        <section className="session-compensation-calculation" aria-live="polite" aria-label="حساب المؤقت قبل وبعد التعويض">
          <div><span>الوقت المنقضي</span><strong dir="ltr">{formatElapsedTime(gross)}</strong></div>
          <div><span>التعويض المسجل</span><strong dir="ltr">{formatElapsedTime(current)}</strong></div>
          <div className={`result ${durationError ? 'is-invalid' : ''}`}><span>{durationError ? 'المؤقت بعد الإضافة — راجع الوقت' : 'المؤقت بعد الإضافة'}</span><strong dir="ltr">{formatElapsedTime(net)}</strong></div>
        </section>

        <label className="session-compensation-reason" htmlFor="session-compensation-reason"><span>السبب الداخلي <small>يظهر للإدارة فقط</small></span><textarea id="session-compensation-reason" rows="2" minLength="5" maxLength="500" required value={reason} disabled={busy} aria-invalid={Boolean(reasonError)} aria-describedby={`session-compensation-reason-help${reasonError ? ' session-compensation-reason-error' : ''}`} onChange={event => { setReason(event.target.value); setError(''); }} placeholder="مثال: تأخر تجهيز إضاءة الشركة" /><small id="session-compensation-reason-help" className="session-compensation-reason-help">الحد الأدنى 5 أحرف · {reason.trim().length}/500</small>{reasonError && <small id="session-compensation-reason-error" className="session-compensation-field-error" role="alert">{reasonError}</small>}</label>
        <div className="session-compensation-note"><ShieldCheck /><p><strong>وقت مجاني بالكامل</strong><span>لن يُخصم هذا الوقت من رصيد باقة العميل، ولن يظهر له السبب الداخلي.</span></p></div>
        {error && <div className="session-compensation-error" role="alert">{error}</div>}
      </div>

      <footer><button type="button" onClick={close} disabled={busy}>إلغاء</button><button className="primary" type="submit" disabled={busy || !valid} aria-describedby={!valid ? 'session-compensation-submit-help' : undefined}>{busy ? <LoaderCircle className="is-spinning" /> : <HandHeart />}{busy ? 'جارٍ الاعتماد…' : 'اعتماد وخصم الوقت'}</button>{!valid && <span id="session-compensation-submit-help" className="session-compensation-submit-help">صحّح حقول الوقت والسبب الموضحة أعلاه للمتابعة.</span>}</footer>
    </form>
  </div>;
}
