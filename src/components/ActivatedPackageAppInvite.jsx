import { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { CLIENT_APP_DOWNLOAD_URL } from '../data/clientApp';
import { analyticsPlatform } from '../lib/siteAnalytics';
import './ActivatedPackageAppInvite.css';

export default function ActivatedPackageAppInvite({ clientId }) {
  const dismissalKey = `mta_app_invite_dismissed:${clientId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissalKey) === '1'; } catch { return false; }
  });
  if (dismissed || analyticsPlatform(window, document) !== 'web') return null;
  const continueOnWebsite = () => {
    try { sessionStorage.setItem(dismissalKey, '1'); } catch { /* Dismissal still works without storage. */ }
    setDismissed(true);
  };
  return <aside className="activated-package-app-invite" aria-label="تطبيق MTA لباقتك المفعّلة">
    <Smartphone className="activated-package-app-invite-icon" aria-hidden="true"/>
    <p>باقتك اتفعّلت! حمّل تطبيق MTA لمتابعة مواعيدك ورصيد ساعاتك بسهولة</p>
    <div className="activated-package-app-invite-actions">
      <a href={CLIENT_APP_DOWNLOAD_URL} download><Download aria-hidden="true"/>تحميل التطبيق للأندرويد</a>
      <button type="button" onClick={continueOnWebsite}>كمّل من الموقع</button>
    </div>
  </aside>;
}
