import { Download } from 'lucide-react';
import { CLIENT_APP_DOWNLOAD_URL } from '../data/clientApp';
import './ClientAppDownload.css';

export default function ClientAppDownload() {
  return <div className="client-app-download">
    <a className="client-app-download-link" href={CLIENT_APP_DOWNLOAD_URL} download>
      <span className="client-app-download-icon" aria-hidden="true"><Download /></span>
      <span>تحميل تطبيق <bdi>MTA</bdi> للأندرويد</span>
    </a>
    <p className="client-app-download-hint">كل تفاصيل الباقات والأسعار متاحة داخل تطبيق MTA. حمّل التطبيق لحجز باقتك ومواعيد تصويرك ومتابعة حسابك.</p>
  </div>;
}
