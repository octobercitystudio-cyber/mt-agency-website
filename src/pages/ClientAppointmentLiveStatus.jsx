import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { elapsedSessionSeconds, formatElapsedTime } from '../erp/studioSessionDuration';

export default function ClientAppointmentLiveStatus({ session, serverOffset = 0, compact = false }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!session) return undefined;
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, [session]);

  if (!session) return null;
  const elapsed = elapsedSessionSeconds(session, now, serverOffset);
  const [hours, minutes, seconds] = formatElapsedTime(elapsed).split(':');

  return <section className={`client-appointment-live${compact ? ' client-appointment-live--compact' : ''}`} aria-label="حالة جلسة التصوير الحالية">
    <div className="client-appointment-live__status" role="status" aria-live="polite">
      <span className="client-appointment-live__dot" aria-hidden="true" />
      <Radio aria-hidden="true" />
      <strong>جاري التصوير</strong>
    </div>
    <time
      className="client-appointment-live__timer"
      dateTime={`PT${Math.floor(elapsed / 3600)}H${Math.floor((elapsed % 3600) / 60)}M${elapsed % 60}S`}
      role="timer"
      aria-label={`الوقت المحتسب ${Number(hours)} ساعة و${Number(minutes)} دقيقة و${Number(seconds)} ثانية`}
    >
      <span><b>{hours}</b><small>ساعة</small></span>
      <i aria-hidden="true">:</i>
      <span><b>{minutes}</b><small>دقيقة</small></span>
      <i aria-hidden="true">:</i>
      <span><b>{seconds}</b><small>ثانية</small></span>
    </time>
    <p>يُحدّث تلقائيًا</p>
  </section>;
}
