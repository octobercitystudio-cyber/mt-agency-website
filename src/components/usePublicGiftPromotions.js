import { useEffect, useState } from 'react';
import { promotionApi } from '../lib/promotionApi';
import { clientOfferServerOffset } from '../lib/clientOfferAdapter';

export default function usePublicGiftPromotions() {
  const [feed, setFeed] = useState({ items: [], serverOffset: 0 });
  useEffect(() => {
    let disposed = false;
    let request;
    const refresh = async () => {
      if (document.hidden) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const data = await promotionApi.public(controller.signal);
        if (disposed || controller.signal.aborted) return;
        setFeed({ items: Array.isArray(data?.items) ? data.items : [], serverOffset: clientOfferServerOffset(data?.server_now) });
      } catch {
        // Optional campaign discovery never blocks registration or displays stale offers.
        if (!disposed && !controller.signal.aborted) setFeed({ items: [], serverOffset: 0 });
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      request?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return feed;
}
