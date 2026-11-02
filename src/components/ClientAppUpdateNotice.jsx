import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useData } from '../store/DataContext';
import { authAudience } from '../lib/authAudience';
import { CLIENT_APP_DOWNLOAD_URL, CLIENT_APP_VERSION } from '../data/clientApp';
import { CLIENT_APP_ENTRY_KEY, CLIENT_APP_UPDATE_SNOOZE_KEY, CLIENT_APP_UPDATE_SNOOZE_MS, clientAppEntry, clientAppVersionStatus, installedClientVersion, updateSnoozed } from '../lib/clientAppUpdate';
import './ClientAppUpdateNotice.css';

const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
const write = (storage, key, value) => { try { window[storage].setItem(key, value); } catch { /* Storage is optional. */ } };
const isAppEntry = () => clientAppEntry({ search: window.location.search, referrer: document.referrer, userAgent: navigator.userAgent, remembered: read('sessionStorage', CLIENT_APP_ENTRY_KEY) === '1' });

export default function ClientAppUpdateNotice() {
  const location = useLocation();
  const { currentUser } = useData();
  const inApp = isAppEntry();
  const [status, setStatus] = useState('checking');
  const [snoozed, setSnoozed] = useState(() => updateSnoozed(read('localStorage', CLIENT_APP_UPDATE_SNOOZE_KEY)));
  const clientSurface = authAudience(location.pathname) === 'client'
    && /^\/(login|register|dashboard|change-password|reset-password)(\/|$)/.test(location.pathname)
    && (!currentUser || ['client', 'applicant'].includes(currentUser.role));

  useEffect(() => {
    write('sessionStorage', CLIENT_APP_ENTRY_KEY, inApp ? '1' : '0');
  }, [inApp]);

  useEffect(() => {
    if (!inApp || !clientSurface) return undefined;
    let cancelled = false;
    let request = 0;
    const check = async () => {
      const currentRequest = ++request;
      setSnoozed(updateSnoozed(read('localStorage', CLIENT_APP_UPDATE_SNOOZE_KEY)));
      const version = await installedClientVersion(navigator);
      if (!cancelled && request === currentRequest) setStatus(clientAppVersionStatus(version));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [inApp, clientSurface]);

  if (!inApp || !clientSurface || snoozed || status === 'checking' || status === 'current') return null;
  const later = () => {
    write('localStorage', CLIENT_APP_UPDATE_SNOOZE_KEY, String(Date.now() + CLIENT_APP_UPDATE_SNOOZE_MS));
    setSnoozed(true);
  };

  return <section className="client-app-update" dir="rtl" aria-label="تحديث تطبيق العميل">
    <div className="client-app-update__copy" role="status">
      <strong>{status === 'outdated' ? 'يوجد تحديث جديد لتطبيق MTA' : 'الإصدار الجديد من تطبيق MTA متاح للتحميل'}</strong>
      <p>الإصدار <bdi>{CLIENT_APP_VERSION}</bdi> باللوجو والألوان الجديدة. حمّل الملف وافتحه لتحديث التطبيق الحالي مع الاحتفاظ بحسابك.</p>
    </div>
    <div className="client-app-update__actions">
      <a href={CLIENT_APP_DOWNLOAD_URL} download><Download aria-hidden="true" />تحميل التحديث</a>
      <button type="button" onClick={later}>ذكّرني لاحقًا</button>
    </div>
  </section>;
}
