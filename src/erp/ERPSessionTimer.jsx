import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StopCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import useChangeSync from '../hooks/useChangeSync';
import ERPStopSessionDialog from './ERPStopSessionDialog';
import { canRoleCompleteStudioSession } from './studioSessionPermissions';
import { elapsedSessionSeconds, formatElapsedTime } from './studioSessionDuration';

export default function ERPSessionTimer({ role }) {
  const [sessions, setSessions] = useState([]);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState(null);
  const stopButtonRef = useRef(null);

  const loadSessions = useCallback(async () => {
    if (typeof supabase.request !== 'function') return;
    const { data, error: requestError } = await supabase.request('/studio-sessions/active', { method: 'GET' });
    if (requestError) return;
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    setSessions(items);
    if (data?.server_now) setServerOffset(new Date(data.server_now).getTime() - Date.now());
  }, []);

  useEffect(() => { const timer = window.setTimeout(loadSessions, 0); return () => window.clearTimeout(timer); }, [loadSessions]);
  useEffect(() => {
    const refresh = () => loadSessions();
    window.addEventListener('erpSessionChanged', refresh);
    return () => window.removeEventListener('erpSessionChanged', refresh);
  }, [loadSessions]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useChangeSync(useCallback((topics) => {
    if (topics.includes('bookings')) loadSessions();
  }, [loadSessions]));

  const active = sessions[0] || null;
  const canComplete = canRoleCompleteStudioSession(role);
  const elapsed = useMemo(() => active
    ? elapsedSessionSeconds(active, now, serverOffset)
    : 0, [active, now, serverOffset]);

  if (!active) return null;

  return <>
    <aside className="erp-live-session" aria-live="polite">
      <span className="erp-live-session__pulse" />
      <div className="erp-live-session__identity">
        <small>تصوير جارٍ الآن</small>
        <strong>{active.client_name}</strong>
        <span>{active.service}</span>
      </div>
      <time dir="ltr">{formatElapsedTime(elapsed)}</time>
      {sessions.length > 1 && <span className="erp-live-session__count">+{sessions.length - 1}</span>}
      {canComplete && <button ref={stopButtonRef} type="button" onClick={() => setSelected(active)}><StopCircle /> إيقاف التصوير</button>}
    </aside>
    {canComplete && <ERPStopSessionDialog role={role} session={selected} serverOffset={serverOffset} returnFocusRef={stopButtonRef} onClose={() => setSelected(null)} onCompleted={loadSessions} />}
  </>;
}
