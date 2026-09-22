const CLIENT_TABS = ['home', 'schedule', 'packages', 'finance', 'offers', 'videos', 'security', 'requests', 'projects', 'history', 'book-studio'];

// Only client dashboard routes may survive a login or registration redirect.
export function safeClientDestination(search, origin) {
  const requested = new URLSearchParams(search).get('returnTo');
  if (!requested) return '/dashboard';
  try {
    const url = new URL(requested, origin);
    const rawTab = url.searchParams.get('tab') || 'home';
    const tab = rawTab === 'montage' ? 'videos' : rawTab;
    if (url.origin !== origin || url.pathname !== '/dashboard' || !CLIENT_TABS.includes(tab)) return '/dashboard';
    if (rawTab === 'montage') url.searchParams.set('tab', 'videos');
    return `${url.pathname}${url.search}`;
  } catch { return '/dashboard'; }
}

export function clientAuthPath(path, destination) {
  return destination === '/dashboard' ? path : `${path}?returnTo=${encodeURIComponent(destination)}`;
}
