import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { CLIENT_APP_DOWNLOAD_URL } from '../data/clientApp';
import { createMetaPixelTracker } from '../lib/metaPixel';

let tracker;
export default function MetaPixelTracker() {
  const { pathname } = useLocation();
  const { currentUser } = useData();
  const role = currentUser?.role;
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    tracker ||= createMetaPixelTracker(window, document);
    tracker.page(pathname, role);
    const onDownload = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === CLIENT_APP_DOWNLOAD_URL) tracker.download(pathname, role);
    };
    document.addEventListener('click', onDownload, true);
    return () => document.removeEventListener('click', onDownload, true);
  }, [pathname, role]);
  return null;
}
