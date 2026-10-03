import { CLIENT_ACTIONS, CLIENT_SCREENS } from './clientAnalytics.js';

const eventNames = new Set(['PageView', 'ClientScreenViewed', 'AndroidAppDownload', 'ClientInteraction', ...Object.values(CLIENT_ACTIONS).map(item => item[1])]);
const uuidPattern = /^[a-f0-9-]{36}$/;
export function analyticsPlatform(win, doc) {
  let stored = '';
  try { stored = win.sessionStorage.getItem('mta_analytics_platform') || ''; } catch { /* Storage is optional. */ }
  const source = new URLSearchParams(win.location.search).get('source');
  const referrer = doc.referrer || '';
  const android = /^android-app:\/\/com\.multitaskagency\.app(?:\/|$)/.test(referrer) || (/Android/i.test(win.navigator.userAgent) && ['android-app', 'android-shortcut'].includes(source));
  if (android || stored === 'android_app') {
    try { win.sessionStorage.setItem('mta_analytics_platform', 'android_app'); } catch { /* Optional. */ }
    return 'android_app';
  }
  return win.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'web';
}
export function analyticsSource(location, referrer, platform) {
  if (platform !== 'web') return 'app';
  const params = new URLSearchParams(location.search);
  const utm = (params.get('utm_source') || '').toLowerCase();
  if (params.has('fbclid') || ['facebook', 'fb', 'meta'].includes(utm)) return 'facebook';
  if (['instagram', 'ig'].includes(utm)) return 'instagram';
  if (params.has('gclid') || utm === 'google') return 'google';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === location.hostname) return 'direct';
    if (/(^|\.)facebook\.com$/.test(host)) return 'facebook';
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
    if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/.test(host)) return 'search';
    return 'referral';
  } catch { return 'direct'; }
}
export function analyticsDevice(agent) {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(agent)) return 'tablet';
  return /Mobi|iPhone|Android/i.test(agent) ? 'mobile' : 'desktop';
}
export function createSiteAnalytics(win, doc) {
  const pendingKey = 'mta_analytics_pending';
  let queue = [], timer = null, retryTimer = null, inFlight = false, activeBatch = [];
  try {
    const stored = JSON.parse(win.sessionStorage.getItem(pendingKey));
    if (Array.isArray(stored)) queue = stored.filter(item => eventNames.has(item?.event?.event) && uuidPattern.test(item.event.id || '') && Number(item.event.at) > Date.now() - 86400000 && Number(item.attempt) <= 2).slice(-100);
  } catch { /* Pending events are best effort. */ }
  function persist() {
    try { win.sessionStorage.setItem(pendingKey, JSON.stringify([...activeBatch, ...queue].slice(-100))); } catch { /* Storage is optional. */ }
  }
  let memoryVisitor = null, memorySession = null;
  const platform = analyticsPlatform(win, doc);
  const device = analyticsDevice(win.navigator.userAgent);
  const newId = () => win.crypto.randomUUID();
  const read = key => { try { return JSON.parse(win.localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { win.localStorage.setItem(key, JSON.stringify(value)); } catch { /* In-memory fallback. */ } };
  function identity() {
    const now = Date.now();
    let visitor = read('mta_analytics_visitor') || memoryVisitor;
    if (!uuidPattern.test(visitor || '')) { visitor = newId(); write('mta_analytics_visitor', visitor); }
    memoryVisitor = visitor;
    const key = `mta_analytics_session_${platform}`;
    let session = read(key) || memorySession;
    if (!session || !uuidPattern.test(session.id || '') || !Number.isFinite(session.last) || now - session.last > 30 * 60 * 1000 || session.last > now) {
      session = { id: newId(), source: analyticsSource(win.location, doc.referrer, platform), last: now };
    }
    session.last = now; memorySession = session; write(key, session);
    return { visitor, session: session.id, source: session.source };
  }
  async function flush() {
    if (timer) win.clearTimeout(timer); timer = null;
    if (inFlight || !queue.length) return;
    inFlight = true;
    const batch = queue.splice(0, 20);
    activeBatch = batch; persist();
    try {
      const response = await win.fetch('/api/site-analytics/events', {
        method: 'POST', credentials: 'omit', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: batch.map(item => item.event) }),
      });
      if (!response.ok && (response.status >= 500 || response.status === 429)) throw new Error('retry');
    } catch {
      const retry = batch.filter(item => item.attempt < 2).map(item => ({ ...item, attempt: item.attempt + 1 }));
      queue = [...retry, ...queue].slice(-100);
      if (queue.length && !retryTimer) retryTimer = win.setTimeout(() => { retryTimer = null; void flush(); }, 15000);
    } finally {
      inFlight = false; activeBatch = []; persist();
      if (queue.length && !retryTimer && !timer) timer = win.setTimeout(() => { void flush(); }, 2000);
    }
  }
  function record(eventName, page, metadata = {}) {
    if (!eventNames.has(eventName)) return;
    const path = page.replace(/\/+$/, '') || '/';
    const screen = path === '/dashboard' ? new URLSearchParams(win.location.search).get('tab') || 'home' : '';
    const control = ['button','link','select','checkbox','file','submit'].includes(metadata.control) ? metadata.control : '';
    const event = { id: newId(), ...identity(), event: eventName, page: path,
      screen: path === '/dashboard' ? (CLIENT_SCREENS.includes(screen) ? screen : 'home') : '',
      control, platform, device, at: Date.now() };
    queue.push({ event, attempt: 0 });
    if (queue.length > 100) queue.shift();
    persist();
    if (queue.length >= 20) void flush();
    else if (!timer && !retryTimer) timer = win.setTimeout(() => { void flush(); }, 2000);
  }
  const hidden = () => { if (doc.visibilityState === 'hidden') void flush(); };
  doc.addEventListener('visibilitychange', hidden);
  const leaving = () => {
    persist();
    if (!queue.length) return;
    // Beacon starts during unload; persisted IDs make a later replay harmless.
    try {
      if (win.navigator.sendBeacon) {
        const body = new Blob([JSON.stringify({ events: queue.slice(0, 20).map(item => item.event) })], { type: 'application/json' });
        if (win.navigator.sendBeacon('/api/site-analytics/events', body)) return;
      }
    } catch { /* Fall back to keepalive fetch. */ }
    void flush();
  };
  win.addEventListener('pagehide', leaving);
  if (queue.length) timer = win.setTimeout(() => { void flush(); }, 500);
  return { record, flush };
}
