import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpCircle, StopCircle } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import ERPStopSessionDialog from './ERPStopSessionDialog';
import PackageUpgradeDialog from './PackageUpgradeDialog';
import { canRoleCompleteStudioSession } from './studioSessionPermissions';
import { elapsedSessionSeconds, formatElapsedTime } from './studioSessionDuration';

export default function ERPSessionTimer({ role }) {
  const [sessions, setSessions] = useState([]);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState(null);
  const [upgradePackageId, setUpgradePackageId] = useState(null);
  const stopButtonRef = useRef(null);
  const upgradeButtonRef = useRef(null);

  const loadSessions = useCallback(async () => {
    if (typeof dataClient.request !== 'function') return;
    const { data, error: requestError } = await dataClient.request('/studio-sessions/active', { method: 'GET' });
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
  const canUpgrade = role === 'owner' && Boolean(active?.client_package_id);
  const hasActions = canUpgrade || canComplete;
  const elapsed = useMemo(() => active
    ? elapsedSessionSeconds(active, now, serverOffset)
    : 0, [active, now, serverOffset]);

  if (!active) return null;

  return <>
    <aside className={`erp-live-session ${hasActions ? 'erp-live-session--has-actions' : ''}`} aria-live="polite">
      <span className="erp-live-session__pulse" aria-hidden="true" />
      <div className="erp-live-session__identity">
        <small>تصوير جارٍ الآن</small>
        <strong>{active.client_name}</strong>
        <span>{active.service}</span>
      </div>
      <time dir="ltr">{formatElapsedTime(elapsed)}</time>
      {sessions.length > 1 && <span className="erp-live-session__count">+{sessions.length - 1}</span>}
      {hasActions && <div className="erp-live-session__actions">
        {canUpgrade && <button ref={upgradeButtonRef} className="erp-live-session__upgrade" type="button" aria-label="ترقية الباقة" title="ترقية الباقة" onClick={() => setUpgradePackageId(active.client_package_id)}><ArrowUpCircle aria-hidden="true" /><span className="erp-live-session__action-label">ترقية الباقة</span></button>}
        {canComplete && <button ref={stopButtonRef} className="erp-live-session__stop" type="button" aria-label="إيقاف التصوير" title="إيقاف التصوير" onClick={() => setSelected(active)}><StopCircle aria-hidden="true" /><span className="erp-live-session__action-label">إيقاف التصوير</span></button>}
      </div>}
    </aside>
    {canComplete && <ERPStopSessionDialog role={role} session={selected} serverOffset={serverOffset} returnFocusRef={stopButtonRef} onClose={() => setSelected(null)} onCompleted={loadSessions} />}
    {role === 'owner' && upgradePackageId && <PackageUpgradeDialog packageId={upgradePackageId} sessionActive returnFocusRef={upgradeButtonRef} onClose={() => setUpgradePackageId(null)} onCompleted={async () => { await loadSessions(); window.dispatchEvent(new CustomEvent('erpDataChanged', { detail: { topics: ['client_packages', 'clients'] } })); }} />}
  </>;
}
