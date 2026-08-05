import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Save, StopCircle, X } from 'lucide-react';
import { dataProvider, supabase } from '../supabaseClient';
import useChangeSync from '../hooks/useChangeSync';

const displayTime = (seconds) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return [hours, minutes, secs].map(part => String(part).padStart(2, '0')).join(':');
};

export default function ERPSessionTimer() {
  const [sessions, setSessions] = useState([]);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState(null);
  const [actualHours, setActualHours] = useState('');
  const [actualMinutes, setActualMinutes] = useState('');
  const [actualReels, setActualReels] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = useCallback(async () => {
    if (dataProvider !== 'hostinger' || typeof supabase.request !== 'function') return;
    const { data, error: requestError } = await supabase.request('/studio-sessions/active', { method: 'GET' });
    if (requestError) return;
    setSessions(data?.items || []);
    if (data?.server_now) setServerOffset(new Date(data.server_now).getTime() - Date.now());
  }, []);

  useEffect(() => { const timer = window.setTimeout(loadSessions, 0); return () => window.clearTimeout(timer); }, [loadSessions]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useChangeSync(useCallback((topics) => {
    if (topics.includes('bookings')) loadSessions();
  }, [loadSessions]));

  const active = sessions[0] || null;
  const elapsed = useMemo(() => active
    ? Math.max(0, Math.floor(((now + serverOffset) - new Date(active.started_at).getTime()) / 1000))
    : 0, [active, now, serverOffset]);

  const openComplete = (session) => {
    const seconds = Math.max(0, Math.floor(((Date.now() + serverOffset) - new Date(session.started_at).getTime()) / 1000));
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    setSelected(session);
    setActualHours(String(Math.floor(minutes / 60)));
    setActualMinutes(String(minutes % 60));
    setActualReels('');
    setReason('');
    setError('');
  };

  const complete = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const reels = Number(actualReels || 0);
    const hours = Math.max(0, Math.floor(Number(actualHours || 0)));
    const minutes = Math.max(0, Math.floor(Number(actualMinutes || 0)));
    const totalMinutes = (hours * 60) + minutes;
    if (minutes > 59) return setError('الدقائق يجب أن تكون من 0 إلى 59.');
    if (totalMinutes < 1) return setError('حدد مدة التصوير الفعلية قبل الحفظ.');
    if (selected.billing_unit === 'reel' && reels <= 0) return setError('أدخل عدد الريلز التي تم تصويرها.');
    setBusy(true);
    setError('');
    const { error: requestError } = await supabase.request(`/bookings/${selected.booking_id}/session/complete`, {
      method: 'POST',
      body: JSON.stringify({ actual_minutes: totalMinutes, actual_reels: reels, reason: reason.trim() }),
    });
    setBusy(false);
    if (requestError) return setError(requestError.message || 'تعذر إنهاء الجلسة.');
    setSelected(null);
    window.dispatchEvent(new Event('erpRequestsUpdated'));
    await loadSessions();
  };

  if (dataProvider !== 'hostinger' || !active) return null;

  return <>
    <aside className="erp-live-session" aria-live="polite">
      <span className="erp-live-session__pulse" />
      <div className="erp-live-session__identity">
        <small>تصوير جارٍ الآن</small>
        <strong>{active.client_name}</strong>
        <span>{active.service}</span>
      </div>
      <time dir="ltr">{displayTime(elapsed)}</time>
      {sessions.length > 1 && <span className="erp-live-session__count">+{sessions.length - 1}</span>}
      <button type="button" onClick={() => openComplete(active)}><StopCircle /> إنهاء الجلسة</button>
    </aside>

    {selected && <div className="erp-modal-overlay erp-session-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelected(null); }}>
      <form className="erp-session-dialog" onSubmit={complete} role="dialog" aria-modal="true" aria-labelledby="complete-session-title">
        <button type="button" className="erp-session-dialog__close" onClick={() => setSelected(null)} aria-label="إغلاق"><X /></button>
        <span className="erp-session-dialog__icon"><Clock3 /></span>
        <h3 id="complete-session-title">إنهاء جلسة {selected.client_name}</h3>
        <p>سيتم تحديث رصيد الباقة وداش بورد العميل فور الحفظ.</p>
        <div className="erp-session-dialog__time"><label>الساعات الفعلية<input type="number" min="0" step="1" required value={actualHours} onChange={event => setActualHours(event.target.value)} /></label><label>الدقائق الفعلية<input type="number" min="0" max="59" step="1" required value={actualMinutes} onChange={event => setActualMinutes(event.target.value)} /></label></div>
        {selected.billing_unit === 'reel' && <label>عدد الريلز المصورة<input type="number" min="1" step="1" required value={actualReels} onChange={event => setActualReels(event.target.value)} /></label>}
        <label>سبب التعديل على الوقت <small>(اختياري)</small><textarea rows="2" value={reason} onChange={event => setReason(event.target.value)} placeholder="يسجل في سجل المراجعة" /></label>
        <div className="erp-session-dialog__rule"><AlertTriangle /> ستُحفظ المدة التي تحددها أنت كما هي، ويمكن أن تكون أقل من ساعة.</div>
        {error && <p className="erp-session-dialog__error">{error}</p>}
        <div className="erp-session-dialog__actions"><button type="button" onClick={() => setSelected(null)} disabled={busy}>استكمال التصوير</button><button type="submit" disabled={busy}><Save /> {busy ? 'جارٍ الحفظ...' : 'حفظ وإنهاء'}</button></div>
      </form>
    </div>}
  </>;
}
