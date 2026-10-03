import { createSiteAnalytics } from '../lib/siteAnalytics';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { CLIENT_APP_DOWNLOAD_URL } from '../data/clientApp';
import { createMetaPixelTracker } from '../lib/metaPixel';
import { CLIENT_ANALYTICS_EVENT } from '../lib/clientAnalytics';

let tracker;
let siteAnalytics;
export default function MetaPixelTracker() {
  const { pathname, search } = useLocation();
  const { currentUser } = useData();
  const role = currentUser?.role;
  const screen = new URLSearchParams(search).get('tab') || 'home';
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    siteAnalytics ||= createSiteAnalytics(window, document);
    tracker ||= createMetaPixelTracker(window, document, siteAnalytics.record);
    // Blocked analytics must not break login, navigation or booking.
    const safely = callback => { try { callback(); } catch { /* Optional analytics. */ } };
    safely(() => { tracker.page(pathname, role); tracker.screen(pathname, role, screen); });
    const onAction = event => safely(() => tracker.action(pathname, role, event.detail?.action));
    const onClick = event => safely(() => {
      const control = event.target.closest?.('a[href],button,[role="button"]');
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
      const anchor = control.matches('a[href]') ? control : null;
      if (anchor) {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname === CLIENT_APP_DOWNLOAD_URL) {
          tracker.download(pathname, role); return;
        }
        if (anchor.closest('.client-drive-delivery')) tracker.action(pathname, role, 'delivery_open');
        if (url.hostname === 'wa.me' || url.protocol === 'tel:') tracker.action(pathname, role, 'support');
      }
      const giftActions = { 'promotion-gift-launcher': 'gift_open', 'promotion-gift-close': 'gift_close', 'promotion-gift-action': 'gift_details' };
      for (const [className, action] of Object.entries(giftActions)) if (control.classList.contains(className)) tracker.action(pathname, role, action);
      tracker.interaction(pathname, role, screen, anchor ? 'link' : 'button');
    });
    const onChange = event => safely(() => {
      const target = event.target;
      const kind = target.tagName === 'SELECT' ? 'select' : target.type;
      if (['select', 'checkbox', 'file'].includes(kind)) tracker.interaction(pathname, role, screen, kind);
    });
    const onSubmit = () => safely(() => {
      if (pathname === '/login') tracker.action(pathname, role, 'login_attempt');
      else if (pathname === '/register') tracker.action(pathname, role, 'registration_attempt');
      else tracker.interaction(pathname, role, screen, 'submit');
    });
    window.addEventListener(CLIENT_ANALYTICS_EVENT, onAction);
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      window.removeEventListener(CLIENT_ANALYTICS_EVENT, onAction);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [pathname, role, screen]);
  return null;
}
