export const META_PIXEL_ID = '5160222017450381';
export const META_PIXEL_SCRIPT = 'https://connect.facebook.net/en_US/fbevents.js';

export function isPixelPage(pathname, role) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/dashboard') return role === 'client';
  if (['/login', '/register'].includes(path)) return true;
  return /^(?:\/(?:ar|en))?(?:\/(?:about|portfolio|studios|contact|services(?:\/[a-z0-9-]+)?))?$/.test(path === '/' ? '' : path);
}

// No advanced matching or form-field collection. Track only explicitly selected events.
export function createMetaPixelTracker(win, doc) {
  let initialized = false;
  let lastPage = null;
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
      script.src = META_PIXEL_SCRIPT;
      script.dataset.mtaMetaPixel = 'true';
      doc.head.appendChild(script);
    }
    initialized = true;
  }
  return {
    page(pathname, role) {
      if (!isPixelPage(pathname, role)) { lastPage = null; return; }
      if (pathname === lastPage) return;
      initialize();
      win.fbq('track', 'PageView');
      lastPage = pathname;
    },
    download(pathname, role) {
      if (!isPixelPage(pathname, role)) return;
      initialize();
      win.fbq('trackCustom', 'AndroidAppDownload', { app_name: 'MTA', platform: 'Android' });
    },
  };
}
