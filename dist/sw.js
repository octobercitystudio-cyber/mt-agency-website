const APP_ORIGIN = self.location.origin;
const DEFAULT_URL = '/login?source=android-notification';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const pushPayload = event => {
  if (!event.data) return {};
  try { return event.data.json() || {}; }
  catch { return { notification: { body: event.data.text() } }; }
};

self.addEventListener('push', event => {
  const payload = pushPayload(event);
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'MT Agency';
  const body = notification.body || data.body || 'لديك تحديث جديد في حسابك.';
  const destination = data.url || notification.click_action || DEFAULT_URL;
  const options = {
    body,
    icon: '/app-icon.svg',
    badge: '/app-icon-monochrome.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: data.notification_id ? `mt-notification-${data.notification_id}` : undefined,
    renotify: false,
    data: { url: destination },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || DEFAULT_URL, APP_ORIGIN).href;
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
