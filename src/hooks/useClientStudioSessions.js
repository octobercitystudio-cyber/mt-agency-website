import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import useChangeSync from './useChangeSync';
import { clientSessionMap, normalizeClientStudioSessions, sessionServerOffset } from '../pages/clientStudioSessions';

const SESSION_TOPICS = new Set(['bookings', 'booking_sessions', 'studio_sessions', 'sessions']);

export default function useClientStudioSessions({ enabled = true, localPreview = false } = {}) {
  const [sessions, setSessions] = useState([]);
  const [serverOffset, setServerOffset] = useState(0);
  const [refreshError, setRefreshError] = useState(false);
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++requestSequence.current;
    const requestedAt = Date.now();
    const { data, error } = await supabase.request('/studio-sessions/active', { method: 'GET' });
    if (!mounted.current || sequence !== requestSequence.current) return;
    if (error) {
      // A temporary failure must not make a real, running session disappear.
      setRefreshError(true);
      return;
    }
    setSessions(normalizeClientStudioSessions(data));
    setServerOffset(sessionServerOffset(data?.server_now, Math.round((requestedAt + Date.now()) / 2)));
    setRefreshError(false);
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return undefined;
    const initialTimer = window.setTimeout(refresh, 0);
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onSessionChanged = () => refresh();
    const onStorage = event => {
      if (!event.key || event.key === 'mt_agency_erp_demo_v12') refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('erpSessionChanged', onSessionChanged);
    window.addEventListener('demoDataChanged', onSessionChanged);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    const previewTimer = localPreview ? window.setInterval(refresh, 5000) : null;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      window.clearTimeout(initialTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('erpSessionChanged', onSessionChanged);
      window.removeEventListener('demoDataChanged', onSessionChanged);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (previewTimer) window.clearInterval(previewTimer);
    };
  }, [enabled, localPreview, refresh]);

  useChangeSync(useCallback(topics => {
    if (topics.some(topic => SESSION_TOPICS.has(topic))) refresh();
  }, [refresh]), enabled && !localPreview);

  const byBookingId = useMemo(() => clientSessionMap(sessions), [sessions]);
  return { sessions, byBookingId, serverOffset, refresh, refreshError };
}
