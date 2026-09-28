import { Download } from 'lucide-react';
import './ClientAppDownload.css';

export default function ClientAppDownload() {
  return <div className="client-app-download">
    <a className="client-app-download-link" href="/downloads/MTA-1.0.6.apk" download>
      <span className="client-app-download-icon" aria-hidden="true"><Download /></span>
      <span>حمّل تطبيق <bdi>MTA</bdi> لحجز موعد تصوير للأندرويد</span>
    </a>
  </div>;
}
