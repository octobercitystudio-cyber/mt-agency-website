import { CLIENT_ACTIONS, CLIENT_SCREENS } from './clientAnalytics.js';
export const META_PIXEL_ID = '5160222017450381';
export const META_PIXEL_SCRIPT = 'https://connect.facebook.net/en_US/fbevents.js';

export function isPixelPage(pathname, role) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/dashboard') return role === 'client';
  if (['/login', '/register'].includes(path)) return true;
  return /^(?:\/(?:ar|en))?(?:\/(?:about|portfolio|studios|contact|services(?:\/[a-z0-9-]+)?))?$/.test(path === '/' ? '' : path);
}

// No advanced matching or form-field collection. Track only explicitly selected events.
export function createMetaPixelTracker(win, doc, record = () => {}) {
  let initialized = false;
  let lastPage = null;
  let lastScreen = null;
  function initialize() {
    if (initialized) return;
    if (!win.fbq) {
      const queue = function (...args) {
        if (queue.callMethod) queue.callMethod.apply(queue, args);
        else queue.queue.push(args);
      };
      win.fbq = queue;
      if (!win._fbq) win._fbq = queue;
      queue.push = queue;
      queue.loaded = true;
      queue.version = '2.0';
      queue.queue = [];
    }
    // React owns PageView dispatch; disable automatic history tracking to avoid duplicates.
    win.fbq.disablePushState = true;
    win.fbq('set', 'autoConfig', false, META_PIXEL_ID);
    win.fbq('init', META_PIXEL_ID);
    if (!doc.querySelector('script[data-mta-meta-pixel]')) {
      const script = doc.createElement('script');
      script.async = true;
      script.fetchPriority = 'low';
      script.src = META_PIXEL_SCRIPT;
      script.dataset.mtaMetaPixel = 'true';
      doc.head.appendChild(script);
    }
    initialized = true;
  }
  function send(pathname, command, event, metadata) {
    // Our dashboard receives the event independently of Meta's network availability.
    try { record(event, pathname, metadata); } catch { /* Optional first-party analytics. */ }
    try { initialize(); if (metadata) win.fbq(command, event, metadata); else win.fbq(command, event); } catch { /* Blocking Meta never blocks the app. */ }
  }
  return {
    page(pathname, role) {
      if (!isPixelPage(pathname, role)) { lastPage = null; return; }
      if (pathname === lastPage) return;
      send(pathname, 'track', 'PageView');
      lastPage = pathname;
    },
    screen(pathname, role, screen) {
      if (pathname !== '/dashboard' || role !== 'client') { lastScreen = null; return; }
      const safeScreen = CLIENT_SCREENS.includes(screen) ? screen : 'home';
      if (lastScreen === safeScreen) return;
      send(pathname, 'trackCustom', 'ClientScreenViewed', { screen: safeScreen });
      lastScreen = safeScreen;
    },
    action(pathname, role, action) {
      if (!Object.hasOwn(CLIENT_ACTIONS, action)) return;
      const auth = ['/login', '/register'].includes(pathname) && (!role || role === 'client');
      const dashboard = pathname === '/dashboard' && role === 'client';
      const authActions = ['registration', 'login', 'login_attempt', 'registration_attempt', 'login_failed', 'registration_failed', 'gift_open', 'gift_close', 'gift_details', 'support'];
      if (!dashboard && !(auth && authActions.includes(action))) return;
      send(pathname, ...CLIENT_ACTIONS[action]);
    },
    interaction(pathname, role, screen, control) {
      if (!['button', 'link', 'select', 'checkbox', 'file', 'submit'].includes(control)) return;
      if (!(pathname === '/dashboard' && role === 'client') && !(['/login', '/register'].includes(pathname) && (!role || role === 'client'))) return;
      const safeScreen = pathname === '/dashboard' ? (CLIENT_SCREENS.includes(screen) ? screen : 'home') : pathname.slice(1);
      send(pathname, 'trackCustom', 'ClientInteraction', { screen: safeScreen, control });
    },
    download(pathname, role) {
      if (!isPixelPage(pathname, role)) return;
      send(pathname, 'trackCustom', 'AndroidAppDownload', { app_name: 'MTA', platform: 'Android' });
    },
  };
}
