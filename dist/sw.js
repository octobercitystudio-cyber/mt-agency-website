const APP_ORIGIN = self.location.origin;
const DEFAULT_URL = '/login?source=android-notification';

const normalizeDestination = value => {
  try {
    const target = new URL(value || DEFAULT_URL, APP_ORIGIN);
    if (target.origin === APP_ORIGIN && target.pathname === '/dashboard' && target.searchParams.get('tab') === 'montage') {
      target.searchParams.set('tab', 'videos');
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return DEFAULT_URL; }
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const pushPayload = event => {
  if (!event.data) return {};
  try { return event.data.json() || {}; }
  catch { return { notification: { body: event.data.text() } }; }
};

const badgeCount = value => Math.max(1, Math.min(999, Math.trunc(Number(value) || 1)));

const updateBadgeAndClients = async count => {
  try {
    if (typeof self.navigator?.setAppBadge === 'function') await self.navigator.setAppBadge(count);
  } catch { /* Android launchers can manage the badge from active notifications instead. */ }
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(client => client.postMessage({ type: 'MT_PUSH_BADGE', unread_count: count }));
};

self.addEventListener('push', event => {
  const payload = pushPayload(event);
  const data = payload.data || {};
  const notification = payload.notification || {};
  const unreadCount = badgeCount(data.unread_count);
  const title = notification.title || data.title || 'MT Agency';
  const body = notification.body || data.body || 'لديك تحديث جديد في حسابك.';
  const destination = normalizeDestination(data.url || notification.click_action || DEFAULT_URL);
  const options = {
    body,
    icon: '/app-icon.svg',
    badge: '/app-icon-monochrome.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: data.notification_id ? `mt-notification-${data.notification_id}` : `mt-notification-${Date.now()}`,
    renotify: true,
    silent: false,
    vibrate: [220, 100, 220],
    data: { url: destination },
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    updateBadgeAndClients(unreadCount),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(normalizeDestination(event.notification.data?.url || DEFAULT_URL), APP_ORIGIN).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== APP_ORIGIN) continue;
      await client.navigate(target);
      return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
